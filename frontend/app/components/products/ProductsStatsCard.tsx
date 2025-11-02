/**
 * 📈 PRODUCTS STATS CARD COMPONENT
 * 
 * Component consolidé pour l'affichage des statistiques produits
 * Basé sur l'architecture dashboard avec spécialisation products
 * 
 * Usage:
 * - Pro Products Interface
 * - Commercial Products Interface  
 * - Progressive Enhancement ready
 */

import { 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  Tag, 
  Star, 
  Crown,
  type LucideIcon 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

interface ProductsStatsProps {
  totalProducts: number;
  categoriesCount?: number;
  brandsCount?: number;
  averageRating?: number;
  inStock?: number;
  exclusiveProducts?: number;
  lowStockItems?: number;
  enhanced?: boolean;
  userRole?: 'pro' | 'commercial';
}

interface StatItemProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  enhanced?: boolean;
  progress?: number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function StatItem({ 
  title, 
  value, 
  icon: Icon, 
  variant = 'default',
  enhanced = false,
  progress,
  trend 
}: StatItemProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'border-success bg-success/10 text-green-900';
      case 'warning':
        return 'border-warning bg-warning/10 text-yellow-900';
      case 'danger':
        return 'border-destructive bg-destructive/10 text-red-900';
      default:
        return 'border-gray-200 bg-white text-gray-900';
    }
  };

  return (
    <Card className={cn('transition-all duration-200 hover:shadow-md', getVariantStyles())}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-70">{title}</p>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            
            {enhanced && trend && (
              <div className="flex items-center mt-1">
                <Badge 
                  variant={trend.isPositive ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
                </Badge>
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-center">
            <Icon className="h-8 w-8 opacity-60" />
            
            {enhanced && progress !== undefined && (
              <div className="mt-2 w-12 bg-gray-200 rounded-full h-1.5">
                <div 
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    variant === 'success' ? 'bg-success' :
                    variant === 'warning' ? 'bg-warning' :
                    variant === 'danger' ? 'bg-destructive' : 'bg-info'
                  )}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductsStatsCard({ 
  totalProducts,
  categoriesCount,
  brandsCount, 
  averageRating,
  inStock,
  exclusiveProducts,
  lowStockItems,
  enhanced = false,
  userRole = 'commercial'
}: ProductsStatsProps) {
  const stats: StatItemProps[] = [
    {
      title: 'Produits Total',
      value: totalProducts,
      icon: Package,
      variant: 'default' as const,
      progress: enhanced ? 100 : undefined
    },
    ...(inStock !== undefined ? [{
      title: 'En Stock',
      value: inStock,
      icon: CheckCircle,
      variant: 'success' as const,
      progress: enhanced ? (inStock / totalProducts) * 100 : undefined,
      trend: enhanced ? { value: 5, isPositive: true } : undefined
    }] : []),
    ...(lowStockItems !== undefined ? [{
      title: 'Stock Faible',
      value: lowStockItems,
      icon: AlertTriangle,
      variant: (lowStockItems > 10 ? 'danger' : 'warning') as 'danger' | 'warning',
      progress: enhanced ? (lowStockItems / totalProducts) * 100 : undefined
    }] : []),
    ...(categoriesCount !== undefined ? [{
      title: 'Catégories',
      value: categoriesCount,
      icon: Tag,
      variant: 'default' as const
    }] : []),
    ...(brandsCount !== undefined ? [{
      title: 'Marques',
      value: brandsCount,
      icon: Star,
      variant: 'default' as const
    }] : []),
    ...(userRole === 'pro' && exclusiveProducts !== undefined ? [{
      title: 'Exclusifs Pro',
      value: exclusiveProducts,
      icon: Crown,
      variant: 'success' as const,
      trend: enhanced ? { value: 12, isPositive: true } : undefined
    }] : []),
    ...(averageRating !== undefined ? [{
      title: 'Note Moyenne',
      value: Math.round(averageRating * 10) / 10,
      icon: Star,
      variant: (averageRating >= 4 ? 'success' : 'default') as 'success' | 'default',
      progress: enhanced ? (averageRating / 5) * 100 : undefined
    }] : [])
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatItem key={index} {...stat} enhanced={enhanced} />
      ))}
    </div>
  );
}

export default ProductsStatsCard;
