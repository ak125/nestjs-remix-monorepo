/**
 * Mandat CG — bloc « Écrire au client » de la fiche commande
 * (`/commercial/orders/:orderId`).
 *
 * 1. Choisir un modèle, prérempli par le backend avec la commande ; le texte
 *    reste modifiable.
 * 2. « Voir l'aperçu » : le backend rend le mail final dans la mise en page
 *    commune. Toute modification du texte efface l'aperçu.
 * 3. « Envoyer au client » : seulement après l'aperçu, d'un clic explicite.
 *    La clé `requestId` tirée à l'aperçu rend un double clic sans effet
 *    (le backend ne renvoie pas deux fois la même clé).
 *
 * Routes (même origine, cookie de session, droit `canSendEmails`) :
 * - GET  /api/admin/orders/:id/customer-mail          modèles + historique
 * - POST /api/admin/orders/:id/customer-mail/preview  aperçu, rien n'est envoyé
 * - POST /api/admin/orders/:id/customer-mail          envoi + traces
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";

export interface CustomerMailTemplate {
  template: string;
  label: string;
  subject: string;
  body: string;
}

export interface CustomerMailHistoryEntry {
  msgId: string;
  sentAt: string | null;
  authorId: string | null;
  template: string | null;
  subject: string | null;
  delivery: string | null;
  content: string | null;
}

export interface CustomerMailComposer {
  orderId: string;
  recipient: string | null;
  templates: CustomerMailTemplate[];
  history: CustomerMailHistoryEntry[] | null;
  historyError: string | null;
}

/** Demande d'ouverture du bloc sur un modèle (après une annulation). */
export interface CustomerMailOpenRequest {
  template: string;
  nonce: number;
}

const PLACEHOLDER_MARK = "[À COMPLÉTER";

const DELIVERY_LABELS: Record<string, string> = {
  sent: "envoyé",
  "test-transport": "transport d'essai : rien n'est parti",
};

