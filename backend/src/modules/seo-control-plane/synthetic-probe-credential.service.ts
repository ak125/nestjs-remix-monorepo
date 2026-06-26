import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import {
  SYNTHETIC_PROBE_HEADER,
  SYNTHETIC_PROBE_SECRET_KEY,
  SYNTHETIC_PROBE_ENABLED_KEY,
  SYNTHETIC_PROBE_WINDOW_MS,
  SYNTHETIC_PROBE_EGRESS_IPS_KEY,
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
 * Défense en profondeur ({@link isExemptEgressIp}, ajout 2026-06-26) : le HMAC
 * voyage dans un en-tête custom qu'un CDN peut retirer en transit (Cloudflare ne
 * l'a PAS transmis → sonde auto-throttlée). Un PLANCHER par IP d'egress
 * (`cf-connecting-ip`, toujours transmis + anti-spoofé) rend l'exemption robuste
 * indépendamment du CDN. Même scope least-privilege, env-gated, fail-closed.
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
  /** Plancher défense-en-profondeur : allowlist d'egress de la sonde (cf. types). */
  private readonly egressAllowlist: BlockList;
  /** Nombre de règles d'egress chargées (0 → plancher inactif, fail-closed). */
  private readonly egressRuleCount: number;
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

    const egress = this.buildEgressAllowlist(
      this.config.get<string>(SYNTHETIC_PROBE_EGRESS_IPS_KEY, ''),
    );
    this.egressAllowlist = egress.list;
    this.egressRuleCount = egress.count;
    if (this.egressRuleCount > 0) {
      this.logger.log(
        `Plancher egress sonde synthétique actif (${this.egressRuleCount} entrée(s) ${SYNTHETIC_PROBE_EGRESS_IPS_KEY}).`,
      );
    }
  }

  /**
   * Construit l'allowlist d'egress (IP simples ou CIDR, v4/v6) depuis une liste
   * séparée par des virgules, via `net.BlockList` (primitive stdlib Node : aucune
   * dépendance tierce, et `check()` normalise nativement les IPv4-mapped-IPv6).
   * Chaque entrée invalide est ignorée + warn (no silent fail-open). `count` =
   * nombre d'entrées valides chargées (0 → plancher OFF / fail-closed).
   */
  private buildEgressAllowlist(raw: string): {
    list: BlockList;
    count: number;
  } {
    const list = new BlockList();
    let count = 0;
    for (const entry of raw.split(',')) {
      const trimmed = entry.trim();
      if (trimmed && this.addEgressEntry(list, trimmed)) count += 1;
    }
    return { list, count };
  }

  /**
   * Ajoute une entrée (IP simple ou CIDR, v4/v6) à la BlockList. Retourne `false`
   * si l'entrée est invalide (ignorée + warn) — `isIP` rejette une IP malformée et
   * `addSubnet`/`addAddress` lèvent sur un préfixe hors-domaine, capté ici.
   */
  private addEgressEntry(list: BlockList, entry: string): boolean {
    try {
      if (entry.includes('/')) {
        const [net, prefixRaw] = entry.split('/');
        const family = isIP(net);
        const prefix = Number(prefixRaw);
        if (family === 0 || !Number.isInteger(prefix)) {
          throw new Error('CIDR invalide');
        }
        list.addSubnet(net, prefix, family === 6 ? 'ipv6' : 'ipv4');
        return true;
      }
      const family = isIP(entry);
      if (family === 0) throw new Error('IP invalide');
      list.addAddress(entry, family === 6 ? 'ipv6' : 'ipv4');
      return true;
    } catch {
      this.logger.warn(
        `Entrée ${SYNTHETIC_PROBE_EGRESS_IPS_KEY} invalide ignorée: "${entry}".`,
      );
      return false;
    }
  }

  /**
   * Plancher défense-en-profondeur : `true` si l'IP cliente (déjà anti-spoofée par
   * BotGuard.getClientIp = `cf-connecting-ip` cru uniquement derrière le proxy
   * interne) appartient à l'allowlist d'egress de la sonde. Allowlist vide → `false`
   * (fail-closed). Le scope least-privilege (GET + catalogue public) reste appliqué
   * en aval dans `skipIf` — cette méthode ne décide QUE de l'identité, pas du scope.
   */
  isExemptEgressIp(ip: string | undefined): boolean {
    if (this.egressRuleCount === 0 || !ip) return false;
    const family = isIP(ip);
    if (family === 0) return false; // IP illisible → fail-closed
    try {
      // `BlockList.check` normalise un IPv4-mapped IPv6 (`::ffff:1.2.3.4`) et
      // n'inter-matche jamais deux familles distinctes (enforce family equality).
      return this.egressAllowlist.check(ip, family === 6 ? 'ipv6' : 'ipv4');
    } catch {
      return false;
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
