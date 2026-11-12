/**
 * Les pages de messagerie (espace client et administration) lisent
 * `api/messages` avec la session de la requête entrante. L'API applique la
 * règle du détenteur (`backend/tests/unit/messages-routes-authz.test.ts`) :
 * une page qui lirait la base elle-même y échapperait.
 *
 * Elles lisent la forme que l'API renvoie : `{ success, data, pagination }`
 * pour la liste, `{ success, data }` pour un message et pour les statistiques.
 * Un refus ou une panne de l'API s'affiche comme une erreur, jamais comme une
 * liste vide.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loader as detailLoader } from "~/routes/account.messages.$messageId";
import { loader as listLoader } from "~/routes/account.messages._index";
import { loader as adminLoader } from "~/routes/admin.messages";
import { logger } from "~/utils/logger";

const { requireUser, requireUserWithRedirect, requireAdmin } = vi.hoisted(
  () => ({
    requireUser: vi.fn(),
    requireUserWithRedirect: vi.fn(),
    requireAdmin: vi.fn(),
  }),
);
vi.mock("~/auth/unified.server", () => ({
  requireUser,
  requireUserWithRedirect,
  requireAdmin,
}));
vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

const ROUTES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../app/routes",
);

const COOKIE = "connect.sid=s%3Asession-de-test";
const CUSTOMER = { id: "42", email: "client@example.test" };
const ADMIN = { id: "1", email: "admin@example.test", level: 9 };

type AnyLoader = (args: any) => Promise<any>;
type Thrown = { data?: { message?: string }; init?: { status?: number } };
type Answers = Record<string, { status?: number; body?: unknown }>;

/** Answers each call by `METHOD /path`; an unlisted call fails the test. */
function stubApi(answers: Answers) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${new URL(String(input)).pathname}`;
      const answer = answers[key];
      if (!answer) throw new Error(`appel inattendu : ${key}`);
      return new Response(JSON.stringify(answer.body ?? {}), {
        status: answer.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Calls that left the loader: method, path, query, cookie, header names. */
function calls(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.map(([input, init]) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    return {
      method: init?.method ?? "GET",
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      cookie: headers.get("Cookie"),
      headerNames: [...headers.keys()],
    };
  });
}

function run(loader: AnyLoader, path: string, params = {}) {
  return loader({
    request: new Request(`http://localhost${path}`, {
      headers: { Cookie: COOKIE },
    }),
    context: {},
    params,
  });
}

async function thrownBy(run: () => Promise<unknown>): Promise<Thrown> {
  try {
    await run();
  } catch (e) {
    return e as Thrown;
  }
  throw new Error("le loader n'a rien levé");
}

const message = (overrides: Record<string, unknown> = {}) => ({
  id: "m1",
  customerId: "42",
  staffId: "1",
  subject: "Sujet",
  content: "<p>Contenu</p>",
  status: "open",
  isRead: false,
  createdAt: "2026-01-02T03:04:05.000Z",
  ...overrides,
});

const PAGINATION = { page: 1, limit: 20, total: 1, totalPages: 1 };
const STATS = { total: 1, open: 1, closed: 0, unread: 1 };

const listAnswers = (overrides: Answers = {}): Answers => ({
  "GET /api/messages": {
    body: { success: true, data: [message()], pagination: PAGINATION },
  },
  "GET /api/messages/stats": { body: { success: true, data: STATS } },
  ...overrides,
});

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(logger.error).mockClear();
  requireUser.mockReset().mockResolvedValue(CUSTOMER);
  requireUserWithRedirect.mockReset().mockResolvedValue(CUSTOMER);
  requireAdmin.mockReset().mockResolvedValue(ADMIN);
});

// ─── Espace client : liste ──────────────────────────────────────────────────

