/**
 * Page de détails d'une commande
 * Affiche toutes les informations d'une commande spécifique
 */

import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { ArrowLeft, Edit, Package, MapPin, CreditCard, FileText } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface OrderDetails {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productSku?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    variantName?: string;
  }>;
  subtotalPrice: number;
  deliveryPrice: number;
  discountAmount: number;
  totalPrice: number;
  deliveryAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    additionalInfo?: string;
  };
  deliveryMethod: string;
  trackingNumber?: string;
  deliveryDate?: string;
  notes?: string;
  promocode?: string;
  createdAt: string;
  updatedAt: string;
}

interface LoaderData {
  order: OrderDetails | null;
  error?: string;
}

export const loader: LoaderFunction = async ({ params, context }) => {
  const orderId = params.id;
  
  if (!orderId) {
    return json<LoaderData>({ order: null, error: "ID de commande manquant" });
  }

  try {
    // Utiliser l'intégration directe pour récupérer la commande
    const result = await context.remixService.integration.getOrderByIdForRemix(orderId);
    
    if (!result.success) {
      return json<LoaderData>({ 
        order: null, 
        error: result.error || "Commande non trouvée" 
      });
    }

    return json<LoaderData>({ order: result.order });
  } catch (error) {
    console.error("Error loading order:", error);
    return json<LoaderData>({ 
      order: null, 
      error: "Erreur lors du chargement de la commande" 
    });
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "confirmed":
      return "bg-blue-100 text-blue-800";
    case "processing":
      return "bg-purple-100 text-purple-800";
    case "shipped":
      return "bg-orange-100 text-orange-800";
    case "delivered":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "paid":
      return "bg-green-100 text-green-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "refunded":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getDeliveryMethodLabel = (method: string) => {
  switch (method) {
    case "standard":
      return "Livraison standard";
    case "express":
      return "Livraison express";
    case "pickup":
      return "Retrait en magasin";
    default:
      return method;
  }
};

export default function OrderDetails() {
  const { order, error } = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  if (error || !order) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-6">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-red-600 text-lg">
              {error || "Commande non trouvée"}
            </p>
            <Button asChild className="mt-4">
              <Link to="/orders">Retour aux commandes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
            <p className="text-gray-600">
              Créée le {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(order.status)}>
            {order.status}
          </Badge>
          <Badge className={getPaymentStatusColor(order.paymentStatus)}>
            {order.paymentStatus}
          </Badge>
          <Button variant="outline" asChild>
            <Link to={`/orders/${order.id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Articles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Articles ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start border-b pb-4 last:border-b-0">
                    <div className="flex-1">
                      <h4 className="font-medium">{item.productName}</h4>
                      {item.productSku && (
                        <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
                      )}
                      {item.variantName && (
                        <p className="text-sm text-gray-600">Variante: {item.variantName}</p>
                      )}
                      <div className="flex items-center mt-2 text-sm">
                        <span className="text-gray-600">
                          {item.quantity} × {item.unitPrice.toFixed(2)}€
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {item.totalPrice.toFixed(2)}€
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Suivi de commande */}
          {order.trackingNumber && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="w-5 h-5 mr-2" />
                  Suivi de commande
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Numéro de suivi:</span>
                    <span className="font-medium">{order.trackingNumber}</span>
                  </div>
                  {order.deliveryDate && (
                    <div className="flex justify-between">
                      <span>Date de livraison prévue:</span>
                      <span className="font-medium">
                        {new Date(order.deliveryDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Résumé de la commande */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Résumé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Sous-total:</span>
                  <span>{order.subtotalPrice.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span>Livraison:</span>
                  <span>{order.deliveryPrice.toFixed(2)}€</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Remise:</span>
                    <span>-{order.discountAmount.toFixed(2)}€</span>
                  </div>
                )}
                {order.promocode && (
                  <div className="flex justify-between text-blue-600">
                    <span>Code promo:</span>
                    <span>{order.promocode}</span>
                  </div>
                )}
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{order.totalPrice.toFixed(2)}€</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Adresse de livraison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Livraison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Méthode:</p>
                  <p className="text-gray-600">{getDeliveryMethodLabel(order.deliveryMethod)}</p>
                </div>
                <div>
                  <p className="font-medium">Adresse:</p>
                  <div className="text-gray-600">
                    <p>{order.deliveryAddress.street}</p>
                    <p>{order.deliveryAddress.postalCode} {order.deliveryAddress.city}</p>
                    <p>{order.deliveryAddress.country}</p>
                    {order.deliveryAddress.additionalInfo && (
                      <p className="text-sm italic mt-1">{order.deliveryAddress.additionalInfo}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/orders/${order.id}/edit`}>
                    <Edit className="w-4 h-4 mr-2" />
                    Modifier la commande
                  </Link>
                </Button>
                <Button variant="outline" className="w-full">
                  <FileText className="w-4 h-4 mr-2" />
                  Télécharger la facture
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
