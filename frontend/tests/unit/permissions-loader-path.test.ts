/**
 * `loadUserPermissions` lit la matrice de permissions du backend pour les
 * pages de commandes. Si le chemin appelé n'est pas celui que le backend
 * déclare, la réponse est un 404 et chaque membre du personnel reçoit les
 * permissions de base : toutes les actions sont refusées, sans erreur visible.
 *
 * Ce test lie le chemin appelé au chemin déclaré par le contrôleur, et vérifie
 * que l'échec de lecture reste fermé (aucune action) et signalé.
 */
// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "~/utils/logger";
import {
  BASE_USER_PERMISSIONS,
  loadUserPermissions,
} from "~/utils/permissions";

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const COOKIE = "connect.sid=s%3Asession-de-test";
const GRANTED = { ...BASE_USER_PERMISSIONS, canValidate: true, canShip: true };

const CONTROLLER = readFileSync(
  resolve(
    __dirname,
    "../../../backend/src/auth/controllers/auth-permissions.controller.ts",
  ),
  "utf8",
);

function stubFetch(respond: () => Promise<Response> | Response) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) => respond(),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("loadUserPermissions", () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("appelle le chemin que le contrôleur backend déclare", async () => {
    // Le contrôleur n'a pas de préfixe et il n'existe pas de préfixe global :
    // le chemin de la route est celui du décorateur @Get.
    expect(CONTROLLER).toMatch(/@Controller\(\)/);
    const declared = /@Get\('(auth\/user-permissions\/):userId'\)/.exec(
      CONTROLLER,
    );
    expect(declared).not.toBeNull();

    const fetchMock = stubFetch(() => json(GRANTED));
    await loadUserPermissions("42", COOKIE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `http://127.0.0.1:3000/${declared![1]}42`,
    );
  });

  it("transmet le cookie de session et encode l'identifiant", async () => {
    const fetchMock = stubFetch(() => json(GRANTED));
    await loadUserPermissions("a/b", COOKIE);

    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toMatch(/\/auth\/user-permissions\/a%2Fb$/);
    expect(new Headers(init?.headers).get("Cookie")).toBe(COOKIE);
  });

  it("renvoie la matrice du backend quand la lecture réussit", async () => {
    stubFetch(() => json(GRANTED));
    await expect(loadUserPermissions("42", COOKIE)).resolves.toEqual(GRANTED);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 500])(
    "n'accorde aucune action et signale la réponse %i",
    async (status) => {
      stubFetch(() => json({ message: "refus" }, status));
      await expect(loadUserPermissions("42", COOKIE)).resolves.toEqual(
        BASE_USER_PERMISSIONS,
      );
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(String(vi.mocked(logger.warn).mock.calls[0][0])).toContain(
        `HTTP ${status}`,
      );
    },
  );

  it("n'accorde aucune action et signale un backend injoignable", async () => {
    stubFetch(() => Promise.reject(new Error("ECONNREFUSED")));
    await expect(loadUserPermissions("42", COOKIE)).resolves.toEqual(
      BASE_USER_PERMISSIONS,
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
