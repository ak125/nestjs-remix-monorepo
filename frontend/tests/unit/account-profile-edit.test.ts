/**
 * « Modifier mon profil » (/account/profile/edit) — branchement sur l'API.
 *
 * L'action appelait une route inexistante : aucune modification n'était
 * enregistrée et le client voyait une erreur générique. Ce test verrouille :
 *  - l'enregistrement passe par PUT /api/users/profile (profil du client
 *    connecté, identifié par la session), avec le cookie, en loopback ;
 *  - le corps ne contient que prénom, nom et téléphone (liste fermée côté
 *    backend : toute autre clé serait refusée) ;
 *  - un refus du backend est affiché, jamais transformé en succès ;
 *  - le formulaire est pré-rempli avec le téléphone enregistré.
 */
import { type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { action, loader } from "~/routes/account.profile_.edit";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

vi.mock("~/auth/unified.server", () => ({
  requireUser: vi.fn(async () => ({
    id: "u-1",
    email: "client@example.com",
    firstName: "Session",
    lastName: "Nom",
  })),
}));

const context = {} as unknown as ActionFunctionArgs["context"];

type Call = { url: string; method: string; headers: Headers; body?: string };

function stubFetch(response: { status: number; body?: unknown }) {
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
      return new Response(JSON.stringify(response.body ?? {}), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

function postForm(fields: Record<string, string>): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request("http://localhost:3000/account/profile/edit", {
    method: "POST",
    body: form,
    headers: { Cookie: "connect.sid=abc" },
  });
}

async function runAction(fields: Record<string, string>) {
  return action({
    request: postForm(fields),
    context,
    params: {},
  } as ActionFunctionArgs);
}

// `data()` renvoie un objet { data, init } ; `redirect()` une Response.
function asData(result: unknown) {
  return result as { data: { error?: string }; init: { status: number } };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("action — enregistrement du profil", () => {
  it("envoie PUT /api/users/profile avec prénom, nom, téléphone et le cookie", async () => {
    const calls = stubFetch({ status: 200, body: { success: true } });

    const result = await runAction({
      firstName: " Jean ",
      lastName: "Martin",
      phone: "06 12 34 56 78",
    });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.method).toBe("PUT");
    expect(call.url).toBe("http://localhost:3000/api/users/profile");
    expect(call.headers.get("Cookie")).toBe("connect.sid=abc");
    expect(JSON.parse(call.body ?? "")).toEqual({
      firstName: "Jean",
      lastName: "Martin",
      phone: "06 12 34 56 78",
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get("Location")).toBe(
      "/account/profile?updated=true",
    );
  });

  it("n'envoie pas de téléphone vide", async () => {
    const calls = stubFetch({ status: 200 });
    await runAction({ firstName: "Jean", lastName: "Martin", phone: "" });
    expect(JSON.parse(calls[0].body ?? "")).toEqual({
      firstName: "Jean",
      lastName: "Martin",
    });
  });

  it("n'appelle plus la route legacy-users", async () => {
    const calls = stubFetch({ status: 200 });
    await runAction({ firstName: "Jean", lastName: "Martin" });
    expect(calls.some((c) => c.url.includes("legacy-users"))).toBe(false);
  });

  it("affiche un refus du backend (400) sans rediriger", async () => {
    stubFetch({ status: 400, body: { message: "détail technique" } });
    const result = asData(
      await runAction({ firstName: "Jean", lastName: "Martin" }),
    );
    expect(result.init.status).toBe(400);
    expect(result.data.error).toBe(
      "Certaines informations n'ont pas été acceptées. Vérifiez le formulaire.",
    );
  });

  it("renvoie une erreur 500 si le backend échoue", async () => {
    stubFetch({ status: 503 });
    const result = asData(
      await runAction({ firstName: "Jean", lastName: "Martin" }),
    );
    expect(result.init.status).toBe(500);
    expect(result.data.error).toBe("Erreur lors de la mise à jour du profil");
  });

  it("renvoie vers la connexion si la session a expiré (401)", async () => {
    stubFetch({ status: 401 });
    const result = await runAction({ firstName: "Jean", lastName: "Martin" });
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get("Location")).toBe("/login");
  });

  it("valide le formulaire avant tout appel", async () => {
    const calls = stubFetch({ status: 200 });
    const result = asData(await runAction({ firstName: "", lastName: "" }));
    expect(result.init.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe("loader — pré-remplissage", () => {
  it("utilise le profil enregistré, téléphone compris", async () => {
    const calls = stubFetch({
      status: 200,
      body: {
        data: { firstName: "Jean", lastName: "Martin", phone: "0612345678" },
      },
    });

    const result = (await loader({
      request: new Request("http://localhost:3000/account/profile/edit", {
        headers: { Cookie: "connect.sid=abc" },
      }),
      context,
      params: {},
    } as LoaderFunctionArgs)) as {
      user: { firstName: string; lastName: string; phone: string };
    };

    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe("http://localhost:3000/api/users/profile");
    expect(result.user).toMatchObject({
      firstName: "Jean",
      lastName: "Martin",
      phone: "0612345678",
    });
  });
});
