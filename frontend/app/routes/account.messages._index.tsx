import {
  Mail,
  MailOpen,
  Clock,
  Bell,
  Archive,
  Search,
  Send,
} from "lucide-react";
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  data,
  useLoaderData,
  useSearchParams,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { requireUserWithRedirect } from "../auth/unified.server";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";
import { formatRelativeTime } from "../utils/date";

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
 * Route: /account/messages
 * Liste des messages du client connecté, lue par l'API `api/messages` avec sa
 * session : l'API ne renvoie à un client que ses propres messages.
 */

// Message tel que le renvoie `GET /api/messages`.
interface Message {
  id: string;
  orderId?: string;
  subject: string;
  status: "open" | "closed";
  isRead: boolean;
  createdAt: string;
}

interface MessageStats {
  total: number;
  open: number;
  closed: number;
  unread: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Filtres de statut que l'API accepte. */
const STATUS_FILTERS = ["all", "open", "closed", "unread"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function parseStatus(value: string | null): StatusFilter {
  return STATUS_FILTERS.find((status) => status === value) ?? "all";
}

/** Adresse de la liste, filtres conservés. */
function listHref(filters: {
  status: StatusFilter;
  search: string;
  page?: number;
}): string {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  const query = params.toString();
  return query ? `/account/messages?${query}` : "/account/messages";
}

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await requireUserWithRedirect({ request, context });

  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));
  const search = url.searchParams.get("search")?.trim() || "";
  const page = Math.max(
    parseInt(url.searchParams.get("page") || "1", 10) || 1,
    1,
  );

  const listParams = new URLSearchParams({
    customer: String(user.id),
    page: String(page),
    status,
  });
  if (search) listParams.set("search", search);
  const statsParams = new URLSearchParams({ customer: String(user.id) });
  const headers = { Cookie: request.headers.get("Cookie") || "" };

  const [messagesResponse, statsResponse] = await Promise.all([
    fetch(
      getInternalApiUrlFromRequest(`/api/messages?${listParams}`, request),
      { headers },
    ),
    fetch(
      getInternalApiUrlFromRequest(
        `/api/messages/stats?${statsParams}`,
        request,
      ),
      { headers },
    ),
  ]);

  // Une liste vide voudrait dire « aucun message » : un refus ou une panne de
  // l'API s'affiche comme une erreur.
  const failed = [messagesResponse, statsResponse].find(
    (response) => !response.ok,
  );
  if (failed) {
    logger.error(
      "Erreur API messages:",
      messagesResponse.status,
      statsResponse.status,
    );
    throw data(
      { message: "Vos messages n'ont pas pu être chargés." },
      { status: failed.status },
    );
  }

  const messagesResult = await messagesResponse.json();
  const statsResult = await statsResponse.json();

  return {
    messages: messagesResult.data as Message[],
    pagination: messagesResult.pagination as Pagination,
    stats: statsResult.data as MessageStats,
    status,
    search,
    email: user.email,
  };
};

