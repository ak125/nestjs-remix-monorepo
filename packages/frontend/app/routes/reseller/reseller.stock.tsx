/**
 * MCP GENERATED ROUTE - RESELLER STOCK
 * Généré automatiquement par MCP Context-7
 * Module: reseller-stock
 * Sécurité: Interface stock revendeurs uniquement
 * Source: massdoc/gestion.stock.php
 */
import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Form, useSubmit } from '@remix-run/react';
import { requireResellerAuth } from '@/utils/reseller-auth';
import type { ResellerStockData } from '@/shared/types/reseller/reseller-ecommerce.types';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Vérification authentification revendeur
    const resellerSession = await requireResellerAuth(request);
    
    if (!resellerSession || resellerSession.userType !== 'reseller') {
      throw redirect('/reseller/login?error=access-denied');
    }

    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const limit = url.searchParams.get('limit') || '20';

    const response = await fetch(`/api/reseller/stock?resellerId=${resellerSession.resellerId}&page=${page}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${resellerSession.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Accès non autorisé');
    }

    const data = await response.json();
    
    return json(data);
  } catch (error) {
    return json(
      { 
        status: 'error', 
        message: 'Accès revendeur requis',
        module: 'reseller-stock',
        timestamp: new Date().toISOString()
      }, 
      { status: 403 }
    );
  }
}

export default function ResellerStock() {
  const data = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleStockAlert = (productId: string, threshold: number) => {
    submit(
      { productId, threshold, action: 'set-alert' },
      { method: 'post' }
    );
  };

  const handleReserveStock = (productId: string, quantity: number) => {
    submit(
      { productId, quantity, action: 'reserve' },
      { method: 'post' }
    );
  };

  if (data.status === 'error') {
    return (
      <div className="mcp-error-container">
        <h1>🚫 Accès Restreint</h1>
        <p>{data.message}</p>
        <p>Cette section est réservée aux revendeurs authentifiés.</p>
      </div>
    );
  }

  return (
    <div className="mcp-reseller-stock">
      <header className="stock-header">
        <h1 className="stock-title">🔒 Gestion Stock Revendeur</h1>
        <div className="security-badge">
          <span>MASSDOC - GESTION STOCK</span>
        </div>
      </header>

      <div className="stock-controls">
        <div className="filter-section">
          <Form method="get" className="filter-form">
            <input
              type="search"
              name="search"
              placeholder="Rechercher un produit..."
              className="search-input"
            />
            <select name="category" className="filter-select">
              <option value="">Toutes catégories</option>
              <option value="electronics">Électronique</option>
              <option value="automotive">Automobile</option>
              <option value="tools">Outillage</option>
            </select>
            <button type="submit" className="filter-button">
              Filtrer
            </button>
          </Form>
        </div>
      </div>

      <div className="stock-grid">
        {data.data?.map((stockItem: any) => (
          <div key={stockItem.id} className="stock-card">
            <div className="stock-info">
              <h3 className="product-name">{stockItem.product?.name}</h3>
              <p className="product-ref">Ref: {stockItem.product?.reference}</p>
            </div>
            
            <div className="stock-levels">
              <div className="level-item">
                <span className="level-label">Disponible:</span>
                <span className={`level-value ${stockItem.available < stockItem.threshold ? 'low' : ''}`}>
                  {stockItem.available}
                </span>
              </div>
              <div className="level-item">
                <span className="level-label">Réservé:</span>
                <span className="level-value">{stockItem.reserved}</span>
              </div>
              <div className="level-item">
                <span className="level-label">Seuil alerte:</span>
                <span className="level-value">{stockItem.threshold}</span>
              </div>
            </div>

            <div className="stock-actions">
              <button
                onClick={() => handleReserveStock(stockItem.productId, 1)}
                className="action-button reserve"
                disabled={stockItem.available === 0}
              >
                Réserver
              </button>
              <button
                onClick={() => handleStockAlert(stockItem.productId, stockItem.threshold)}
                className="action-button alert"
              >
                Modifier seuil
              </button>
            </div>

            {stockItem.available < stockItem.threshold && (
              <div className="stock-warning">
                ⚠️ Stock faible - Réapprovisionnement conseillé
              </div>
            )}
          </div>
        ))}
      </div>

      {(!data.data || data.data.length === 0) && (
        <div className="empty-state">
          <h2>📦 Aucun produit en stock</h2>
          <p>Contactez votre gestionnaire pour ajouter des produits à votre stock.</p>
        </div>
      )}
    </div>
  );
}
