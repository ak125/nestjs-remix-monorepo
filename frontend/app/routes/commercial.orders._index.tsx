/**
 * Interface Commerciale - Gestion des Commandes
 * Meme logique que admin.orders._index mais accessible level >= 3
 * Navigation vers /commercial/orders/:id pour le detail
 */

import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Alert } from "~/components/ui/alert";
import { logger } from "~/utils/logger";
import { getOptionalUser } from "../auth/unified.server";
import { OrderEditForm } from "../components/orders/OrderEditForm";
import { OrderExportButtons } from "../components/orders/OrderExportButtons";
import { OrdersFilters } from "../components/orders/OrdersFilters";
import { OrdersStats } from "../components/orders/OrdersStats";
import { OrdersTable } from "../components/orders/OrdersTable";
import { Separator } from "../components/ui/separator";

import { type ActionData, type Order } from "../types/orders.types";
import { getUserPermissions, getUserRole } from "../utils/permissions";

export const meta = () => [
  { title: "Commandes | Commercial" },
  { name: "robots", content: "noindex, nofollow" },
];

// ========================================
// ACTION
// ========================================
export const action = async ({ request, context }: ActionFunctionArgs) => {
  const user = await getOptionalUser({ context });
  if (!user || !user.level || user.level < 3) {
    return json<ActionData>({ error: "Acces refuse" }, { status: 403 });
  }

  const permissions = getUserPermissions(user.level);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const orderId = formData.get("orderId") as string;
  const cookie = request.headers.get("Cookie") || "";

  try {
    let apiUrl = "";
    let method = "POST";
    let body: string | undefined;

    switch (intent) {
      case "markPaid":
        if (!permissions.canMarkPaid)
          return json<ActionData>(
            { error: "Permission refusee" },
            { status: 403 },
          );
        apiUrl = `http://127.0.0.1:3000/api/admin/orders/${orderId}/confirm-payment`;
        break;
      case "validate":
        if (!permissions.canValidate)
          return json<ActionData>(
            { error: "Permission refusee" },
            { status: 403 },
          );
        apiUrl = `http://127.0.0.1:3000/api/admin/orders/${orderId}/validate`;
        break;
      case "ship":
        if (!permissions.canShip)
          return json<ActionData>(
            { error: "Permission refusee" },
            { status: 403 },
          );
        apiUrl = `http://127.0.0.1:3000/api/admin/orders/${orderId}/ship`;
        body = JSON.stringify({
          trackingNumber: formData.get("trackingNumber"),
        });
        break;
      case "deliver":
        if (!permissions.canDeliver)
          return json<ActionData>(
            { error: "Permission refusee" },
            { status: 403 },
          );
        apiUrl = `http://127.0.0.1:3000/api/admin/orders/${orderId}/deliver`;
        break;
      case "cancel":
        if (!permissions.canCancel)
          return json<ActionData>(
            { error: "Permission refusee" },
            { status: 403 },
          );
        apiUrl = `http://127.0.0.1:3000/api/admin/orders/${orderId}/cancel`;
        body = JSON.stringify({ reason: formData.get("reason") });
        break;
      default:
        return json<ActionData>({ error: "Action inconnue" }, { status: 400 });
    }

    const headers: Record<string, string> = { Cookie: cookie };
    if (body) headers["Content-Type"] = "application/json";

    const res = await fetch(apiUrl, { method, headers, body });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erreur" }));
      return json<ActionData>(
        { error: err.message || "Erreur" },
        { status: 500 },
      );
    }

    return json<ActionData>({
      success: true,
      message: `Action "${intent}" executee`,
    });
  } catch {
    return json<ActionData>({ error: "Erreur serveur" }, { status: 500 });
  }
};

