import {
  type MetaFunction,
  Outlet,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";

export const meta: MetaFunction = () => [
  { title: "Ma messagerie | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/account/messages",
  },
];

/**
 * Mise en page de /account/messages.
 *
 * La liste (`account.messages._index.tsx`), le détail d'un message
 * (`account.messages.$messageId.tsx`) et la rédaction
 * (`account.messages.compose.tsx`) sont ses routes enfants : elles s'affichent
 * à l'emplacement de `<Outlet />`.
 *
 * Le nom de l'export et le bloc `meta` restent ceux d'avant : ils font partie
 * de la surface canonique de la route (R-SEO-09). Une route enfant qui déclare
 * son propre `meta` l'emporte sur celui-ci.
 */
export default function AccountMessages() {
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
