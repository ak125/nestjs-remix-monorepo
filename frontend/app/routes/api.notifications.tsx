/**
 * 🔔 API NOTIFICATIONS - Mock endpoint pour tester NotificationCenter
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";

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

// Mock data pour les tests
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    title: "Nouvelle commande",
    message: "Commande #12345 reçue de Jean Dupont",
    type: "info",
    isRead: false,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
    actions: [
      { label: "Voir", action: "view-order", variant: "primary" },
      { label: "Traiter", action: "process-order", variant: "secondary" }
    ],
    metadata: { orderId: "12345", userId: "user-123" }
  },
  {
    id: "2",
    title: "Stock faible",
    message: "Le produit 'Amortisseur avant' est en rupture de stock",
    type: "warning",
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    actions: [
      { label: "Réapprovisionner", action: "restock", variant: "primary" }
    ],
    metadata: { productId: "prod-456" }
  },
  {
    id: "3",
    title: "Paiement confirmé",
    message: "Paiement de 125,99€ confirmé pour la commande #12344",
    type: "success",
    isRead: true,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4h ago
    metadata: { orderId: "12344" }
  },
  {
    id: "4",
    title: "Erreur de traitement",
    message: "Échec du traitement automatique de la commande #12343",
    type: "error",
    isRead: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    actions: [
      { label: "Retry", action: "retry-processing", variant: "primary" },
      { label: "Manuel", action: "manual-process", variant: "secondary" }
    ],
    metadata: { orderId: "12343" }
  },
  {
    id: "5",
    title: "Nouvel utilisateur",
    message: "Marie Martin s'est inscrite sur la plateforme",
    type: "info",
    isRead: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    metadata: { userId: "user-789" }
  }
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all";
  const limit = parseInt(url.searchParams.get("limit") || "50");

  // Filtrer les notifications
  let filteredNotifications = MOCK_NOTIFICATIONS;

  switch (filter) {
    case "unread":
      filteredNotifications = MOCK_NOTIFICATIONS.filter(n => !n.isRead);
      break;
    case "read":
      filteredNotifications = MOCK_NOTIFICATIONS.filter(n => n.isRead);
      break;
    case "info":
    case "success":
    case "warning":
    case "error":
      filteredNotifications = MOCK_NOTIFICATIONS.filter(n => n.type === filter);
      break;
    default:
      // "all" - pas de filtre
      break;
  }

  // Limiter le nombre de résultats
  const notifications = filteredNotifications.slice(0, limit);
  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.isRead).length;

  return json({
    notifications,
    total: filteredNotifications.length,
    unreadCount
  });
}
