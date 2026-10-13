import type { IncomingMessage } from 'node:http';

/** Where an audited request came from: the client IP clientIp() settled on and the browser, when known. */
export interface RequestOrigin {
  ip: string | null;
  userAgent: string | null;
}

const header = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || null;

export function requestOrigin(request: IncomingMessage): RequestOrigin {
  return {
    ip: header(request.headers['x-client-ip']),
    // Capped: the header is the client's to fill.
    userAgent: header(request.headers['user-agent'])?.slice(0, 300) ?? null,
  };
}
