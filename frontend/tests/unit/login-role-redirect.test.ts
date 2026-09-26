/**
 * Destination par défaut après connexion. Elle suit le niveau de privilège de
 * la session, avec les mêmes seuils que les loaders qui gardent ces espaces
 * (/admin : isAdmin et niveau 7, /commercial : niveau 3). `isPro` décrit le
 * compte client et n'ouvre pas l'espace commercial : un client pro connecté
 * doit arriver sur son compte, pas sur une page d'accès refusé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { action, loader } from "~/routes/_public+/login";

const { getOptionalUser } = vi.hoisted(() => ({ getOptionalUser: vi.fn() }));
vi.mock("~/auth/unified.server", () => ({ getOptionalUser }));

type LoaderArgs = Parameters<typeof loader>[0];
type ActionArgs = Parameters<typeof action>[0];

type SessionUser = { level?: number; isAdmin?: boolean; isPro?: boolean };

const CUSTOMER_PRO: SessionUser = { level: 1, isAdmin: false, isPro: true };
const CUSTOMER: SessionUser = { level: 1, isAdmin: false, isPro: false };
const COMMERCIAL: SessionUser = { level: 3, isAdmin: false, isPro: true };
const MANAGER: SessionUser = { level: 5, isAdmin: false, isPro: true };
const ADMIN: SessionUser = { level: 7, isAdmin: true, isPro: true };

function location(result: unknown): string | null {
  expect(result).toBeInstanceOf(Response);
  return (result as Response).headers.get("Location");
}

async function runLoader(user: SessionUser | null) {
  getOptionalUser.mockResolvedValue(user);
  return loader({
    request: new Request("http://localhost/login"),
    context: {},
    params: {},
  } as unknown as LoaderArgs);
}

async function runAction(user: SessionUser, redirectTo = "") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, user }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  const body = new FormData();
  body.set("email", "client@example.test");
  body.set("password", "secret");
  body.set("redirectTo", redirectTo);
  return action({
    request: new Request("http://localhost/login", { method: "POST", body }),
    context: {},
    params: {},
  } as unknown as ActionArgs);
}

beforeEach(() => {
  getOptionalUser.mockReset();
  vi.unstubAllGlobals();
});

describe("login — destination par défaut selon le privilège de session", () => {
  it.each([
    ["client pro", CUSTOMER_PRO, "/account/dashboard"],
    ["client", CUSTOMER, "/account/dashboard"],
    ["commercial", COMMERCIAL, "/commercial"],
    ["manager", MANAGER, "/commercial"],
    ["admin", ADMIN, "/admin"],
  ])("loader, session %s", async (_name, user, expected) => {
    expect(location(await runLoader(user))).toBe(expected);
  });

  it("loader sans session : affiche le formulaire", async () => {
    const result = await runLoader(null);
    expect(result).not.toBeInstanceOf(Response);
  });

  it.each([
    ["client pro", CUSTOMER_PRO, "/account/dashboard"],
    ["client", CUSTOMER, "/account/dashboard"],
    ["commercial", COMMERCIAL, "/commercial"],
    ["manager", MANAGER, "/commercial"],
    ["admin", ADMIN, "/admin"],
  ])("action, connexion %s", async (_name, user, expected) => {
    expect(location(await runAction(user))).toBe(expected);
  });

  it("action : une destination explicite est conservée", async () => {
    expect(location(await runAction(CUSTOMER_PRO, "/panier"))).toBe("/panier");
    expect(location(await runAction(ADMIN, "/panier"))).toBe("/panier");
  });
});
