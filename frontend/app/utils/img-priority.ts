/**
 * Helper pour la prop `fetchpriority` sur `<img>` / `<link rel="preload">`.
 *
 * react-dom 18.3.1 ne reconnaît pas la prop `fetchPriority` (camelCase) au
 * runtime : il émet un warning "unknown prop" et n'écrit pas l'attribut sur
 * le DOM, ce qui supprime le hint LCP au navigateur. L'attribut HTML réel est
 * `fetchpriority` (lowercase). React 19 mappe correctement la version
 * camelCase ; tant que Remix 2.17 nous bloque sur React 18, on passe la prop
 * lowercase via spread pour bypasser le filtre de react-dom.
 *
 * Migration React 19 : supprimer ce fichier et remplacer
 * `{...imgPriority(x)}` par `fetchPriority={x}` (find/replace global).
 */

export type ImgPriority = "high" | "low" | "auto";

export function imgPriority(
  value?: ImgPriority,
): { fetchpriority?: ImgPriority } {
  return value ? { fetchpriority: value } : {};
}
