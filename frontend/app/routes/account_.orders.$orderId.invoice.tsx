import { Alert } from '@fafa/ui';
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";
import { Button } from '~/components/ui/button';
import { requireAuth } from "../auth/unified.server";

// Types
interface InvoiceAddress {
  civility?: string;
  name: string;
  firstName?: string;
  address: string;
  zipCode: string;
  city: string;
  country: string;
}

interface InvoiceOrderLine {
  id: number;
  productName: string;
  unitPriceTTC: number;
  quantity: number;
  totalPriceTTC: number;
}

interface InvoiceOrder {
  id: number;
  orderId: string; // ORD_PARENT/A
  date: string;
  datePay?: string;
  info?: string;
  amountTTC: number;
  depositTTC: number;
  shippingFeeTTC: number;
  totalTTC: number;
  isPaid: boolean;
  isSupplementOrder: boolean; // true si ORD_PARENT != 0
  parentOrderId?: string;
  
  // Customer
  customer: {
    id: number;
    email: string;
    phone?: string;
    mobile?: string;
  };
  
  // Addresses
  billingAddress: InvoiceAddress;
  deliveryAddress: InvoiceAddress;
  
  // Lines
  lines: InvoiceOrderLine[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const orderId = params.orderId;
  
  if (!orderId) {
    throw new Response("Order ID manquant", { status: 400 });
  }
  
  // Récupérer les données de la commande avec JOIN sur les adresses
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/___xtr_order?select=*,___xtr_customer!inner(*),___xtr_customer_billing_address!inner(*),___xtr_customer_delivery_address!inner(*),___xtr_order_line(*)&ord_id=eq.${orderId}`,
    {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY!}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Response("Erreur lors de la récupération de la commande", { status: 500 });
  }
  
  const orders = await response.json();
  
  if (!orders || orders.length === 0) {
    throw new Response("Commande non trouvée", { status: 404 });
  }
  
  const orderData = orders[0];
  
  // Vérifier que la commande appartient au client connecté
  if (orderData.ord_cst_id !== user.id) {
    throw new Response("Accès non autorisé", { status: 403 });
  }
  
  // Récupérer les lignes de commande
  const linesResponse = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/___xtr_order_line?orl_ord_id=eq.${orderId}`,
    {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY!}`,
      },
    }
  );
  
  const lines = linesResponse.ok ? await linesResponse.json() : [];
  
  // Mapper les données
  const invoice: InvoiceOrder = {
    id: orderData.ord_id,
    orderId: orderData.ord_parent && orderData.ord_parent !== '0' 
      ? `${orderData.ord_id}/A` 
      : `${orderData.ord_id}/A`,
    date: orderData.ord_date,
    datePay: orderData.ord_date_pay,
    info: orderData.ord_info,
    amountTTC: parseFloat(orderData.ord_amount_ttc || 0),
    depositTTC: parseFloat(orderData.ord_deposit_ttc || 0),
    shippingFeeTTC: parseFloat(orderData.ord_shipping_fee_ttc || 0),
    totalTTC: parseFloat(orderData.ord_total_ttc || 0),
    isPaid: orderData.ord_is_pay === 1 || orderData.ord_is_pay === true,
    isSupplementOrder: orderData.ord_parent && orderData.ord_parent !== '0',
    parentOrderId: orderData.ord_parent && orderData.ord_parent !== '0' ? orderData.ord_parent : undefined,
    
    customer: {
      id: orderData.___xtr_customer?.cst_id,
      email: orderData.___xtr_customer?.cst_mail,
      phone: orderData.___xtr_customer?.cst_tel,
      mobile: orderData.___xtr_customer?.cst_gsm,
    },
    
    billingAddress: {
      civility: orderData.___xtr_customer_billing_address?.cba_civility,
      name: orderData.___xtr_customer_billing_address?.cba_name,
      firstName: orderData.___xtr_customer_billing_address?.cba_fname,
      address: orderData.___xtr_customer_billing_address?.cba_address,
      zipCode: orderData.___xtr_customer_billing_address?.cba_zip_code,
      city: orderData.___xtr_customer_billing_address?.cba_city,
      country: orderData.___xtr_customer_billing_address?.cba_country,
    },
    
    deliveryAddress: {
      civility: orderData.___xtr_customer_delivery_address?.cda_civility,
      name: orderData.___xtr_customer_delivery_address?.cda_name,
      firstName: orderData.___xtr_customer_delivery_address?.cda_fname,
      address: orderData.___xtr_customer_delivery_address?.cda_address,
      zipCode: orderData.___xtr_customer_delivery_address?.cda_zip_code,
      city: orderData.___xtr_customer_delivery_address?.cda_city,
      country: orderData.___xtr_customer_delivery_address?.cda_country,
    },
    
    lines: lines.map((line: any) => ({
      id: line.orl_id,
      productName: line.orl_pg_name,
      unitPriceTTC: parseFloat(line.orl_art_price_sell_unit_ttc || 0),
      quantity: parseInt(line.orl_art_quantity || 0),
      totalPriceTTC: parseFloat(line.orl_art_price_sell_ttc || 0),
    })),
  };
  
  return json({ invoice, user });
}

export default function OrderInvoice() {
  const { invoice } = useLoaderData<typeof loader>();
  const [paymentMethod, setPaymentMethod] = useState<'PAYBOX' | 'PAYPAL'>('PAYBOX');
  
  // Calculer le total des lignes
  const linesTotal = invoice.lines.reduce((sum, line) => sum + line.totalPriceTTC, 0);
  
  return (
    <div className="container-fluid invoice-page bg-white">
      <div className="max-w-5xl mx-auto p-8">
        
        {/* En-tête avec logo et informations commande */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          <div className="col-span-12 md:col-span-3">
            <div className="border p-4 rounded">
              <img 
                src="/assets/img/automecanik.png" 
                alt="AutoMecanik" 
                className="w-full h-auto"
              />
            </div>
          </div>
          
          <div className="col-span-12 md:col-span-4">
            {/* Espace vide */}
          </div>
          
          <div className="col-span-12 md:col-span-5">
            <div className="border border-gray-300 rounded-lg p-4 space-y-2">
              {/* Titre selon le type et statut */}
              <div className="flex justify-between">
                <span className="font-semibold">
                  {invoice.isPaid 
                    ? 'Facture n°' 
                    : invoice.isSupplementOrder 
                      ? 'Supplément n°'
                      : 'Bon de commande n°'
                  }
                </span>
                <span>
                  {invoice.orderId}
                </span>
              </div>
              
              {/* Date de commande */}
              <div className="flex justify-between">
                <span className="font-semibold">Date</span>
                <span>{new Date(invoice.date).toLocaleDateString('fr-FR')}</span>
              </div>
              
              {/* Date de paiement si payé */}
              {invoice.isPaid && invoice.datePay && (
                <div className="flex justify-between">
                  <span className="font-semibold">Date de paiement</span>
                  <span>{new Date(invoice.datePay).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
              
              {/* Référence commande parent si supplément */}
              {invoice.isSupplementOrder && invoice.parentOrderId && (
                <div className="flex justify-between">
                  <span className="font-semibold">Commande parente n°</span>
                  <span>{invoice.parentOrderId}/A</span>
                </div>
              )}
              
              {/* Total */}
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="font-semibold">Total TTC</span>
                <span className="font-bold">{invoice.totalTTC.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Adresses facturation et livraison */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border border-gray-200 rounded p-4">
            <h3 className="font-semibold mb-2 underline">Facturée à :</h3>
            <p>
              {invoice.billingAddress.civility} {invoice.billingAddress.name} {invoice.billingAddress.firstName}
            </p>
            <p>
              {invoice.billingAddress.address}
            </p>
            <p>
              {invoice.billingAddress.zipCode} {invoice.billingAddress.city}, {invoice.billingAddress.country}
            </p>
          </div>
          
          <div className="border border-gray-200 rounded p-4">
            <h3 className="font-semibold mb-2 underline">Livrée à :</h3>
            <p>
              {invoice.deliveryAddress.civility} {invoice.deliveryAddress.name} {invoice.deliveryAddress.firstName}
            </p>
            <p>
              {invoice.deliveryAddress.address}
            </p>
            <p>
              {invoice.deliveryAddress.zipCode} {invoice.deliveryAddress.city}, {invoice.deliveryAddress.country}
            </p>
          </div>
        </div>
        
        {/* Tableau des produits */}
        <div className="border border-gray-300 rounded-lg overflow-hidden mb-6">
          <div className="grid grid-cols-12 bg-gray-100 border-b border-gray-300 font-semibold p-3 text-center">
            <div className="col-span-5">Désignation</div>
            <div className="col-span-3">PU TTC</div>
            <div className="col-span-1">QTE</div>
            <div className="col-span-3">PT TTC</div>
          </div>
          
          {invoice.lines.map((line) => (
            <div 
              key={line.id} 
              className="grid grid-cols-12 border-b border-gray-200 p-3 text-sm"
            >
              <div className="col-span-5">{line.productName}</div>
              <div className="col-span-3 text-right">
                {line.unitPriceTTC.toFixed(2)} €
              </div>
              <div className="col-span-1 text-center">{line.quantity}</div>
              <div className="col-span-3 text-right font-semibold">
                {line.totalPriceTTC.toFixed(2)} €
              </div>
            </div>
          ))}
          
          {/* Total */}
          <div className="grid grid-cols-12 bg-gray-50 p-4">
            <div className="col-span-7 md:col-span-9"></div>
            <div className="col-span-5 md:col-span-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total TTC</span>
                <span className="text-lg font-bold">{linesTotal.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Section paiement (uniquement pour suppléments non payés) */}
        {invoice.isSupplementOrder && !invoice.isPaid && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="border border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                <img 
                  src="/assets/img/pay-paybox.jpg" 
                  alt="Paybox" 
                  className="w-full max-w-xs mx-auto mb-3"
                />
                <p className="mb-3">Carte bancaire</p>
                <input 
                  type="radio" 
                  name="paymethod" 
                  value="PAYBOX" 
                  checked={paymentMethod === 'PAYBOX'}
                  onChange={(e) => setPaymentMethod(e.target.value as 'PAYBOX')}
                  className="w-4 h-4"
                />
              </div>
              
              <div className="border border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                <img 
                  src="/assets/img/pay-paypal.jpg" 
                  alt="PayPal" 
                  className="w-full max-w-xs mx-auto mb-3"
                />
                <p className="mb-3">PayPal</p>
                <input 
                  type="radio" 
                  name="paymethod" 
                  value="PAYPAL" 
                  checked={paymentMethod === 'PAYPAL'}
                  onChange={(e) => setPaymentMethod(e.target.value as 'PAYPAL')}
                  className="w-4 h-4"
                />
              </div>
            </div>
            
            <div className="border border-primary bg-primary/10 rounded-lg p-4">
              <p className="text-sm">
                En cliquant sur le bouton « Payer maintenant », vous acceptez de vous conformer aux{' '}
                <a 
                  href="/conditions-generales-de-vente.html" 
                  target="_blank"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Conditions générales de vente
                </a>
                {' '}que vous reconnaissez avoir lues, comprises et acceptées dans leur intégralité.
              </p>
            </div>
            
            <div className="text-center">
              <form 
                method="post" 
                action={`${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payments/proceed-supplement`}
                onSubmit={async (e) => {
                  e.preventDefault();
                  
                  try {
                    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payments/proceed-supplement`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        orderId: invoice.id,
                        paymentMethod: paymentMethod,
                      }),
                    });
                    
                    if (response.ok) {
                      const result = await response.json();
                      // Rediriger vers la passerelle de paiement
                      if (result.data?.redirectUrl) {
                        window.location.href = result.data.redirectUrl;
                      }
                    } else {
                      alert('Erreur lors de l\'initialisation du paiement');
                    }
                  } catch (error) {
                    console.error('Payment error:', error);
                    alert('Erreur lors de l\'initialisation du paiement');
                  }
                }}
              >
                <Button className="font-bold py-3 px-8 rounded-lg text-lg" variant="green" type="submit">\n  Payer maintenant\n</Button>
              </form>
            </div>
          </div>
        )}
        
        {/* Message si déjà payé */}
        {invoice.isPaid && (
          <Alert intent="success"><p>✓ Cette commande a été payée le {invoice.datePay ? new Date(invoice.datePay).toLocaleDateString('fr-FR') : 'N/A'}</p></Alert>
        )}
        
        {/* Pied de page */}
        <div className="border-t border-gray-300 pt-6 mt-8 text-center text-sm text-gray-600">
          <p className="mb-1">AUTO PIECES EQUIPEMENTS</p>
          <p className="mb-1">184 AVENUE ARISTIDE BRIAND 93320 LES PAVILLONS SOUS BOIS</p>
          <p className="mb-1">TEL 0177695892 SASU au capital de 10000 euro</p>
          <p className="mb-1">RCS Bobigny siret 82049999400010 N° tva FR58820499994 CODE APE4531Z</p>
          <p>WWW.AUTOMECANIK.COM</p>
        </div>
        
        {/* Boutons d'action */}
        <div className="flex gap-4 justify-center mt-8">
          <Link 
            to={`/account/orders/${invoice.id}`}
            className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-6 rounded transition-colors"
          >
            ← Retour à la commande
          </Link>
          
          <button 
            onClick={() => window.print()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-6 rounded transition-colors"
          >
            🖨️ Imprimer
          </button>
        </div>
        
      </div>
      
      {/* Styles pour l'impression */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .invoice-page {
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
