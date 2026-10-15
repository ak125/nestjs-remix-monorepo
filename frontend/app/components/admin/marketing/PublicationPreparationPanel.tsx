import { useEffect, useId, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectItem } from "~/components/ui/select";
import {
  loadPreparations,
  downloadPreparation,
  preparationRequestSchema,
  PreparationError,
  savePreparation,
  type PreparationFields,
  type PreparationRecord,
  type PreparationRequest,
  type PreparationTarget,
} from "~/services/api/marketing-publication.api";
import { safeSessionStorage } from "~/utils/safe-storage";

export function PublicationPreparationPanel({
  target,
  canPrepare,
  onReload,
}: {
  target: PreparationTarget;
  canPrepare: boolean;
  onReload: () => void;
}) {
  const id = useId();
  const { register, control, handleSubmit, reset } = useForm<PreparationFields>(
    {
      defaultValues: { account: { label: "", external_id: "" }, media: [] },
    },
  );
  const { fields, append, remove } = useFieldArray({ control, name: "media" });
  const [candidate, setCandidate] = useState<PreparationRequest | null>(null);
  const [saved, setSaved] = useState<PreparationRecord | null>(null);
  const [retry, setRetry] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<PreparationRecord[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const sending = useRef(false);
  const historyRequest = useRef<AbortController | null>(null);
  const storageKey = `automecanik:preparation:${target.post_id}:${target.channel}:${target.content_revision}:${target.review_version}`;
  const eligible =
    canPrepare &&
    ["facebook", "instagram", "youtube"].includes(target.channel) &&
    Number.isSafeInteger(target.content_revision) &&
    target.content_revision > 0 &&
    Number.isSafeInteger(target.review_version) &&
    target.review_version >= 0;

  useEffect(() => {
    // A retry receipt, never an approval authority. Keep it even after success:
    // reopening/reloading must confirm the same server record, not create another.
    try {
      // A failed read must differ from an absent receipt to avoid duplicate requests.
      // eslint-disable-next-line no-restricted-syntax -- caught below; safe storage conflates read failure and absence
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const receipt = preparationRequestSchema.parse(JSON.parse(raw));
        if (
          receipt.channel !== target.channel ||
          receipt.content_revision !== target.content_revision ||
          receipt.review_version !== target.review_version
        )
          throw new Error();
        setCandidate(receipt);
        setRetry(true);
        reset({ account: receipt.account, media: receipt.media });
        setMessage(
          "Une demande précédente doit être confirmée. Réessayez la même demande pour retrouver son enregistrement.",
        );
      }
    } catch {
      setBlocked(true);
      setMessage(
        "La reprise locale est indisponible. Consultez l’historique avant de poursuivre dans une session disposant du stockage navigateur.",
      );
    }
    return () => historyRequest.current?.abort();
  }, [
    storageKey,
    target.channel,
    target.content_revision,
    target.review_version,
    reset,
  ]);

  function review(fields: PreparationFields) {
    setMessage("");
    try {
      const payload = preparationRequestSchema.parse({
        request_id: crypto.randomUUID(),
        channel: target.channel,
        content_revision: target.content_revision,
        review_version: target.review_version,
        ...fields,
      });
      setCandidate(payload);
      setRetry(false);
    } catch {
      setMessage(
        "Vérifiez le compte et les références des médias : champs complets, empreinte SHA-256 valide et aucun fichier en double.",
      );
    }
  }

  async function save() {
    if (!candidate || sending.current || blocked || !eligible) return;
    sending.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (!safeSessionStorage.setItem(storageKey, JSON.stringify(candidate))) {
        setMessage(
          "Impossible de conserver la demande pour un nouvel essai. Aucun enregistrement n’a été envoyé.",
        );
        return;
      }
      const result = await savePreparation(target.post_id, candidate);
      // A GET started before the save must not replace history with an older view.
      historyRequest.current?.abort();
      setHistoryBusy(false);
      setHistoryError("");
      setSaved(result);
      setRetry(false);
      // Existing history may be incomplete; make the newly confirmed record visible.
      setHistory((previous) =>
        previous
          ? [
              result,
              ...previous.filter(
                (item) => item.request_id !== result.request_id,
              ),
            ].slice(0, 50)
          : previous,
      );
    } catch (error) {
      if (
        error instanceof PreparationError &&
        ["conflict", "denied"].includes(error.kind)
      ) {
        setBlocked(true);
        setRetry(false);
        setMessage(
          error.kind === "conflict"
            ? "Le contenu ou une décision a changé, ou cette demande est déjà utilisée. Rechargez le contenu et relisez l’historique."
            : "Accès refusé. Votre session administrateur doit être vérifiée avant de poursuivre.",
        );
      } else if (
        error instanceof PreparationError &&
        error.kind === "invalid"
      ) {
        if (!safeSessionStorage.removeItem(storageKey)) {
          setBlocked(true);
        }
        setCandidate(null);
        setRetry(false);
        setMessage(
          "Préparation refusée. Vérifiez les références et l’approbation du réseau avant un nouvel essai.",
        );
      } else {
        setRetry(true);
        setMessage(
          "Enregistrement non confirmé. Réessayez la même demande ; son identifiant est conservé pour éviter un doublon.",
        );
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function readHistory() {
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    setHistoryBusy(true);
    setHistoryError("");
    setHistory(null);
    try {
      const records = await loadPreparations(target.post_id, controller.signal);
      if (!controller.signal.aborted)
        setHistory(
          records.filter((record) => record.channel === target.channel),
        );
    } catch {
      if (!controller.signal.aborted)
        setHistoryError(
          "Historique indisponible. Réessayez la lecture avant de créer une autre préparation.",
        );
    } finally {
      if (!controller.signal.aborted) setHistoryBusy(false);
    }
  }

  function correctBinding() {
    if (!safeSessionStorage.removeItem(storageKey)) {
      setMessage(
        "Impossible de conserver la demande. La préparation précédente reste enregistrée.",
      );
      return;
    }
    setSaved(null);
    setCandidate(null);
    setRetry(false);
    setMessage("");
  }

  return (
    <section
      className="space-y-4 rounded-lg border p-4"
      aria-labelledby={`${id}-title`}
    >
      <h3 id={`${id}-title`} className="font-semibold">
        Préparation de publication · {target.channel}
      </h3>
      <p className="text-sm text-muted-foreground">
        Publication non autorisée : le compte et les fichiers doivent encore
        être vérifiés, puis la publication approuvée séparément.
      </p>
      {!eligible && (
        <p className="text-sm">
          Approuvez le contenu de ce réseau et de cette version avant de
          préparer son rattachement.
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      {blocked && (
        <Button type="button" variant="outline" onClick={onReload}>
          Recharger le contenu
        </Button>
      )}
      {eligible && !blocked && !candidate && !saved && (
        <form onSubmit={handleSubmit(review)} className="space-y-4">
          <p className="text-sm">
            Le contenu affiché au-dessus sera rattaché au compte déclaré
            ci-dessous.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-label`}>Nom du compte</Label>
              <Input
                id={`${id}-label`}
                autoComplete="off"
                required
                maxLength={200}
                {...register("account.label", { required: true })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-account`}>
                Identifiant du compte sur {target.channel}
              </Label>
              <Input
                id={`${id}-account`}
                autoComplete="off"
                required
                maxLength={200}
                {...register("account.external_id", { required: true })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Renseignez l’identifiant du compte destinataire, jamais un mot de
            passe ou un jeton d’accès. Il ne sera pas vérifié à cette étape.
          </p>
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Fichiers existants — facultatifs à cette étape
            </p>
            <p className="text-xs text-muted-foreground">
              Utilisez les références fournies avec les médias finalisés. Aucun
              fichier n’est envoyé ni téléchargé ici.
            </p>
            {fields.map((field, index) => (
              <fieldset key={field.id} className="space-y-2 rounded border p-3">
                <legend className="px-1 text-sm">Média {index + 1}</legend>
                <Label htmlFor={`${id}-role-${index}`}>
                  Usage · média {index + 1}
                </Label>
                <Select
                  id={`${id}-role-${index}`}
                  {...register(`media.${index}.role`)}
                >
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Vidéo finale</SelectItem>
                  <SelectItem value="thumbnail">Miniature</SelectItem>
                  <SelectItem value="subtitles">Sous-titres</SelectItem>
                </Select>
                <Label htmlFor={`${id}-bucket-${index}`}>
                  Espace de stockage · média {index + 1}
                </Label>
                <Input
                  id={`${id}-bucket-${index}`}
                  required
                  maxLength={100}
                  {...register(`media.${index}.bucket`, { required: true })}
                />
                <Label htmlFor={`${id}-path-${index}`}>
                  Chemin du fichier · média {index + 1}
                </Label>
                <Input
                  id={`${id}-path-${index}`}
                  required
                  maxLength={512}
                  {...register(`media.${index}.path`, { required: true })}
                />
                <Label htmlFor={`${id}-sha-${index}`}>
                  Empreinte SHA-256 · média {index + 1}
                </Label>
                <Input
                  id={`${id}-sha-${index}`}
                  required
                  minLength={64}
                  maxLength={64}
                  {...register(`media.${index}.sha256`, { required: true })}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => remove(index)}
                >
                  Retirer le média {index + 1}
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={fields.length >= 20}
              onClick={() =>
                append({ bucket: "", path: "", sha256: "", role: "image" })
              }
            >
              Ajouter un média existant
            </Button>
          </div>
          <Button type="submit">Relire la préparation</Button>
        </form>
      )}
      {eligible && candidate && !saved && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Post #{target.post_id} · {target.channel} · version{" "}
            {candidate.content_revision}
          </p>
          <BindingSummary account={candidate.account} media={candidate.media} />
          {!blocked && (
            <div className="flex flex-wrap gap-2">
              {!retry && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setCandidate(null)}
                >
                  Retour au formulaire
                </Button>
              )}
              <Button type="button" disabled={busy} onClick={save}>
                {busy
                  ? "Enregistrement…"
                  : retry
                    ? "Réessayer la même demande"
                    : "Confirmer l’enregistrement"}
              </Button>
            </div>
          )}
        </div>
      )}
      {saved && (
        <div className="space-y-3 rounded border p-3">
          <p role="status" className="font-medium">
            Préparation enregistrée · version {saved.content_revision}
          </p>
          <BindingSummary account={saved.account} media={saved.media} />
          <p className="text-xs text-muted-foreground">
            Enregistrée par {saved.actor} le {saved.created_at}. Le contenu n’a
            pas été publié.
          </p>
          <Button type="button" variant="outline" onClick={correctBinding}>
            Corriger le rattachement
          </Button>
          <p className="text-xs text-muted-foreground">
            Une correction crée une nouvelle préparation et conserve celle-ci
            dans l’historique.
          </p>
          <PreparationExportButton preparation={saved} />
        </div>
      )}
      <div className="space-y-3 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          disabled={historyBusy}
          onClick={readHistory}
        >
          {historyBusy
            ? "Chargement de l’historique…"
            : "Charger les préparations précédentes"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Instantanés historiques du réseau parmi les 50 dernières préparations
          du post. Leur approbation ne prouve pas que le contenu actuel est
          approuvé.
        </p>
        {historyError && (
          <p role="alert" className="text-sm text-destructive">
            {historyError}
          </p>
        )}
        {history?.length === 0 && (
          <p className="text-sm">
            Aucune préparation de ce réseau dans les 50 derniers
            enregistrements.
          </p>
        )}
        {history?.map((entry) => (
          <details
            key={entry.request_id}
            className="rounded border p-3 text-sm"
          >
            <summary className="cursor-pointer">
              {entry.account.label} · version {entry.content_revision} ·{" "}
              {entry.created_at}
            </summary>
            <div className="mt-3 space-y-3">
              <BindingSummary account={entry.account} media={entry.media} />
              <HistoricalContent entry={entry} />
              <p>
                Approbation éditoriale historique de{" "}
                {entry.approval_snapshot.actor} le{" "}
                {entry.approval_snapshot.decided_at}.
              </p>
              <p>
                Préparation enregistrée par {entry.actor}. Aucune autorisation
                de publication.
              </p>
              <p className="break-all text-xs text-muted-foreground">
                Référence : {entry.request_id}
              </p>
              <PreparationExportButton preparation={entry} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function PreparationExportButton({
  preparation,
}: {
  preparation: PreparationRecord;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const sending = useRef(false);
  async function download() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      await downloadPreparation(preparation);
      setMessage(
        "Téléchargement préparé. Ce fichier n’autorise pas la publication ; les médias restent à vérifier séparément.",
      );
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof PreparationError && error.kind === "conflict"
          ? "Export refusé : la préparation est absente ou son contenu n’est plus approuvé. Rechargez le contenu avant une nouvelle préparation."
          : error instanceof PreparationError && error.kind === "denied"
            ? "Export refusé : vérifiez votre session administrateur."
            : "Export indisponible ou incohérent. Aucun fichier n’a été téléchargé ; réessayez la lecture.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={download}
      >
        {busy
          ? "Vérification de l’export…"
          : "Exporter cette préparation (JSON)"}
      </Button>
      {message && (
        <p role={failed ? "alert" : "status"} className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

function BindingSummary({ account, media }: PreparationFields) {
  return (
    <div className="space-y-2 text-sm">
      <p className="break-words">
        Compte déclaré : {account.label} · {account.external_id}
      </p>
      {media.length === 0 ? (
        <p>
          Aucun média rattaché. La préparation reste incomplète si ce format en
          nécessite un.
        </p>
      ) : (
        <ul className="space-y-2">
          {media.map((item) => (
            <li key={`${item.bucket}/${item.path}`} className="break-all">
              {item.role} : {item.bucket}/{item.path}
              <span className="block text-xs text-muted-foreground">
                SHA-256 déclaré : {item.sha256}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoricalContent({ entry }: { entry: PreparationRecord }) {
  const channels = entry.editorial_snapshot.channels;
  const content =
    channels && typeof channels === "object"
      ? (channels as Record<string, unknown>)[entry.channel]
      : null;
  if (!content || typeof content !== "object" || Array.isArray(content))
    return <p>Contenu historique non lisible.</p>;
  const labels: Record<string, string> = {
    title: "Titre",
    caption: "Texte",
    description: "Description",
    hashtags: "Hashtags",
    tags: "Tags",
    hook_script: "Accroche",
    alt_text: "Texte alternatif",
    format: "Format",
    visual_brief: "Brief visuel",
    thumbnail_brief: "Brief miniature",
  };
  return (
    <div className="space-y-2">
      <p className="font-medium">Contenu conservé dans cette préparation</p>
      {Object.entries(content).map(([key, value]) =>
        typeof value === "string" ||
        (Array.isArray(value) &&
          value.every((part) => typeof part === "string")) ? (
          <div key={key}>
            <p className="text-xs text-muted-foreground">
              {labels[key] ?? key}
            </p>
            <p className="whitespace-pre-wrap break-words">
              {Array.isArray(value) ? value.join(" ") : value}
            </p>
          </div>
        ) : null,
      )}
    </div>
  );
}
