import { type LoaderFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loader } from "~/routes/checkout.resume";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Lien de reprise d'une commande devenue non payable (annulée…) : le backend
// refuse (409 ORDER.NOT_PAYABLE). La page doit l'expliquer au client — jamais
// le renvoyer vers le paiement, jamais une erreur 500 opaque.
function stubTokenResponse(status: number, body: Record<string, unknown>) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function load(query: string) {
  return loader({
    request: new Request(`http://localhost/checkout/resume?${query}`),
    params: {},
    context: {},
  } as unknown as LoaderFunctionArgs);
}

const NOT_PAYABLE = {
  statusCode: 409,
  code: "ORDER.NOT_PAYABLE",
  message: "Cette commande a été annulée : elle ne peut plus être payée.",
};

describe("checkout.resume loader — commande non payable", () => {
  it.each([["token=tok"], ["token=tok&check=1"]])(
    "409 ORDER.NOT_PAYABLE (%s) → écran « paiement impossible » avec le message backend",
    async (query) => {
      const fetchMock = stubTokenResponse(409, NOT_PAYABLE);
      await expect(load(query)).resolves.toEqual({
        mode: "not_payable",
        message: NOT_PAYABLE.message,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("409 sans ce code → erreur serveur (comportement inchangé)", async () => {
    stubTokenResponse(409, { statusCode: 409, message: "autre conflit" });
    const thrown = await load("token=tok").catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(500);
  });

  it("commande payable → redirection vers le paiement (inchangé)", async () => {
    stubTokenResponse(200, {
      orderId: "ORD-42",
      totalTTC: 62.35,
      isPaid: false,
      orderStatus: "1",
      customerEmail: "client@example.com",
    });
    const res = (await load("token=tok")) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      "/api/paybox/redirect?orderId=ORD-42&amount=62.35&email=client%40example.com",
    );
  });

  it("commande payée (isPaid booléen) → confirmation, pas de paiement", async () => {
    stubTokenResponse(200, {
      orderId: "ORD-42",
      totalTTC: 62.35,
      isPaid: true,
      orderStatus: "3",
      customerEmail: "client@example.com",
    });
    await expect(load("token=tok")).resolves.toMatchObject({
      mode: "already_paid",
      isPaid: true,
    });
  });
});
