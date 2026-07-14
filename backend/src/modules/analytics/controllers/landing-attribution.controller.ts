/**
 * Landing Attribution Controller — first-party first-touch source capture.
 *
 * Endpoint PUBLIC :
 *   POST /api/attribution/landing — reçoit 1 ping émis via `sendBeacon` (ou
 *   `fetch keepalive`) APRÈS le chargement de la page, depuis le frontend.
 *
 * ── POURQUOI ce déport (cutover cache HTML) ─────────────────────────────────
 * L'ancien `LandingAttributionMiddleware` écrivait `req.session.landing` sur
 * CHAQUE GET HTML first-touch. Écrire la session matérialise le store même sous
 * `saveUninitialized:false` → express-session émet `Set-Cookie: connect.sid` sur
 * la réponse HTML → Cloudflare BYPASS (ne cache jamais une réponse avec cookie).
 * Résultat : tout le HTML public restait DYNAMIC. En déplaçant la capture sur un
 * POST post-chargement, le GET HTML anonyme redevient strictement sans effet de
 * bord (0 write session, 0 Set-Cookie) donc edge-cacheable. Le Set-Cookie qui
 * matérialise la session se produit désormais sur CE POST — jamais mis en cache
 * par CF (les POST ne le sont pas). Design : audit/cache-cutover-design-A-B-C.
 *
 * ── SÉMANTIQUE (inchangée vs middleware) ────────────────────────────────────
 *   - first-touch : ne JAMAIS écraser un `session.landing` déjà présent.
 *   - modèle identique : { source (enum fermé), path (pathname only), firstSeenAt }.
 *     Ce sont exactement les 3 champs lus par orders.controller (persistance
 *     `___xtr_order.landing_*`). Aucun nouveau champ (medium/campaign/referrer
 *     ne sont PAS capturés aujourd'hui — ils ne le sont toujours pas ici).
 *   - classification serveur-side depuis le body (anti-spoof `selfHost` lu du
 *     header `host`, jamais du client) — même `classifyLandingSource` que le
 *     middleware. `firstSeenAt` généré serveur (jamais l'horloge client).
 *   - skip crawlers (même `CRAWLER_RE` que l'ancien middleware) : les bots ne
 *     doivent pas matérialiser de session ni polluer l'attribution.
 *
 * Pattern mirror de `CwvBeaconController` : @HttpCode(202) fire-and-forget,
 * `safeParse` → 202 silencieux si malformé (ne jamais casser le client),
 * throttler global `CloudflareThrottlerGuard` (clé sur la vraie IP client).
 */
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { classifyLandingSource } from '../landing-source.classifier';

/** Même détection que l'ancien LandingAttributionMiddleware (defense-in-depth). */
const CRAWLER_RE =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|headlesschrome/i;

/**
 * Allowlist EXACTE des seuls params lus par le classifieur (utm_source/medium +
 * click-ids), chacun borné en taille. `.strict()` → une clé inconnue *dans*
 * `query` fait échouer le parse (202 no-op) : ce n'est PAS un objet query
 * arbitraire. Doit refléter `ATTR_QUERY_KEYS` côté client
 * (frontend/app/utils/attribution-beacon.client.ts).
 */
const AttributionQuerySchema = z
  .object({
    utm_source: z.string().max(128).optional(),
    utm_medium: z.string().max(64).optional(),
    gclid: z.string().max(256).optional(),
    gbraid: z.string().max(256).optional(),
    wbraid: z.string().max(256).optional(),
    msclkid: z.string().max(256).optional(),
  })
  .strict();

/**
 * Payload minimal & validé. `.strict()` (aux DEUX niveaux) = tout champ inconnu
 * → rejet (202 no-op). `path` : pathname only (le client envoie déjà
 * `location.pathname`) ; re-sanitisé serveur-side pour garantir l'invariant PII
 * (jamais de query string stockée).
 */
const LandingPingSchema = z
  .object({
    path: z.string().min(1).max(512),
    referer: z.string().max(2048).optional(),
    query: AttributionQuerySchema.optional(),
  })
  .strict();

@Controller('api/attribution')
export class LandingAttributionController {
  private readonly logger = new Logger(LandingAttributionController.name);

  @Post('landing')
  @HttpCode(202)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  landing(
    @Body() body: unknown,
    @Req() req: Request,
    @Headers('user-agent') ua: string | undefined,
  ): { ok: boolean } {
    try {
      // Pas de session (store indispo, cookie refusé) → no-op silencieux.
      if (!req.session) return { ok: false };

      // first-touch : ne jamais réécrire. Garde AVANT parse → un ping répété est
      // idempotent quel que soit son body (T3).
      if (req.session.landing) return { ok: true };

      // Skip crawlers (un bot ne doit pas matérialiser de session). T5.
      if (!ua || CRAWLER_RE.test(ua)) return { ok: false };

      const parsed = LandingPingSchema.safeParse(body);
      if (!parsed.success) {
        this.logger.debug(
          `landing ping rejected (schema): ${parsed.error.message}`,
        );
        return { ok: false };
      }

      // Classification serveur-side. `selfHost` = header `host` (anti-spoof :
      // le client ne peut pas forger l'hôte pour biaiser referral/direct).
      const source = classifyLandingSource({
        referer: parsed.data.referer,
        query: parsed.data.query,
        selfHost: req.get('host') ?? '',
      });

      // pathname only — jamais de query string (invariant PII, identique au
      // middleware qui stockait `req.path`).
      const path = sanitizePath(parsed.data.path);

      req.session.landing = {
        source,
        path,
        firstSeenAt: new Date().toISOString(), // horloge serveur
      };

      // Observabilité seule (pas de write DB — READ_ONLY-safe) : compte les
      // first-touch réellement enregistrés via beacon. NB: la population
      // « sessions qui envoient un beacon » ≠ la population « commandes » — ce
      // compteur n'est PAS le numérateur direct du taux
      // `attribution_capture_missing` mesuré côté orders.controller (échelles
      // distinctes, à ne pas diviser l'un par l'autre).
      this.logger.log(`[attribution_capture] event=recorded source=${source}`);

      return { ok: true };
    } catch (err) {
      // L'attribution ne doit JAMAIS casser quoi que ce soit (T6).
      this.logger.debug(`landing ping error (ignored): ${String(err)}`);
      return { ok: false };
    }
  }
}

/** Garde pathname-only : coupe query/hash, force un leading slash, borne la taille. */
function sanitizePath(raw: string): string {
  let p = raw.split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  return p.slice(0, 512);
}
