import { Outlet, useRouteError, isRouteErrorResponse } from "react-router";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";

/**
 * Mise en page de /account/messages.
 *
 * La liste (`account.messages._index.tsx`), le détail d'un message
 * (`account.messages.$messageId.tsx`) et la rédaction
 * (`account.messages.compose.tsx`) sont ses routes enfants : elles s'affichent
 * à l'emplacement de `<Outlet />`.
 */
export default function AccountMessagesLayout() {
  return <Outlet />;
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
