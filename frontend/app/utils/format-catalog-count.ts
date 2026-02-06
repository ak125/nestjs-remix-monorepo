/**
 * Arrondit un comptage catalogue à la dizaine de milliers inférieure et formate en français.
 * 409619 → "400 000+"
 * 442173 → "440 000+"
 */
export function formatCatalogCount(count: number | undefined): string {
  if (!count || count <= 0) return "50 000+";
  const rounded = Math.floor(count / 10000) * 10000;
  return `${rounded.toLocaleString("fr-FR")}+`;
}
