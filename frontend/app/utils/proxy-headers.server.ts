/**
 * Extract proxy headers from the original browser request
 * to forward them in internal Remix → NestJS fetch calls.
 *
 * Required for: session cookies (Secure flag), rate limiting, IP logging.
 * Without these headers, NestJS sees internal HTTP requests and refuses
 * to set Secure cookies in production (trust proxy relies on X-Forwarded-Proto).
 */
export function getProxyHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};

  const proto = request.headers.get("X-Forwarded-Proto");
  if (proto) headers["X-Forwarded-Proto"] = proto;

  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) headers["X-Forwarded-For"] = forwardedFor;

  const realIp = request.headers.get("X-Real-IP");
  if (realIp) headers["X-Real-IP"] = realIp;

  const host = request.headers.get("X-Forwarded-Host");
  if (host) headers["X-Forwarded-Host"] = host;

  return headers;
}
