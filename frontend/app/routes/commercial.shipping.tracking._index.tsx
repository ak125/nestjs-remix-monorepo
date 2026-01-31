/**
 * 📦 Suivi des expéditions - Interface commerciale
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Clock,
  CheckCircle,
  Truck,
  Package,
  Bell,
  RefreshCw,
  Eye,
  Navigation,
  Phone,
  Mail,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "~/components/ui";
import { Button } from "~/components/ui/button";

// Types pour le suivi
interface TrackingEvent {
  id: string;
  timestamp: string;
  location: string;
  status: string;
  description: string;
  isDelivered?: boolean;
}

interface ShipmentTracking {
  id: string;
  trackingNumber: string;
  orderNumber: string;
  customerName: string;
  carrier: {
    name: string;
    logo: string;
  };
  status:
    | "preparing"
    | "shipped"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "exception";
  estimatedDelivery: string;
  currentLocation?: {
    city: string;
    country: string;
    coordinates?: [number, number];
  };
  events: TrackingEvent[];
  shippingAddress: {
    city: string;
    country: string;
  };
  lastUpdate: string;
}

interface LoaderData {
  shipments: ShipmentTracking[];
  stats: {
    inTransit: number;
    outForDelivery: number;
    delivered: number;
    exceptions: number;
  };
}

// Données de démonstration avec tracking réaliste
const mockShipments: ShipmentTracking[] = [
  {
    id: "1",
    trackingNumber: "CP123456789FR",
    orderNumber: "CMD-961114239",
    customerName: "Client #1",
    carrier: { name: "Chronopost", logo: "/images/carriers/chronopost.png" },
    status: "in_transit",
    estimatedDelivery: "2025-08-17T18:00:00Z",
    currentLocation: {
      city: "Lyon",
      country: "France",
      coordinates: [4.8357, 45.764],
    },
    shippingAddress: { city: "Paris", country: "France" },
    lastUpdate: new Date().toISOString(),
    events: [
      {
        id: "1",
        timestamp: "2025-08-16T08:30:00Z",
        location: "Centre de tri Lyon",
        status: "EN_TRANSIT",
        description: "Colis en cours de transport vers la destination",
      },
      {
        id: "2",
        timestamp: "2025-08-16T06:15:00Z",
        location: "Hub Chronopost Lyon",
        status: "DEPARTED",
        description: "Colis parti du centre de tri",
      },
      {
        id: "3",
        timestamp: "2025-08-15T22:45:00Z",
        location: "Centre de tri Paris",
        status: "ARRIVED",
        description: "Colis arrivé au centre de tri",
      },
      {
        id: "4",
        timestamp: "2025-08-15T18:00:00Z",
        location: "Entrepôt expéditeur",
        status: "SHIPPED",
        description: "Colis pris en charge par Chronopost",
      },
    ],
  },
  {
    id: "2",
    trackingNumber: "DHL987654321",
    orderNumber: "CMD-919114807",
    customerName: "Client #81500",
    carrier: { name: "DHL Express", logo: "/images/carriers/dhl.png" },
    status: "out_for_delivery",
    estimatedDelivery: "2025-08-16T12:00:00Z",
    currentLocation: {
      city: "Marseille",
      country: "France",
      coordinates: [5.3698, 43.2965],
    },
    shippingAddress: { city: "Marseille", country: "France" },
    lastUpdate: new Date().toISOString(),
    events: [
      {
        id: "1",
        timestamp: "2025-08-16T09:30:00Z",
        location: "Centre DHL Marseille",
        status: "OUT_FOR_DELIVERY",
        description:
          "Colis en cours de livraison - Livraison prévue avant 12h00",
      },
      {
        id: "2",
        timestamp: "2025-08-16T07:00:00Z",
        location: "Centre DHL Marseille",
        status: "ARRIVED",
        description: "Colis arrivé au centre de livraison local",
      },
      {
        id: "3",
        timestamp: "2025-08-15T20:30:00Z",
        location: "Hub DHL Charles de Gaulle",
        status: "DEPARTED",
        description: "Colis expédié vers Marseille",
      },
    ],
  },
  {
    id: "3",
    trackingNumber: "UPS456789123",
    orderNumber: "CMD-903152192",
    customerName: "Client #81508",
    carrier: { name: "UPS", logo: "/images/carriers/ups.png" },
    status: "delivered",
    estimatedDelivery: "2025-08-15T17:00:00Z",
    currentLocation: {
      city: "Toulouse",
      country: "France",
      coordinates: [1.4442, 43.6047],
    },
    shippingAddress: { city: "Toulouse", country: "France" },
    lastUpdate: "2025-08-15T16:45:00Z",
    events: [
      {
        id: "1",
        timestamp: "2025-08-15T16:45:00Z",
        location: "Toulouse - Domicile client",
        status: "DELIVERED",
        description: "Colis livré et signé par M. MARTIN",
        isDelivered: true,
      },
      {
        id: "2",
        timestamp: "2025-08-15T14:30:00Z",
        location: "Centre UPS Toulouse",
        status: "OUT_FOR_DELIVERY",
        description: "Colis en cours de livraison",
      },
      {
        id: "3",
        timestamp: "2025-08-15T08:00:00Z",
        location: "Centre UPS Toulouse",
        status: "ARRIVED",
        description: "Colis arrivé au centre de livraison",
      },
    ],
  },
];

// Helper function to get Badge variant from status
function getStatusVariant(
  status: string,
): "success" | "error" | "warning" | "info" | "default" | "purple" | "orange" {
  switch (status) {
    case "preparing":
      return "warning";
    case "shipped":
      return "info";
    case "in_transit":
      return "purple";
    case "out_for_delivery":
      return "orange";
    case "delivered":
      return "success";
    case "exception":
      return "error";
    default:
      return "default";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "preparing":
      return "En préparation";
    case "shipped":
      return "Expédiée";
    case "in_transit":
      return "En transit";
    case "out_for_delivery":
      return "En cours de livraison";
    case "delivered":
      return "Livrée";
    case "exception":
      return "Incident";
    default:
      return "Statut inconnu";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "preparing":
      return Clock;
    case "shipped":
      return Package;
    case "in_transit":
      return Truck;
    case "out_for_delivery":
      return Navigation;
    case "delivered":
      return CheckCircle;
    case "exception":
      return AlertTriangle;
    default:
      return Package;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Récupérer les expéditions depuis le nouveau endpoint dashboard
    const ordersResponse = await fetch(
      `http://127.0.0.1:3000/api/dashboard/shipments`,
    );

    let realShipments: ShipmentTracking[] = [];

    if (ordersResponse.ok) {
      const trackingData = await ordersResponse.json();
      if (trackingData.success && trackingData.data) {
        realShipments = trackingData.data;
      }
    }

    // Fallback vers les données mockées si pas de vraies données
    const shipments = realShipments.length > 0 ? realShipments : mockShipments;

    const stats = {
      inTransit: shipments.filter((s) => s.status === "in_transit").length,
      outForDelivery: shipments.filter((s) => s.status === "out_for_delivery")
        .length,
      delivered: shipments.filter((s) => s.status === "delivered").length,
      exceptions: shipments.filter((s) => s.status === "exception").length,
    };

    return json({ shipments, stats });
  } catch (error) {
    console.error("❌ Erreur tracking:", error);

    // Fallback vers les données mockées en cas d'erreur
    const shipments = mockShipments;
    const stats = {
      inTransit: shipments.filter((s) => s.status === "in_transit").length,
      outForDelivery: shipments.filter((s) => s.status === "out_for_delivery")
        .length,
      delivered: shipments.filter((s) => s.status === "delivered").length,
      exceptions: shipments.filter((s) => s.status === "exception").length,
    };

    return json({ shipments, stats });
  }
}

export default function ShippingTracking() {
  const { shipments, stats } = useLoaderData<LoaderData>();
  const [realTimeUpdates, setRealTimeUpdates] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Simulation WebSocket pour les mises à jour en temps réel
  useEffect(() => {
    // En production, ceci serait une vraie connexion WebSocket
    const simulateRealTimeUpdates = () => {
      const updates = [
        "📦 Colis CP123456789FR: Arrivée au centre de tri de destination",
        "🚛 Colis DHL987654321: Sortie pour livraison - ETA 11:30",
        "✅ Nouvelle livraison confirmée: UPS456789123",
        "🔔 3 nouvelles expéditions créées ce matin",
        "📍 Mise à jour géolocalisation: 5 colis en transit",
      ];

      let index = 0;
      const interval = setInterval(() => {
        if (index < updates.length) {
          setRealTimeUpdates((prev) => [updates[index], ...prev.slice(0, 4)]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 3000);

      return () => clearInterval(interval);
    };

    setIsConnected(true);
    const cleanup = simulateRealTimeUpdates();
    return cleanup;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header avec indicateur temps réel */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Navigation className="w-8 h-8 text-blue-600" />
              Suivi des Expéditions
              {isConnected && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success/20 text-success">
                  <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse"></div>
                  Temps réel
                </span>
              )}
            </h1>
            <p className="text-gray-600 mt-1">
              Suivi en temps réel avec notifications instantanées
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              to="/commercial/shipping/create"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Package className="w-4 h-4" />
              Créer expédition
            </Link>
            <Button
              className="px-4 py-2 rounded-lg flex items-center gap-2"
              variant="green"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </Button>
          </div>
        </div>
      </div>

      {/* Statistiques en temps réel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">En transit</p>
              <p className="text-2xl font-bold text-indigo-600">
                {stats.inTransit}
              </p>
            </div>
            <Truck className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">En livraison</p>
              <p className="text-2xl font-bold text-orange-600">
                {stats.outForDelivery}
              </p>
            </div>
            <Navigation className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Livrées</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.delivered}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Incidents</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.exceptions}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Liste des expéditions */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Expéditions actives ({shipments.length})
              </h2>
            </div>

            <div className="divide-y divide-gray-200">
              {shipments.map((shipment) => {
                const StatusIcon = getStatusIcon(shipment.status);
                return (
                  <div
                    key={shipment.id}
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center">
                          <StatusIcon className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {shipment.orderNumber}
                          </div>
                          <div className="text-sm text-gray-600">
                            {shipment.customerName}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            📦 {shipment.trackingNumber}
                            <span className="text-gray-300">•</span>
                            {shipment.carrier.name}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge
                          variant={getStatusVariant(shipment.status)}
                          size="sm"
                        >
                          {getStatusLabel(shipment.status)}
                        </Badge>
                        <Link
                          to={`/commercial/shipping/${shipment.id}`}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </Link>
                      </div>
                    </div>

                    {/* Barre de progression */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">
                          {shipment.currentLocation?.city} →{" "}
                          {shipment.shippingAddress.city}
                        </span>
                        <span className="text-sm text-gray-600">
                          ETA:{" "}
                          {new Date(
                            shipment.estimatedDelivery,
                          ).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            shipment.status === "delivered"
                              ? "bg-success"
                              : shipment.status === "out_for_delivery"
                                ? "bg-orange-600"
                                : shipment.status === "in_transit"
                                  ? "bg-info"
                                  : "bg-warning"
                          }`}
                          style={{
                            width:
                              shipment.status === "delivered"
                                ? "100%"
                                : shipment.status === "out_for_delivery"
                                  ? "85%"
                                  : shipment.status === "in_transit"
                                    ? "60%"
                                    : "30%",
                          }}
                        />
                      </div>
                    </div>

                    {/* Derniers événements */}
                    <div className="space-y-2">
                      {shipment.events.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center gap-3 text-sm"
                        >
                          <div className="w-2 h-2 bg-info rounded-full"></div>
                          <div className="text-gray-600">
                            {new Date(event.timestamp).toLocaleDateString(
                              "fr-FR",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>
                          <div className="text-gray-900">{event.location}</div>
                          <div className="text-gray-600 flex-1">
                            {event.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel temps réel */}
        <div className="space-y-6">
          {/* Mises à jour en temps réel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Notifications temps réel
            </h3>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {realTimeUpdates.map((update, index) => (
                <div
                  key={index}
                  className="p-3 bg-primary/5 border border-blue-200 rounded-lg text-sm animate-fade-in"
                >
                  {update}
                </div>
              ))}

              {realTimeUpdates.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>En attente de notifications...</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions rapides */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Actions rapides
            </h3>

            <div className="space-y-3">
              <button className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-sm">Créer expédition groupée</span>
              </button>

              <button className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                <Bell className="w-4 h-4 text-orange-600" />
                <span className="text-sm">Configurer alertes</span>
              </button>

              <button className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                <Mail className="w-4 h-4 text-green-600" />
                <span className="text-sm">Notifications clients</span>
              </button>

              <button className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                <Phone className="w-4 h-4 text-purple-600" />
                <span className="text-sm">Support transporteurs</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
