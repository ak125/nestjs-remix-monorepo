/**
 * Session management utilities
 */

import { createCookieSessionStorage } from '@remix-run/node';

// Session storage configuration
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET || 'default-secret'],
    secure: process.env.NODE_ENV === 'production',
  },
});

export async function getSession(cookieHeader: string | null) {
  return sessionStorage.getSession(cookieHeader);
}

export async function commitSession(session: any) {
  return sessionStorage.commitSession(session);
}

export async function destroySession(session: any) {
  return sessionStorage.destroySession(session);
}
