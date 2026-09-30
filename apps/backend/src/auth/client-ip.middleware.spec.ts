import type { IncomingMessage, ServerResponse } from 'node:http';
import { clientIp, resolveClientIp } from './client-ip.middleware';

const request = (headers: Record<string, string | string[]>, remoteAddress?: string) =>
  ({ headers, socket: { remoteAddress } }) as unknown as IncomingMessage;

describe('client IP', () => {
  const secret = 'edge-secret-edge-secret';

  it('trusts the frontend proxy only with the shared secret', () => {
    expect(resolveClientIp(request({ 'x-mb-edge': secret, 'x-mb-client-ip': '102.89.1.2' }), secret)).toBe('102.89.1.2');
    expect(
      resolveClientIp(request({ 'x-mb-edge': 'guess', 'x-mb-client-ip': '6.6.6.6', 'x-real-ip': '102.89.1.3' }), secret),
    ).toBe('102.89.1.3');
  });

  it("uses Railway's X-Real-IP, else the last X-Forwarded-For hop, else the socket", () => {
    expect(resolveClientIp(request({ 'x-real-ip': '102.89.1.4' }), secret)).toBe('102.89.1.4');
    expect(resolveClientIp(request({ 'x-forwarded-for': '6.6.6.6, 102.89.1.5' }), secret)).toBe('102.89.1.5');
    expect(resolveClientIp(request({}, '127.0.0.1'), secret)).toBe('127.0.0.1');
  });

  it('ignores anything that is not an IP address', () => {
    expect(resolveClientIp(request({ 'x-real-ip': 'not-an-ip' }), secret)).toBeNull();
  });

  it('replaces whatever x-client-ip the client sent, and drops the proxy headers', () => {
    const req = request({ 'x-client-ip': '6.6.6.6', 'x-mb-edge': 'guess', 'x-mb-client-ip': '6.6.6.6', 'x-real-ip': '102.89.1.6' });
    const next = jest.fn();
    process.env.EDGE_PROXY_SECRET = secret;
    clientIp(req, {} as ServerResponse, next);
    expect(req.headers).toEqual({ 'x-real-ip': '102.89.1.6', 'x-client-ip': '102.89.1.6' });
    expect(next).toHaveBeenCalled();
  });
});
