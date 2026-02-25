import { z } from 'zod';

/**
 * Schema Zod pour les callbacks Cyberplus/SystemPay (BNP Paribas).
 *
 * Le webhook envoie un POST form-urlencoded — tous les champs sont des strings.
 * Au moins UN identifiant de commande et UN identifiant de transaction doivent
 * etre presents pour que le callback soit exploitable.
 *
 * Champs vads_* : protocole natif SystemPay
 * Champs sans prefixe : alias legacy / integration historique
 */
export const CyberplusCallbackSchema = z
  .object({
    // --- Champs SystemPay natifs (vads_*) ---
    vads_trans_status: z.string().optional(),
    vads_order_id: z.string().optional(),
    vads_amount: z.string().optional(),
    vads_currency: z.string().optional(),
    vads_effective_amount: z.string().optional(),
    vads_card_brand: z.string().optional(),
    vads_card_number: z.string().optional(),
    vads_auth_number: z.string().optional(),
    vads_capture_delay: z.string().optional(),
    vads_trans_date: z.string().optional(),
    vads_trans_id: z.string().optional(),
    vads_payment_config: z.string().optional(),
    vads_page_action: z.string().optional(),
    vads_site_id: z.string().optional(),
    vads_result: z.string().optional(),

    // --- Champs legacy / alias ---
    order_id: z.string().optional(),
    orderid: z.string().optional(),
    transaction_id: z.string().optional(),
    transactionid: z.string().optional(),
    status: z.string().optional(),
    statuscode: z.string().optional(),
    amount: z.string().optional(),
    payment_id: z.string().optional(),
    paymentid: z.string().optional(),
    currency: z.string().optional(),
    payment_method: z.string().optional(),
    paymentmethod: z.string().optional(),
    ip: z.string().optional(),
    ips: z.string().optional(),
    date_payment: z.string().optional(),
    datepayment: z.string().optional(),
    signature: z.string().optional(),
  })
  .catchall(z.string())
  .refine((data) => !!(data.vads_order_id || data.order_id || data.orderid), {
    message:
      'Au moins un identifiant de commande requis (vads_order_id | order_id | orderid)',
  })
  .refine(
    (data) =>
      !!(data.vads_trans_id || data.transaction_id || data.transactionid),
    {
      message:
        'Au moins un identifiant de transaction requis (vads_trans_id | transaction_id | transactionid)',
    },
  );

/**
 * Type infere du schema Zod
 */
export type CyberplusCallbackDto = z.infer<typeof CyberplusCallbackSchema>;

/**
 * Schema Zod pour la page de retour succes (POST form-urlencoded).
 */
export const PaymentSuccessReturnSchema = z
  .object({
    order_id: z.string().optional(),
    orderid: z.string().optional(),
  })
  .catchall(z.string())
  .refine((data) => !!(data.order_id || data.orderid), {
    message: 'Order ID requis (order_id | orderid)',
  });

export type PaymentSuccessReturnDto = z.infer<
  typeof PaymentSuccessReturnSchema
>;

/**
 * Schema Zod pour la page de retour erreur (POST form-urlencoded).
 */
export const PaymentErrorReturnSchema = z
  .object({
    order_id: z.string().optional(),
    orderid: z.string().optional(),
    error: z.string().optional(),
    error_message: z.string().optional(),
  })
  .catchall(z.string());

export type PaymentErrorReturnDto = z.infer<typeof PaymentErrorReturnSchema>;
