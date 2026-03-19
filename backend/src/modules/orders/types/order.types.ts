/**
 * Types DB pour les tables ___xtr_order et ___xtr_customer
 *
 * Ces interfaces representent la shape reelle des lignes DB Supabase.
 * Elles remplacent les Record<string, unknown> dans les services orders.
 *
 * Note: @repo/database-types expose ZodUnknown pour ces tables,
 * donc on definit les types localement a partir des colonnes utilisees.
 */

/** Row shape de ___xtr_order (colonnes effectivement utilisees) */
export interface OrderRecord {
  ord_id: string;
  ord_cst_id: string;
  ord_ords_id: string;
  ord_is_pay: string;
  ord_total_ttc: string;
  ord_amount_ttc: string;
  ord_deposit_ttc: string;
  ord_shipping_fee_ttc: string;
  ord_date: string;
  ord_date_pay: string | null;
  ord_date_ship: string | null;
  ord_date_deliv: string | null;
  ord_tracking: string | null;
  ord_tracking_url: string | null;
  ord_cancel_date: string | null;
  ord_cancel_reason: string | null;
  ord_updated_at: string | null;
  ord_info: string | null;
  ord_parent: string;
  ord_cba_id: string | null;
  ord_cda_id: string | null;
  ord_billing_snapshot: Record<string, unknown> | null;
  ord_shipping_snapshot: Record<string, unknown> | null;
  /** Allow extra DB columns without breaking */
  [key: string]: unknown;
}

/** Row shape de ___xtr_customer (colonnes effectivement utilisees) */
export interface CustomerRecord {
  cst_id: string;
  cst_mail: string;
  cst_fname: string;
  cst_name: string;
  cst_prenom?: string;
  cst_nom?: string;
  cst_tel?: string;
  cst_gsm?: string;
  cst_address?: string;
  cst_zip_code?: string;
  cst_city?: string;
  cst_country?: string;
  /** Allow extra DB columns without breaking */
  [key: string]: unknown;
}
