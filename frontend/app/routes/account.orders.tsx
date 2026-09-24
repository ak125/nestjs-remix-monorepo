import { ShoppingBag } from "lucide-react";
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
  Link,
  useSearchParams,
  Form,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { logger } from "~/utils/logger";
import { requireAuth } from "../auth/unified.server";
import { AccountLayout } from "../components/account/AccountNavigation";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";
import { getUserOrders } from "../services/orders.server";
import { formatPrice } from "../utils/orders";
import {
  ORDER_STATUS_OPTIONS,
  getStatusBadgeColor,
  getStatusLabel,
} from "../utils/orders.utils";

/**
 * Année de la plus ancienne commande en base : le filtre propose chaque année
 * depuis celle-ci jusqu'à l'année en cours.
 */
const FIRST_ORDER_YEAR = 2020;

export const meta: MetaFunction = () => [
  { title: "Mes commandes | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/account/orders",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // ✅ Utilisation de requireAuth au lieu de requireUser
    const user = await requireAuth(request);

    // ✅ Vérification et adaptation de la structure utilisateur
    const userId = user?.id || user?.cst_id;
    if (!user || !userId) {
      logger.error("User or user.id is undefined:", user);
      throw new Response("Utilisateur non trouvé", { status: 401 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const status = url.searchParams.get("status") || "all";
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam) : undefined;

    logger.log("Fetching orders for user:", userId);

    const { orders, pagination } = await getUserOrders({
      userId: userId,
      page,
      status,
      year,
      request, // Transmission de la requête pour les cookies
    });

    return { orders, pagination, user };
  } catch (error) {
    logger.error("Error in loader:", error);

    // Retour avec des données vides en cas d'erreur
    return {
      orders: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
      },
      user: null,
      error: "Impossible de charger les commandes",
    };
  }
}

export default function OrdersListPage() {
  const { orders, pagination, user } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Erreur de chargement</p>
          <Button asChild>
            <Link to="/login">Se connecter</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - FIRST_ORDER_YEAR + 1 },
    (_, i) => currentYear - i,
  );

  return (
    <AccountLayout
      user={user}
      stats={{ orders: { pending: 0 }, messages: { unread: 0 } }}
    >
      <div className="space-y-6">
        {/* Breadcrumb */}
        <PublicBreadcrumb
          items={[
            { label: "Mon Compte", href: "/account" },
            { label: "Mes Commandes" },
          ]}
        />

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mes commandes</h1>
            <p className="text-muted-foreground">
              Suivez l'état de vos commandes et téléchargez vos factures
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            <span className="text-sm text-muted-foreground">
              {pagination.totalCount} commande
              {pagination.totalCount > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Filtres */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtrer les commandes</CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="get" className="flex flex-wrap gap-4">
              <div className="flex flex-col space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Statut
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={searchParams.get("status") || "all"}
                  className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="all">Tous les statuts</option>
                  {ORDER_STATUS_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-2">
                <label htmlFor="year" className="text-sm font-medium">
                  Année
                </label>
                <select
                  id="year"
                  name="year"
                  defaultValue={searchParams.get("year") || ""}
                  className="flex h-10 w-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Toutes</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <Button type="submit" variant="outline">
                  Filtrer
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>

        {/* Liste des commandes */}
        {orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Commande #{order.orderNumber}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Passée le{" "}
                        {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    {/* Pas de <Badge> : sa variante par défaut (bg-primary)
                        écrase les couleurs de statut, faute de fusion des
                        classes. */}
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${getStatusBadgeColor(order.status ?? "")}`}
                    >
                      {getStatusLabel(order.status ?? "")}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Articles de la commande */}
                  <div className="space-y-3">
                    {order.lines.slice(0, 3).map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                      >
                        <img
                          src={line.productImage}
                          alt={line.productName}
                          className="h-12 w-12 rounded-md object-cover bg-background"
                        />
                        <div className="flex-1">
                          <p className="font-medium">{line.productName}</p>
                          <p className="text-sm text-muted-foreground">
                            {line.quantity} × {formatPrice(line.unitPrice)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {order.lines.length > 3 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        + {order.lines.length - 3} autre
                        {order.lines.length - 3 > 1 ? "s" : ""} article
                        {order.lines.length - 3 > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>

                  {/* Total et actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-lg font-semibold">
                      Total: {formatPrice(order.totalTTC)}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" asChild>
                        <Link
                          to={`/account/orders/${order.ord_id || order.id || order.orderNumber}`}
                        >
                          Voir le détail
                        </Link>
                      </Button>

                      {order.isPaid && (
                        <Button variant="secondary" asChild>
                          <Link
                            to={`/account/orders/${order.ord_id || order.id}/invoice`}
                          >
                            Facture
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Aucune commande trouvée
              </h3>
              <p className="text-muted-foreground mb-6 text-center">
                Vous n'avez pas encore passé de commande ou aucune commande ne
                correspond à vos filtres.
              </p>
              <Button asChild>
                <Link to="/">Découvrir nos produits</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Card>
            <CardContent className="flex justify-center py-4">
              <div className="flex gap-2">
                {Array.from(
                  { length: pagination.totalPages },
                  (_, i) => i + 1,
                ).map((page) => (
                  <Button
                    key={page}
                    variant={
                      page === pagination.currentPage ? "default" : "outline"
                    }
                    size="sm"
                    asChild
                  >
                    <Link
                      to={`?${new URLSearchParams({
                        ...Object.fromEntries(searchParams.entries()),
                        page: page.toString(),
                      })}`}
                    >
                      {page}
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AccountLayout>
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