// ========================================
// LOADER
// ========================================
interface LoaderData {
  orders: Order[];
  stats: {
    totalOrders: number;
    totalRevenue: number;
    monthRevenue: number;
    averageBasket: number;
    unpaidAmount: number;
    pendingOrders: number;
  };
  filters: {
    search: string;
    orderStatus: string;
    paymentStatus: string;
    dateRange: string;
  };
  total: number;
  currentPage: number;
  totalPages: number;
  permissions: ReturnType<typeof getUserPermissions>;
  user: { level: number; email: string; role: ReturnType<typeof getUserRole> };
}

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await getOptionalUser({ context });
  if (!user || !user.level || user.level < 3) {
    throw new Response("Acces refuse", { status: 403 });
  }

  const permissions = getUserPermissions(user.level);
  const userRole = getUserRole(user.level);

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "25");
    const search = url.searchParams.get("search") || "";
    const orderStatus = url.searchParams.get("orderStatus") || "";
    const paymentStatus = url.searchParams.get("paymentStatus") || "";

    const apiParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      excludePending: "false",
    });
    if (search) apiParams.set("search", search);
    if (orderStatus) apiParams.set("orderStatus", orderStatus);
    if (paymentStatus) apiParams.set("paymentStatus", paymentStatus);

    const cookie = request.headers.get("Cookie") || "";
    const ordersResponse = await fetch(
      `http://127.0.0.1:3000/api/legacy-orders?${apiParams.toString()}`,
      { headers: { Cookie: cookie } },
    );

    if (!ordersResponse.ok) throw new Error("Erreur chargement commandes");

    const ordersData = await ordersResponse.json();
    const rawOrders = ordersData?.data || [];
    const totalFromApi = ordersData?.pagination?.total || rawOrders.length;

    const orders = rawOrders.map((order: Order) => ({
      ...order,
      customerName: order.customer
        ? `${order.customer.cst_fname || ""} ${order.customer.cst_name || ""}`.trim() ||
          "Client inconnu"
        : "Client inconnu",
      customerEmail: order.customer?.cst_mail || "",
    }));

    const totalRevenue = orders.reduce(
      (sum: number, o: Order) => sum + parseFloat(o.ord_total_ttc || "0"),
      0,
    );

    const stats = {
      totalOrders: totalFromApi,
      totalRevenue,
      monthRevenue: 0,
      averageBasket: orders.length > 0 ? totalRevenue / orders.length : 0,
      unpaidAmount: 0,
      pendingOrders: 0,
    };

    const totalPages = Math.ceil(totalFromApi / limit);

    return json<LoaderData>({
      orders,
      stats,
      filters: { search, orderStatus, paymentStatus, dateRange: "" },
      total: totalFromApi,
      currentPage: page,
      totalPages,
      permissions,
      user: { level: user.level, email: user.email, role: userRole },
    });
  } catch (error) {
    logger.error("Loader error:", error);
    return json<LoaderData>({
      orders: [],
      stats: {
        totalOrders: 0,
        totalRevenue: 0,
        monthRevenue: 0,
        averageBasket: 0,
        unpaidAmount: 0,
        pendingOrders: 0,
      },
      filters: {
        search: "",
        orderStatus: "",
        paymentStatus: "",
        dateRange: "",
      },
      total: 0,
      currentPage: 1,
      totalPages: 0,
      permissions,
      user: { level: user.level || 0, email: user.email, role: userRole },
    });
  }
};

