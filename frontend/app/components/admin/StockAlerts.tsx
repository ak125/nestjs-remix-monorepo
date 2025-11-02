/**
 * 🚨 Composant StockAlerts - Alertes de stock
 * Compatible avec l'architecture Remix existante
 */

import { Link } from "@remix-run/react";

interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  alertType: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVERSTOCK';
  alertLevel: 'CRITICAL' | 'WARNING' | 'INFO';
  currentStock: number;
  minStock: number;
  createdAt: string;
}

interface StockAlertsProps {
  alerts: StockAlert[];
}

export function StockAlerts({ alerts }: StockAlertsProps) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          🚨 Alertes Stock
        </h2>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-gray-600">Aucune alerte active</p>
          <p className="text-sm text-gray-500 mt-1">
            Votre stock est dans les paramètres normaux
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          🚨 Alertes Stock ({alerts.length})
        </h2>
        <Link 
          to="/admin/stock/alerts" 
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Voir toutes
        </Link>
      </div>
      
      <div className="space-y-3">
        {alerts.slice(0, 5).map((alert) => (
          <div 
            key={alert.id}
            className={`p-4 rounded-lg border-l-4 ${getAlertStyles(alert.alertLevel)}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getAlertIcon(alert.alertType)}</span>
                  <h3 className="font-medium text-gray-900">{alert.productName}</h3>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Stock actuel: <span className="font-medium">{alert.currentStock}</span>
                  {alert.minStock > 0 && (
                    <span> / Minimum: <span className="font-medium">{alert.minStock}</span></span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatRelativeTime(alert.createdAt)}
                </p>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getAlertBadgeStyles(alert.alertLevel)}`}>
                  {alert.alertType.replace('_', ' ')}
                </span>
                <Link 
                  to={`/admin/stock/products/${alert.productId}`}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Gérer →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {alerts.length > 5 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <Link 
            to="/admin/stock/alerts" 
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Voir {alerts.length - 5} alertes supplémentaires
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Styles CSS pour les différents niveaux d'alerte
 */
function getAlertStyles(level: string): string {
  switch (level) {
    case 'CRITICAL':
      return 'border-red-500 bg-destructive/10';
    case 'WARNING':
      return 'border-yellow-500 bg-warning/10';
    default:
      return 'border-blue-500 bg-primary/10';
  }
}

/**
 * Styles pour les badges d'alerte
 */
function getAlertBadgeStyles(level: string): string {
  switch (level) {
    case 'CRITICAL':
      return 'error';
    case 'WARNING':
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * Icônes pour les types d'alerte
 */
function getAlertIcon(type: string): string {
  switch (type) {
    case 'OUT_OF_STOCK':
      return '❌';
    case 'LOW_STOCK':
      return '⚠️';
    case 'OVERSTOCK':
      return '📦';
    default:
      return '🔔';
  }
}

/**
 * Formate une date en temps relatif
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) {
    return 'À l\'instant';
  } else if (diffInMinutes < 60) {
    return `Il y a ${diffInMinutes} min`;
  } else if (diffInHours < 24) {
    return `Il y a ${diffInHours}h`;
  } else if (diffInDays < 7) {
    return `Il y a ${diffInDays}j`;
  } else {
    return date.toLocaleDateString('fr-FR');
  }
}
