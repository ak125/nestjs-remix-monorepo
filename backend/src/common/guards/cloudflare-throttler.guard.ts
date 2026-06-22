import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttler guard qui clé le rate-limit sur la VRAIE IP client.
 *
 * Contexte runtime : Cloudflare → Caddy → NestJS. La clé par défaut de
 * `ThrottlerGuard` (`req.ips[0] ?? req.ip`) dépend de `trust proxy` +
 * `X-Forwarded-For`. Si le proxy forwarde l'IP du pair immédiat (edge
 * Cloudflare, partagée par des milliers de clients d'un même PoP) au lieu de
 * la vraie IP client, TOUS ces clients partagent un seul bucket → 429
 * « Trop de requêtes » sur les routes no-cache qui tapent toujours l'origine
 * (/cart, /checkout, /account, /api/*).
 *
 * Défense en profondeur (indépendante de la config Caddy) : on lit en priorité
 * `Cf-Connecting-Ip`, l'en-tête que Cloudflare positionne sur CHAQUE requête
 * avec l'IP client réelle — valeur unique (pas une liste à parser) et
 * non-spoofable côté client puisque l'origine n'accepte que des connexions
 * Cloudflare (firewall + Caddy). Hors Cloudflare (DEV / PREPROD / tests),
 * repli déterministe sur `X-Real-IP` puis la pile IP d'Express.
 *
 * Pas de fallback silencieux : la clé est toujours définie et déterministe.
 */
@Injectable()
export class CloudflareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const headers: Record<string, unknown> = req?.headers ?? {};

    // 1) Cloudflare authoritative client IP (PROD).
    const cfIp = this.firstIp(headers['cf-connecting-ip']);
    if (cfIp) return cfIp;

    // 2) X-Real-IP posé par Caddy ({client_ip}) en l'absence de CF.
    const realIp = this.firstIp(headers['x-real-ip']);
    if (realIp) return realIp;

    // 3) Repli : pile Express (respecte `trust proxy`).
    const expressIp =
      Array.isArray(req?.ips) && req.ips.length ? req.ips[0] : req?.ip;
    return typeof expressIp === 'string' && expressIp ? expressIp : 'unknown';
  }

  /** Première IP d'un en-tête, trimée. Accepte une valeur simple ou une liste. */
  private firstIp(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const first = value.split(',')[0]?.trim();
    return first ? first : undefined;
  }
}
