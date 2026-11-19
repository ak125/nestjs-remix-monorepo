/**
 * Mandat BM — panneau « Encaissement et facture » de la fiche commande admin.
 *
 * PRÊT À BRANCHER, NON BRANCHÉ : à poser dans
 * `frontend/app/routes/commercial.orders.$orderId.tsx` (hors périmètre du
 * mandat) par `<OrderBillingPanel orderId={order.ord_id} />`.
 *
 * Il appelle directement les routes admin (même origine, cookie de session) :
 * - GET  /api/admin/orders/:id/billing                 état (canMarkPaid)
 * - POST /api/admin/orders/:id/billing/reduction       moins cher (canMarkPaid)
 * - POST /api/admin/orders/:id/billing/supplement      plus cher (canCreateOrders)
 * - POST /api/admin/orders/:id/billing/capture-state   saisie Verifone (canMarkPaid)
 * - POST /api/admin/orders/:id/billing/issue-invoice   nouvelle tentative (canShip)
 * - GET  /api/admin/orders/:id/billing/invoice.pdf     PDF
 *
 * Toutes les règles sont dans OrderBillingService ; le panneau n'en recopie
 * aucune et affiche les refus du backend tels quels. Drapeau
 * ORDER_BILLING_ENABLED éteint ⇒ 403 ⇒ message « facturation non activée ».
 * Aucun encaissement ni remboursement n'est déclenché d'ici : l'état saisi est
 * celui lu par Marwane dans le back-office Verifone.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "~/components/ui/button";

export interface OrderBilling {
  orderId: string;
  paid: boolean;
  shippedAt: string | null;
  totalTtc: string;
  expectedCaptureTtc: string;
  capture: {
    ocs_state: string;
    ocs_captured_amount_cents: number | null;
    ocs_source: string;
    ocs_checked_at?: string | null;
  } | null;
  /** Complément BM n° 2 : paiement annulé ou remboursé ⇒ ne pas expédier. */
  paymentVoid: { state: string; label: string } | null;
  adjustments: Array<{
    opa_kind: "reduction" | "supplement";
    opa_amount_ttc_cents: number;
    opa_reason: string;
    opa_supplement_ord_id?: string | null;
  }>;
  supplements: Array<{
    orderId: string;
    totalTtc: string;
    paid: boolean;
    cancelled: boolean;
  }>;
  invoice: { number: string; date: string | null; totalTtc: string } | null;
}

/** Origine de l'état d'encaissement (mandat BT : paybox_mail). */
const SOURCES: Record<string, string> = {
  manual: "saisi",
  paybox_mail: "lu dans les mails Paybox",
  paybox_direct: "lu par Paybox Direct",
};

const STATES: Array<[string, string]> = [
  ["authorized", "Autorisée, non encaissée"],
  ["captured", "Encaissée"],
  ["cancelled", "Annulée chez Verifone"],
  ["refunded", "Remboursée"],
];

const euros = (text: string | number) =>
  `${Number(text).toFixed(2).replace(".", ",")} €`;
const eurosFromCents = (cents: number) => euros(cents / 100);

async function readError(res: Response): Promise<string> {
  if (res.status === 403) {
    return "Facturation non activée ou droit manquant.";
  }
  try {
    const body = await res.json();
    const m = body?.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) {
      return m.map((i) => (typeof i === "string" ? i : i?.message)).join(" ; ");
    }
  } catch {
    /* corps illisible : statut seul */
  }
  return `Erreur ${res.status}`;
}

