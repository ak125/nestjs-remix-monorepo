import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { RedisStore } from 'connect-redis';
import session from 'express-session';
import type { RequestHandler } from 'express';
import { createClient } from 'redis';
import crypto from 'crypto';
import { isReadOnlyMode } from '../../config/env-validation';

/** 30 days — unchanged from the connect-redis@5 baseline (PR-9e.1). */
const SESSION_TTL_SECONDS = 86400 * 30;
/**
 * connect-redis@5 used `'sess:'` as the implicit default prefix. We pass it
 * EXPLICITLY here so the swap to connect-redis@9 reads/writes the SAME keyspace
 * — changing it would orphan every existing session (forced sign-out).
 */
const SESSION_KEY_PREFIX = 'sess:';
/** Per-socket connection timeout. Bounds a single connect attempt. */
const CONNECT_TIMEOUT_MS = 5000;
/** Overall fail-fast deadline for the INITIAL boot connect (allows a couple of
 *  default-strategy retries for a slow-starting Redis, then gives up). */
const BOOT_CONNECT_DEADLINE_MS = 10000;
/** Bounded drain window on graceful shutdown before forcing destroy(). */
const SHUTDOWN_DRAIN_TIMEOUT_MS = 5000;
/** Bounded healthCheck PING (node-redis has no default command timeout). */
const HEALTHCHECK_TIMEOUT_MS = 3000;

/**
 * Encapsulates the Redis-backed session store + express-session middleware.
 *
 * PR-9e.2 = IMPLEMENTATION SWAP behind the PR-9e.1 surface
 * (`createSessionMiddleware()` / `isOpen()` / `healthCheck()`): connect-redis@9
 * (named `RedisStore`) backed by **node-redis v5** for sessions only. ioredis is
 * kept elsewhere (cache / BullMQ / OIDC / write-guard) — this service owns the
 * ONLY session client.
 *
 * WIRE-FORMAT INVARIANTS PRESERVED — changing any = forced sign-out / session
 * loss; this is what makes a rollback to the v5 image SAFE (v5 reads v9-written
 * sessions and vice-versa, proven by the bidirectional test suite):
 *  - key prefix `sess:` (now passed explicitly — == connect-redis@5 default)
 *  - default JSON serializer (omitted → JSON.parse/stringify, == v5)
 *  - `disableTouch:false` (default → rolling TTL preserved)
 *  - `disableTTL:false` (default → TTL written, == v5)
 *  - ttl 30d
 *  - cookie `connect.sid`, `sameSite:'lax'`, SESSION_SECRET fail-fast (unchanged)
 *
 * Lifecycle differs from PR-9e.1 on purpose: node-redis does NOT auto-connect,
 * so connect() is awaited fail-fast at boot (sessions are critical infra) and
 * the client is closed gracefully (drain → close → destroy) on shutdown.
 *
 * The raw store/client are NEVER exposed publicly (no `.store` getter).
 */
