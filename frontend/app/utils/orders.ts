/**
 * Utilitaires pour les commandes - Côté client et serveur
 */

/**
 * Utilitaires pour les statuts de commandes
 */
export function getOrderStatusLabel(status: number): string {
  const statusMap: Record<number, string> = {
    1: "En attente",
    2: "Confirmée", 
    3: "En préparation",
    4: "Expédiée",
    5: "En livraison",
    6: "Livrée",
    7: "Annulée",
    8: "Remboursée",
  };
  
  return statusMap[status] || "Statut inconnu";
}

/**
 * Formatage des prix
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

/**
 * Types d'interfaces partagées
 */
export interface OrderLine {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: number;
  totalTTC: number;
  createdAt: string;
  lines: OrderLine[];
}

export interface OrdersResponse {
  orders: Order[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
}
