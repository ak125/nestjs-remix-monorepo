/**
 * resilient-lazy.client — `React.lazy` durci contre l'`import()` dynamique qui
 * **résout avec `undefined`** (artefact Rolldown mixed-chunk : un module importé
 * à la fois statiquement et dynamiquement peut voir son `import()` dynamique
 * résolu sur `undefined`). React.lazy lit alors `_result.default` sur `undefined`
 * → `TypeError: Cannot read properties of undefined (reading 'default')`.
 *
 * Décision (validée red-team) : sur résolution invalide, on **observe** (balise
 * `reportChunkResolvedInvalid`) puis on **jette** pour laisser `LazyBoundary`
 * dégrader vers `null`. **PAS de retry, PAS de reload** :
 *   - retry : le registre ESM a mis en cache le namespace `undefined` → un
 *     ré-`import()` ne récupère pas, et peut re-déclencher des side-effects
 *     top-level ;
 *   - reload : l'artefact est déterministe → recharger le même graphe de chunks
 *     boucle et détruit l'état en cours (panier / formulaire) sur la page R2.
 * Le reload sur *rejet* (stale chunk après déploiement) reste géré, inchangé,
 * par `vite:preloadError` (`chunk-reload.client.ts`).
 *
 * Portée : uniquement les `lazy()` à **factory nue** (`() => import("X")`) dont
 * la valeur résolue est le namespace du module (peut être `undefined`). Les
 * lazies `.then(m => ({ default: m.X }))` résolvent un littéral objet (jamais
 * `undefined`) — hors classe de crash, non routés ici.
 */

import { type ComponentType, type LazyExoticComponent, lazy } from "react";
import { reportChunkResolvedInvalid } from "~/utils/runtime-errors.client";

/** Forme de module que `React.lazy` sait rendre. */
export type DefaultModule<T extends ComponentType<unknown>> = { default: T };

export interface SafeLazyOptions {
  /** Libellé diagnostic (balise meta + warn boundary). Aucune PII. */
  name: string;
}

/**
 * Vrai uniquement si `mod` est un namespace de module exposant un `default`
 * utilisable. Rejette explicitement le cas `undefined` (la forme exacte sur
 * laquelle le bundle live plante) + `null` + primitives + `default` absent/nul.
 */
export function isValidDefaultModule(
  mod: unknown,
): mod is DefaultModule<ComponentType<unknown>> {
  return (
    mod != null &&
    typeof mod === "object" &&
    "default" in mod &&
    (mod as { default?: unknown }).default != null
  );
}

/**
 * Cœur du loader — exporté pour être testable sans rendu React. Résout la
 * factory, valide la forme, émet la balise sur échec, puis jette. Un seul appel
 * de factory (aucun retry).
 */
export async function loadSafeModule<T extends ComponentType<unknown>>(
  factory: () => Promise<unknown>,
  opts: SafeLazyOptions,
): Promise<DefaultModule<T>> {
  let mod: unknown;
  try {
    mod = await factory();
  } catch (cause) {
    // Rejet réel (stale chunk / réseau) : observer puis re-jeter. La décision
    // de reload appartient exclusivement à `vite:preloadError`.
    reportChunkResolvedInvalid({ name: opts.name, stage: "rejected" });
    throw cause instanceof Error ? cause : new Error(String(cause));
  }
  if (isValidDefaultModule(mod)) return mod as DefaultModule<T>;
  // Résolu-avec-undefined / default manquant → observer + dégrader (pas de reload).
  reportChunkResolvedInvalid({ name: opts.name, stage: "resolved_undefined" });
  throw new Error(`[safeLazy:${opts.name}] resolved without a default export`);
}

/**
 * Drop-in pour `React.lazy` sur une factory nue. Rendu sous le `<Suspense>` de
 * l'appelant ; à protéger par `<LazyBoundary>` pour dégrader la classe
 * fulfill-with-undefined au lieu de la faire remonter à l'ErrorBoundary de route.
 */
export function safeLazy<T extends ComponentType<unknown>>(
  factory: () => Promise<unknown>,
  opts: SafeLazyOptions,
): LazyExoticComponent<T> {
  return lazy<T>(() => loadSafeModule<T>(factory, opts));
}
