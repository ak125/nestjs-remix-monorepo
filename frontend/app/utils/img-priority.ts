/**
 * Helper pour la prop `fetchpriority` sur `<img>` / `<link rel="preload">`.
 *
 * react-dom 18.3.1 n'a pas `fetchPriority` dans son allowlist d'attributs DOM
 * connus (grep `fetchPriority` dans react-dom/cjs/* → 0 hit). Conséquence en
 * SSR + hydratation :
 *
 *   1. React émet le warning « React does not recognize the `fetchPriority`
 *      prop on a DOM element » à chaque render.
 *   2. Le passthrough générique des string-attrs sérialise quand même
 *      `fetchPriority="high"` (camelCase préservée) dans le HTML.
 *   3. Le browser parse le HTML en case-insensitive (HTML5 §13), donc
 *      l'attribut est interprété comme `fetchpriority` et le hint LCP est
 *      honoré au préload-scan.
 *
 * En clair : la fonctionnalité LCP marchait déjà ; ce helper supprime le
 * warning React + aligne la sérialisation HTML sur la spec lowercase.
 *
 * React 19 mappe correctement la version camelCase nativement ; quand Remix
 * v3 / React Router v7 débloquera la migration, supprimer ce fichier et
 * remplacer `{...imgPriority(x)}` par `fetchPriority={x}` (find/replace
 * global).
 */

export type ImgPriority = "high" | "low" | "auto";

export function imgPriority(
  value?: ImgPriority,
): { fetchpriority?: ImgPriority } {
  return value ? { fetchpriority: value } : {};
}