describe("account.messages._index loader", () => {
  it("lit la liste et les statistiques du client de la session, par l'API", async () => {
    const fetchMock = stubApi(listAnswers());

    const result = await run(listLoader, "/account/messages");

    expect(calls(fetchMock)).toEqual([
      {
        method: "GET",
        path: "/api/messages",
        query: { customer: "42", page: "1", status: "all" },
        cookie: COOKIE,
        headerNames: ["cookie"],
      },
      {
        method: "GET",
        path: "/api/messages/stats",
        query: { customer: "42" },
        cookie: COOKIE,
        headerNames: ["cookie"],
      },
    ]);
    expect(result).toEqual({
      messages: [message()],
      pagination: PAGINATION,
      stats: STATS,
      status: "all",
      search: "",
      email: CUSTOMER.email,
    });
  });

  it.each(["open", "closed", "unread"])(
    "transmet le filtre de statut %s",
    async (status) => {
      const fetchMock = stubApi(listAnswers());

      const result = await run(
        listLoader,
        `/account/messages?status=${status}`,
      );

      expect(calls(fetchMock)[0].query.status).toBe(status);
      expect(result.status).toBe(status);
    },
  );

  it("ne transmet pas un statut que l'API refuse", async () => {
    const fetchMock = stubApi(listAnswers());

    const result = await run(listLoader, "/account/messages?status=system");

    expect(calls(fetchMock)[0].query.status).toBe("all");
    expect(result.status).toBe("all");
  });

  it("transmet la recherche et la page", async () => {
    const fetchMock = stubApi(listAnswers());

    await run(listLoader, "/account/messages?search=pompe&page=3");

    expect(calls(fetchMock)[0].query).toEqual({
      customer: "42",
      page: "3",
      status: "all",
      search: "pompe",
    });
  });

  it.each([
    ["la liste", "GET /api/messages", 403],
    ["la liste", "GET /api/messages", 500],
    ["les statistiques", "GET /api/messages/stats", 500],
  ])(
    "un refus de l'API sur %s (%s → %i) est une erreur, pas une liste vide",
    async (_label, key, status) => {
      stubApi(listAnswers({ [key]: { status } }));

      const thrown = await thrownBy(() => run(listLoader, "/account/messages"));

      expect(thrown.init?.status).toBe(status);
      expect(thrown.data?.message).toBe(
        "Vos messages n'ont pas pu être chargés.",
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
    },
  );
});

// ─── Espace client : détail ─────────────────────────────────────────────────

describe("account.messages.$messageId loader", () => {
  const runDetail = (messageId = "m1") =>
    run(detailLoader, `/account/messages/${messageId}`, { messageId });

  it("lit le message par l'API et le marque lu", async () => {
    const fetchMock = stubApi({
      "GET /api/messages/m1": { body: { success: true, data: message() } },
      "PUT /api/messages/m1/read": { body: { success: true } },
    });

    const result = await runDetail();

    expect(
      calls(fetchMock).map(({ method, path, cookie, headerNames }) => ({
        method,
        path,
        cookie,
        headerNames,
      })),
    ).toEqual([
      {
        method: "GET",
        path: "/api/messages/m1",
        cookie: COOKIE,
        headerNames: ["cookie"],
      },
      {
        method: "PUT",
        path: "/api/messages/m1/read",
        cookie: COOKIE,
        headerNames: ["cookie"],
      },
    ]);
    expect(result).toEqual({ message: message() });
  });

  it("ne marque pas un message déjà lu", async () => {
    const fetchMock = stubApi({
      "GET /api/messages/m1": {
        body: { success: true, data: message({ isRead: true }) },
      },
    });

    await runDetail();

    expect(calls(fetchMock).map(({ method }) => method)).toEqual(["GET"]);
  });

  it("encode l'identifiant dans le chemin de l'API", async () => {
    const fetchMock = stubApi({
      "GET /api/messages/a%2Fb": {
        body: { success: true, data: message({ id: "a/b", isRead: true }) },
      },
    });

    await run(detailLoader, "/account/messages/x", { messageId: "a/b" });

    expect(calls(fetchMock)[0].path).toBe("/api/messages/a%2Fb");
  });

  it("un message que l'API refuse est introuvable, sans marquage", async () => {
    const fetchMock = stubApi({ "GET /api/messages/m1": { status: 404 } });

    const thrown = await thrownBy(runDetail);

    expect(thrown.init?.status).toBe(404);
    expect(thrown.data?.message).toBe("Message introuvable.");
    expect(calls(fetchMock)).toHaveLength(1);
  });

  it("le message d'un autre compte est introuvable, même si l'API l'ouvre", async () => {
    const fetchMock = stubApi({
      "GET /api/messages/m1": {
        body: { success: true, data: message({ customerId: "7" }) },
      },
    });

    const thrown = await thrownBy(runDetail);

    expect(thrown.init?.status).toBe(404);
    expect(calls(fetchMock)).toHaveLength(1);
  });

  it("une panne de l'API garde son statut", async () => {
    stubApi({ "GET /api/messages/m1": { status: 500 } });

    const thrown = await thrownBy(runDetail);

    expect(thrown.init?.status).toBe(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("affiche le message et trace l'échec quand le marquage est refusé", async () => {
    stubApi({
      "GET /api/messages/m1": { body: { success: true, data: message() } },
      "PUT /api/messages/m1/read": { status: 500 },
    });

    const result = await runDetail();

    expect(result).toEqual({ message: message() });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

// ─── Administration ─────────────────────────────────────────────────────────

describe("admin.messages loader", () => {
  const adminAnswers = (overrides: Answers = {}): Answers => ({
    "GET /api/messages": {
      body: {
        success: true,
        data: [message(), message({ id: "m2", status: "closed" })],
        pagination: { page: 2, limit: 20, total: 2500, totalPages: 125 },
      },
    },
    "GET /api/messages/stats/overview": {
      body: {
        success: true,
        data: { total: 2500, open: 2200, closed: 300, unread: 40 },
      },
    },
    ...overrides,
  });

  it("lit la forme que l'API renvoie, avec le cookie de session", async () => {
    const fetchMock = stubApi(adminAnswers());

    const result = await run(adminLoader, "/admin/messages?page=2");

    expect(result).toEqual({
      messages: [message(), message({ id: "m2", status: "closed" })],
      total: 2500,
      page: 2,
      totalPages: 125,
      stats: { total: 2500, open: 2200, closed: 300, unread: 40 },
      fallbackMode: false,
    });
    expect(calls(fetchMock).map(({ cookie }) => cookie)).toEqual([
      COOKIE,
      COOKIE,
    ]);
  });

  it("signale une réponse d'une autre forme au lieu d'afficher zéro message", async () => {
    stubApi(
      adminAnswers({
        "GET /api/messages": {
          body: { messages: [], total: 0, page: 1, totalPages: 1 },
        },
      }),
    );

    const result = await run(adminLoader, "/admin/messages");

    expect(result.fallbackMode).toBe(true);
    expect(result.error).toBe("Réponse inattendue de l'API messages");
    expect(result.messages).toEqual([]);
  });

  it("signale un refus de l'API avec les deux statuts", async () => {
    stubApi(adminAnswers({ "GET /api/messages": { status: 403 } }));

    const result = await run(adminLoader, "/admin/messages");

    expect(result.fallbackMode).toBe(true);
    expect(result.error).toBe("Erreur API (liste 403, statistiques 200)");
  });

  it.each([
    ["unread", "unread"],
    ["closed", "closed"],
    ["system", undefined],
    ["all", undefined],
  ])("statut %s → filtre transmis : %s", async (status, sent) => {
    const fetchMock = stubApi(adminAnswers());

    await run(adminLoader, `/admin/messages?status=${status}`);

    expect(calls(fetchMock)[0].query.status).toBe(sent);
  });
});

// ─── Aucune lecture directe de la base ──────────────────────────────────────

describe("pages de messagerie — accès aux données", () => {
  it.each([
    "account.messages.tsx",
    "account.messages._index.tsx",
    "account.messages.$messageId.tsx",
    "account.messages.compose.tsx",
    "admin.messages.tsx",
  ])("%s ne lit pas la base avec la clé de service", (file) => {
    const source = readFileSync(join(ROUTES_DIR, file), "utf8");

    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("/rest/v1/");
  });
});
