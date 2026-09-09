import { type ThrottlerOptions } from '@nestjs/throttler';

/**
 * Tiers de rate-limiting appliqués à CHAQUE route de l'application.
 *
 * ⚠️ Invariant de portée — à lire avant d'ajouter un tier.
 * Un throttler nommé ici s'applique à **toutes** les routes : @nestjs/throttler
 * 6.5.0 boucle sur `this.throttlers` dans `canActivate()` sans notion de portée
 * (`throttler.guard.js:66`). Le nom d'un tier ne le restreint à rien. Le tier le
 * plus strict devient donc le plafond réel du site entier.
 *
 * Corollaire : un tier destiné à une poignée de routes doit rester
 * **non-contraignant globalement**, et sa valeur opérante être posée PAR LA ROUTE
 * via `@Throttle({ <nom du tier>: { limit, ttl } })`.
 *
 * Le bucket est par (contrôleur, handler, tier, IP) — `generateKey()` =
 * `sha256(Classe-Handler-tier-IP)` (`throttler.guard.js:148-151`). Conséquence :
 * chaque `/api/*` a son propre budget, mais TOUT le SSR (pages, `*.data`,
 * `/__manifest`) partage un seul bucket, servi par l'unique handler catch-all
 * `remix.controller.ts:160 @All('{*path}')`.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** Fenêtre de rafale — absorbe le parallélisme d'un chargement de page. */
const SHORT: ThrottlerOptions = { name: 'short', ttl: SECOND, limit: 15 };

/** Politique par défaut par minute — c'est elle qui borne la navigation. */
const MEDIUM: ThrottlerOptions = { name: 'medium', ttl: MINUTE, limit: 100 };

/** Plafond horaire — vise les sources automatisées, pas la navigation humaine. */
const LONG: ThrottlerOptions = { name: 'long', ttl: HOUR, limit: 2000 };

/**
 * Tier de portée route pour les callbacks passerelle (ADR-043 Sprint 1
 * ticket #6, STRIDE 01-paiement critique #2). Sa valeur opérante — 30/min/IP —
 * est déclarée par les 2 routes concernées, dans `payments/controllers/`.
 *
 * Sa valeur ICI est délibérément alignée sur `MEDIUM` : globalement inerte.
 * Historique : introduit à `limit: 30` par #390 (2026-05-08), ce tier a plafonné
 * le site entier à 30 req/min/IP jusqu'au 2026-09-09 — 1er 429 mesuré à la 31e
 * requête sur le catch-all alors que `medium` affichait encore 69/100 restants.
 *
 * Le tier doit rester déclaré : les deux `@Throttle({ payment_callback: … })` le
 * référencent par nom, et un override nommant un tier absent de cette liste est
 * silencieusement ignoré (`throttler.guard.js:77` lit la métadonnée sous le nom
 * du tier configuré). Garde mécanique :
 * `.ast-grep/rules/backend-throttle-key-must-match-configured-tier.yml`.
 */
const PAYMENT_CALLBACK: ThrottlerOptions = {
  name: 'payment_callback',
  ttl: MEDIUM.ttl,
  limit: MEDIUM.limit,
};

export const THROTTLER_TIERS: ThrottlerOptions[] = [
  SHORT,
  MEDIUM,
  LONG,
  PAYMENT_CALLBACK,
];
