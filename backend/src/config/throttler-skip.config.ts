import { type ExecutionContext } from '@nestjs/common';
import { type IncomingHttpHeaders } from 'node:http';
import { isSyntheticExemptPath } from '../modules/seo-control-plane/types';

interface ThrottlerRequest {
  headers: IncomingHttpHeaders;
  socket?: { remoteAddress?: string };
  method: string;
  path?: string;
  user?: { isAdmin?: boolean; level?: string | number };
  isVerifiedBot?: boolean;
  isVerifiedSyntheticProbe?: boolean;
}

/**
 * Preserve authenticated exemptions, but never infer an internal caller from
 * Express req.ip: trust proxy reconstructs it from request headers. Caddy is
 * itself a Docker peer, so a private socket address is not an internal identity.
 */
export function shouldSkipThrottling(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest<ThrottlerRequest>();

  // These flags are set by BotGuardMiddleware, not read from HTTP headers.
  if (request.isVerifiedBot === true) return true;
  if (
    request.isVerifiedSyntheticProbe === true &&
    isSyntheticExemptPath(request.method, request.path || '')
  ) {
    return true;
  }

  const user = request.user;
  if (user?.isAdmin === true || parseInt(String(user?.level), 10) >= 7) {
    return true;
  }

  // SSR calls its own process on loopback. Forwarded visitor calls still use
  // their normal rate-limit bucket, even if relayed locally by an SSR action.
  const peer = request.socket?.remoteAddress;
  const loopback =
    peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1';
  if (!loopback) return false;

  return ![
    'forwarded',
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
  ].some((header) => request.headers[header] !== undefined);
}
