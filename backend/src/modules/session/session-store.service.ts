import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import RedisStore from 'connect-redis';
import session from 'express-session';
import type { RequestHandler } from 'express';
import Redis from 'ioredis';
import crypto from 'crypto';
import { isReadOnlyMode } from '../../config/env-validation';

/**
 * Encapsulates the Redis-backed session store + express-session middleware.
 *
 * PR-9e.1 = NEUTRAL extraction. The implementation is UNCHANGED from the
 * previous inline wiring in `main.ts`: connect-redis@5 factory + ioredis with
 * background auto-connect (no `await connect()` → boot behavior identical).
 * `main.ts` mounts `createSessionMiddleware()` at the exact same position in
 * the middleware chain, so ordering is preserved.
 *
 * INVARIANTS PRESERVED — changing any of these = forced sign-out / session
 * loss (see plan §Synthèse):
 *  - key prefix `sess:` (connect-redis@5 default — kept implicit, as before)
 *  - cookie name `connect.sid`
 *  - default JSON serializer
 *  - `disableTouch:false` (connect-redis@5 default → rolling TTL)
 *  - `sameSite:'lax'`
 *
 * The raw store/client are NEVER exposed publicly (no `.store` getter). The
 * impl swap to connect-redis@9 + node-redis (sessions only) happens in PR-9e.2
 * behind this same surface (createSessionMiddleware / isOpen / healthCheck).
 */
@Injectable()
export class SessionStoreService implements OnApplicationShutdown {
  private readonly logger = new Logger(SessionStoreService.name);
  private readonly client: Redis;
  private readonly store: session.Store;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    // ioredis auto-connects in the background (non-blocking) — identical to the
    // previous inline construction in main.ts. No `await` here on purpose: boot
    // must not block on Redis (cf. backend.md "Non-blocking onModuleInit").
    this.client = new Redis(redisUrl);
    this.client.on('connect', () => this.logger.log('Redis connecté'));
    this.client.on('error', (err) => this.logger.error('Erreur Redis', err));

    const redisStoreFactory = RedisStore(session);
    this.store = new redisStoreFactory({
      client: this.client,
      ttl: 86400 * 30,
    });
  }

  /**
   * Builds the express-session middleware. The store + session options are
   * encapsulated here so callers never touch the raw store. SESSION_SECRET
   * resolution (fail-fast in prod, random in dev) is moved verbatim from
   * main.ts → boot behavior unchanged.
   */
  createSessionMiddleware(): RequestHandler {
    const isProd = process.env.NODE_ENV === 'production';
    const secret = this.resolveSessionSecret(isProd);
    return session({
      store: this.store,
      resave: false,
      saveUninitialized: false, // Session créée uniquement quand des données y sont écrites (login, panier)
      secret,
      name: 'connect.sid', // ✅ Nom explicite du cookie
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 jours
        sameSite: 'lax', // ✅ Compatible navigation cross-site
        secure: isProd, // HTTPS via Caddy en production
        httpOnly: true, // ✅ Protection XSS
        path: '/', // ✅ Cookie valide pour tout le site
      },
    });
  }

  /**
   * Connection state — synchronous, no I/O. For ioredis, `status === 'ready'`
   * means the client is connected and accepting commands. (PR-9e.2 maps this
   * to node-redis `isReady`.)
   */
  isOpen(): boolean {
    return this.client.status === 'ready';
  }

  /**
   * Active liveness probe against Redis (PING). Surfaces (throws) on failure
   * or timeout — never swallows. A bounded timeout is REQUIRED because ioredis
   * has no default command timeout: a PING on a half-open socket could
   * otherwise hang the readiness probe indefinitely.
   */
  async healthCheck(): Promise<void> {
    const timeoutMs = 3000;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Redis healthCheck timeout (${timeoutMs}ms)`)),
        timeoutMs,
      );
    });
    try {
      await Promise.race([this.client.ping(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Graceful shutdown: drain pending replies then close. Wired via
   * `app.enableShutdownHooks()` (main.ts). Falls back to a forced disconnect
   * if the graceful quit fails.
   */
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
    } catch (err) {
      this.logger.warn(`Redis quit() a échoué, disconnect forcé: ${err}`);
      this.client.disconnect();
    }
  }

  /**
   * SESSION_SECRET resolution — moved verbatim from main.ts (ADR-028 Option D,
   * STRIDE 03-sessions #3, ADR-043 Sprint 1 Plan F). Behavior unchanged:
   *  - PROD (RW): missing/weak secret → fatal throw.
   *  - PREPROD (NODE_ENV=production + READ_ONLY=true): a weak/missing secret
   *    still refuses to boot (a weak secret exposes all active sessions
   *    regardless of RW/RO mode).
   *  - DEV: generates a random runtime secret (sessions lost on restart).
   */
  private resolveSessionSecret(isProd: boolean): string {
    // Sécurité de session et cookies selon l'environnement.
    // ADR-028 Option D : preprod sets NODE_ENV=production but READ_ONLY=true
    // means no mutable session state to protect — SESSION_SECRET becomes
    // a soft warning instead of a hard requirement.
    const readOnly = isReadOnlyMode();
    if (isProd && !readOnly && !process.env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET requis en production');
    }

    // SECURITE: SESSION_SECRET fail-fast en non-DEV + détection placeholders.
    // Référence STRIDE 03-sessions critique #3, ADR-043 Sprint 1 Plan F.
    const sessionSecretRaw = process.env.SESSION_SECRET ?? '';
    const sessionSecretNorm = sessionSecretRaw.trim();
    const KNOWN_WEAK_PLACEHOLDERS = [
      '123',
      'changeme',
      'change-me',
      'secret',
      'mysecret',
      'insecure_dev_secret_change_me',
      'your-secret-here',
      'todo',
      'xxxxx',
    ];
    const isWeakSecret =
      !sessionSecretNorm ||
      sessionSecretNorm.length < 32 ||
      KNOWN_WEAK_PLACEHOLDERS.includes(sessionSecretNorm.toLowerCase());

    let sessionSecret = sessionSecretNorm;
    if (isWeakSecret) {
      // PROD/PREPROD: refuse de démarrer même en read-only — un secret faible
      // expose toutes les sessions actives, indépendamment du mode RW/RO.
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `SESSION_SECRET ${sessionSecretNorm ? 'FAIBLE' : 'MANQUANT'} en production. ` +
            `Génère un secret >= 32 caractères avec: openssl rand -base64 32`,
        );
      }

      // DEV: génère un secret aléatoire runtime (sessions invalidées au restart,
      // accepté en DEV). Plus jamais le hardcoded `INSECURE_DEV_SECRET_CHANGE_ME`
      // qui était identique entre toutes les instances DEV — vector de spoofing.
      sessionSecret = crypto.randomBytes(32).toString('base64');
      this.logger.warn(
        `[SECURITY] SESSION_SECRET ${sessionSecretNorm ? 'FAIBLE' : 'MANQUANT'} en DEV. ` +
          `Secret aléatoire généré (32 bytes). Sessions perdues au restart.`,
      );
      this.logger.warn(
        '[SECURITY] Pour des sessions persistantes, ajoute dans .env: ' +
          'SESSION_SECRET=$(openssl rand -base64 32)',
      );
    }

    return sessionSecret;
  }
}
