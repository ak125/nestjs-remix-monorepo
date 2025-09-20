/**
 * 📦 COMPOSANT DE SUIVI D'EXPÉDITIONS UTILISATEUR
 * 
 * Permet aux utilisateurs de suivre leurs commandes expédiées
 * avec tracking en temps réel et statuts détaillés
 */

import { Package, Truck, MapPin, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface ShipmentEvent {
  id: string;
  timestamp: string;
  location: string;
  status: string;
  description: string;
}

interface UserShipment {
  id: string;
  trackingNumber: string;
  orderNumber: string;
  carrier: {
    name: string;
    logo: string;
  };
  status: 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';
  estimatedDelivery: string;
  currentLocation: {
    city: string;
    country: string;
  };
  lastUpdate: string;
  events: ShipmentEvent[];
}

interface UserShipmentTrackingProps {
  shipments: UserShipment[];
  className?: string;
}

export function UserShipmentTracking({ shipments, className }: UserShipmentTrackingProps) {
  
  function getStatusLabel(status: string) {
    switch (status) {
      case 'shipped': return 'Expédié';
      case 'in_transit': return 'En transit';
      case 'out_for_delivery': return 'En cours de livraison';
      case 'delivered': return 'Livré';
      case 'exception': return 'Incident';
      default: return 'Statut inconnu';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'shipped': return Package;
      case 'in_transit': return Truck;
      case 'out_for_delivery': return MapPin;
      case 'delivered': return CheckCircle;
      case 'exception': return AlertTriangle;
      default: return Package;
    }
  }

  function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case 'delivered': return "default";
      case 'in_transit': 
      case 'out_for_delivery': return "secondary";
      case 'exception': return "destructive";
      case 'shipped': return "outline";
      default: return "outline";
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (!shipments || shipments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Suivi de vos expéditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucune expédition en cours</p>
            <p className="text-sm">Vos commandes expédiées apparaîtront ici</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Suivi de vos expéditions ({shipments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {shipments.map((shipment) => {
          const StatusIcon = getStatusIcon(shipment.status);
          
          return (
            <div key={shipment.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              {/* En-tête de l'expédition */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{shipment.orderNumber}</h4>
                    <Badge variant={getStatusVariant(shipment.status)}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {getStatusLabel(shipment.status)}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Suivi: <span className="font-mono font-medium">{shipment.trackingNumber}</span></p>
                    <p>Transporteur: {shipment.carrier.name}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  {shipment.status !== 'delivered' && (
                    <div className="text-gray-600 mb-1">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Livraison estimée: {formatDate(shipment.estimatedDelivery)}
                    </div>
                  )}
                  <div className="text-gray-500">
                    Dernière MAJ: {formatDate(shipment.lastUpdate)}
                  </div>
                </div>
              </div>

              {/* Localisation actuelle */}
              <div className="flex items-center gap-2 mb-3 text-sm">
                <MapPin className="h-4 w-4 text-blue-500" />
                <span className="text-gray-600">
                  Actuellement: {shipment.currentLocation.city}, {shipment.currentLocation.country}
                </span>
              </div>

              {/* Derniers événements */}
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-700">Derniers événements</h5>
                <div className="bg-gray-50 rounded p-3 space-y-2">
                  {shipment.events.slice(0, 2).map((event) => (
                    <div key={event.id} className="flex justify-between items-start text-xs">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{event.description}</p>
                        <p className="text-gray-500">{event.location}</p>
                      </div>
                      <div className="text-gray-500 ml-2">
                        {formatDate(event.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center mt-3 pt-3 border-t">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/account/orders/${shipment.orderNumber.replace('CMD-', '')}`}>
                    Voir la commande
                  </a>
                </Button>
                
                {shipment.status !== 'delivered' && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`https://www.${shipment.carrier.name.toLowerCase()}.fr/suivi?code=${shipment.trackingNumber}`} 
                       target="_blank" rel="noopener noreferrer">
                      Suivi détaillé
                    </a>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Lien vers toutes les expéditions */}
        <div className="text-center pt-4 border-t">
          <Button variant="outline" asChild>
            <a href="/account/shipments">
              Voir toutes mes expéditions
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
