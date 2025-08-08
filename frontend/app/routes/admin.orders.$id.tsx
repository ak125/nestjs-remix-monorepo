/**
 * Page de détails d'une commande avec les vraies données
 * Affiche toutes les informations d'une commande spécifique avec adresses
 */

import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ArrowLeft, Edit, Package, MapPin, CreditCard, FileText, User, Phone, Mail } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface OrderDetails {
  ord_id: string;
  ord_cst_id: string;
  ord_date: string;
  ord_total_ttc: string;
  ord_is_pay: string;
  ord_ords_id: string;
  ord_amount_ht?: string;
  ord_shipping_fee_ttc?: string;
  ord_info?: string;
  statusDetails?: {
    ords_id: string;
    ords_named: string;
    ords_action: string;
    ords_color: string;
  };
  customer?: {
    cst_id: string;
    cst_fname: string;
    cst_name: string;
    cst_mail: string;
    cst_tel?: string;
    cst_gsm?: string;
  };
  billingAddress?: {
    cba_id: string;
    cba_mail?: string;
    cba_civility?: string;
    cba_name: string;
    cba_fname: string;
    cba_address: string;
    cba_zip_code: string;
    cba_city: string;
    cba_country: string;
    cba_tel?: string;
    cba_gsm?: string;
  };
  deliveryAddress?: {
    cda_id: string;
    cda_mail?: string;
    cda_civility?: string;
    cda_name: string;
    cda_fname: string;
    cda_address: string;
    cda_zip_code: string;
    cda_city: string;
    cda_country: string;
    cda_tel?: string;
    cda_gsm?: string;
  };
  orderLines?: Array<{
    orl_id: string;
    orl_art_ref: string;
    orl_pg_name: string;
    orl_art_quantity: string;
    orl_art_unit_price: string;
    orl_art_total_price: string;
    lineStatus?: {
      orls_id: string;
      orls_named: string;
      orls_color: string;
    };
  }>;
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
  const { getRemixIntegrationService } = await import("~/server/remix-integration.server");
  const integration: any = await getRemixIntegrationService(context);
    let result = await integration.getOrderByIdForRemix?.(orderId);
    if (!result) {
      // Fallback HTTP direct
      const { getRemixApiService } = await import("~/server/remix-api.server");
      const api: any = await getRemixApiService(context);
      result = await api.makeApiCall?.(`/api/orders/${orderId}`);
      if (result && !result.success) {
        result = { success: true, order: result };
      }
    }
    
    if (!result.success) {
      return json<LoaderData>({ 
        order: null, 
        error: result.error || "Commande non trouvée" 
      });
    }

    return json<LoaderData>({
      order: result.order,
      error: undefined
    });
  } catch (error) {
    console.error("Error loading order:", error);
    return json<LoaderData>({ 
      order: null, 
      error: "Erreur lors du chargement de la commande" 
    });
  }
};

