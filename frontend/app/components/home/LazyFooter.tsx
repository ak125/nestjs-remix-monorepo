/**
 * LazyFooter — footer global partagé, chargé en lazy via un **specifier
 * canonique unique** `~/components/home/Footer`.
 *
 * Pourquoi ce composant existe (cause racine du crash PROD) : `Footer` était
 * importé à la fois STATIQUEMENT (barrel `~/components/home`, dans `_index` et
 * `pieces.$slug`) et DYNAMIQUEMENT (`lazy(() => import("./components/home/Footer"))`
 * dans `root`). Ce mix statique+dynamique sous Vite 8 / Rolldown peut produire
 * un chunk dont l'`import()` dynamique se **résout avec `undefined`** →
 * `React.lazy` lit `_result.default` sur `undefined` → `TypeError: Cannot read
 * properties of undefined (reading 'default')` (crash R2 en prod).
 *
 * Correctif : TOUS les points de rendu du footer passent par CE composant
 * (donc par le MÊME specifier alias `~/components/home/Footer`), et plus aucun
 * import statique de `Footer` ne subsiste → `Footer.tsx` n'a que des importeurs
 * dynamiques → condition de mixed-chunk éliminée. La position DOM à chaque site
 * de rendu est inchangée (le `<Suspense fallback={null}>` + boundary sont
 * transparents au layout : pas de skeleton, pas de CLS).
 */

import { Suspense } from "react";
import { LazyBoundary } from "~/components/LazyBoundary";
import { safeLazy } from "~/utils/resilient-lazy";

// Specifier canonique UNIQUE — forme alias — utilisé nulle part ailleurs en
// import statique. Rolldown ne coalesce en un seul chunk dynamique que si cette
// chaîne est l'unique chemin vers Footer.tsx (vérifié par le gate build-graph).
const Footer = safeLazy(() => import("~/components/home/Footer"), {
  name: "GlobalFooter",
});

/**
 * Footer below-fold partagé. Rendu identique à un `<Footer/>` nu. Utilisé par
 * root/AppShell, `_index`, `pieces.$slug`.
 */
export function LazyFooter() {
  return (
    <LazyBoundary name="GlobalFooter">
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </LazyBoundary>
  );
}
