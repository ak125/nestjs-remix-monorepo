/**
 * MCP GENERATED ROUTE - RESELLER DASHBOARD
 * Généré automatiquement par MCP Context-7
 * Module: reseller-dashboard
 * Sécurité: Interface revendeurs uniquement
 * Source: massdoc/welcome.php
 */
import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { requireResellerAuth } from '@/utils/reseller-auth';
import type { ResellerDashboardData } from '@/shared/types/reseller/reseller-ecommerce.types';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Vérification authentification revendeur
    const resellerSession = await requireResellerAuth(request);
    
    if (!resellerSession || resellerSession.userType !== 'reseller') {
      throw redirect('/reseller/login?error=access-denied');
    }

    const response = await fetch(`/api/reseller/dashboard?resellerId=${resellerSession.resellerId}`, {
      headers: {
        'Authorization': `Bearer ${resellerSession.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Accès non autorisé');
    }

    const data: ResellerDashboardData = await response.json();
    
    return json(data);
  } catch (error) {
    return json(
      { 
        status: 'error', 
        message: 'Accès revendeur requis',
        module: 'reseller-dashboard',
        timestamp: new Date().toISOString()
      }, 
      { status: 403 }
    );
  }
}

export default function ResellerDashboard() {
  const data = useLoaderData<typeof loader>();

  if (data.status === 'error') {
    return (
      <div className="mcp-error-container">
        <h1>🚫 Accès Restreint</h1>
        <p>{data.message}</p>
        <p>Cette section est réservée aux revendeurs authentifiés.</p>
        <Link to="/reseller/login" className="mcp-button">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="mcp-reseller-dashboard">
      <header className="dashboard-header">
        <h1 className="dashboard-title">🔒 Dashboard Revendeur</h1>
        <div className="security-badge">
          <span>MASSDOC - ACCÈS REVENDEURS</span>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Résumé des commandes */}
        <div className="dashboard-card">
          <h2>📊 Résumé Activité</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{data.summary?.totalOrders || 0}</span>
              <span className="stat-label">Commandes Total</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{data.summary?.pendingOrders || 0}</span>
              <span className="stat-label">En Attente</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{data.summary?.totalAmount?.toFixed(2) || '0.00'}€</span>
              <span className="stat-label">CA Total</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{data.summary?.averageOrderValue?.toFixed(2) || '0.00'}€</span>
              <span className="stat-label">Panier Moyen</span>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="dashboard-card">
          <h2>⚡ Actions Rapides</h2>
          <div className="action-buttons">
            <Link to="/reseller/reseller.mycart.show" className="action-button">
              🛒 Mon Panier
            </Link>
            <Link to="/reseller/reseller.stock" className="action-button">
              📦 Gestion Stock
            </Link>
            <Link to="/reseller/catalog" className="action-button">
              📋 Catalogue
            </Link>
            <Link to="/reseller/orders" className="action-button">
              📋 Mes Commandes
            </Link>
          </div>
        </div>

        {/* Commandes récentes */}
        <div className="dashboard-card recent-orders">
          <h2>📋 Commandes Récentes</h2>
          <div className="orders-list">
            {data.recentOrders?.map((order: any) => (
              <div key={order.id} className="order-item">
                <span className="order-number">#{order.orderNumber}</span>
                <span className="order-status">{order.status}</span>
                <span className="order-amount">{order.totalAmount.toFixed(2)}€</span>
                <span className="order-date">{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertes stock */}
        <div className="dashboard-card stock-alerts">
          <h2>⚠️ Alertes Stock</h2>
          <div className="alerts-list">
            {data.stockAlerts?.map((alert: any) => (
              <div key={alert.id} className="alert-item">
                <span className="alert-product">{alert.productName}</span>
                <span className="alert-level">Stock: {alert.available}</span>
                <span className="alert-threshold">Seuil: {alert.threshold}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
