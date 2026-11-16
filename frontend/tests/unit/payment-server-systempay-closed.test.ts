/**
 * Mandat AY (2026-11-16) — retour SystemPay quand le backend a fermé
 * POST /api/payments/callback/cyberplus (410, SYSTEMPAY_CALLBACK_ENABLED absent).
 *
 * processPaymentReturn doit rendre `null` (même issue qu'une transaction
 * introuvable) au lieu de lever une erreur qui deviendrait un 500.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { processPaymentReturn } from "~/services/payment.server";

function stubFetch(status: number) {
  const fetchMock = vi.fn(
    async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ statusCode: status }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const args = {
  transactionId: "TX-1",
  status: "AUTHORISED",
  params: { vads_trans_id: "TX-1" },
};

describe("processPaymentReturn — SystemPay fermé", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("410 du backend → null, pas d'exception", async () => {
    const fetchMock = stubFetch(410);
    await expect(processPaymentReturn(args)).resolves.toBeNull();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/payments/callback/cyberplus",
    );
  });

  it("404 inchangé → null", async () => {
    stubFetch(404);
    await expect(processPaymentReturn(args)).resolves.toBeNull();
  });

  it("500 inchangé → erreur", async () => {
    stubFetch(500);
    await expect(processPaymentReturn(args)).rejects.toThrow();
  });
});
