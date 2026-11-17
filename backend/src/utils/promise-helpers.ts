import { promisify } from 'util';
import { gzip } from 'zlib';
import type { Session, SessionData } from 'express-session';

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

/**
 * Clés de session recopiées à travers une régénération. Liste fermée : la
 * régénération existe pour qu'une session posée avant la connexion ne donne
 * aucun droit après (fixation de session). Seule la provenance first-touch y
 * figure : `{ source, path, firstSeenAt }`, écrite par le serveur
 * (LandingAttributionController), sans identité ni privilège, relue par
 * orders.controller pour `___xtr_order.landing_*`. Sans cette recopie, une
 * connexion ou une inscription avant l'achat effaçait la provenance de la
 * commande, et le beacon ne la renvoie pas (une fois par onglet).
 */
const SESSION_KEYS_KEPT_ON_REGENERATE = ['landing'] as const;

/**
 * Promisify express session.regenerate().
 *
 * Prend la requête, pas la session : express-session remplace `req.session`
 * par un nouvel objet, l'ancienne référence ne permet pas d'y réécrire. La
 * valeur recopiée n'est persistée qu'au `session.save()` qui suit chez
 * l'appelant (tous les appelants sauvegardent après la connexion).
 */
export function promisifySessionRegenerate(req: {
  session: Session & Partial<SessionData>;
}): Promise<void> {
  const kept: Partial<SessionData> = {};
  for (const key of SESSION_KEYS_KEPT_ON_REGENERATE) {
    if (req.session[key] !== undefined) kept[key] = req.session[key];
  }
  return new Promise((resolve, reject) => {
    req.session.regenerate((err?: Error | null) => {
      if (err) return reject(err);
      Object.assign(req.session, kept);
      resolve();
    });
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
