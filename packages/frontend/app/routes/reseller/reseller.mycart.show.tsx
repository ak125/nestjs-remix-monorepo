/**
 * MCP GENERATED ROUTE - RESELLER PROTECTED
 * Généré automatiquement par MCP Context-7
 * Module: reseller-ecommerce
 * Sécurité: Interface revendeurs uniquement
 * Source: massdoc/mycart.php
 */
import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Form } from '@remix-run/react';
import { requireResellerAuth } from '@/utils/reseller-auth';
import type { ResellerEcommerceData, ResellerEcommerceResponse } from '@/shared/types/reseller';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Vérification authentification revendeur
    const resellerSession = await requireResellerAuth(request);
    
    if (!resellerSession || resellerSession.userType !== 'reseller') {
      throw redirect('/reseller/login?error=access-denied');
    }

    const response = await fetch(`/api/reseller/ecommerce/mycart/show?resellerId=${resellerSession.resellerId}`, {
      headers: {
        'Authorization': `Bearer ${resellerSession.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Accès non autorisé');
    }

    const data: ResellerEcommerceResponse = await response.json();
    
    return json(data);
  } catch (error) {
    return json(
      { 
        status: 'error', 
        message: 'Accès revendeur requis',
        module: 'reseller-ecommerce',
        security: 'access-denied',
        timestamp: new Date().toISOString()
      }, 
      { status: 403 }
    );
  }
}

export default function ResellerMycartShow() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="mcp-reseller-container">
      <div className="reseller-header">
        <h1 className="mcp-title">🔒 Panier Revendeur</h1>
        <div className="security-badge">
          <span>ACCÈS REVENDEURS UNIQUEMENT</span>
        </div>
      </div>
      
      {data.status === 'error' && (
        <div className="mcp-error-security">
          🚫 Erreur d'accès: {data.message}
          <p>Cette section est réservée aux revendeurs authentifiés.</p>
        </div>
      )}
      
      <div className="reseller-cart-items">
        {data.data?.map((item: any) => (
          <div key={item.id} className="reseller-cart-item">
            <span>{item.product.name}</span>
            <span>Prix public: {item.product.price}€</span>
            <span className="reseller-price">
              Prix revendeur: {item.resellerPrice}€
            </span>
            <span className="discount">
              Remise: {item.discountPercent}%
            </span>
            <span>Qty: {item.quantity}</span>
          </div>
        ))}
      </div>
      
      <Form method="post" className="mcp-reseller-form">
        <button type="submit" className="mcp-button-reseller">
          Valider commande revendeur
        </button>
      </Form>
    </div>
  );
}
