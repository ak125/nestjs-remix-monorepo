import { promisify } from 'util';
import { gzip } from 'zlib';

/** Promisified gzip — replaces manual callback wrapping */
export const gzipAsync = promisify(gzip);

/** Shared sleep utility — replaces 6 duplicates across the codebase */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Promisify passport req.login() */
export function promisifyLogin(req: any, user: any): Promise<void> {
  return new Promise((resolve, reject) => {
    req.login(user, (err: any) => (err ? reject(err) : resolve()));
  });
}

/** Promisify express session.save() */
export function promisifySessionSave(session: any): Promise<void> {
  return new Promise((resolve, reject) => {
    session.save((err: any) => (err ? reject(err) : resolve()));
  });
}

/** Promisify express session.regenerate() */
export function promisifySessionRegenerate(session: any): Promise<void> {
  return new Promise((resolve, reject) => {
    session.regenerate((err: any) => (err ? reject(err) : resolve()));
  });
}

/** Promisify passport req.logOut() */
export function promisifyLogout(req: any): Promise<void> {
  return new Promise((resolve, reject) => {
    req.logOut((err: any) => (err ? reject(err) : resolve()));
  });
}

/** Promisify express session.destroy() */
export function promisifySessionDestroy(session: any): Promise<void> {
  return new Promise((resolve) => {
    session.destroy(() => resolve());
  });
}
