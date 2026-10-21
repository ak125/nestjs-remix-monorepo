/**
 * Paramètres du compte (/account/settings) — consentement marketing.
 *
 * La carte « Notifications » affichait des valeurs figées et l'action
 * `updatePreferences` répondait « Préférences mises à jour avec succès » sans
 * rien enregistrer. Ce test verrouille :
 *  - la page lit le consentement enregistré via
 *    GET /api/users/profile/marketing-consent, avec le cookie de session ;
 *  - un échec de lecture n'affiche aucune case (un état par défaut renvoyé tel
 *    quel pourrait retirer un accord) ;
 *  - case cochée → PUT { granted: true } ; case absente → PUT { granted: false } ;
 *  - un refus du backend est affiché, jamais transformé en succès ;
 *  - l'ancienne action `updatePreferences` n'existe plus.
 *
 * Identifiants fictifs : aucune donnée client.
 *
 * @see frontend/app/routes/account.settings.tsx
 * @see frontend/app/services/profile.server.ts (getMarketingConsent, updateMarketingConsent)
 * @see backend/src/modules/users/users-final.controller.ts (profile/marketing-consent)
 */
import { cleanup, render, screen } from "@testing-library/react";
import {
  createRoutesStub,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AccountSettings, { action, loader } from "~/routes/account.settings";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

vi.mock("~/auth/unified.server", () => ({
  requireUser: vi.fn(async () => ({ id: "u-1", email: "client@example.com" })),
}));

const COOKIE = "connect.sid=s%3Asession-de-test";
const ENDPOINT = "http://localhost:3000/api/users/profile/marketing-consent";
const GRANTED = {
  granted: true,
  grantedAt: "2026-10-19T08:00:00.000Z",
  source: "register",
};
const WITHDRAWN = { granted: false, grantedAt: null, source: null };

const context = {} as unknown as ActionFunctionArgs["context"];

type Call = { url: string; method: string; headers: Headers; body?: string };

function stubFetch(response: { status: number; body?: unknown } | Error) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: init?.body as string | undefined,
      });
      if (response instanceof Error) throw response;
      return new Response(JSON.stringify(response.body ?? {}), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

async function runLoader() {
  return loader({
    request: new Request("http://localhost:3000/account/settings", {
      headers: { Cookie: COOKIE },
    }),
    context,
    params: {},
  } as LoaderFunctionArgs);
}

async function runAction(fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return action({
    request: new Request("http://localhost:3000/account/settings", {
      method: "POST",
      body: form,
      headers: { Cookie: COOKIE },
    }),
    context,
    params: {},
  } as ActionFunctionArgs);
}

// `data()` renvoie un objet { data, init } ; `redirect()` une Response.
function asData(result: unknown) {
  return result as {
    data: { success?: boolean; error?: string };
    init: { status: number };
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("loader — lecture du consentement enregistré", () => {
  it("lit GET /api/users/profile/marketing-consent avec le cookie", async () => {
    const calls = stubFetch({
      status: 200,
      body: { success: true, data: GRANTED },
    });

    const result = await runLoader();

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe(ENDPOINT);
    expect(calls[0].headers.get("Cookie")).toBe(COOKIE);
    expect(result.marketingConsent).toEqual(GRANTED);
  });

  it.each([
    ["une erreur backend", { status: 500, body: { message: "boom" } }],
    [
      "une réponse hors contrat",
      { status: 200, body: { success: true, data: { granted: "yes" } } },
    ],
    ["un appel qui échoue", new Error("ECONNREFUSED")],
  ])("ne présente aucun état après %s", async (_label, response) => {
    stubFetch(response);

    const result = await runLoader();

    expect(result.marketingConsent).toBeNull();
  });
});

describe("action — enregistrement du choix", () => {
  it("case cochée : PUT { granted: true } avec le cookie", async () => {
    const calls = stubFetch({
      status: 200,
      body: { success: true, data: { ...GRANTED, source: "account_settings" } },
    });

    const result = await runAction({
      _action: "updateMarketingConsent",
      marketingConsent: "on",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toBe(ENDPOINT);
    expect(calls[0].headers.get("Cookie")).toBe(COOKIE);
    expect(JSON.parse(calls[0].body ?? "")).toEqual({ granted: true });
    expect(result).toEqual({
      success: true,
      message: "C'est noté : vous recevrez nos offres et actualités.",
    });
  });

  it("case décochée (absente du formulaire) : PUT { granted: false }", async () => {
    const calls = stubFetch({
      status: 200,
      body: { success: true, data: WITHDRAWN },
    });

    const result = await runAction({ _action: "updateMarketingConsent" });

    expect(JSON.parse(calls[0].body ?? "")).toEqual({ granted: false });
    expect(result).toEqual({
      success: true,
      message: "C'est noté : vous ne recevrez plus nos offres et actualités.",
    });
  });

  it.each([
    ["une erreur backend", { status: 500, body: { message: "boom" } }],
    [
      "une réponse hors contrat",
      { status: 200, body: { success: true, data: null } },
    ],
    ["un appel qui échoue", new Error("ECONNREFUSED")],
  ])("affiche une erreur après %s, jamais un succès", async (_l, response) => {
    stubFetch(response);

    const result = asData(
      await runAction({
        _action: "updateMarketingConsent",
        marketingConsent: "on",
      }),
    );

    expect(result.init.status).toBe(500);
    expect(result.data.success).toBe(false);
    expect(result.data.error).toBe(
      "Votre choix n'a pas pu être enregistré. Réessayez dans quelques instants.",
    );
  });

  it("session expirée côté backend : renvoie vers /login", async () => {
    stubFetch({ status: 401 });

    const result = await runAction({
      _action: "updateMarketingConsent",
      marketingConsent: "on",
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe("/login");
  });

  it("l'ancienne action updatePreferences n'existe plus", async () => {
    const calls = stubFetch({ status: 200 });

    const result = await runAction({
      _action: "updatePreferences",
      emailNotifications: "on",
    });

    expect(calls).toHaveLength(0);
    expect(result).toEqual({ success: false, error: "Action non reconnue" });
  });
});

function renderPage(marketingConsent: unknown) {
  const Stub = createRoutesStub([
    {
      path: "/account/settings",
      Component: AccountSettings,
      HydrateFallback: () => null,
      loader: () => ({ user: { id: "u-1" }, marketingConsent }),
    },
  ]);
  return render(<Stub initialEntries={["/account/settings"]} />);
}

describe("page — case de consentement", () => {
  it("reflète un accord enregistré, avec sa date", async () => {
    renderPage(GRANTED);

    const box = (await screen.findByLabelText(
      "Je souhaite recevoir les offres et actualités AutoMecanik",
    )) as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(box.name).toBe("marketingConsent");
    expect(screen.getByText(/Accord donné le/)).toBeTruthy();
  });

  it("reflète une absence d'accord, sans date", async () => {
    renderPage(WITHDRAWN);

    const box = (await screen.findByLabelText(
      "Je souhaite recevoir les offres et actualités AutoMecanik",
    )) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.queryByText(/Accord donné le/)).toBeNull();
  });

  it("n'affiche aucune case quand le choix n'a pas pu être lu", async () => {
    renderPage(null);

    expect(
      await screen.findByText(/Votre choix actuel n'a pas pu être chargé/),
    ).toBeTruthy();
    expect(
      screen.queryByLabelText(
        "Je souhaite recevoir les offres et actualités AutoMecanik",
      ),
    ).toBeNull();
  });
});
