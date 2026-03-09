/**
 * Valide un paramètre redirectTo pour bloquer les open redirects.
 * Seuls les chemins internes (commençant par / mais pas //) sont acceptés.
 */
export function safeRedirect(
  to: string | null | undefined,
  fallback = "/account",
): string {
  if (!to || typeof to !== "string") return fallback;
  if (!to.startsWith("/") || to.startsWith("//")) return fallback;
  return to;
}