function MessageCard({ message }: { message: Message }) {
  const isUnread = !message.isRead;

  return (
    <Card
      className={`transition-all duration-200 hover:shadow-md ${
        isUnread ? "bg-primary/5 border-blue-200" : "bg-white"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {isUnread ? (
                <Mail className="h-4 w-4 text-blue-500 shrink-0" />
              ) : (
                <MailOpen className="h-4 w-4 text-gray-400 shrink-0" />
              )}
              <h3
                className={`font-medium truncate ${
                  isUnread ? "font-semibold text-gray-900" : "text-gray-700"
                }`}
              >
                {message.subject}
              </h3>
              {isUnread && (
                <Badge className="bg-info/20 text-info">Nouveau</Badge>
              )}
              {message.status === "closed" && (
                <Badge className="bg-gray-100 text-gray-600">Fermé</Badge>
              )}
            </div>

            {message.orderId && (
              <p className="text-sm text-gray-600">
                Commande #{message.orderId}/A
              </p>
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(message.createdAt)}
              </span>
            </div>
          </div>

          <Button size="sm" variant="outline" asChild>
            <Link to={`/account/messages/${encodeURIComponent(message.id)}`}>
              {isUnread ? "Lire" : "Voir"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      to={href}
      className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <div className="flex items-center">
        {icon}
        <span className="ml-3 text-sm font-medium">{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <Badge
          className={
            active ? "bg-info/20 text-info" : "bg-gray-100 text-gray-600"
          }
        >
          {count}
        </Badge>
      )}
    </Link>
  );
}

export default function AccountMessages() {
  const { messages, pagination, stats, status, search, email } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const justSent = searchParams.get("sent") === "1";
  const isFiltered = status !== "all" || search !== "";

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="absolute top-4 left-4 z-10">
        <PublicBreadcrumb
          items={[
            { label: "Mon Compte", href: "/account" },
            { label: "Messagerie" },
          ]}
        />
      </div>

      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Messagerie
              </h2>
              <p className="text-sm text-gray-600">Bonjour {email}</p>
            </div>
            <Link to="/account/messages/compose">
              <Button className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Nouveau message
              </Button>
            </Link>
          </div>
        </div>

        <nav className="space-y-1">
          <SidebarItem
            icon={<Mail className="w-4 h-4" />}
            label="Tous les messages"
            count={stats.total}
            active={status === "all"}
            href={listHref({ status: "all", search })}
          />
          <SidebarItem
            icon={<Bell className="w-4 h-4" />}
            label="Non lus"
            count={stats.unread}
            active={status === "unread"}
            href={listHref({ status: "unread", search })}
          />
          <SidebarItem
            icon={<MailOpen className="w-4 h-4" />}
            label="Ouverts"
            count={stats.open}
            active={status === "open"}
            href={listHref({ status: "open", search })}
          />
          <SidebarItem
            icon={<Archive className="w-4 h-4" />}
            label="Fermés"
            count={stats.closed}
            active={status === "closed"}
            href={listHref({ status: "closed", search })}
          />
        </nav>

        {/* Statistiques */}
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Statistiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Total:</span>
              <span className="font-medium">{stats.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Non lus:</span>
              <span className="font-medium text-blue-600">{stats.unread}</span>
            </div>
            <div className="flex justify-between">
              <span>Ouverts:</span>
              <span className="font-medium text-green-600">{stats.open}</span>
            </div>
            <div className="flex justify-between">
              <span>Fermés:</span>
              <span className="font-medium text-gray-600">{stats.closed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header avec recherche */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Mes Messages</h1>

            <div className="flex items-center space-x-4">
              <form method="get" className="flex items-center">
                {status !== "all" && (
                  <input type="hidden" name="status" value={status} />
                )}
                <Input
                  name="search"
                  defaultValue={search}
                  placeholder="Rechercher dans mes messages..."
                  className="w-64"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="ml-2"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Liste des messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {justSent && (
            <Alert className="mb-4 border-success bg-success/10">
              <AlertDescription className="text-green-800">
                Votre message a été envoyé.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {messages.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucun message
                  </h3>
                  <p className="text-gray-600">
                    {isFiltered
                      ? "Aucun message ne correspond à ce filtre."
                      : "Vous n'avez encore reçu aucun message."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              messages.map((message) => (
                <MessageCard key={message.id} message={message} />
              ))
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-700">
              <span>
                Page {pagination.page} sur {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                {pagination.page > 1 && (
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      to={listHref({
                        status,
                        search,
                        page: pagination.page - 1,
                      })}
                    >
                      Précédent
                    </Link>
                  </Button>
                )}
                {pagination.page < pagination.totalPages && (
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      to={listHref({
                        status,
                        search,
                        page: pagination.page + 1,
                      })}
                    >
                      Suivant
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
