import type { ConfigService } from '@nestjs/config';

/**
 * Commande fournisseur préparée — réglages (mandat BK, 17/11/2026).
 *
 * Valeurs de départ décidées par Marwane le 17/11/2026 à 18:04 (heure de Paris).
 * Elles se changent par PR, comme les règles de vente fournisseur
 * (`pricing/config/supplier-sale-rules.ts`) : pas de variable d'environnement,
 * pas de valeur en base, une seule source versionnée et relue.
 */

/**
 * Contrôle 1 : écart maximal toléré entre le prix d'achat net relu en direct sur
 * le portail et le prix d'achat en base (`pieces_price`). Au-delà : bloqué.
 * 0.05 = 5 %. Un prix relu plus bas que la base n'est jamais bloqué.
 */
export const SEUIL_ECART_ACHAT_LIVE = 0.05;

/**
 * Contrôle 6 : plafond d'une commande fournisseur, en euros HT (prix net × quantité).
 * Au-dessus : une seconde confirmation explicite est exigée.
 */
export const PLAFOND_COMMANDE_FOURNISSEUR_HT = 300;

/**
 * Contrôle 8 : nombre de commandes préparées en essai (sans envoi), à comparer
 * à la commande passée à la main avant toute bascule. La bascule vers l'envoi
 * réel relève d'un mandat distinct.
 */
export const NOMBRE_COMMANDES_ESSAI = 10;

/**
 * Flag d'envoi réel : désactivé par défaut, strict `=== 'true'` comme
 * `SUPPLIER_TRUTH_SYNC_ENABLED`. AUCUN code d'envoi n'existe derrière : même à
 * `'true'`, la préparation reste en mode essai et le signale. Le flag n'existe
 * que pour que le second mandat (envoi réel) ait un interrupteur déjà gouverné.
 */
export const SUPPLIER_ORDER_SEND_ENABLED = 'SUPPLIER_ORDER_SEND_ENABLED';

export function isSupplierOrderSendEnabled(config: ConfigService): boolean {
  return config.get<string>(SUPPLIER_ORDER_SEND_ENABLED) === 'true';
}
