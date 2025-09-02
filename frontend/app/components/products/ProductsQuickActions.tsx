/**
 * ⚡ PRODUCTS QUICK ACTIONS COMPONENT
 * 
 * Component consolidé pour les actions rapides produits
 * Réutilise l'architecture dashboard QuickActions avec spécialisation products
 * 
 * Usage:
 * - Pro Products Interface
 * - Commercial Products Interface
 * - Progressive Enhancement ready
 */

import { Link, Form } from '@remix-run/react';
import { 
  Plus, 
  Upload, 
  Download, 
  RefreshCw, 
  Search, 
  Filter,
  BarChart3,
  Settings,
  type LucideIcon 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface QuickAction {
  label: string;
  icon: LucideIcon;
  to?: string;
  action?: 'submit' | 'button';
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
  enhanced?: boolean;
  proOnly?: boolean;
  commercialOnly?: boolean;
}

interface ProductsQuickActionsProps {
  enhanced?: boolean;
  userRole?: 'pro' | 'commercial';
  onRefresh?: () => void;
  className?: string;
}

export function ProductsQuickActions({
  enhanced = false,
  userRole = 'commercial',
  onRefresh,
  className
}: ProductsQuickActionsProps) {
  const actions: QuickAction[] = [
    {
      label: 'Nouveau Produit',
      icon: Plus,
      to: userRole === 'pro' ? '/pro/products/new' : '/commercial/products/new',
      variant: 'default'
    },
    {
      label: 'Recherche Avancée',
      icon: Search,
      to: userRole === 'pro' ? '/pro/products/search' : '/commercial/products/search',
      variant: 'outline'
    },
    {
      label: 'Filtres',
      icon: Filter,
      action: 'button',
      variant: 'outline',
      enhanced: true
    },
    {
      label: 'Actualiser',
      icon: RefreshCw,
      action: 'button',
      variant: 'secondary'
    },
    ...(enhanced ? [
      {
        label: 'Import CSV',
        icon: Upload,
        to: userRole === 'pro' ? '/pro/products/import' : '/commercial/products/import',
        variant: 'outline' as const,
        enhanced: true
      },
      {
        label: 'Export',
        icon: Download,
        action: 'button' as const,
        variant: 'outline' as const,
        enhanced: true
      },
      {
        label: 'Analytics',
        icon: BarChart3,
        to: userRole === 'pro' ? '/pro/analytics/products' : '/commercial/analytics/products',
        variant: 'secondary' as const,
        enhanced: true
      }
    ] : []),
    ...(userRole === 'pro' ? [
      {
        label: 'Configuration',
        icon: Settings,
        to: '/pro/products/settings',
        variant: 'outline' as const,
        proOnly: true
      }
    ] : [])
  ];

  // Filter actions based on role and enhanced mode
  const availableActions = actions.filter(action => {
    if (action.proOnly && userRole !== 'pro') return false;
    if (action.commercialOnly && userRole !== 'commercial') return false;
    if (action.enhanced && !enhanced) return false;
    return true;
  });

  const handleAction = (action: QuickAction) => {
    if (action.action === 'button' && action.icon === RefreshCw) {
      onRefresh?.();
    }
    // Add other action handlers as needed
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="p-6">
        <div className="flex flex-wrap gap-3">
          {availableActions.map((action, index) => {
            const ActionIcon = action.icon;
            
            if (action.to) {
              return (
                <Button
                  key={index}
                  asChild
                  variant={action.variant}
                  size="sm"
                  className={cn(
                    'flex items-center gap-2 transition-all duration-200',
                    enhanced && 'hover:scale-105'
                  )}
                >
                  <Link to={action.to}>
                    <ActionIcon className="h-4 w-4" />
                    {action.label}
                  </Link>
                </Button>
              );
            }

            if (action.action === 'submit') {
              return (
                <Form key={index} method="post" className="inline-block">
                  <Button
                    type="submit"
                    variant={action.variant}
                    size="sm"
                    className={cn(
                      'flex items-center gap-2 transition-all duration-200',
                      enhanced && 'hover:scale-105'
                    )}
                  >
                    <ActionIcon className="h-4 w-4" />
                    {action.label}
                  </Button>
                </Form>
              );
            }

            return (
              <Button
                key={index}
                variant={action.variant}
                size="sm"
                onClick={() => handleAction(action)}
                className={cn(
                  'flex items-center gap-2 transition-all duration-200',
                  enhanced && 'hover:scale-105'
                )}
              >
                <ActionIcon className="h-4 w-4" />
                {action.label}
              </Button>
            );
          })}
        </div>

        {enhanced && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Actions disponibles: {availableActions.length}</span>
              <span>Mode: {userRole.toUpperCase()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProductsQuickActions;