async function readError(res: Response): Promise<string> {
  if (res.status === 403) return "Droit manquant pour écrire au client.";
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

function newRequestId(): string {
  return crypto.randomUUID();
}

export function OrderCustomerMailPanel({
  orderId,
  openRequest,
}: {
  orderId: string;
  openRequest?: CustomerMailOpenRequest | null;
}) {
  const base = `/api/admin/orders/${encodeURIComponent(orderId)}/customer-mail`;
  const sectionRef = useRef<HTMLElement>(null);
  const [composer, setComposer] = useState<CustomerMailComposer | null>(null);
  const [template, setTemplate] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<{
    html: string;
    complete: boolean;
    requestId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(base, { credentials: "same-origin" });
    if (!res.ok) {
      setError(await readError(res));
      return null;
    }
    const data = (await res.json()) as CustomerMailComposer;
    setComposer(data);
    return data;
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = useCallback(
    (key: string, source: CustomerMailComposer | null = composer) => {
      const t = source?.templates.find((x) => x.template === key);
      setTemplate(key);
      setSubject(t?.subject ?? "");
      setBody(t?.body ?? "");
      setPreview(null);
      setNotice(null);
      setError(null);
    },
    [composer],
  );

  // Ouverture demandée par la fiche (après « Annuler la commande »).
  const handledNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!openRequest || !composer) return;
    if (handledNonce.current === openRequest.nonce) return;
    handledNonce.current = openRequest.nonce;
    choose(openRequest.template, composer);
    sectionRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [openRequest, composer, choose]);

  function edit(setter: (v: string) => void) {
    return (e: { target: { value: string } }) => {
      setter(e.target.value);
      setPreview(null); // l'aperçu ne vaut que pour le texte affiché
    };
  }

  async function post(path: string, payload: unknown) {
    const res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readError(res));
    return res.json();
  }

  async function showPreview() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await post(`${base}/preview`, { subject, body });
      setPreview({
        html: String(r.html ?? ""),
        complete: Boolean(r.complete),
        requestId: newRequestId(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const sending = useRef(false);
  async function send() {
    if (!preview || !preview.complete || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await post(base, {
        requestId: preview.requestId,
        template,
        subject,
        body,
      });
      if (r.status === "already-sent") {
        setNotice("Ce mail a déjà été traité : aucun second envoi.");
      } else {
        const how = DELIVERY_LABELS[r.delivery] ?? r.delivery;
        setNotice(
          `Mail enregistré sur la commande (${how}).${
            r.auditRecorded === false
              ? " Attention : le journal admin n'a pas été écrit."
              : ""
          }`,
        );
      }
      setPreview(null);
      setTemplate("");
      setSubject("");
      setBody("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const hasPlaceholder =
    subject.includes(PLACEHOLDER_MARK) || body.includes(PLACEHOLDER_MARK);
  const labelOf = (key: string | null) =>
    composer?.templates.find((t) => t.template === key)?.label ?? key ?? "—";

  return (
    <section
      ref={sectionRef}
      id="ecrire-au-client"
      aria-label="Écrire au client"
      className="space-y-4 rounded-lg border p-4"
    >
      <h2 className="text-lg font-semibold">Écrire au client</h2>

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

      {composer && (
        <>
          <p className="text-sm text-muted-foreground">
            Destinataire :{" "}
            {composer.recipient ?? "aucune adresse mail sur ce client"} ·
            Expéditeur : Automecanik.com (contact@automecanik.com)
          </p>

          <label className="block text-sm font-medium">
            Modèle
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={template}
              onChange={(e) => choose(e.target.value)}
              disabled={busy}
            >
              <option value="">— Choisir un modèle —</option>
              {composer.templates.map((t) => (
                <option key={t.template} value={t.template}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {template && (
            <>
              <label className="block text-sm font-medium">
                Objet
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={subject}
                  onChange={edit(setSubject)}
                  disabled={busy}
                />
              </label>
              <label className="block text-sm font-medium">
                Texte
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
                  rows={16}
                  value={body}
                  onChange={edit(setBody)}
                  disabled={busy}
                />
              </label>
              {hasPlaceholder && (
                <p className="text-sm text-amber-700">
                  Complétez les passages « {PLACEHOLDER_MARK} … » : l'envoi est
                  refusé tant qu'il en reste.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void showPreview()}
                  disabled={busy || !subject.trim() || !body.trim()}
                >
                  Voir l'aperçu
                </Button>
                <Button
                  type="button"
                  onClick={() => void send()}
                  disabled={
                    busy || !preview || !preview.complete || !composer.recipient
                  }
                >
                  Envoyer au client
                </Button>
              </div>
              {preview && (
                <iframe
                  title="Aperçu du mail"
                  sandbox=""
                  srcDoc={preview.html}
                  className="h-96 w-full rounded border"
                />
              )}
            </>
          )}

          <div>
            <h3 className="text-sm font-semibold">Mails envoyés</h3>
            {composer.historyError ? (
              <p role="alert" className="text-sm text-red-700">
                {composer.historyError}
              </p>
            ) : composer.history && composer.history.length > 0 ? (
              <ul aria-label="Mails envoyés" className="mt-2 space-y-2 text-sm">
                {composer.history.map((h) => (
                  <li key={h.msgId} className="rounded border p-2">
                    <p className="font-medium">{h.subject ?? "—"}</p>
                    <p className="text-muted-foreground">
                      {h.sentAt
                        ? new Date(h.sentAt).toLocaleString("fr-FR")
                        : "—"}{" "}
                      · {labelOf(h.template)} ·{" "}
                      {DELIVERY_LABELS[h.delivery ?? ""] ?? h.delivery ?? "—"}
                      {h.authorId ? ` · auteur ${h.authorId}` : ""}
                    </p>
                    {h.content && (
                      <details>
                        <summary className="cursor-pointer">Texte</summary>
                        <iframe
                          title={`Texte du mail ${h.msgId}`}
                          sandbox=""
                          srcDoc={h.content}
                          className="mt-1 h-48 w-full rounded border"
                        />
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun mail envoyé depuis cette fiche.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
