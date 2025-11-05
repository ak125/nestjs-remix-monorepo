/**
 * 🛒 Order Hover Card - Preview rapide commande au survol
 * 
 * Affiche un aperçu riche au hover avec:
 * - Numéro de commande + date
 * - Statut avec badge coloré
 * - Montant total
 * - Client (nom + email)
 * - Nombre d'articles
 * - Lien vers détails commande
 */

import { Link } from '@remix-run/react';
import { Calendar, ExternalLink, Package, ShoppingBag, User } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../ui/hover-card';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface OrderPreview {
  id: number;
  orderNumber: string;
  date: string;
  status: OrderStatus;
  total: number;
  itemsCount: number;
  customerName: string;
  customerEmail?: string;
  shippingAddress?: string;
}

interface OrderHoverCardProps {
  order: OrderPreview;
  /** Élément qui déclenche le hover */
  children: React.ReactNode;
  /** Afficher le bouton "Voir commande" */
  showViewButton?: boolean;
}

export function OrderHoverCard({ 
  order, 
  children,
  showViewButton = true
}: OrderHoverCardProps) {
  // Déterminer le badge de statut
  const getStatusBadge = (status: OrderStatus) => {
    const badges = {
      pending: { label: 'En attente', variant: 'secondary' as const, color: 'bg-gray-100 text-gray-800' },
      processing: { label: 'En traitement', variant: 'default' as const, color: 'bg-blue-100 text-blue-800' },
      shipped: { label: 'Expédiée', variant: 'default' as const, color: 'bg-purple-100 text-purple-800' },
      delivered: { label: 'Livrée', variant: 'success' as const, color: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Annulée', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
    };
    return badges[status];
  };

  const statusBadge = getStatusBadge(order.status);

  // Formater la date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="space-y-4">
          {/* Header avec numéro et statut */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-sm">Commande #{order.orderNumber}</h4>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(order.date)}</span>
              </div>
            </div>
            <Badge className={statusBadge.color}>
              {statusBadge.label}
            </Badge>
          </div>

          {/* Montant total */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
            <span className="text-sm text-muted-foreground">Montant total</span>
            <span className="text-2xl font-bold text-blue-600">{order.total.toFixed(2)}€</span>
          </div>

          {/* Informations */}
          <div className="space-y-2 text-xs">
            {/* Client */}
            <div className="flex items-start gap-2">
              <User className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-foreground">{order.customerName}</div>
                {order.customerEmail && (
                  <div className="text-muted-foreground">{order.customerEmail}</div>
                )}
              </div>
            </div>

            {/* Nombre d'articles */}
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">{order.itemsCount}</strong> article{order.itemsCount > 1 ? 's' : ''}
              </span>
            </div>

            {/* Adresse de livraison */}
            {order.shippingAddress && (
              <div className="flex items-start gap-2 pt-2 border-t border-border">
                <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-muted-foreground font-medium mb-1">Livraison:</div>
                  <div className="text-muted-foreground leading-relaxed">{order.shippingAddress}</div>
                </div>
              </div>
            )}
          </div>

          {/* Lien vers détails */}
          {showViewButton && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to={`/admin/orders/${order.id}`}>
                <ShoppingBag className="w-4 h-4 mr-2" />
                Voir les détails
                <ExternalLink className="w-3 h-3 ml-auto" />
              </Link>
            </Button>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