export function OrderBillingPanel({ orderId }: { orderId: string }) {
  const base = `/api/admin/orders/${encodeURIComponent(orderId)}/billing`;
  const [billing, setBilling] = useState<OrderBilling | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(base, { credentials: "same-origin" });
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    setBilling((await res.json()) as OrderBilling);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, body: unknown, done: (r: any) => string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${base}/${path}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setNotice(done(await res.json()));
      await load();
    } finally {
      setBusy(false);
    }
  }

  function fields(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
  }

  // Paiement annulé ou remboursé : facture, réduction et supplément fermés,
  // motif affiché. La saisie de l'état reste ouverte pour le corriger.
  const voided = billing?.paymentVoid ?? null;
  const locked = busy || voided !== null;

  const invoiceIssue = (r: any): string => {
    const inv = r?.invoice ?? r;
    if (inv?.issued) {
      return `Facture ${inv.invoiceNumber} émise (mail : ${inv.mail}).`;
    }
    return inv?.reason ? `Facture en attente : ${inv.reason}` : "Enregistré.";
  };

  return (
    <section
      aria-label="Encaissement et facture"
      className="space-y-4 rounded-lg border p-4"
    >
      <h2 className="text-lg font-semibold">Encaissement et facture</h2>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-green-700">
          {notice}
        </p>
      )}

      {billing && (
        <>
          {voided && (
            <p
              role="alert"
              data-testid="payment-void"
              className="rounded border border-red-300 bg-red-50 p-2 text-sm font-semibold text-red-800"
            >
              {voided.label} : expédition, facture, réduction et supplément
              désactivés.
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt>Total payé</dt>
            <dd>{euros(billing.totalTtc)}</dd>
            <dt>Montant à encaisser</dt>
            <dd data-testid="expected-capture">
              {euros(billing.expectedCaptureTtc)}
            </dd>
            <dt>État Verifone</dt>
            <dd data-testid="capture-state">
              {billing.capture
                ? `${STATES.find(([k]) => k === billing.capture!.ocs_state)?.[1] ?? billing.capture.ocs_state}${
                    billing.capture.ocs_captured_amount_cents != null
                      ? ` — ${eurosFromCents(billing.capture.ocs_captured_amount_cents)}`
                      : ""
                  } (${SOURCES[billing.capture.ocs_source] ?? billing.capture.ocs_source})`
                : "Non renseigné"}
            </dd>
            <dt>Expédition</dt>
            <dd>
              {billing.shippedAt
                ? new Date(billing.shippedAt).toLocaleDateString("fr-FR")
                : "Non expédiée"}
            </dd>
          </dl>

          {billing.adjustments.length > 0 && (
            <ul aria-label="Ajustements" className="list-disc pl-5 text-sm">
              {billing.adjustments.map((a, i) => (
                <li key={i}>
                  {a.opa_kind === "reduction" ? "Réduction" : "Supplément"}{" "}
                  {eurosFromCents(a.opa_amount_ttc_cents)} — {a.opa_reason}
                  {a.opa_supplement_ord_id
                    ? ` (commande ${a.opa_supplement_ord_id})`
                    : ""}
                </li>
              ))}
            </ul>
          )}

          {billing.supplements.length > 0 && (
            <ul aria-label="Suppléments" className="text-sm">
              {billing.supplements.map((s) => (
                <li key={s.orderId}>
                  {s.orderId} : {euros(s.totalTtc)} —{" "}
                  {s.cancelled
                    ? "annulé"
                    : s.paid
                      ? "payé"
                      : "en attente du client"}
                </li>
              ))}
            </ul>
          )}

          {billing.invoice ? (
            <p className="text-sm">
              Facture <strong>{billing.invoice.number}</strong> (
              {euros(billing.invoice.totalTtc)}) —{" "}
              <a className="underline" href={`${base}/invoice.pdf`} download>
                PDF
              </a>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Facture : émise automatiquement une fois la commande expédiée et
              l'encaissement confirmé.
            </p>
          )}

          {!billing.invoice && (
            <div className="grid gap-4 md:grid-cols-3">
              <form
                aria-label="Moins cher"
                className="space-y-2"
                onSubmit={(e) => {
                  const f = fields(e);
                  void post(
                    "reduction",
                    { amountTtc: f.amountTtc, reason: f.reason },
                    (r) =>
                      `Réduction enregistrée : encaisser ${euros(r.amountToCaptureTtc)} dans Verifone.`,
                  );
                }}
              >
                <h3 className="font-medium">Moins cher</h3>
                <input
                  name="amountTtc"
                  aria-label="Réduction TTC (€)"
                  required
                  className="w-full rounded border px-2 py-1"
                />
                <input
                  name="reason"
                  aria-label="Motif de la réduction"
                  required
                  minLength={3}
                  maxLength={500}
                  className="w-full rounded border px-2 py-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={locked}
                  title={voided?.label}
                >
                  Enregistrer la réduction
                </Button>
              </form>

              <form
                aria-label="Plus cher"
                className="space-y-2"
                onSubmit={(e) => {
                  const f = fields(e);
                  void post(
                    "supplement",
                    { amountTtc: f.amountTtc, reason: f.reason },
                    (r) =>
                      `Supplément ${r.supplementOrderId} créé, lien envoyé au client (mail : ${r.mail}).`,
                  );
                }}
              >
                <h3 className="font-medium">Plus cher</h3>
                <input
                  name="amountTtc"
                  aria-label="Supplément TTC (€)"
                  required
                  className="w-full rounded border px-2 py-1"
                />
                <input
                  name="reason"
                  aria-label="Motif du supplément"
                  required
                  minLength={3}
                  maxLength={500}
                  className="w-full rounded border px-2 py-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={locked}
                  title={voided?.label}
                >
                  Envoyer le lien de supplément
                </Button>
              </form>

              <form
                aria-label="État Verifone"
                className="space-y-2"
                onSubmit={(e) => {
                  const f = fields(e);
                  void post(
                    "capture-state",
                    f.state === "captured"
                      ? {
                          state: f.state,
                          capturedAmountTtc: f.capturedAmountTtc,
                        }
                      : { state: f.state },
                    invoiceIssue,
                  );
                }}
              >
                <h3 className="font-medium">État Verifone lu</h3>
                <select
                  name="state"
                  aria-label="État Verifone"
                  className="w-full rounded border px-2 py-1"
                  defaultValue="captured"
                >
                  {STATES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
                <input
                  name="capturedAmountTtc"
                  aria-label="Montant encaissé TTC (€)"
                  className="w-full rounded border px-2 py-1"
                />
                <Button type="submit" size="sm" disabled={busy}>
                  Enregistrer l'état
                </Button>
              </form>
            </div>
          )}

          {!billing.invoice && billing.shippedAt && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={locked}
              title={voided?.label}
              onClick={() => void post("issue-invoice", {}, invoiceIssue)}
            >
              Réessayer l'émission de la facture
            </Button>
          )}
        </>
      )}
    </section>
  );
}
