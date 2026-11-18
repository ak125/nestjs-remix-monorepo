/**
 * Complément BM n° 2 (2026-11-18) — marque « Paiement annulé » ou
 * « Remboursée — ne pas expédier » d'une commande payée dont l'encaissement
 * est annulé ou remboursé dans Paybox.
 *
 * Source : `GET /api/admin/orders/:id/billing/payment-void` (fiche) et
 * `GET /api/admin/orders/billing/payment-voids?ids=` (liste). Les libellés
 * viennent du backend (`PAYMENT_VOID_LABEL`) et sont rendus tels quels.
 *
 * États lus : `ok` (marque ou rien), `off` (drapeau ORDER_BILLING_ENABLED
 * absent : rien n'est lu côté serveur), `unavailable` (réponse en erreur ou
 * illisible). Une indisponibilité n'est jamais rendue comme « aucune marque ».
 */
import { useEffect, useState } from "react";

interface PaymentVoidMark {
  state: string;
  label: string;
}

type Unavailable = { status: "unavailable"; httpStatus: number | null };

export type PaymentVoidRead =
  | { status: "ok"; mark: PaymentVoidMark | null }
  | { status: "off" }
  | Unavailable;

type PaymentVoidsRead =
  | { status: "ok"; byOrder: Record<string, PaymentVoidMark> }
  | { status: "off" }
  | { status: "loading" }
  | Unavailable;

/** Taille maximale d'une demande, alignée sur la route backend. */
const MAX_IDS = 100;

function markOf(v: unknown): PaymentVoidMark | null {
  if (!v || typeof v !== "object") return null;
  const { state, label } = v as Record<string, unknown>;
  return typeof label === "string" && label
    ? { state: String(state), label }
    : null;
}

async function bodyOf(res: Response): Promise<Record<string, unknown> | null> {
  if (!res.ok) return null;
  try {
    const body = await res.json();
    return body && typeof body.enabled === "boolean" ? body : null;
  } catch {
    return null;
  }
}

export async function readPaymentVoid(res: Response): Promise<PaymentVoidRead> {
  const body = await bodyOf(res);
  if (!body) return { status: "unavailable", httpStatus: res.status };
  if (!body.enabled) return { status: "off" };
  return { status: "ok", mark: markOf(body.paymentVoid) };
}

async function readPaymentVoids(res: Response): Promise<PaymentVoidsRead> {
  const body = await bodyOf(res);
  if (!body || (body.enabled && !Array.isArray(body.voids))) {
    return { status: "unavailable", httpStatus: res.status };
  }
  if (!body.enabled) return { status: "off" };
  const byOrder: Record<string, PaymentVoidMark> = {};
  for (const v of body.voids as unknown[]) {
    const mark = markOf(v);
    const orderId = (v as { orderId?: unknown }).orderId;
    if (mark && typeof orderId === "string") byOrder[orderId] = mark;
  }
  return { status: "ok", byOrder };
}

/** Marques des commandes d'une page de liste, lues côté navigateur. */
export function usePaymentVoids(orderIds: string[]): PaymentVoidsRead {
  const key = orderIds.join(",");
  const [read, setRead] = useState<PaymentVoidsRead>({ status: "loading" });

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setRead({ status: "ok", byOrder: {} });
      return;
    }
    const ctrl = new AbortController();
    setRead({ status: "loading" });
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += MAX_IDS) {
      chunks.push(ids.slice(i, i + MAX_IDS));
    }
    Promise.all(
      chunks.map((chunk) =>
        fetch(
          `/api/admin/orders/billing/payment-voids?ids=${encodeURIComponent(chunk.join(","))}`,
          { credentials: "same-origin", signal: ctrl.signal },
        ).then(readPaymentVoids),
      ),
    )
      .then((reads) => {
        const failed = reads.find((r) => r.status === "unavailable");
        if (failed) return setRead(failed);
        if (reads.some((r) => r.status === "off")) {
          return setRead({ status: "off" });
        }
        const byOrder: Record<string, PaymentVoidMark> = {};
        for (const r of reads)
          if (r.status === "ok") Object.assign(byOrder, r.byOrder);
        setRead({ status: "ok", byOrder });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setRead({ status: "unavailable", httpStatus: null });
        }
      });
    return () => ctrl.abort();
  }, [key]);

  return read;
}

/** Texte de l'avertissement quand l'état d'encaissement ne peut être lu. */
export function paymentVoidUnavailableText(httpStatus: number | null): string {
  return `État d'encaissement indisponible${
    httpStatus ? ` (HTTP ${httpStatus})` : ""
  } : vérifier dans Paybox qu'aucun paiement n'est annulé ou remboursé avant d'expédier.`;
}
