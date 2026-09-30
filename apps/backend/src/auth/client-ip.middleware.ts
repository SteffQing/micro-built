import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

// Decides the client IP once, before anything reads it, and hands it on as `x-client-ip` — the
// header better-auth's rate limiter keys on (D8). Auth requests come through the frontend's
// proxy.ts (Vercel), which vouches for the browser's IP with the shared EDGE_PROXY_SECRET; any
// other request uses Railway's X-Real-IP, else the last X-Forwarded-For hop Railway appended.
// Whatever a client sent in these headers itself is thrown away.

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function lastForwarded(value: string | string[] | undefined): string | undefined {
  const hops = (Array.isArray(value) ? value.join(',') : (value ?? '')).split(',');
  return hops.map((hop) => hop.trim()).filter(Boolean).pop();
}

function isEdge(secret: string | undefined, presented: string | undefined): boolean {
  if (!secret || !presented) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function resolveClientIp(request: IncomingMessage, edgeSecret = process.env.EDGE_PROXY_SECRET): string | null {
  const headers = request.headers;
  const candidate = isEdge(edgeSecret, first(headers['x-mb-edge']))
    ? first(headers['x-mb-client-ip'])
    : (first(headers['x-real-ip']) ?? lastForwarded(headers['x-forwarded-for']) ?? request.socket?.remoteAddress);
  const ip = candidate?.trim();
  return ip && isIP(ip) ? ip : null;
}

export function clientIp(request: IncomingMessage, _response: ServerResponse, next: () => void): void {
  const ip = resolveClientIp(request);
  const headers = request.headers;
  delete headers['x-mb-edge'];
  delete headers['x-mb-client-ip'];
  delete headers['x-client-ip'];
  if (ip) headers['x-client-ip'] = ip;
  next();
}
