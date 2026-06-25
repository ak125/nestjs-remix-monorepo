import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  SYNTHETIC_PROBE_HEADER,
  SYNTHETIC_PROBE_SECRET_KEY,
  SYNTHETIC_PROBE_ENABLED_KEY,
  SYNTHETIC_PROBE_WINDOW_MS,
} from './types';

/** Requête minimale lisible par {@link SyntheticProbeCredentialService.verify}. */
export interface SyntheticVerifiableRequest {
  method?: string;
  path?: string;
  headers?: Record<string, unknown>;
}

/**
 * SyntheticProbeCredentialService — credential vérifiable (HMAC) prouvant qu'une
 * requête provient du crawler synthétique interne (seo-control-plane L1), SANS
 * faire confiance à l'User-Agent (spoofable).
 *
 * Pourquoi (incident 2026-06-25) : le crawler L1 sonde ses propres pages publiques
 * via Cloudflare pour mesurer la santé edge+page, mais le ThrottlerGuard global
 * (clé par IP) le 429 à 89,7 % car c'est une source mono-IP en rafale → le
 * monitoring L1 devient AVEUGLE. Ce credential permet à BotGuardMiddleware de poser
 * `req.isVerifiedSyntheticProbe`, lu par une branche `skipIf` SCOPÉE (GET + préfixes
 * catalogue publics uniquement, cf. {@link isSyntheticExemptPath}) dans app.module.
 *
 * Sécurité (issue d'un panel de conception adverse, 2026-06-25) :
 *   - HMAC-SHA256(`${method}|${pathname}|${windowCounter}`) avec un secret DÉDIÉ
 *     (≠ INTERNAL_API_KEY : compartimentation — une fuite ne touche pas les
 *     endpoints internes admin). Le SECRET ne transite JAMAIS sur le fil ; seule
 *     une signature (liée méthode+chemin+fenêtre 60 s) circule.
 *   - `timingSafeEqual` length-guardé (même primitive qu'InternalApiKeyGuard).
 *   - Fenêtre 60 s + acceptation `t` et `t-1` (skew d'horloge ; crawler et origine
 *     co-localisés sur la même machine PROD → skew ~0).
 *   - FAIL-CLOSED : kill-switch OFF, secret absent, header absent, parse error,
 *     signature invalide ou fenêtre expirée → `false` → la requête retombe sur le
 *     throttler normal. JAMAIS de fail-open vers « vérifié ».
 *   - Le least-privilege (scope GET + catalogue) est appliqué dans `skipIf`, pas ici.
 *
 * Stateless. Dépend uniquement de ConfigService. Fourni par un module @Global pour
 * être injecté à la fois par BotGuardMiddleware (verify) et SyntheticCrawlerService
 * (sign) sans dépendance circulaire.
 */
@Injectable()
export class SyntheticProbeCredentialService {
  private readonly logger = new Logger(SyntheticProbeCredentialService.name);
  private readonly secret: string;
  private readonly enabled: boolean;
  private warnedSecretMissing = false;

  constructor(private readonly config: ConfigService) {
    this.secret = this.config.get<string>(SYNTHETIC_PROBE_SECRET_KEY, '');
    this.enabled =
      this.config.get<string>(SYNTHETIC_PROBE_ENABLED_KEY, '') === 'true';
    if (this.enabled && !this.secret) {
      // Erreur de config explicite (no silent enable) : flag ON mais secret absent.
      this.logger.error(
        `${SYNTHETIC_PROBE_ENABLED_KEY}=true mais ${SYNTHETIC_PROBE_SECRET_KEY} absent — ` +
          'exemption synthétique DÉSACTIVÉE (fail-closed).',
      );
    }
  }

  /** Le credential est-il opérationnel (flag ON + secret présent) ? */
  isActive(): boolean {
    return this.enabled && this.secret.length > 0;
  }

  /** Signe une requête sortante du crawler (côté émetteur). */
  sign(method: string, pathname: string): string {
    return this.computeMac(method, pathname, this.windowCounter());
  }

  /**
   * Vérifie l'en-tête `x-synthetic-probe` d'une requête entrante (côté origine).
   * Retourne `true` SEULEMENT si la signature est valide pour la fenêtre courante
   * ou précédente. Fail-closed sur toute condition d'erreur.
   */
  verify(req: SyntheticVerifiableRequest): boolean {
    if (!this.enabled) return false;
    if (!this.secret) {
      if (!this.warnedSecretMissing) {
        this.warnedSecretMissing = true;
        this.logger.warn(
          `${SYNTHETIC_PROBE_SECRET_KEY} absent — exemption synthétique inactive (fail-closed).`,
        );
      }
      return false;
    }

    const provided = req.headers?.[SYNTHETIC_PROBE_HEADER];
    if (typeof provided !== 'string' || provided.length === 0) return false;

    const method = (req.method ?? '').toUpperCase();
    const pathname = req.path ?? '';
    const w = this.windowCounter();
    // Accepte la fenêtre courante ET la précédente (tolérance de skew d'horloge).
    return (
      this.safeEqual(provided, this.computeMac(method, pathname, w)) ||
      this.safeEqual(provided, this.computeMac(method, pathname, w - 1))
    );
  }

  private windowCounter(): number {
    return Math.floor(Date.now() / SYNTHETIC_PROBE_WINDOW_MS);
  }

  private computeMac(method: string, pathname: string, window: number): string {
    return createHmac('sha256', this.secret)
      .update(`${method.toUpperCase()}|${pathname}|${window}`)
      .digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
