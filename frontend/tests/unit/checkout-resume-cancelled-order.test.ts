// @vitest-environment node
/** Reprise de paiement (`/checkout/resume?token=…`) : une commande annulée
 * (ord_ords_id = '2') ne doit jamais être renvoyée vers la page de paiement.
 * Une commande en cours non payée reste redirigée comme avant.
 * Valeurs fictives uniquement. */

import { type LoaderFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loader } from "~/routes/checkout_.resume";

function tokenApiAnswers(body: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

function callLoader(search: string) {
  return loader({
    params: {},
    request: new Request(`http://localhost/checkout/resume${search}`),
    context: {},
  } as unknown as LoaderFunctionArgs);
}

const ORDER = {
  orderId: "ORD-FICTIF-1",
  totalTTC: 49.9,
  isPaid: "0",
  customerEmail: "client@example.test",
};

describe("checkout_.resume — commande annulée", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("commande annulée non payée : aucune redirection vers le paiement (410)", async () => {
    tokenApiAnswers({ ...ORDER, orderStatus: "2" });
    const outcome = await callLoader("?token=tok").then(
      (value) => ({ returned: value as unknown }),
      (thrown) => ({ thrown: thrown as unknown }),
    );
    expect(outcome).toHaveProperty("thrown");
    const thrown = (outcome as { thrown: Response }).thrown;
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(410);
    expect(await thrown.text()).toMatch(/annulée/);
  });

  it("statut annulé reçu sous forme numérique : même refus", async () => {
    tokenApiAnswers({ ...ORDER, orderStatus: 2 });
    await expect(callLoader("?token=tok")).rejects.toMatchObject({
      status: 410,
    });
  });

  it("commande en cours non payée : redirigée vers le paiement, comme avant", async () => {
    tokenApiAnswers({ ...ORDER, orderStatus: "1" });
    const res = (await callLoader("?token=tok")) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      "/api/paybox/redirect?orderId=ORD-FICTIF-1&amount=49.9&email=client%40example.test",
    );
  });

  it("mode check : l'état d'une commande annulée reste consultable", async () => {
    tokenApiAnswers({ ...ORDER, orderStatus: "2" });
    await expect(callLoader("?token=tok&check=1")).resolves.toMatchObject({
      mode: "check",
      orderId: "ORD-FICTIF-1",
      isPaid: false,
      orderStatus: "2",
    });
  });
});
