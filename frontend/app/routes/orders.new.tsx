/**
 * Nouvelle commande — DÉSACTIVÉ (503).
 *
 * La création de commande depuis cette route est explicitement désactivée tant
 * qu'un use case authentifié, idempotent et audité n'est pas exposé par le port.
 * Le contrat réel (idempotency `order_idempotency` + `create_order_atomic` RPC +
 * resume-token) vit dans `OrdersController`, PAS dans une méthode service qu'un
 * port pourrait appeler telle quelle. On refuse (503) plutôt que de créer des
 * commandes sans idempotence/audit — l'ancienne version appelait un
 * `createOrderForRemix` inexistant sur des produits synthétiques, avec l'auth
 * commentée : tout cela est supprimé.
 */

import {
  type ActionFunction,
  type LoaderFunction,
  type MetaFunction,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () => createNoIndexMeta("Nouvelle Commande");

const DISABLED_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  "Retry-After": "3600",
};

function disabled(): Response {
  return new Response(
    "Création de commande indisponible : aucun use case authentifié, idempotent et audité n'est exposé par le port.",
    { status: 503, headers: DISABLED_HEADERS },
  );
}

export const loader: LoaderFunction = async () => {
  throw disabled();
};

export const action: ActionFunction = async () => {
  throw disabled();
};

export default function NewOrderDisabled() {
  // Defensive: the loader always throws 503, so the ErrorBoundary renders.
  return (
    <div className="container mx-auto p-6">
      <p className="text-muted-foreground">
        La création de commande est temporairement indisponible.
      </p>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY — renders the 503 disabled state
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }
  return <ErrorGeneric />;
}
