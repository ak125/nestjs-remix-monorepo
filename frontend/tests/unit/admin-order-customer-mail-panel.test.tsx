/**
 * Mandat CG — OrderCustomerMailPanel (« Écrire au client »).
 *
 * Verrouille : modèle prérempli puis modifiable, aperçu obligatoire avant
 * envoi, toute modification efface l'aperçu, passage « À COMPLÉTER » ⇒
 * envoi bloqué, envoi = une seule requête avec la clé de l'aperçu,
 * historique affiché, erreur d'historique non masquée, ouverture sur le
 * modèle d'annulation à la demande de la fiche.
 *
 * Données inventées uniquement.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OrderCustomerMailPanel,
  type CustomerMailComposer,
} from "~/components/admin/OrderCustomerMailPanel";

const ID = "ORD-TEST-CG";
const BASE = `/api/admin/orders/${ID}/customer-mail`;
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

const composer = (
  over: Partial<CustomerMailComposer> = {},
): CustomerMailComposer => ({
  orderId: ID,
  recipient: "client@example.test",
  templates: [
    {
      template: "cancel-payment-voided",
      label: "Annulation : paiement annulé avant encaissement",
      subject: `Votre commande ${ID} est annulée`,
      body: "Bonjour,\n\nVotre paiement de 89,90 € a été annulé avant encaissement.",
    },
    {
      template: "free",
      label: "Message libre",
      subject: `Votre commande ${ID}`,
      body: "Bonjour,\n\n[À COMPLÉTER : votre message]",
    },
  ],
  history: [],
  historyError: null,
  ...over,
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(crypto, "randomUUID").mockReturnValue(UUID);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function postsTo(url: string) {
  return fetchMock.mock.calls.filter(
    ([u, init]) => u === url && init?.method === "POST",
  );
}

async function openTemplate(key: string) {
  await screen.findByText(/Destinataire/);
  fireEvent.change(screen.getByRole("combobox", { name: "Modèle" }), {
    target: { value: key },
  });
}

describe("OrderCustomerMailPanel (mandat CG)", () => {
  it("prérempli, aperçu puis envoi : une requête avec la clé de l'aperçu", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === BASE && !init?.method) return json(composer());
      if (url === `${BASE}/preview`)
        return json({ subject: "s", html: "<p>aperçu</p>", complete: true });
      if (url === BASE && init?.method === "POST")
        return json({
          status: "sent",
          msgId: "cg_x",
          delivery: "test-transport",
          auditRecorded: true,
        });
      throw new Error(`inattendu ${url}`);
    });
    render(<OrderCustomerMailPanel orderId={ID} />);
    expect(await screen.findByText(/client@example\.test/)).toBeTruthy();

    await openTemplate("cancel-payment-voided");
    const objet = screen.getByRole("textbox", { name: "Objet" });
    const texte = screen.getByRole("textbox", { name: "Texte" });
    expect((objet as HTMLInputElement).value).toBe(
      `Votre commande ${ID} est annulée`,
    );
    fireEvent.change(texte, { target: { value: "Bonjour,\n\nTexte relu." } });

    const envoyer = screen.getByRole("button", { name: "Envoyer au client" });
    expect((envoyer as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Voir l'aperçu" }));
    expect(await screen.findByTitle("Aperçu du mail")).toBeTruthy();
    expect(JSON.parse(postsTo(`${BASE}/preview`)[0][1].body)).toEqual({
      subject: `Votre commande ${ID} est annulée`,
      body: "Bonjour,\n\nTexte relu.",
    });
    expect((envoyer as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(envoyer);
    fireEvent.click(envoyer);
    expect(
      await screen.findByText(/Mail enregistré sur la commande/),
    ).toBeTruthy();
    const sends = postsTo(BASE);
    expect(sends).toHaveLength(1);
    expect(JSON.parse(sends[0][1].body)).toEqual({
      requestId: UUID,
      template: "cancel-payment-voided",
      subject: `Votre commande ${ID} est annulée`,
      body: "Bonjour,\n\nTexte relu.",
    });
  });

  it("modifier le texte après l'aperçu efface l'aperçu et rebloque l'envoi", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === `${BASE}/preview`)
        return json({ subject: "s", html: "<p>a</p>", complete: true });
      return json(composer());
    });
    render(<OrderCustomerMailPanel orderId={ID} />);
    await openTemplate("cancel-payment-voided");
    fireEvent.click(screen.getByRole("button", { name: "Voir l'aperçu" }));
    await screen.findByTitle("Aperçu du mail");

    fireEvent.change(screen.getByRole("textbox", { name: "Texte" }), {
      target: { value: "Bonjour,\n\nAutre texte." },
    });
    expect(screen.queryByTitle("Aperçu du mail")).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Envoyer au client",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("passage « À COMPLÉTER » : avertissement, envoi impossible", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === `${BASE}/preview`)
        return json({ subject: "s", html: "<p>a</p>", complete: false });
      return json(composer());
    });
    render(<OrderCustomerMailPanel orderId={ID} />);
    await openTemplate("free");
    expect(
      screen.getByText(/l'envoi\s+est refusé tant qu'il en reste/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voir l'aperçu" }));
    await screen.findByTitle("Aperçu du mail");
    expect(
      (
        screen.getByRole("button", {
          name: "Envoyer au client",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("refus du backend affiché tel quel ; 403 ⇒ droit manquant", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === `${BASE}/preview`)
        return json({ message: "Objet trop court" }, 400);
      return json(composer());
    });
    render(<OrderCustomerMailPanel orderId={ID} />);
    await openTemplate("cancel-payment-voided");
    fireEvent.click(screen.getByRole("button", { name: "Voir l'aperçu" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Objet trop court",
    );

    cleanup();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json({ message: "Forbidden" }, 403));
    render(<OrderCustomerMailPanel orderId={ID} />);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Droit manquant pour écrire au client.",
    );
  });

  it("historique affiché ; erreur d'historique non masquée", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        composer({
          history: [
            {
              msgId: "cg_1",
              sentAt: "2026-11-18T14:00:00Z",
              authorId: "42",
              template: "cancel-payment-voided",
              subject: `Votre commande ${ID} est annulée`,
              delivery: "test-transport",
              content: "<p>texte</p>",
            },
          ],
        }),
      ),
    );
    render(<OrderCustomerMailPanel orderId={ID} />);
    const list = await screen.findByRole("list", { name: "Mails envoyés" });
    expect(list.textContent).toContain(`Votre commande ${ID} est annulée`);
    expect(list.textContent).toContain(
      "Annulation : paiement annulé avant encaissement",
    );
    expect(list.textContent).toContain("transport d'essai");
    expect(list.textContent).toContain("auteur 42");

    cleanup();
    fetchMock.mockResolvedValueOnce(
      json(composer({ history: null, historyError: "Historique illisible" })),
    );
    render(<OrderCustomerMailPanel orderId={ID} />);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Historique illisible",
    );
  });

  it("après annulation : la fiche ouvre le bloc sur le modèle d'annulation", async () => {
    fetchMock.mockResolvedValue(json(composer()));
    const { rerender } = render(<OrderCustomerMailPanel orderId={ID} />);
    await screen.findByText(/Destinataire/);
    expect(screen.queryByRole("textbox", { name: "Texte" })).toBeNull();

    await act(async () => {
      rerender(
        <OrderCustomerMailPanel
          orderId={ID}
          openRequest={{ template: "cancel-payment-voided", nonce: 1 }}
        />,
      );
    });
    await waitFor(() =>
      expect(
        (screen.getByRole("textbox", { name: "Texte" }) as HTMLTextAreaElement)
          .value,
      ).toContain("annulé avant encaissement"),
    );
    // Aucun envoi automatique : seule la lecture initiale a eu lieu.
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });
});