const getStatusColor = (statusDetails: any) => {
  if (!statusDetails) return "bg-gray-100 text-gray-800";
  
  switch (statusDetails.ords_named?.toLowerCase()) {
    case 'en attente':
    case 'pending': return "bg-yellow-100 text-yellow-800";
    case 'confirmée':
    case 'confirmed': return "bg-blue-100 text-blue-800";
    case 'en cours':
    case 'processing': return "bg-purple-100 text-purple-800";
    case 'expédiée':
    case 'shipped': return "bg-green-100 text-green-800";
    case 'livrée':
    case 'delivered': return "bg-green-100 text-green-800";
    case 'annulée':
    case 'cancelled': return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const getPaymentStatusColor = (isPaid: string) => {
  switch (isPaid) {
    case "1": return "bg-green-100 text-green-800";
    case "0": return "bg-yellow-100 text-yellow-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const getPaymentStatusText = (isPaid: string) => {
  switch (isPaid) {
    case "1": return "Payé";
    case "0": return "En attente";
    default: return "Non spécifié";
  }
};

export default function OrderDetailsReal() {
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
              <Link to="/admin/orders">Retour aux commandes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Commande #{order.ord_id}</h1>
            <p className="text-gray-600">
              {new Date(order.ord_date).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(order.statusDetails)}>
            {order.statusDetails?.ords_named || 'Non spécifié'}
          </Badge>
          <Badge className={getPaymentStatusColor(order.ord_is_pay)}>
            {getPaymentStatusText(order.ord_is_pay)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informations client */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informations client
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order.customer ? (
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-lg">
                    {order.customer.cst_fname} {order.customer.cst_name}
                  </p>
                  <p className="text-gray-600 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {order.customer.cst_mail}
                  </p>
                  {order.customer.cst_tel && (
                    <p className="text-gray-600 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {order.customer.cst_tel}
                    </p>
                  )}
                  {order.customer.cst_gsm && (
                    <p className="text-gray-600 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {order.customer.cst_gsm} (GSM)
                    </p>
                  )}
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-gray-500">ID Client: {order.customer.cst_id}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Informations client non disponibles</p>
            )}
          </CardContent>
        </Card>

        {/* Adresse de facturation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Adresse de facturation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order.billingAddress ? (
              <div className="space-y-2">
                <p className="font-medium">
                  {order.billingAddress.cba_civility} {order.billingAddress.cba_fname} {order.billingAddress.cba_name}
                </p>
                <p>{order.billingAddress.cba_address}</p>
                <p>{order.billingAddress.cba_zip_code} {order.billingAddress.cba_city}</p>
                <p>{order.billingAddress.cba_country}</p>
                {order.billingAddress.cba_tel && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {order.billingAddress.cba_tel}
                  </p>
                )}
                {order.billingAddress.cba_gsm && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {order.billingAddress.cba_gsm} (GSM)
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Adresse de facturation non spécifiée</p>
            )}
          </CardContent>
        </Card>

        {/* Adresse de livraison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Adresse de livraison
            </CardTitle>
          </CardHeader>
          <CardContent>
            {order.deliveryAddress ? (
              <div className="space-y-2">
                <p className="font-medium">
                  {order.deliveryAddress.cda_civility} {order.deliveryAddress.cda_fname} {order.deliveryAddress.cda_name}
                </p>
                <p>{order.deliveryAddress.cda_address}</p>
                <p>{order.deliveryAddress.cda_zip_code} {order.deliveryAddress.cda_city}</p>
                <p>{order.deliveryAddress.cda_country}</p>
                {order.deliveryAddress.cda_tel && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {order.deliveryAddress.cda_tel}
                  </p>
                )}
                {order.deliveryAddress.cda_gsm && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {order.deliveryAddress.cda_gsm} (GSM)
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Adresse de livraison non spécifiée</p>
            )}
          </CardContent>
        </Card>

        {/* Résumé financier */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Résumé financier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {order.ord_amount_ht && (
                <div className="flex justify-between">
                  <span>Montant HT</span>
                  <span>{parseFloat(order.ord_amount_ht).toFixed(2)} €</span>
                </div>
              )}
              {order.ord_shipping_fee_ttc && (
                <div className="flex justify-between">
                  <span>Frais de livraison</span>
                  <span>{parseFloat(order.ord_shipping_fee_ttc).toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total TTC</span>
                <span>{parseFloat(order.ord_total_ttc).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span>Statut paiement</span>
                <Badge className={getPaymentStatusColor(order.ord_is_pay)}>
                  {getPaymentStatusText(order.ord_is_pay)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Articles commandés */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Articles commandés ({order.orderLines?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {order.orderLines && order.orderLines.length > 0 ? (
            <div className="space-y-4">
              {order.orderLines.map((line, index) => (
                <div key={line.orl_id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{line.orl_pg_name}</h4>
                      <p className="text-gray-600">Réf: {line.orl_art_ref}</p>
                      {line.lineStatus && (
                        <Badge className={`mt-2 ${getStatusColor(line.lineStatus)}`}>
                          {line.lineStatus.orls_named}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {line.orl_art_quantity} x {parseFloat(line.orl_art_unit_price).toFixed(2)} €
                      </p>
                      <p className="text-lg font-bold">
                        {parseFloat(line.orl_art_total_price).toFixed(2)} €
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Aucun article trouvé</p>
          )}
        </CardContent>
      </Card>

      {/* Informations supplémentaires */}
      {order.ord_info && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Informations supplémentaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{order.ord_info}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
