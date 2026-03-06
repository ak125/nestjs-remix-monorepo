/**
 * Cles publiques RSA Paybox pour verification IPN (callbacks)
 * Source: https://www.paybox.com/espace-integrateur-documentation
 *
 * Paybox signe les callbacks avec RSA + SHA-1.
 * Paybox peut changer de cle → on garde les 2 (essai sequentiel).
 */
export const PAYBOX_PUBLIC_KEYS: string[] = [
  // Cle 2048 bits (essayee en premier) — recommandee par Paybox (2025)
  // https://www.paybox.com/wp-content/uploads/2025/09/pubkey_RSA_2048.pem
  `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA16QmkNXsa4XjKqhMCF9k
L4gboAXZrpX9AXJhQFtpu65SEg7Ejht+5J7vztnZQrJ6o+Gy/N31Mj0+T/937OlO
Z/xH/SR40f93LuIYPXykoAelUWVJYe4HqLvtBKskOHBmy4KGYNB1QDtyFoYt4aSo
aBzPYJrjpoLlCqKhU4mnKxVZih4ZYvBUnrCEKt86VeTLUVlXy/xwyTNieiYGM/oV
1PpCUlVfLqA7t2GQRZTrdyUwK8zEbMfFOA5acdX1exIGV8gFnj/BUFndA0SdMhfo
EDe9RFHELMEHxmSZjwqSyX81uNoIshY5YjMtJ6puCI8q7VJnB3+9W5OUll1127pt
8wIDAQAB
-----END PUBLIC KEY-----`,
  // Cle 1024 bits (fallback historique, 2014)
  // https://www.paybox.com/wp-content/uploads/2014/03/pubkey.pem
  `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDe+hkicNP7ROHUssGNtHwiT2Ew
HFrSk/qwrcq8v5metRtTTFPE/nmzSkRnTs3GMpi57rBdxBBJW5W9cpNyGUh0jNXc
VrOSClpD5Ri2hER/GcNrxVRP7RlWOqB1C03q4QYmwjHZ+zlM4OUhCCAtSWflB4wC
Ka1g88CjFwRw/PB9kwIDAQAB
-----END PUBLIC KEY-----`,
];
