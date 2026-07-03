/**
 * LazyBoundary — ErrorBoundary réutilisable pour UI **lazy non-critique**.
 * Généralise l'ancien `ChatWidgetErrorBoundary` (root.tsx) en un composant
 * paramétré par `name` (libellé warn/balise) + `fallback` (défaut `null`).
 *
 * CLASSIFIANT (must-fix red-team #5) : SEULE la classe « fulfill-with-undefined
 * / safeLazy » est avalée → dégrade vers `fallback` + est observée. TOUTE autre
 * erreur est **re-jetée** (pendant le render de récupération → propagation
 * déterministe vers l'ErrorBoundary de route). Une vraie régression ne doit
 * jamais être masquée silencieusement (canon : no silent fallback).
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "~/utils/logger";
import { reportChunkResolvedInvalid } from "~/utils/runtime-errors.client";

interface LazyBoundaryProps {
  /** Libellé diagnostic (warn + meta balise). Aucune PII. */
  name: string;
  /** Rendu en cas de crash lazy avalé. Défaut `null` (dégradation silencieuse). */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Vrai uniquement pour les signatures lazy-init / resolved-undefined qu'on est
 * autorisé à avaler : le message synthétique de `safeLazy`, ou le `TypeError`
 * brut de React.lazy lisant `_result.default` sur `undefined`. Toute autre
 * erreur (y compris un autre `reading 'x'` sur undefined) → NON reconnue.
 */
export function isLazyInitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const m = error.message ?? "";
  return (
    m.startsWith("[safeLazy:") ||
    (error instanceof TypeError &&
      m.includes("reading 'default'") &&
      m.includes("undefined"))
  );
}

export class LazyBoundary extends Component<
  LazyBoundaryProps,
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Side-effects (warn + balise) UNIQUEMENT pour la classe avalée. Le re-jet
    // d'une vraie erreur se fait dans render() (déterministe), pas ici.
    if (!isLazyInitError(error)) return;
    logger.warn(
      `[${this.props.name}] crash intercepte:`,
      error.message,
      info.componentStack?.slice(0, 200),
    );
    // Garde `typeof window` : `reportChunkResolvedInvalid` vient d'un module
    // `.client` (stub `undefined` côté serveur). `componentDidCatch` est de fait
    // client-only, mais la garde rend l'isomorphie explicite et uniforme avec
    // `resilient-lazy` (pas d'appel de `(void 0)` si le lifecycle évolue).
    if (typeof window !== "undefined") {
      reportChunkResolvedInvalid({ name: this.props.name, stage: "boundary" });
    }
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (isLazyInitError(error)) return this.props.fallback ?? null;
      // Vraie régression → re-jeter pour remonter à l'ErrorBoundary de route.
      throw error;
    }
    return this.props.children;
  }
}
