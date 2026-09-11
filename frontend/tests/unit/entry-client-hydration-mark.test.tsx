/**
 * Test unitaire — mark d'hydratation posé par `frontend/app/entry.client.tsx`.
 *
 * `attr_hydrated_at` (beacon CWV) n'a qu'un producteur : le wrapper
 * `HydrationCommitMark` de la racine hydratée. Ce test importe le vrai point
 * d'entrée. `hydrateRoot` y est redirigé vers un conteneur (jsdom n'hydrate pas
 * `document`) et le routeur est remplacé par un shell instrumenté.
 *
 * Contrat épinglé :
 *   - aucun mark au retour de `hydrateRoot` : le commit n'a pas encore eu lieu ;
 *   - un seul mark après le commit, posé après les effets layout du shell et
 *     avant ses effets passifs ;
 *   - le wrapper ne rend aucun DOM : le HTML serveur s'hydrate sans écart.
 *
 * Retirer le wrapper, poser le mark au retour de `hydrateRoot` ou le déplacer
 * dans un effet passif casse ce test.
 */

import { act } from "react";
import type * as ReactDomClient from "react-dom/client";
import { renderToString } from "react-dom/server";
import { HydratedRouter } from "react-router/dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type * as RuntimeErrorsClient from "~/utils/runtime-errors.client";
import type * as WebVitalsClient from "~/utils/web-vitals.client";
import { HYDRATION_COMMIT_MARK } from "~/utils/web-vitals.client";

const harness = vi.hoisted(() => ({
  container: null as HTMLElement | null,
  order: [] as string[],
  recoverableErrors: [] as unknown[],
}));

function hydrationMarks(): number {
  return performance.getEntriesByName(HYDRATION_COMMIT_MARK, "mark").length;
}

vi.mock("react-dom/client", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactDomClient>();
  const { HYDRATION_COMMIT_MARK: mark } =
    await import("~/utils/web-vitals.client");
  return {
    ...actual,
    hydrateRoot: (
      _document: unknown,
      children: Parameters<typeof actual.hydrateRoot>[1],
    ) => {
      if (!harness.container) throw new Error("container not ready");
      const root = actual.hydrateRoot(harness.container, children, {
        onRecoverableError: (error) => harness.recoverableErrors.push(error),
      });
      harness.order.push(
        `after-hydrateRoot marks=${performance.getEntriesByName(mark, "mark").length}`,
      );
      return root;
    },
  };
});

vi.mock("react-router/dom", async () => {
  const { createElement, useEffect, useLayoutEffect } = await import("react");
  const { HYDRATION_COMMIT_MARK: mark } =
    await import("~/utils/web-vitals.client");
  const count = () => performance.getEntriesByName(mark, "mark").length;
  function Shell() {
    useLayoutEffect(() => {
      harness.order.push(`shell-layout marks=${count()}`);
    }, []);
    useEffect(() => {
      harness.order.push(`shell-passive marks=${count()}`);
    }, []);
    return createElement("button", { type: "button" }, "tap");
  }
  return { HydratedRouter: Shell };
});

// Effets de bord du point d'entrée sans rapport avec le mark : pas d'observateurs
// web-vitals, pas de reporter runtime, pas de beacon d'attribution.
vi.mock("~/utils/web-vitals.client", async (importOriginal) => ({
  ...(await importOriginal<typeof WebVitalsClient>()),
  reportWebVitals: vi.fn(),
}));
vi.mock("~/utils/runtime-errors.client", async (importOriginal) => ({
  ...(await importOriginal<typeof RuntimeErrorsClient>()),
  startRuntimeErrorReporter: vi.fn(),
}));
vi.mock("~/utils/attribution-beacon.client", () => ({
  captureLandingAttribution: vi.fn(() => null),
  sendLandingAttribution: vi.fn(),
}));

describe("entry.client — hydration commit mark", () => {
  let serverHtml = "";

  beforeAll(async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    // Les tâches différées du point d'entrée (Sentry, beacon d'attribution) ne
    // sont jamais exécutées ici.
    vi.stubGlobal("requestIdleCallback", vi.fn());
    performance.clearMarks();

    serverHtml = renderToString(<HydratedRouter />);
    harness.container = document.createElement("div");
    harness.container.innerHTML = serverHtml;
    document.body.appendChild(harness.container);

    await act(async () => {
      await import("~/entry.client");
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("does not date hydration when hydrateRoot returns", () => {
    expect(harness.order[0]).toBe("after-hydrateRoot marks=0");
  });

  it("marks once at the commit — after the shell's layout effects, before its passive effects", () => {
    expect(harness.order).toEqual([
      "after-hydrateRoot marks=0",
      "shell-layout marks=0",
      "shell-passive marks=1",
    ]);
    expect(hydrationMarks()).toBe(1);
  });

  it("renders no DOM of its own, so the server HTML hydrates without mismatch", () => {
    expect(harness.recoverableErrors).toEqual([]);
    expect(harness.container?.innerHTML).toBe(serverHtml);
  });
});
