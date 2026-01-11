import { useFetcher } from "@remix-run/react";
import {
  ShoppingCart,
  CheckCircle,
  Clock,
  Euro,
  User,
  Mail,
  Calendar,
  Download,
  Plus,
  Filter,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Select, SelectItem } from "~/components/ui/select";

type Order = {
  id: string | number;
  orderNumber: string;
  customer?: { name?: string; email?: string } | null;
  transactionId?: string | null;
  total?: number;
  status?: "PAID" | "PENDING" | string;
  paymentMethod?: string | null;
  date: string | Date;
};

interface OrdersManagementProps {
  orders?: Order[];
  stats?: {
    total?: number;
    paid?: number;
    pending?: number;
    revenue?: number;
    averageCart?: number;
  };
  totalPages?: number;
  currentPage?: number;
}

export default function OrdersManagement({
  orders: initialOrders = [],
  stats = {},
  totalPages = 1,
  currentPage = 1,
}: OrdersManagementProps) {
  const fetcher = useFetcher();
  const [orders, setOrders] = useState<Order[]>(initialOrders || []);

  useEffect(() => {
    const data = fetcher.data as { orders?: Order[] } | undefined;
    if (data?.orders) setOrders(data.orders);
  }, [fetcher.data]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Commandes</h1>
          <p className="text-gray-600">
            Gérez toutes les commandes et transactions de votre plateforme
          </p>
        </div>
        <div className="flex gap-2">
          <Button>
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle Commande
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Commandes</p>
                <p className="text-2xl font-bold">{stats.total || 0}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Depuis la base de données
                </p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Commandes Payées</p>
                <p className="text-2xl font-bold">{stats.paid || 0}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Transactions confirmées
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">En Attente</p>
                <p className="text-2xl font-bold">{stats.pending || 0}</p>
                <p className="mt-1 text-xs text-gray-500">À traiter</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(stats.revenue || 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Panier moyen:{" "}
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(stats.averageCart || 0)}
                </p>
              </div>
              <Euro className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Rechercher une commande..."
                className="w-full"
              />
            </div>
            <Select
              className="w-[180px]"
              defaultValue="all"
              placeholder="Tous les statuts"
            >
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="paid">Payées</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="cancelled">Annulées</SelectItem>
            </Select>
            <Button>
              <Filter className="mr-2 h-4 w-4" /> Plus de filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des Commandes</CardTitle>
          <p className="text-sm text-gray-600">
            Toutes les commandes depuis la base de données - {orders.length}{" "}
            commandes affichées
          </p>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <p className="text-gray-500">Aucune commande trouvée</p>
              <p className="mt-2 text-sm text-gray-400">
                Les commandes apparaîtront ici une fois créées
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold">
                        {order.orderNumber}
                      </p>
                      <p className="text-sm text-gray-600">
                        <User className="mr-1 inline h-3 w-3" />
                        {order.customer?.name || "Client inconnu"}
                      </p>
                      <p className="text-sm text-gray-600">
                        <Mail className="mr-1 inline h-3 w-3" />
                        {order.customer?.email || "Email non disponible"}
                      </p>
                      {order.transactionId && (
                        <p className="text-xs text-gray-500">
                          TX: {order.transactionId.substring(0, 15)}...
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(order.total || 0)}
                      </p>
                      <Badge
                        className={
                          order.status === "PAID" ? "success" : "warning"
                        }
                      >
                        {order.status === "PAID" ? "Payée" : "En attente"}
                      </Badge>
                      <p className="text-xs text-gray-500">
                        {order.paymentMethod || "N/A"}
                      </p>
                      <p className="text-xs text-gray-500">
                        <Calendar className="mr-1 inline h-3 w-3" />
                        {new Date(order.date).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button>Détails</Button>
                    <Button>Marquer comme payée</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Page {currentPage} sur {totalPages}
        </p>
        <div className="flex gap-2">
          <Button disabled={currentPage <= 1}>Précédent</Button>
          <Button disabled={currentPage >= totalPages}>Suivant</Button>
        </div>
      </div>
    </div>
  );
}
