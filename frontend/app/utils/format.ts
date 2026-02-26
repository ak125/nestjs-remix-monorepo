/**
 * Fonctions de formatage centralisées
 */

/**
 * Formate un prix en euros (ex: "45,99 €")
 * Accepte string, number ou undefined — retourne "0,00 €" en fallback.
 */
export function formatPrice(amount: string | number | undefined): string {
  if (!amount) return "0,00 €";

  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0,00 €";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formate un nombre avec 2 décimales sans symbole monétaire (ex: "45,99")
 */
export function formatPriceNumber(amount: string | number | undefined): string {
  if (!amount) return "0,00";

  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0,00";

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
