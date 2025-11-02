/**
 * 🔔 NOTIFICATION CENTER - Centre de notifications avancé
 * 
 * Centre de notifications sophisticated avec:
 * ✅ Auto-refresh configurable (30s par défaut)
 * ✅ Types multiples (info, success, warning, error)
 * ✅ Actions rapides sur notifications
 * ✅ Marquer lu/non lu individuellement ou en masse
 * ✅ Filtres par statut et type
 * ✅ Suppression avec confirmation
 * ✅ Badge compteur non lus
 * ✅ Interface responsive avec dropdown
 */

import { useFetcher } from "@remix-run/react";
import { 
  Bell, 
  X, 
  CheckCheck, 
  Trash2, 
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  actions?: Array<{
    label: string;
    action: string;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
  metadata?: {
    userId?: string;
    orderId?: string;
    productId?: string;
  };
}

interface NotificationCenterProps {
  autoRefreshInterval?: number; // en millisecondes
  maxNotifications?: number;
  className?: string;
}

const NOTIFICATION_TYPES = {
  info: { icon: Info, color: 'blue' },
  success: { icon: CheckCircle, color: 'green' },
  warning: { icon: AlertCircle, color: 'yellow' },
  error: { icon: XCircle, color: 'red' },
} as const;

const FILTER_OPTIONS = [
  { key: 'all', label: 'Toutes' },
  { key: 'unread', label: 'Non lues' },
  { key: 'read', label: 'Lues' },
  { key: 'info', label: 'Info' },
  { key: 'success', label: 'Succès' },
  { key: 'warning', label: 'Attention' },
  { key: 'error', label: 'Erreurs' },
] as const;

export function NotificationCenter({ 
  autoRefreshInterval = 30000, // 30 secondes
  maxNotifications = 50,
  className = ""
}: NotificationCenterProps) {
  const fetcher = useFetcher<{ notifications: Notification[]; total: number; unreadCount: number }>();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [showActions, setShowActions] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  // Charger les notifications
  const loadNotifications = useCallback(() => {
    const params = new URLSearchParams({
      filter: selectedFilter,
      limit: maxNotifications.toString()
    });
    fetcher.load(`/api/notifications?${params}`);
  }, [fetcher, selectedFilter, maxNotifications]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      refreshIntervalRef.current = setInterval(loadNotifications, autoRefreshInterval);
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [loadNotifications, autoRefreshInterval]);

  // Charger au montage et changement de filtre
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Fermer le dropdown si clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowActions(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Actions sur notifications
  const markAsRead = useCallback((notificationIds: string[]) => {
    fetcher.submit(
      { action: 'mark-read', ids: JSON.stringify(notificationIds) },
      { method: 'post', action: '/api/notifications/actions' }
    );
  }, [fetcher]);

  const markAsUnread = useCallback((notificationIds: string[]) => {
    fetcher.submit(
      { action: 'mark-unread', ids: JSON.stringify(notificationIds) },
      { method: 'post', action: '/api/notifications/actions' }
    );
  }, [fetcher]);

  const deleteNotifications = useCallback((notificationIds: string[]) => {
    if (confirm(`Supprimer ${notificationIds.length} notification${notificationIds.length > 1 ? 's' : ''} ?`)) {
      fetcher.submit(
        { action: 'delete', ids: JSON.stringify(notificationIds) },
        { method: 'post', action: '/api/notifications/actions' }
      );
      setSelectedNotifications(new Set());
    }
  }, [fetcher]);

  const markAllAsRead = useCallback(() => {
    const unreadIds = (fetcher.data?.notifications || [])
      .filter(n => !n.isRead)
      .map(n => n.id);
    
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  }, [fetcher.data?.notifications, markAsRead]);

  // Gestion de la sélection
  const toggleSelection = useCallback((id: string) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = fetcher.data?.notifications.map(n => n.id) || [];
    setSelectedNotifications(new Set(allIds));
  }, [fetcher.data?.notifications]);

  const clearSelection = useCallback(() => {
    setSelectedNotifications(new Set());
  }, []);

  // Format de temps relatif
  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'À l\'instant';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }, []);

  const notifications = fetcher.data?.notifications || [];
  const unreadCount = fetcher.data?.unreadCount || 0;
  const isLoading = fetcher.state === 'loading';
  const hasSelection = selectedNotifications.size > 0;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bouton déclencheur */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[600px] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({unreadCount} non lue{unreadCount > 1 ? 's' : ''})
                  </span>
                )}
              </h3>
              
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    title="Marquer tout comme lu"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filtres */}
            <div className="flex flex-wrap gap-1">
              {FILTER_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedFilter(key)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    selectedFilter === key
                      ? 'bg-primary/15 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Actions de masse */}
            {hasSelection && (
              <div className="flex items-center justify-between mt-3 p-2 bg-primary/5 rounded-lg">
                <span className="text-sm text-blue-700">
                  {selectedNotifications.size} sélectionnée{selectedNotifications.size > 1 ? 's' : ''}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => markAsRead(Array.from(selectedNotifications))}
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    title="Marquer comme lu"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => markAsUnread(Array.from(selectedNotifications))}
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    title="Marquer comme non lu"
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteNotifications(Array.from(selectedNotifications))}
                    className="text-sm text-red-600 hover:text-red-700 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-600 hover:text-gray-700 transition-colors"
                    title="Désélectionner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="p-4 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-500">Chargement...</p>
            </div>
          )}

          {/* Liste des notifications */}
          <div className="max-h-96 overflow-y-auto">
            {!isLoading && notifications.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>Aucune notification</p>
              </div>
            )}

            {!isLoading && notifications.map((notification) => {
              const TypeIcon = NOTIFICATION_TYPES[notification.type].icon;
              const typeColor = NOTIFICATION_TYPES[notification.type].color;
              const isSelected = selectedNotifications.has(notification.id);
              const showActionsMenu = showActions === notification.id;

              return (
                <div
                  key={notification.id}
                  className={`border-b border-gray-100 last:border-b-0 transition-colors ${
                    notification.isRead ? 'bg-white' : 'bg-primary/5'
                  } ${isSelected ? 'bg-primary/15' : ''}`}
                >
                  <div className="p-4">
                    <div className="flex items-start space-x-3">
                      {/* Checkbox de sélection */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(notification.id)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />

                      {/* Icône du type */}
                      <div className={`flex-shrink-0 mt-0.5 p-1 rounded-full bg-${typeColor}-100`}>
                        <TypeIcon className={`w-4 h-4 text-${typeColor}-600`} />
                      </div>

                      {/* Contenu */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${notification.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                              {notification.title}
                            </p>
                            <p className={`text-sm mt-1 ${notification.isRead ? 'text-gray-500' : 'text-gray-700'}`}>
                              {notification.message}
                            </p>

                            {/* Actions rapides */}
                            {notification.actions && notification.actions.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {notification.actions.map((action, index) => (
                                  <button
                                    key={index}
                                    onClick={() => {
                                      // Traiter l'action
                                      fetcher.submit(
                                        { action: action.action, notificationId: notification.id },
                                        { method: 'post', action: '/api/notifications/actions' }
                                      );
                                    }}
                                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                      action.variant === 'danger'
                                        ? 'border-red-300 text-destructive hover:bg-destructive/10'
                                        : action.variant === 'primary'
                                        ? 'border-blue-300 text-blue-700 hover:bg-info/20'
                                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Menu d'actions */}
                          <div className="relative ml-2">
                            <button
                              onClick={() => setShowActions(showActionsMenu ? null : notification.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            >
                              <span className="sr-only">Actions</span>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>

                            {showActionsMenu && (
                              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                                <button
                                  onClick={() => {
                                    if (notification.isRead) {
                                      markAsUnread([notification.id]);
                                    } else {
                                      markAsRead([notification.id]);
                                    }
                                    setShowActions(null);
                                  }}
                                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                  {notification.isRead ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                                  {notification.isRead ? 'Marquer non lu' : 'Marquer lu'}
                                </button>
                                <button
                                  onClick={() => {
                                    deleteNotifications([notification.id]);
                                    setShowActions(null);
                                  }}
                                  className="flex items-center w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Supprimer
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Horodatage */}
                        <div className="flex items-center mt-2 text-xs text-gray-400">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTime(notification.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <button
                  onClick={selectAll}
                  className="hover:text-gray-800 transition-colors"
                >
                  Tout sélectionner
                </button>
                <button
                  onClick={loadNotifications}
                  className="hover:text-gray-800 transition-colors"
                >
                  Actualiser
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook pour utiliser le centre de notifications
export function useNotificationCenter() {
  const fetcher = useFetcher<{ unreadCount: number }>();

  // Charger le nombre de notifications non lues
  const loadUnreadCount = useCallback(() => {
    fetcher.load('/api/notifications/count');
  }, [fetcher]);

  useEffect(() => {
    loadUnreadCount();
    
    // Rafraîchir toutes les 60 secondes
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  return {
    unreadCount: fetcher.data?.unreadCount || 0,
    refresh: loadUnreadCount
  };
}
