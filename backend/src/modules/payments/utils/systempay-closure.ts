import { HttpStatus, type Logger } from '@nestjs/common';

/**
 * Mandat AY (2026-11-16) — fermeture par défaut des routes SystemPay/Cyberplus.
 *
 * Le certificat SystemPay est exposé dans l'historique public du dépôt :
 * quiconque le détient peut signer une confirmation acceptée par
 * `POST /api/payments/callback/cyberplus`. Tant que SYSTEMPAY_CALLBACK_ENABLED
 * ne vaut pas `true`, ces routes répondent 410 sans exploiter le corps reçu, avant
 * toute écriture (`ic_postback`, paiement, commande) et tout calcul de
 * signature.
 *
 * 410 plutôt que 403 : la route est retirée du service, quel que soit
 * l'appelant ; 403 laisserait croire qu'une autre identité serait acceptée.
 *
 * La réponse est écrite par le contrôleur lui-même : une exception
 * passerait par `GlobalErrorFilter.handle410`, qui cherche une règle de
 * redirection et enregistre la requête en base.
 *
 * Journal : nom de la route seulement, jamais le corps ni l'adresse IP.
 */
export const SYSTEMPAY_CLOSED_STATUS = HttpStatus.GONE;

export const SYSTEMPAY_CLOSED_BODY = Object.freeze({
  statusCode: HttpStatus.GONE,
  error: 'Gone',
  message: 'SystemPay is disabled on this server',
});

export function logSystemPayRouteClosed(logger: Logger, route: string): void {
  logger.warn(
    `REFUSED ${route}: SystemPay closed (SYSTEMPAY_CALLBACK_ENABLED is not "true") — 410, body ignored`,
  );
}
