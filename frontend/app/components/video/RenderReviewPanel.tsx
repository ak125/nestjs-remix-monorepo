import { useEffect, useState } from "react";
import { Link, useFetcher, useRevalidator } from "react-router";

export interface RenderReview {
  binding: {
    executionLogId: number;
    renderHash: string;
    productionVersion: string;
    fps: number;
    totalFrames: number;
  };
  revision: number;
  comments: Array<{
    id: string;
    authorId: string;
    createdAt: string;
    status: "open" | "resolved";
    startFrame: number;
    endFrame: number;
    target: string;
    preserve: string;
    request: string;
    source?: {
      executionLogId: number;
      commentId: string;
      startFrame: number;
      endFrame: number;
    };
  }>;
}

export function RenderReviewPanel({
  review,
  error,
}: {
  review: RenderReview | null;
  error?: string | null;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const [editing, setEditing] = useState(false);
  const [pinned, setPinned] = useState<RenderReview | null>(null);
  const busy = fetcher.state !== "idle" || revalidator.state !== "idle";
  const sameRender =
    !!review &&
    !!pinned &&
    review.binding.executionLogId === pinned.binding.executionLogId &&
    review.binding.renderHash === pinned.binding.renderHash &&
    review.binding.productionVersion === pinned.binding.productionVersion &&
    review.binding.fps === pinned.binding.fps &&
    review.binding.totalFrames === pinned.binding.totalFrames;
  const canSaveDraft =
    !busy && sameRender && review?.revision === pinned?.revision;
  // Keep the existing form mounted when a reload temporarily loses the review.
  // The pinned snapshot is only for display; saving still requires a live match.
  const displayedReview = review ?? (editing ? pinned : null);
  const refresh = (
    <button
      type="button"
      className="border rounded p-2"
      disabled={busy}
      onClick={() => {
        void revalidator.revalidate();
      }}
    >
      Actualiser la revue sans effacer la saisie
    </button>
  );
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) setEditing(false);
  }, [fetcher.state, fetcher.data]);
  if (!displayedReview)
    return (
      <section aria-label="Revue du rendu" className="border rounded p-4">
        <h2>Revue du rendu</h2>
        <p>
          {error ??
            "Ce rendu ne possède pas encore de référence vérifiable pour la revue."}
        </p>
        {refresh}
      </section>
    );
  const binding = displayedReview.binding;
  const fields = (snapshot: RenderReview) => (
    <>
      <input type="hidden" name="_intent" value="render-review" />
      <input
        type="hidden"
        name="expectedReviewRevision"
        value={snapshot.revision}
      />
      <input
        type="hidden"
        name="expectedRenderHash"
        value={snapshot.binding.renderHash}
      />
      <input
        type="hidden"
        name="expectedProductionVersion"
        value={snapshot.binding.productionVersion}
      />
    </>
  );
  return (
    <section
      aria-label="Revue du rendu"
      className="border rounded p-4 space-y-3"
    >
      <h2 className="font-semibold">Revue du rendu</h2>
      <p className="text-sm break-all">
        Version {binding.productionVersion} · SHA-256 {binding.renderHash}
      </p>
      <p className="text-sm">
        {binding.totalFrames} frames à {binding.fps} fps. Début inclus, fin
        exclue. Les commentaires restent attachés à ce rendu ; un montage
        différent exige un repositionnement explicite.
      </p>
      {refresh}
      <p className="text-sm">Révision de revue : {displayedReview.revision}</p>
      {!review && (
        <p role="alert">
          {error ?? "Revue indisponible."} Votre saisie est conservée ;
          actualisez avant d’enregistrer.
        </p>
      )}
      {editing && review && pinned && !sameRender && (
        <p role="alert">
          La référence du rendu a changé. Votre saisie reste attachée au rendu
          initial ; elle ne peut pas être transférée automatiquement.
        </p>
      )}
      {editing &&
        sameRender &&
        review &&
        pinned &&
        review.revision > pinned.revision && (
          <div className="space-y-2">
            <p>
              La revue a changé. Comparez les commentaires ci-dessous avec votre
              saisie avant d’utiliser cette révision. Aucun enregistrement
              automatique.
            </p>
            <button
              type="button"
              className="border rounded p-2"
              disabled={busy}
              onClick={() => {
                setPinned(review);
                fetcher.reset();
              }}
            >
              Utiliser cette révision en conservant ma saisie
            </button>
          </div>
        )}
      {displayedReview.comments.map((comment) => (
        <article key={comment.id} className="border rounded p-3 space-y-1">
          <p>
            <strong>{comment.target}</strong> · [{comment.startFrame},{" "}
            {comment.endFrame}) ·{" "}
            {comment.status === "open" ? "Ouvert" : "Résolu"}
          </p>
          <p>
            Auteur : {comment.authorId} · {comment.createdAt}
          </p>
          <p>À préserver : {comment.preserve || "Non précisé"}</p>
          <p>Demande : {comment.request}</p>
          <p className="text-xs break-all">Commentaire : {comment.id}</p>
          {comment.source && (
            <p>
              Repositionné depuis{" "}
              <Link
                to={`/admin/video-hub/executions/${comment.source.executionLogId}`}
              >
                le rendu {comment.source.executionLogId}
              </Link>
              , [{comment.source.startFrame}, {comment.source.endFrame}).
              L’original est conservé.
            </p>
          )}
          <fetcher.Form method="post">
            {fields(displayedReview)}
            <input type="hidden" name="commentId" value={comment.id} />
            <button
              className="underline"
              name="action"
              value={comment.status === "open" ? "resolve" : "reopen"}
              disabled={busy || editing || !review}
            >
              {comment.status === "open" ? "Marquer résolu" : "Rouvrir"}
            </button>
          </fetcher.Form>
        </article>
      ))}
      {!editing ? (
        <button
          className="border rounded p-2"
          disabled={busy || !review}
          onClick={() => {
            fetcher.reset();
            setPinned(review);
            setEditing(true);
          }}
        >
          Ajouter un commentaire
        </button>
      ) : (
        pinned && (
          <fetcher.Form
            method="post"
            className="space-y-2"
            onSubmit={(event) => {
              if (!canSaveDraft) event.preventDefault();
            }}
          >
            {fields(pinned)}
            <input type="hidden" name="action" value="add" />
            <label className="block">
              Début (frame)
              <input
                className="border block"
                name="startFrame"
                type="number"
                min="0"
                max={pinned.binding.totalFrames - 1}
                step="1"
                required
              />
            </label>
            <label className="block">
              Fin exclue (frame)
              <input
                className="border block"
                name="endFrame"
                type="number"
                min="1"
                max={pinned.binding.totalFrames}
                step="1"
                required
              />
            </label>
            <label className="block">
              Cible
              <input
                className="border block"
                name="target"
                required
                maxLength={500}
              />
            </label>
            <label className="block">
              Éléments à préserver
              <textarea
                className="border block w-full"
                name="preserve"
                maxLength={2000}
              />
            </label>
            <label className="block">
              Changement demandé
              <textarea
                className="border block w-full"
                name="request"
                required
                maxLength={4000}
              />
            </label>
            <details>
              <summary>Repositionner un commentaire d’un autre rendu</summary>
              <p>
                Indiquez sa référence et choisissez explicitement le nouvel
                intervalle ci-dessus. Aucune translation automatique après une
                coupe ou une suppression de scène.
              </p>
              <label className="block">
                Exécution d’origine
                <input
                  className="border block"
                  name="sourceExecutionId"
                  type="number"
                  min="1"
                  step="1"
                />
              </label>
              <label className="block">
                Identifiant du commentaire d’origine
                <input className="border block" name="sourceCommentId" />
              </label>
            </details>
            <button
              className="border rounded p-2"
              type="submit"
              disabled={!canSaveDraft}
            >
              Enregistrer le commentaire
            </button>{" "}
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Annuler la saisie
            </button>
          </fetcher.Form>
        )
      )}
      {fetcher.data?.ok === false && <p role="alert">{fetcher.data.error}</p>}
    </section>
  );
}
