import { promisify } from 'util';
import { gzip } from 'zlib';
import type { Session } from 'express-session';

/** Promisified gzip — replaces manual callback wrapping */
export const gzipAsync = promisify(gzip);

/** Shared sleep utility — replaces 6 duplicates across the codebase */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Promisify passport req.login() */
export function promisifyLogin(
  req: Express.Request,
  user: object,
): Promise<void> {
  return new Promise((resolve, reject) => {
    req.login(user as Express.User, (err: Error | null) =>
      err ? reject(err) : resolve(),
    );
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

/** Promisify express session.destroy() */
export function promisifySessionDestroy(session: Session): Promise<void> {
  return new Promise((resolve) => {
    session.destroy(() => resolve());
  });
}
