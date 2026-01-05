import { Badge } from '~/components/ui';
/**
 * 🔄 Composant RecentActivity - Activité récente
 * Compatible avec l'architecture Remix existante
 */

import { Link } from "@remix-run/react";

interface ActivityItem {
  id: string;
  type: 'ORDER_CREATED' | 'ORDER_UPDATED' | 'STOCK_ALERT' | 'USER_REGISTERED' | 'PAYMENT_RECEIVED' | 'PRODUCT_UPDATED' | 'ADMIN_ACTION';
  title: string;
  description: string;
  userId?: string;
  userName?: string;
  entityId?: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  metadata?: Record<string, any>;
}

interface RecentActivityProps {
  activities: ActivityItem[];
  title?: string;
  maxItems?: number;
  showFilters?: boolean;
}

export function RecentActivity({ 
  activities, 
  title = "🔄 Activité Récente",
  maxItems = 10,
  showFilters = false 
}: RecentActivityProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🔄</div>
          <p className="text-gray-600">Aucune activité récente</p>
          <p className="text-sm text-gray-500 mt-1">
            L'activité du système apparaîtra ici
          </p>
        </div>
      </div>
    );
  }

  // Statistiques rapides
  const stats = {
    total: activities.length,
    today: activities.filter(a => isToday(a.timestamp)).length,
    errors: activities.filter(a => a.severity === 'ERROR').length,
    warnings: activities.filter(a => a.severity === 'WARNING').length
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <Link 
          to="/admin/activity" 
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Historique complet
        </Link>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-muted p-3 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-xs text-blue-600 uppercase tracking-wide">Total</div>
        </div>
        <div className="bg-success/10 p-3 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.today}</div>
          <div className="text-xs text-green-600 uppercase tracking-wide">Aujourd'hui</div>
        </div>
        <div className="bg-warning/10 p-3 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
          <div className="text-xs text-yellow-600 uppercase tracking-wide">Alertes</div>
        </div>
        <div className="bg-destructive/10 p-3 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
          <div className="text-xs text-red-600 uppercase tracking-wide">Erreurs</div>
        </div>
      </div>

      {/* Filtres rapides */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200">
          <button className="px-3 py-1 bg-info/90 text-info-foreground hover:bg-info rounded-full text-xs font-medium">
            Tout
          </button>
          <button className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-200">
            Commandes
          </button>
          <button className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-200">
            Stock
          </button>
          <button className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-200">
            Utilisateurs
          </button>
          <button className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-200">
            Erreurs
          </button>
        </div>
      )}

      {/* Timeline d'activité */}
      <div className="flow-root">
        <ul className="-mb-8">
          {activities.slice(0, maxItems).map((activity, activityIdx) => (
            <li key={activity.id}>
              <div className="relative pb-8">
                {activityIdx !== activities.slice(0, maxItems).length - 1 ? (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                ) : null}
                
                <div className="relative flex space-x-3">
                  {/* Icône d'activité */}
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ring-8 ring-white ${getActivityIconStyles(activity.type, activity.severity)}`}>
                    <span className="text-sm">
                      {getActivityIcon(activity.type)}
                    </span>
                  </div>
                  
                  {/* Contenu */}
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.title}
                        </p>
                        {activity.severity === 'ERROR' && (
                          <Badge variant="error">Erreur</Badge>
                        )}
                        {activity.severity === 'WARNING' && (
                          <Badge variant="warning">Alerte</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-1">
                        {activity.description}
                      </p>
                      
                      {/* Métadonnées */}
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(activity.metadata).slice(0, 3).map(([key, value]) => (
                            <span 
                              key={key}
                              className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
                            >
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Utilisateur */}
                      {activity.userName && (
                        <div className="mt-2 flex items-center space-x-1 text-xs text-gray-500">
                          <span>👤</span>
                          <span>{activity.userName}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Timestamp et actions */}
                    <div className="flex flex-col items-end space-y-2">
                      <time className="whitespace-nowrap text-xs text-gray-500">
                        {formatRelativeTime(activity.timestamp)}
                      </time>
                      
                      {activity.entityId && (
                        <Link 
                          to={getEntityLink(activity.type, activity.entityId)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Voir détails →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Lien vers l'historique complet */}
      {activities.length > maxItems && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <Link 
            to="/admin/activity" 
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Voir {activities.length - maxItems} activités supplémentaires
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Icônes pour les types d'activité
 */
function getActivityIcon(type: string): string {
  switch (type) {
    case 'ORDER_CREATED':
      return '🛒';
    case 'ORDER_UPDATED':
      return '📝';
    case 'STOCK_ALERT':
      return '📦';
    case 'USER_REGISTERED':
      return '👤';
    case 'PAYMENT_RECEIVED':
      return '💳';
    case 'PRODUCT_UPDATED':
      return '🏷️';
    case 'ADMIN_ACTION':
      return '⚙️';
    default:
      return '📋';
  }
}

/**
 * Styles pour les icônes d'activité
 */
function getActivityIconStyles(type: string, severity: string): string {
  // Base styles selon la sévérité
  let baseStyles = '';
  switch (severity) {
    case 'ERROR':
      baseStyles = 'bg-destructive text-destructive-foreground';
      break;
    case 'WARNING':
      baseStyles = 'bg-warning text-warning-foreground';
      break;
    case 'SUCCESS':
      baseStyles = 'bg-success text-success-foreground';
      break;
    default:
      baseStyles = 'bg-primary text-primary-foreground';
  }

  // Styles spécifiques selon le type
  switch (type) {
    case 'ORDER_CREATED':
    case 'ORDER_UPDATED':
      return severity === 'INFO' ? 'bg-primary text-white' : baseStyles;
    case 'STOCK_ALERT':
      return severity === 'INFO' ? 'bg-orange-500 text-white' : baseStyles;
    case 'USER_REGISTERED':
      return severity === 'INFO' ? 'bg-success text-white' : baseStyles;
    case 'PAYMENT_RECEIVED':
      return severity === 'INFO' ? 'bg-emerald-500 text-white' : baseStyles;
    case 'PRODUCT_UPDATED':
      return severity === 'INFO' ? 'bg-purple-500 text-white' : baseStyles;
    case 'ADMIN_ACTION':
      return severity === 'INFO' ? 'bg-gray-500 text-white' : baseStyles;
    default:
      return baseStyles;
  }
}

/**
 * Génère le lien vers l'entité selon le type
 */
function getEntityLink(type: string, entityId: string): string {
  switch (type) {
    case 'ORDER_CREATED':
    case 'ORDER_UPDATED':
      return `/admin/orders/${entityId}`;
    case 'USER_REGISTERED':
      return `/admin/users/${entityId}`;
    case 'PRODUCT_UPDATED':
      return `/admin/products/${entityId}`;
    case 'STOCK_ALERT':
      return `/admin/stock/alerts/${entityId}`;
    default:
      return '/admin';
  }
}

/**
 * Vérifie si une date est aujourd'hui
 */
function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
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
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
