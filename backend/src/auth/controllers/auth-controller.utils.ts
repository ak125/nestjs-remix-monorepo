/**
 * Shared types and helpers for auth controllers.
 */

import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: any;
}

/**
 * Extract guest session ID from cookie header (connect.sid).
 * Used for cart merge on login.
 */
export function extractGuestSessionId(
  cookieHeader: string,
): string | undefined {
  const sessionCookie = cookieHeader
    .split(';')
    .find((c: string) => c.trim().startsWith('connect.sid='));

  if (!sessionCookie) return undefined;

  try {
    const cookieValue = sessionCookie.split('=')[1];
    const decoded = decodeURIComponent(cookieValue);
    const match = decoded.match(/^s:([^.]+)\./);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}
