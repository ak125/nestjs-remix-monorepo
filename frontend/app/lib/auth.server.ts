/**
 * Auth server utilities for admin authentication
 */

import { redirect } from '@remix-run/node';
import { getSession } from '~/server/session.server';

export async function requireAdminAuth(request: Request) {
  const session = await getSession(request);
  const user = session.get('user');

  if (!user || !user.level || user.level < 7) {
    throw redirect('/login');
  }

  return user;
}

export async function requireSuperAdminAuth(request: Request) {
  const session = await getSession(request);
  const user = session.get('user');

  if (!user || !user.level || user.level < 9) {
    throw redirect('/unauthorized');
  }

  return user;
}

export async function getAdminUser(request: Request) {
  const session = await getSession(request);
  return session.get('user');
}
