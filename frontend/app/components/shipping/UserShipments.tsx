import { Package, Truck, Clock, CheckCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface UserShipment {
  id: string;
  orderId: string;
  orderNumber: string;
  trackingNumber: string;
  status: string;
  carrier: {
    name: string;
    logo: string;
  };
  shippedDate: string;
  estimatedDelivery: string;
  currentLocation: {
    city: string;
    country: string;
  };
  lastUpdate: string;
  events: Array<{
    status: string;
    location: string;
    timestamp: string;
    description: string;
  }>;
}

interface UserShipmentsProps {
  userId: string;
}

const statusConfig = {
  pending: { label: 'En attente', color: 'bg-gray-100 text-gray-800', icon: Clock },
  shipped: { label: 'Expédié', color: 'info', icon: Package },
  in_transit: { label: 'En transit', color: 'warning', icon: Truck },
  out_for_delivery: { label: 'En livraison', color: 'orange', icon: Truck },
  delivered: { label: 'Livré', color: 'success', icon: CheckCircle },
  returned: { label: 'Retourné', color: 'error', icon: Package },
};

export function UserShipments({ userId }: UserShipmentsProps) {
  const [shipments, setShipments] = useState<UserShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchShipments() {
      try {
        const response = await fetch(`/api/users/${userId}/shipments`);
        const data = await response.json();

        if (data.success && data.data.success) {
          setShipments(data.data.shipments);
        } else {
          setError(data.data.error || 'Erreur lors du chargement des expéditions');
        }
      } catch (err) {
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchShipments();
    }
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mes expéditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Chargement...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mes expéditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (shipments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mes expéditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-500">Aucune expédition trouvée</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Mes expéditions ({shipments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {shipments.slice(0, 3).map((shipment) => {
            const statusInfo = statusConfig[shipment.status as keyof typeof statusConfig] || statusConfig.pending;
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={shipment.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <StatusIcon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{shipment.orderNumber}</p>
                      <p className="text-xs text-gray-500">N° suivi: {shipment.trackingNumber}</p>
                    </div>
                  </div>
                  <Badge className={statusInfo.color}>
                    {statusInfo.label}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    <span>📍 {shipment.currentLocation.city}</span>
                    <span>🚚 {shipment.carrier.name}</span>
                  </div>
                  <span>
                    Livraison prévue: {new Date(shipment.estimatedDelivery).toLocaleDateString('fr-FR')}
                  </span>
                </div>

                {shipment.events.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600">
                      <strong>Dernière mise à jour:</strong> {shipment.events[0].description} 
                      <span className="ml-2 text-gray-500">
                        {new Date(shipment.events[0].timestamp).toLocaleString('fr-FR')}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {shipments.length > 3 && (
            <div className="text-center pt-4">
              <Button variant="outline" size="sm">
                Voir toutes les expéditions ({shipments.length})
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
