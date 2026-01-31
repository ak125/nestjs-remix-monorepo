/**
 * 📦 Gestion des expéditions - Interface principale
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, Form } from "@remix-run/react";
import {
  Truck,
  Package,
  Clock,
  CheckCircle,
  Search,
  Filter,
  Download,
  Eye,
  TrendingUp,
  Globe,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui";
import { Button } from "~/components/ui/button";

// Types pour les expéditions
interface ShippingOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: number;
  totalPrice: number;
  shippingFee: number;
  deliveryMethod?: string;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;

  // Adresse de livraison
  shippingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    postalCode: string;
    city: string;
    country: string;
  };

  // Infos calculées
  deliveryZone?: string;
  estimatedDelivery?: string;
  shippingStatus: "pending" | "shipped" | "delivered" | "returned";
}

interface ShippingStats {
  totalShipments: number;
  pendingShipments: number;
  shippedOrders: number;
  deliveredOrders: number;
  averageShippingFee: number;
  totalShippingRevenue: number;

  // Par zone
  zoneStats: {
    france: number;
    corsica: number;
    domTom: number;
    europe: number;
    international: number;
  };
}

interface LoaderData {
  orders: ShippingOrder[];
  stats: ShippingStats;
  totalOrders: number;
  currentPage: number;
  limit: number;
  filters: {
    search: string;
    status: string;
    zone: string;
    trackingStatus: string;
  };
}

// Fonction utilitaire pour déterminer la zone de livraison
function getDeliveryZone(country: string, postalCode: string): string {
  if (!country) return "unknown";

  const countryLower = country.toLowerCase();

  if (countryLower.includes("france") || countryLower === "fr") {
    if (postalCode.startsWith("20")) return "corsica";
    if (
      [
        "971",
        "972",
        "973",
        "974",
        "975",
        "976",
        "977",
        "978",
        "984",
        "986",
        "987",
        "988",
      ].some((dom) => postalCode.startsWith(dom))
    ) {
      return "domTom";
    }
    return "france";
  }

  // Zones Europe
  const euCountries = [
    "de",
    "germany",
    "it",
    "italy",
    "es",
    "spain",
    "pt",
    "portugal",
    "be",
    "belgium",
    "nl",
    "netherlands",
    "lu",
    "luxembourg",
    "at",
    "austria",
    "ch",
    "switzerland",
  ];
  if (euCountries.some((eu) => countryLower.includes(eu))) {
    return "europe";
  }

  return "international";
}

// Fonction pour obtenir le statut d'expédition basé sur le statut de commande
function getShippingStatus(
  orderStatus: number,
): "pending" | "shipped" | "delivered" | "returned" {
  switch (orderStatus) {
    case 1:
    case 2:
      return "pending";
    case 3:
    case 4:
      return "shipped";
    case 5:
      return "delivered";
    case 6:
    case 7:
      return "returned";
    default:
      return "pending";
  }
}

// Fonction pour obtenir le libellé du statut
function getShippingStatusLabel(
  status: "pending" | "shipped" | "delivered" | "returned",
): string {
  switch (status) {
    case "pending":
      return "En préparation";
    case "shipped":
      return "Expédiée";
    case "delivered":
      return "Livrée";
    case "returned":
      return "Retournée";
    default:
      return "Inconnu";
  }
}

// Fonction pour obtenir la couleur du statut
// Helper function to get Badge variant from shipping status
function getShippingStatusVariant(
  status: "pending" | "shipped" | "delivered" | "returned",
): "warning" | "info" | "success" | "error" | "default" {
  switch (status) {
    case "pending":
      return "warning";
    case "shipped":
      return "info";
    case "delivered":
      return "success";
    case "returned":
      return "error";
    default:
      return "default";
  }
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const zone = url.searchParams.get("zone") || "";
  const trackingStatus = url.searchParams.get("trackingStatus") || "";

  try {
    console.log("🚚 Chargement des données d'expédition...");

    // Récupérer les commandes avec informations de livraison via l'API existante
    const ordersUrl = new URL(
      "http://127.0.0.1:3000/api/dashboard/orders/recent",
    );
    ordersUrl.searchParams.set("page", page.toString());
    ordersUrl.searchParams.set("limit", limit.toString());
    if (search) ordersUrl.searchParams.set("search", search);

    const [ordersResponse] = await Promise.all([fetch(ordersUrl.toString())]);

    const ordersData = await ordersResponse.json();

    // Transformer les données pour l'interface shipping
    const rawOrders = ordersData.orders || [];
    const orders: ShippingOrder[] = rawOrders.map((order: any) => {
      const shippingStatus = getShippingStatus(order.status || 1);
      const deliveryZone = getDeliveryZone(
        order.shippingAddress?.country ||
          order.deliveryAddress?.country ||
          order.country ||
          "France",
        order.shippingAddress?.postalCode ||
          order.deliveryAddress?.postalCode ||
          order.postalCode ||
          "",
      );

      return {
        id: order.id?.toString() || order.ord_id?.toString(),
        orderNumber: order.orderNumber || `CMD-${order.id || order.ord_id}`,
        customerId:
          order.customerId?.toString() || order.ord_cst_id?.toString() || "",
        customerName:
          order.customerName ||
          order.customer_name ||
          `${order.firstName || ""} ${order.lastName || ""}`.trim() ||
          "Client inconnu",
        customerEmail: order.customerEmail || order.customer_email || "",
        status: order.status || 1,
        totalPrice: parseFloat(
          order.totalPrice || order.total_price || order.ord_total_price || 0,
        ),
        shippingFee: parseFloat(
          order.shippingFee ||
            order.shipping_fee ||
            order.deliveryPrice ||
            order.ord_delivery_price ||
            0,
        ),
        deliveryMethod:
          order.deliveryMethod || order.delivery_method || "Standard",
        trackingNumber: order.trackingNumber || order.tracking_number,
        createdAt: order.createdAt || order.created_at || order.ord_created_at,
        updatedAt: order.updatedAt || order.updated_at || order.ord_updated_at,

        shippingAddress: {
          firstName:
            order.shippingAddress?.firstName ||
            order.deliveryAddress?.firstName ||
            order.shipping_first_name ||
            order.delivery_first_name ||
            order.firstName ||
            "",
          lastName:
            order.shippingAddress?.lastName ||
            order.deliveryAddress?.lastName ||
            order.shipping_last_name ||
            order.delivery_last_name ||
            order.lastName ||
            "",
          company:
            order.shippingAddress?.company ||
            order.deliveryAddress?.company ||
            order.shipping_company ||
            order.delivery_company ||
            "",
          address1:
            order.shippingAddress?.address1 ||
            order.deliveryAddress?.address1 ||
            order.shipping_address1 ||
            order.delivery_address1 ||
            order.address ||
            "",
          address2:
            order.shippingAddress?.address2 ||
            order.deliveryAddress?.address2 ||
            order.shipping_address2 ||
            order.delivery_address2 ||
            "",
          postalCode:
            order.shippingAddress?.postalCode ||
            order.deliveryAddress?.postalCode ||
            order.shipping_postal_code ||
            order.delivery_postal_code ||
            order.postalCode ||
            "",
          city:
            order.shippingAddress?.city ||
            order.deliveryAddress?.city ||
            order.shipping_city ||
            order.delivery_city ||
            order.city ||
            "",
          country:
            order.shippingAddress?.country ||
            order.deliveryAddress?.country ||
            order.shipping_country ||
            order.delivery_country ||
            order.country ||
            "France",
        },

        deliveryZone,
        shippingStatus,
        estimatedDelivery: order.estimatedDelivery || order.estimated_delivery,
      };
    });

    // Appliquer les filtres côté client
    let filteredOrders = orders;

    if (status) {
      filteredOrders = filteredOrders.filter(
        (order) => order.status.toString() === status,
      );
    }

    if (zone) {
      filteredOrders = filteredOrders.filter(
        (order) => order.deliveryZone === zone,
      );
    }

    if (trackingStatus) {
      filteredOrders = filteredOrders.filter(
        (order) => order.shippingStatus === trackingStatus,
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredOrders = filteredOrders.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(searchLower) ||
          order.customerName.toLowerCase().includes(searchLower) ||
          order.customerEmail.toLowerCase().includes(searchLower) ||
          (order.trackingNumber &&
            order.trackingNumber.toLowerCase().includes(searchLower)),
      );
    }

    // Calculer les statistiques d'expédition
    const stats: ShippingStats = {
      totalShipments: orders.length,
      pendingShipments: orders.filter((o) => o.shippingStatus === "pending")
        .length,
      shippedOrders: orders.filter((o) => o.shippingStatus === "shipped")
        .length,
      deliveredOrders: orders.filter((o) => o.shippingStatus === "delivered")
        .length,
      averageShippingFee:
        orders.length > 0
          ? orders.reduce((sum, o) => sum + o.shippingFee, 0) / orders.length
          : 0,
      totalShippingRevenue: orders.reduce((sum, o) => sum + o.shippingFee, 0),

      zoneStats: {
        france: orders.filter((o) => o.deliveryZone === "france").length,
        corsica: orders.filter((o) => o.deliveryZone === "corsica").length,
        domTom: orders.filter((o) => o.deliveryZone === "domTom").length,
        europe: orders.filter((o) => o.deliveryZone === "europe").length,
        international: orders.filter((o) => o.deliveryZone === "international")
          .length,
      },
    };

    return json({
      orders: filteredOrders,
      stats,
      totalOrders: filteredOrders.length,
      currentPage: page,
      limit,
      filters: {
        search,
        status,
        zone,
        trackingStatus,
      },
    });
  } catch (error) {
    console.error("Erreur chargement expéditions commercial:", error);
    return json({
      orders: [],
      stats: {
        totalShipments: 0,
        pendingShipments: 0,
        shippedOrders: 0,
        deliveredOrders: 0,
        averageShippingFee: 0,
        totalShippingRevenue: 0,
        zoneStats: {
          france: 0,
          corsica: 0,
          domTom: 0,
          europe: 0,
          international: 0,
        },
      },
      totalOrders: 0,
      currentPage: 1,
      limit: 20,
      filters: { search: "", status: "", zone: "", trackingStatus: "" },
    });
  }
}

export default function CommercialShippingIndex() {
  const { orders, stats, totalOrders, currentPage, limit, filters } =
    useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Pagination
  const totalPages = Math.ceil(totalOrders / limit);
  const startIndex = (currentPage - 1) * limit + 1;
  const endIndex = Math.min(currentPage * limit, totalOrders);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-600" />
              Gestion des Expéditions
            </h1>
            <p className="text-gray-600 mt-1">
              Suivi et gestion des livraisons commerciales
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              to="/commercial/shipping/create"
              className="bg-success hover:bg-success/90 text-success-foreground px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Package className="w-4 h-4" />
              Créer expédition
            </Link>
            <Link
              to="/commercial/shipping/tracking"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Suivi temps réel
            </Link>
            <Link
              to="/commercial/returns"
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retours
            </Link>
            <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Statistiques d'expédition */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Expéditions
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalShipments.toLocaleString()}
              </p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                En préparation
              </p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.pendingShipments.toLocaleString()}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expédiées</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.shippedOrders.toLocaleString()}
              </p>
            </div>
            <Truck className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Livrées</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.deliveredOrders.toLocaleString()}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Statistiques par zone et revenus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenus d'expédition */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Revenus d'expédition
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total revenus livraison:</span>
              <span className="text-2xl font-bold text-green-600">
                {stats.totalShippingRevenue.toFixed(2)}€
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Frais moyen par commande:</span>
              <span className="text-lg font-semibold text-gray-900">
                {stats.averageShippingFee.toFixed(2)}€
              </span>
            </div>
          </div>
        </div>

        {/* Répartition par zones */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            Répartition par zones
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">🇫🇷 France métropolitaine:</span>
              <span className="font-semibold">{stats.zoneStats.france}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">🏝️ Corse:</span>
              <span className="font-semibold">{stats.zoneStats.corsica}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">🌴 DOM-TOM:</span>
              <span className="font-semibold">{stats.zoneStats.domTom}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">🇪🇺 Europe:</span>
              <span className="font-semibold">{stats.zoneStats.europe}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">🌍 International:</span>
              <span className="font-semibold">
                {stats.zoneStats.international}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <Form method="get" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Recherche */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  name="search"
                  placeholder="Rechercher commande, client, suivi..."
                  defaultValue={filters.search}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Filtre par statut */}
            <div>
              <select
                name="status"
                defaultValue={filters.status}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="1">Nouvelle commande</option>
                <option value="2">Confirmée</option>
                <option value="3">En préparation</option>
                <option value="4">Expédiée</option>
                <option value="5">Livrée</option>
                <option value="6">Retournée</option>
              </select>
            </div>

            {/* Filtre par zone */}
            <div>
              <select
                name="zone"
                defaultValue={filters.zone}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Toutes les zones</option>
                <option value="france">France métro</option>
                <option value="corsica">Corse</option>
                <option value="domTom">DOM-TOM</option>
                <option value="europe">Europe</option>
                <option value="international">International</option>
              </select>
            </div>

            {/* Filtre par statut d'expédition */}
            <div>
              <select
                name="trackingStatus"
                defaultValue={filters.trackingStatus}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="pending">En préparation</option>
                <option value="shipped">Expédiée</option>
                <option value="delivered">Livrée</option>
                <option value="returned">Retournée</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Button
              className="px-6 py-2 rounded-lg flex items-center gap-2"
              variant="blue"
              type="submit"
            >
              <Filter className="w-4 h-4" />
              Appliquer les filtres
            </Button>

            {(filters.search ||
              filters.status ||
              filters.zone ||
              filters.trackingStatus) && (
              <Link
                to="/commercial/shipping"
                className="text-gray-600 hover:text-gray-800 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Réinitialiser
              </Link>
            )}
          </div>
        </Form>
      </div>

      {/* Liste des expéditions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Expéditions ({totalOrders})
            </h2>
            <div className="text-sm text-gray-500">
              Affichage de {startIndex} à {endIndex} sur {totalOrders} résultats
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrders(orders.map((o) => o.id));
                      } else {
                        setSelectedOrders([]);
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commande
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Destination
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frais de port
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Suivi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedOrders.includes(order.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders([...selectedOrders, order.id]);
                        } else {
                          setSelectedOrders(
                            selectedOrders.filter((id) => id !== order.id),
                          );
                        }
                      }}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {order.orderNumber}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {order.customerName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.customerEmail}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900">
                        {order.shippingAddress.postalCode}{" "}
                        {order.shippingAddress.city}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.shippingAddress.country}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="info">
                      {order.deliveryZone === "france" && "🇫🇷 France"}
                      {order.deliveryZone === "corsica" && "🏝️ Corse"}
                      {order.deliveryZone === "domTom" && "🌴 DOM-TOM"}
                      {order.deliveryZone === "europe" && "🇪🇺 Europe"}
                      {order.deliveryZone === "international" &&
                        "🌍 International"}
                      {order.deliveryZone === "unknown" && "❓ Inconnue"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {order.shippingFee.toFixed(2)}€
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      variant={getShippingStatusVariant(order.shippingStatus)}
                      size="sm"
                    >
                      {getShippingStatusLabel(order.shippingStatus)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.trackingNumber ? (
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {order.trackingNumber}
                        </div>
                        <div className="text-gray-500">
                          {order.deliveryMethod}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">
                        Pas de suivi
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Link
                      to={`/commercial/orders/${order.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length === 0 && (
          <div className="text-center py-12">
            <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune expédition trouvée
            </h3>
            <p className="text-gray-500">
              Aucune expédition ne correspond aux critères de recherche.
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Page {currentPage} sur {totalPages}
              </div>
              <div className="flex space-x-2">
                {currentPage > 1 && (
                  <Link
                    to={`?${new URLSearchParams({
                      ...Object.fromEntries(searchParams),
                      page: (currentPage - 1).toString(),
                    }).toString()}`}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Précédent
                  </Link>
                )}

                {currentPage < totalPages && (
                  <Link
                    to={`?${new URLSearchParams({
                      ...Object.fromEntries(searchParams),
                      page: (currentPage + 1).toString(),
                    }).toString()}`}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Suivant
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