@Injectable()
export class SessionStoreService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SessionStoreService.name);
  private readonly client: ReturnType<typeof createClient>;
  private readonly store: session.Store;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    // node-redis v5 client. Unlike ioredis it does NOT auto-connect — connect()
    // is awaited in onApplicationBootstrap (fail-fast). The offline queue is KEPT
    // (default, NOT disableOfflineQueue) so transient post-boot blips queue during
    // reconnect instead of rejecting store.get → next(err) → site-wide 500
    // (cf. PR-9e.2 plan Affinement 1). reconnectStrategy is left at the node-redis
    // default (exponential backoff, retries indefinitely) for runtime auto-recovery.
    this.client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        keepAlive: true,
      },
    });
    // The 'error' listener MUST be attached BEFORE connect(): a node-redis client
    // with no 'error' listener re-throws socket errors as uncaught → process crash.
    this.client.on('error', (err) =>
      this.logger.error('Erreur Redis (session)', err as Error),
    );
    this.client.on('ready', () =>
      this.logger.log('Redis (session) ready — node-redis v5'),
    );

    // connect-redis@9 named export. PRESERVES the connect-redis@5 wire format:
    // SAFETY: prefix / disableTouch / disableTTL / serializer must NOT change —
    // they are the contract that lets v5 and v9 read each other's sessions.
    this.store = new RedisStore({
      client: this.client,
      prefix: SESSION_KEY_PREFIX, // == v5 default 'sess:'
      ttl: SESSION_TTL_SECONDS, // disableTouch:false (default) = rolling TTL kept
    });
  }

  /**
   * Fail-fast Redis connect. Runs after all modules init but BEFORE the HTTP port
   * binds (NestJS bootstrap phase): if Redis is unreachable at boot the app MUST
   * NOT start — sessions/auth would be silently broken (no silent fallback).
   *
   * Bounded by {@link BOOT_CONNECT_DEADLINE_MS} so a permanently-down Redis (the
   * default reconnectStrategy would otherwise retry forever) fails the boot fast
   * → process exits → Docker restarts. Intentional blocking I/O lives in
   * onApplicationBootstrap, NOT onModuleInit: the no-remote-io-in-onModuleInit
   * rule (backend.md) targets non-critical warmers, not critical session infra.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.withTimeout(
        this.client.connect(),
        BOOT_CONNECT_DEADLINE_MS,
        'redis-connect',
      );
      await this.withTimeout(
        this.client.ping(),
        HEALTHCHECK_TIMEOUT_MS,
        'redis-boot-ping',
      );
      this.logger.log(
        'Session store connecté (connect-redis@9 + node-redis v5)',
      );
    } catch (err) {
      this.logger.error(
        'Échec connexion Redis au boot — arrêt fatal (fail-fast)',
        err as Error,
      );
      // Release the half-open socket + stop the reconnect loop. Guarded:
      // destroy() throws ClientClosedError if the socket never opened — we must
      // not let that mask the original connect failure (err) we want to surface.
      try {
        this.client.destroy();
      } catch {
        // socket never opened / already destroyed — nothing to release
      }
      throw err; // fail-fast → process exits non-zero → Docker restarts
    }
  }

  /**
   * Builds the express-session middleware. The store + session options are
   * encapsulated here so callers never touch the raw store. SESSION_SECRET
   * resolution (fail-fast in prod, random in dev) is unchanged from PR-9e.1.
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
   * Connection state — synchronous, no I/O. node-redis `isReady` is true only
   * when the socket is open AND the handshake/ready handshake completed (i.e.
   * accepting commands). Distinct from `isOpen` (socket open but maybe not ready).
   */
  isOpen(): boolean {
    return this.client.isReady;
  }

  /**
   * Active liveness probe against Redis (PING). Surfaces (throws) on failure or
   * timeout — never swallows. The bounded timeout is REQUIRED because node-redis
   * has no default command timeout: a PING issued while the socket is half-open
   * (offline queue) could otherwise hang the readiness probe.
   */
  async healthCheck(): Promise<void> {
    await this.withTimeout(
      this.client.ping(),
      HEALTHCHECK_TIMEOUT_MS,
      'redis-healthcheck',
    );
  }

  /**
   * Graceful shutdown: drain pending commands (bounded), then close. The session
   * client is closed here and owns no incoming requests at this point. Falls back
   * to a forced destroy() if the graceful close drains too slowly or fails.
   */
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.withTimeout(
        this.client.close(), // node-redis v5: graceful, waits for pending commands
        SHUTDOWN_DRAIN_TIMEOUT_MS,
        'redis-close',
      );
    } catch (err) {
      this.logger.warn(
        `Redis close() (drain) a échoué/timeout — destroy forcé: ${err}`,
      );
      try {
        this.client.destroy(); // node-redis v5: immediate, rejects pending
      } catch {
        // already destroyed / never connected — nothing to release
      }
    }
  }

  /**
   * Races a promise against a bounded timeout that REJECTS (never resolves to a
   * default — surfacing the failure is the point). Uses Promise.race so the
   * loser keeps a handler attached (no unhandledRejection if it settles late).
   */
  private async withTimeout<T>(
    p: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        p,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} timeout (${ms}ms)`)),
            ms,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * SESSION_SECRET resolution — unchanged from PR-9e.1 (ADR-028 Option D,
   * STRIDE 03-sessions #3, ADR-043 Sprint 1 Plan F). Behavior:
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
