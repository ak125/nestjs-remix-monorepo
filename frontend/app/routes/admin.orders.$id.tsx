/**
 * Page de détails d'une commande avec les vraies données
 * Affiche toutes les informations d'une commande spécifique avec adresses
 */

import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { ArrowLeft, Package, MapPin, CreditCard, FileText, User, Phone, Mail } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
        <div className="max-w-[1400px] mx-auto p-6">
          <div className="flex items-center mb-6">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <p className="text-red-600 text-lg font-semibold mb-4">
                {error || "Commande non trouvée"}
              </p>
              <Button asChild>
                <Link to="/admin/orders">Retour aux commandes</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="max-w-[1400px] mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header moderne */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <Package className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Commande #{order.ord_id}</h1>
                <p className="text-gray-600 font-medium mt-1">
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
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${getStatusColor(order.statusDetails)} px-4 py-2 text-sm font-semibold`}>
              {order.statusDetails?.ords_named || 'Non spécifié'}
            </Badge>
            <Badge className={`${getPaymentStatusColor(order.ord_is_pay)} px-4 py-2 text-sm font-semibold`}>
              {getPaymentStatusText(order.ord_is_pay)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informations client */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-200">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Informations client</h3>
          </div>
          <div>
            {order.customer ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                  <p className="font-semibold text-lg text-gray-900">
                    {order.customer.cst_fname} {order.customer.cst_name}
                  </p>
                  <Link 
                    to={`/admin/users/${order.customer.cst_id}`}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium mt-1 inline-block"
                  >
                    Voir la fiche client →
                  </Link>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <a 
                      href={`mailto:${order.customer.cst_mail}`}
                      className="text-gray-700 hover:text-blue-600 hover:underline font-medium"
                    >
                      {order.customer.cst_mail}
                    </a>
                  </div>
                  {order.customer.cst_tel && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Phone className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      <a 
                        href={`tel:${order.customer.cst_tel}`}
                        className="text-gray-700 hover:text-blue-600 font-medium"
                      >
                        {order.customer.cst_tel}
                      </a>
                    </div>
                  )}
                  {order.customer.cst_gsm && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Phone className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <a 
                        href={`tel:${order.customer.cst_gsm}`}
                        className="text-gray-700 hover:text-blue-600 font-medium"
                      >
                        {order.customer.cst_gsm} <span className="text-xs text-gray-500">(Mobile)</span>
                      </a>
                    </div>
                  )}
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-500">ID Client: <span className="font-mono font-semibold text-gray-700">#{order.customer.cst_id}</span></p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Informations client non disponibles</p>
            )}
          </div>
        </div>

        {/* Adresse de facturation */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-200">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Adresse de facturation</h3>
          </div>
          <div>
            {order.billingAddress ? (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200 space-y-2">
                <p className="font-semibold text-gray-900">
                  {order.billingAddress.cba_civility} {order.billingAddress.cba_fname} {order.billingAddress.cba_name}
                </p>
                <p className="text-gray-700">{order.billingAddress.cba_address}</p>
                <p className="text-gray-700 font-medium">
                  {order.billingAddress.cba_zip_code} {order.billingAddress.cba_city}
                </p>
                <p className="text-gray-600">{order.billingAddress.cba_country}</p>
                {(order.billingAddress.cba_tel || order.billingAddress.cba_gsm) && (
                  <div className="pt-2 mt-2 border-t border-purple-200 space-y-1">
                    {order.billingAddress.cba_tel && (
                      <p className="text-gray-700 flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-purple-500" />
                        {order.billingAddress.cba_tel}
                      </p>
                    )}
                    {order.billingAddress.cba_gsm && (
                      <p className="text-gray-700 flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-purple-500" />
                        {order.billingAddress.cba_gsm} <span className="text-xs text-gray-500">(Mobile)</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Adresse de facturation non spécifiée</p>
            )}
          </div>
        </div>

        {/* Adresse de livraison */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-200">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Adresse de livraison</h3>
          </div>
          <div>
            {order.deliveryAddress ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200 space-y-2">
                <p className="font-semibold text-gray-900">
                  {order.deliveryAddress.cda_civility} {order.deliveryAddress.cda_fname} {order.deliveryAddress.cda_name}
                </p>
                <p className="text-gray-700">{order.deliveryAddress.cda_address}</p>
                <p className="text-gray-700 font-medium">
                  {order.deliveryAddress.cda_zip_code} {order.deliveryAddress.cda_city}
                </p>
                <p className="text-gray-600">{order.deliveryAddress.cda_country}</p>
                {(order.deliveryAddress.cda_tel || order.deliveryAddress.cda_gsm) && (
                  <div className="pt-2 mt-2 border-t border-green-200 space-y-1">
                    {order.deliveryAddress.cda_tel && (
                      <p className="text-gray-700 flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-green-500" />
                        {order.deliveryAddress.cda_tel}
                      </p>
                    )}
                    {order.deliveryAddress.cda_gsm && (
                      <p className="text-gray-700 flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-green-500" />
                        {order.deliveryAddress.cda_gsm} <span className="text-xs text-gray-500">(Mobile)</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Adresse de livraison non spécifiée</p>
            )}
          </div>
        </div>

        {/* Résumé financier */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-200">
            <div className="p-2 bg-amber-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Résumé financier</h3>
          </div>
          <div>
            <div className="space-y-3">
              {order.ord_amount_ht && parseFloat(order.ord_amount_ht) > 0 && (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Montant HT</span>
                  <span className="font-semibold text-gray-900">{parseFloat(order.ord_amount_ht).toFixed(2)} €</span>
                </div>
              )}
              {order.ord_shipping_fee_ttc && parseFloat(order.ord_shipping_fee_ttc) > 0 && (
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Frais de livraison</span>
                  <span className="font-semibold text-gray-900">{parseFloat(order.ord_shipping_fee_ttc).toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between items-center p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
                <span className="font-semibold text-gray-900">Total TTC</span>
                <span className="font-bold text-2xl text-amber-700">{parseFloat(order.ord_total_ttc).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700 font-medium">Statut paiement</span>
                <Badge className={`${getPaymentStatusColor(order.ord_is_pay)} px-3 py-1.5 text-sm font-semibold`}>
                  {getPaymentStatusText(order.ord_is_pay)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Articles commandés */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Package className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Articles commandés</h3>
          </div>
          <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {order.orderLines?.length || 0} article{(order.orderLines?.length || 0) > 1 ? 's' : ''}
          </span>
        </div>
        <div>
          {order.orderLines && order.orderLines.length > 0 ? (
            <div className="space-y-4">
              {order.orderLines.map((line, index) => (
                <div 
                  key={line.orl_id} 
                  className="group border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200"
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                          <Package className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-lg">
                            {line.orl_pg_name}
                            {line.orl_pm_name && <span className="text-gray-600 font-normal"> - {line.orl_pm_name}</span>}
                          </h4>
                          {line.orl_art_ref && (
                            <p className="text-sm text-gray-600 font-mono mt-1 bg-gray-100 inline-block px-2 py-1 rounded">
                              Réf: {line.orl_art_ref}
                            </p>
                          )}
                        </div>
                      </div>
                      {line.lineStatus && (
                        <Badge className={`${getStatusColor(line.lineStatus)} px-3 py-1 text-xs font-semibold`}>
                          {line.lineStatus.orls_named}
                        </Badge>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right space-y-1">
                      <p className="text-gray-600 text-sm">
                        <span className="font-semibold text-gray-900">{line.orl_art_quantity}</span> × {line.orl_art_price_sell_unit_ttc ? parseFloat(line.orl_art_price_sell_unit_ttc).toFixed(2) : '0.00'} €
                      </p>
                      <p className="text-2xl font-bold text-indigo-700">
                        {line.orl_art_price_sell_ttc ? parseFloat(line.orl_art_price_sell_ttc).toFixed(2) : '0.00'} €
                      </p>
                    </div>
                  </div>
                  
                  {/* Boutons d'action */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
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
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">Aucun article trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Informations complémentaires */}
      {order.ord_info && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-200">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Informations complémentaires</h3>
          </div>
          <div>
            {(() => {
              try {
                const paymentInfo = JSON.parse(order.ord_info);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {paymentInfo.payment_gateway && (
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Passerelle de paiement</label>
                        <p className="mt-2 font-bold text-gray-900 text-lg">{paymentInfo.payment_gateway}</p>
                      </div>
                    )}
                    {paymentInfo.transaction_id && (
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ID Transaction</label>
                        <p className="mt-2 font-mono text-sm text-gray-900 break-all">{paymentInfo.transaction_id}</p>
                      </div>
                    )}
                    {paymentInfo.currency && (
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Devise</label>
                        <p className="mt-2 font-bold text-gray-900 text-lg">{paymentInfo.currency}</p>
                      </div>
                    )}
                    {paymentInfo.payment_metadata && Object.keys(paymentInfo.payment_metadata).length > 0 && (
                      <div className="col-span-1 md:col-span-2">
                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-3">Métadonnées de paiement</label>
                          <pre className="text-xs text-green-400 font-mono overflow-auto">
{JSON.stringify(paymentInfo.payment_metadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              } catch {
                // Si ce n'est pas du JSON, afficher en tant que texte/HTML
                return (
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                    <div 
                      className="text-sm text-gray-700 whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: order.ord_info.replace(/<br>/g, '<br/>') }}
                    />
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