// ========================================
// COMPOSANT
// ========================================
export default function CommercialOrdersPage() {
  const data = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);

  const activeFilters = {
    search: data.filters.search || "",
    orderStatus: data.filters.orderStatus || "all",
    paymentStatus: data.filters.paymentStatus || "all",
    dateRange: data.filters.dateRange || "all",
  };

  const setActiveFilters = useCallback(
    (updates: Partial<typeof activeFilters>) => {
      const params = new URLSearchParams(searchParams);
      params.set("page", "1");
      Object.entries(updates).forEach(([key, value]) => {
        if (value && value !== "all" && value !== "") {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      navigate(`?${params.toString()}`, { replace: true });
    },
    [searchParams, navigate],
  );

  const resetAllFilters = useCallback(() => {
    navigate("/commercial/orders", { replace: true });
  }, [navigate]);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    navigate(`?${params.toString()}`);
  };

  const handleEditOrder = (orderId: string) => {
    const order = data.orders.find((o) => o.ord_id === orderId);
    if (order) {
      setSelectedOrder(order);
      setIsEditFormOpen(true);
    }
  };

  const handleMarkPaid = async (orderId: string) => {
    if (!confirm("Marquer cette commande comme payee ?")) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/confirm-payment`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Paiement confirme");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const err = await res.json().catch(() => ({ message: "Erreur" }));
        toast.error(err.message || "Erreur");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleShip = (orderId: string) => {
    setActionOrderId(orderId);
    setShipModalOpen(true);
  };
  const handleCancel = (orderId: string) => {
    setActionOrderId(orderId);
    setCancelModalOpen(true);
  };

  const handleShipOrder = async () => {
    if (!actionOrderId || !trackingNumber.trim()) {
      toast.error("Numero de suivi requis");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${actionOrderId}/ship`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: trackingNumber.trim() }),
      });
      if (res.ok) {
        toast.success("Commande expediee");
        setShipModalOpen(false);
        setTrackingNumber("");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const err = await res.json().catch(() => ({ message: "Erreur" }));
        toast.error(err.message || "Erreur");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!actionOrderId || !cancelReason.trim()) {
      toast.error("Raison requise");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${actionOrderId}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      if (res.ok) {
        toast.success("Commande annulee");
        setCancelModalOpen(false);
        setCancelReason("");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const err = await res.json().catch(() => ({ message: "Erreur" }));
        toast.error(err.message || "Erreur");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Gestion des Commandes
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data.stats.totalOrders} commande
              {data.stats.totalOrders > 1 ? "s" : ""} {data.user.role.badge}{" "}
              {data.user.role.label}
            </p>
          </div>
        </div>

        {/* Messages */}
        {actionData?.success && (
          <Alert intent="success" className="mb-4">
            <p>{actionData.message}</p>
          </Alert>
        )}
        {actionData?.error && (
          <Alert intent="error" className="mb-4">
            <p>{actionData.error}</p>
          </Alert>
        )}

        {/* Stats */}
        <OrdersStats stats={data.stats} />

        <Separator className="my-6" />

        {/* Filtres */}
        <OrdersFilters
          filters={activeFilters}
          onFilterChange={setActiveFilters}
          onReset={resetAllFilters}
        />

        {/* Export */}
        <div className="mt-4">
          <OrderExportButtons
            filters={activeFilters}
            selectedOrders={[]}
            allOrders={data.orders}
          />
        </div>

        <Separator className="my-6" />

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <OrdersTable
            orders={data.orders}
            permissions={data.permissions}
            currentPage={data.currentPage}
            totalPages={data.totalPages}
            onPageChange={handlePageChange}
            onEditOrder={handleEditOrder}
            onMarkPaid={handleMarkPaid}
            onShip={handleShip}
            onCancel={handleCancel}
            basePath="/commercial/orders"
          />
        </div>
      </div>

      {/* Edit Form Modal */}
      {selectedOrder && (
        <OrderEditForm
          order={selectedOrder}
          isOpen={isEditFormOpen}
          onClose={() => {
            setIsEditFormOpen(false);
            setSelectedOrder(null);
          }}
          onSuccess={() => {
            toast.success("Commande modifiee");
            setIsEditFormOpen(false);
            setSelectedOrder(null);
            setTimeout(() => window.location.reload(), 1000);
          }}
        />
      )}

      {/* Ship Modal */}
      {shipModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Expedier la commande #{actionOrderId}
            </h3>
            <div className="mb-4">
              <label
                htmlFor="trackingNumber"
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                Numero de suivi *
              </label>
              <input
                type="text"
                id="trackingNumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Ex: 1Z999AA10123456784"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleShipOrder}
                disabled={!trackingNumber.trim() || isLoading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 font-medium"
              >
                {isLoading ? "Expedition..." : "Confirmer"}
              </button>
              <button
                onClick={() => {
                  setShipModalOpen(false);
                  setTrackingNumber("");
                }}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Annuler la commande #{actionOrderId}
            </h3>
            <div className="mb-4">
              <label
                htmlFor="cancelReason"
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                Raison *
              </label>
              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Raison de l'annulation..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCancelOrder}
                disabled={!cancelReason.trim() || isLoading}
                className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50 font-medium"
              >
                {isLoading ? "Annulation..." : "Confirmer"}
              </button>
              <button
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancelReason("");
                }}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
