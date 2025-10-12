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
import { OrderLineActions } from "~/components/admin/OrderLineActions";

/**
 * 🎯 FORMAT BDD SUPABASE - Format legacy consolidé
 * Correspond exactement à la structure de la table ___xtr_order
 */
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
    orl_ord_id: string;
    orl_pg_name: string;
    orl_pm_name?: string;
    orl_art_ref?: string;
    orl_art_ref_clean?: string;
    orl_art_quantity: string;
    orl_art_price_sell_unit_ttc?: string;
    orl_art_price_sell_ttc?: string;
    orl_art_price_buy_unit_ht?: string;
    orl_orls_id?: string;
    orl_equiv_id?: string;
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

export const loader: LoaderFunction = async ({ params, request }) => {
  const orderId = params.id;
  
  if (!orderId) {
    return json<LoaderData>({ order: null, error: "ID de commande manquant" });
  }

  console.log(`🔍 [Frontend] Chargement commande avec ID: ${orderId}`);

  try {
    const cookie = request.headers.get("Cookie") || "";
    
    // Appel direct à l'API backend
    const response = await fetch(`http://localhost:3000/api/legacy-orders/${orderId}`, {
      headers: {
        "Cookie": cookie,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Frontend] API /api/legacy-orders/${orderId} returned ${response.status}:`, errorText);
      
      return json<LoaderData>({ 
        order: null, 
        error: `Commande non trouvée avec l'ID: ${orderId}` 
      });
    }

    const data = await response.json();
    const order = data.data || data.order || data;
    
    if (!order || !order.ord_id) {
      console.error(`❌ [Frontend] Commande non trouvée ou structure invalide`);
      return json<LoaderData>({ 
        order: null, 
        error: "Commande non trouvée" 
      });
    }

    console.log(`✅ [Frontend] Commande ${orderId} chargée (format BDD)`);
    return json<LoaderData>({
      order: order,
      error: undefined
    });
  } catch (error) {
    console.error("❌ [Frontend] Error loading order:", error);
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
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {line.orl_pg_name}
                        {line.orl_pm_name && ` - ${line.orl_pm_name}`}
                      </h4>
                      {line.orl_art_ref && (
                        <p className="text-gray-600">Réf: {line.orl_art_ref}</p>
                      )}
                      {line.lineStatus && (
                        <Badge className={`mt-2 ${getStatusColor(line.lineStatus)}`}>
                          {line.lineStatus.orls_named}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {line.orl_art_quantity} x {line.orl_art_price_sell_unit_ttc ? parseFloat(line.orl_art_price_sell_unit_ttc).toFixed(2) : '0.00'} €
                      </p>
                      <p className="text-lg font-bold">
                        {line.orl_art_price_sell_ttc ? parseFloat(line.orl_art_price_sell_ttc).toFixed(2) : '0.00'} €
                      </p>
                    </div>
                  </div>
                  
                  {/* 🚀 NOUVEAU : Boutons d'action */}
                  <div className="mt-4 pt-4 border-t">
                    <OrderLineActions 
                      orderId={parseInt(order.ord_id)} 
                      line={line}
                      onSuccess={() => window.location.reload()}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Aucun article trouvé</p>
          )}
        </CardContent>
      </Card>

      {/* Informations de paiement */}
      {order.ord_info && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Informations de paiement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              try {
                const paymentInfo = JSON.parse(order.ord_info);
                return (
                  <div className="grid grid-cols-2 gap-4">
                    {paymentInfo.payment_gateway && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Passerelle de paiement</label>
                        <p className="mt-1 font-semibold">{paymentInfo.payment_gateway}</p>
                      </div>
                    )}
                    {paymentInfo.transaction_id && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">ID Transaction</label>
                        <p className="mt-1 font-mono text-sm">{paymentInfo.transaction_id}</p>
                      </div>
                    )}
                    {paymentInfo.currency && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Devise</label>
                        <p className="mt-1">{paymentInfo.currency}</p>
                      </div>
                    )}
                    {paymentInfo.payment_metadata && Object.keys(paymentInfo.payment_metadata).length > 0 && (
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-600">Métadonnées</label>
                        <pre className="mt-1 p-3 bg-gray-50 rounded text-xs overflow-auto">
                          {JSON.stringify(paymentInfo.payment_metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              } catch {
                return <p className="whitespace-pre-wrap text-sm">{order.ord_info}</p>;
              }
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
