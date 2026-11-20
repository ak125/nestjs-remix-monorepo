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

/**
 * Sépare un prix en partie entière et centimes, au format français
 * (ex: 54.38 → { whole: "54", cents: "38" } ; 1234.5 → { whole: "1 234", cents: "50" }).
 * Arrondi au centime le plus proche : 9.999 → { whole: "10", cents: "00" }.
 */
export function splitPrice(amount: string | number | undefined): {
  whole: string;
  cents: string;
} {
  const [whole, cents = "00"] = formatPriceNumber(amount).split(",");
  return { whole, cents };
}
