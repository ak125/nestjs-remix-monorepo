import { promisify } from 'util';
import { gzip } from 'zlib';
import type { Session } from 'express-session';

/** Promisified gzip — replaces manual callback wrapping */
export const gzipAsync = promisify(gzip);

/** Shared sleep utility — replaces 6 duplicates across the codebase */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Passport 0.7 session-fixation workaround (session-store-version-independent).
 *  Passport >=0.6 calls session.regenerate() inside req.login() to harden against
 *  session fixation — but that drops the pre-login (guest cart) session and its id.
 *  This patches session.regenerate/save to no-ops *during* req.login() so the caller
 *  can regenerate + save explicitly and preserve the guest cart on login.
 *  Independent of the session-store impl: works identically with connect-redis 5
 *  (ioredis) and connect-redis 9 (node-redis) — it only touches express-session
 *  Session methods, never the Store. See PR-9e.2. */
export function promisifyLoginNoRegenerate(
  req: Express.Request,
  user: object,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session internals
    const session = req.session as any;
    const origRegenerate = session.regenerate;
    const origSave = session.save;
    session.regenerate = (cb: (err?: Error) => void) => cb();
    session.save = (cb: (err?: Error) => void) => cb();
    req.login(user as Express.User, (err: Error | null) => {
      session.regenerate = origRegenerate;
      session.save = origSave;
      if (err) reject(err);
      else resolve();
    });
  });
}

/** Promisify express session.save() */
export function promisifySessionSave(session: Session): Promise<void> {
  return new Promise((resolve, reject) => {
    session.save((err?: Error | null) => (err ? reject(err) : resolve()));
  });
}

/** Promisify express session.regenerate() */
export function promisifySessionRegenerate(session: Session): Promise<void> {
  return new Promise((resolve, reject) => {
    session.regenerate((err?: Error | null) => (err ? reject(err) : resolve()));
  });
}

/** Promisify passport req.logOut() */
export function promisifyLogout(req: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.logOut((err: Error | null) => (err ? reject(err) : resolve()));
  });
}

/** Promisify express session.destroy() — propagates Redis errors via reject(), aligned with promisifyLogout/Save/Regenerate. */
export function promisifySessionDestroy(session: Session): Promise<void> {
  return new Promise((resolve, reject) => {
    session.destroy((err?: Error | null) => (err ? reject(err) : resolve()));
  });
}
