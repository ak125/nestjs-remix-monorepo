import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { Button } from './button';

const productCardVariants = cva(
  'group relative flex flex-col overflow-hidden transition-all duration-200',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--bg-primary)] border-2 border-[var(--border-primary)] hover:border-[var(--color-primary-500)] hover:shadow-lg',
        outlined:
          'bg-transparent border-2 border-[var(--border-primary)] hover:bg-[var(--bg-secondary)]',
        elevated:
          'bg-[var(--bg-primary)] shadow-md hover:shadow-xl border border-[var(--border-secondary)]',
        flat: 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]',
      },
      radius: {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        xl: 'rounded-xl',
      },
      density: {
        compact: 'p-3 gap-2',
        comfy: 'p-4 gap-3',
        spacious: 'p-6 gap-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      radius: 'lg',
      density: 'comfy',
    },
  }
);

const productCardImageVariants = cva('relative w-full overflow-hidden bg-[var(--bg-secondary)]', {
  variants: {
    aspectRatio: {
      square: 'aspect-square',
      portrait: 'aspect-[3/4]',
      landscape: 'aspect-[4/3]',
      wide: 'aspect-[16/9]',
    },
  },
  defaultVariants: {
    aspectRatio: 'square',
  },
});

export interface ProductCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof productCardVariants> {
  image?: string;
  imageFallback?: string;
  imageAlt: string;
  imageAspectRatio?: VariantProps<typeof productCardImageVariants>['aspectRatio'];
  badge?: React.ReactNode;
  badgeVariant?: 'promo' | 'new' | 'stock' | 'custom';
  title: string;
  subtitle?: string;
  price: string;
  oldPrice?: string;
  stock?: 'in-stock' | 'low-stock' | 'out-of-stock';
  stockLabel?: string;
  rating?: number;
  reviewCount?: number;
  ctaLabel?: string;
  onCtaClick?: () => void;
  ctaDisabled?: boolean;
  footer?: React.ReactNode;
}

const ProductCard = React.forwardRef<HTMLDivElement, ProductCardProps>(
  (
    {
      className,
      variant,
      radius,
      density,
      image,
      imageFallback = '/placeholder.svg',
      imageAlt,
      imageAspectRatio = 'square',
      badge,
      badgeVariant = 'custom',
      title,
      subtitle,
      price,
      oldPrice,
      stock,
      stockLabel,
      rating,
      reviewCount,
      ctaLabel = 'Ajouter au panier',
      onCtaClick,
      ctaDisabled = false,
      footer,
      ...props
    },
    ref
  ) => {
    const [imgError, setImgError] = React.useState(false);
    const [imgLoaded, setImgLoaded] = React.useState(false);

    const badgeColors = {
      promo: 'bg-[var(--color-error)] text-[var(--text-inverse)]',
      new: 'bg-[var(--color-primary-600)] text-[var(--text-inverse)]',
      stock: 'bg-[var(--color-success)] text-[var(--text-inverse)]',
      custom: 'bg-[var(--color-accent-600)] text-[var(--text-inverse)]',
    };

    const stockColors = {
      'in-stock': 'text-[var(--color-success)]',
      'low-stock': 'text-[var(--color-warning)]',
      'out-of-stock': 'text-[var(--color-error)]',
    };

    const stockLabels = {
      'in-stock': 'En stock',
      'low-stock': 'Stock limité',
      'out-of-stock': 'Rupture de stock',
    };

    return (
      <div
        ref={ref}
        className={cn(productCardVariants({ variant, radius, density }), className)}
        {...props}
      >
        {/* Image Container */}
        <div className={cn(productCardImageVariants({ aspectRatio: imageAspectRatio }))}>
          <img
            src={imgError ? imageFallback : image || imageFallback}
            alt={imageAlt}
            onError={() => setImgError(true)}
            onLoad={() => setImgLoaded(true)}
            className={cn(
              'h-full w-full object-cover transition-transform duration-300 group-hover:scale-105',
              !imgLoaded && 'opacity-0'
            )}
          />

          {/* Badge Overlay */}
          {badge && (
            <div
              className={cn(
                'absolute left-2 top-2 rounded px-2 py-1 text-xs font-bold uppercase tracking-wide shadow-sm',
                badgeColors[badgeVariant]
              )}
            >
              {badge}
            </div>
          )}

          {/* Loading Skeleton */}
          {!imgLoaded && (
            <div className="absolute inset-0 animate-pulse bg-[var(--bg-tertiary)]" />
          )}
        </div>

        {/* Content Container */}
        <div className="flex flex-1 flex-col">
          {/* Title & Subtitle */}
          <div className="flex-1">
            <h3 className="line-clamp-2 font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary-600)]">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 line-clamp-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
            )}
          </div>

          {/* Rating */}
          {rating !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={cn(
                      'h-4 w-4',
                      i < Math.floor(rating)
                        ? 'fill-[var(--color-warning)] text-[var(--color-warning)]'
                        : 'fill-[var(--border-secondary)] text-[var(--border-secondary)]'
                    )}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              {reviewCount !== undefined && (
                <span className="text-xs text-[var(--text-secondary)]">({reviewCount})</span>
              )}
            </div>
          )}

          {/* Price Container */}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-[var(--text-primary)]">{price}</span>
            {oldPrice && (
              <span className="text-sm text-[var(--text-secondary)] line-through">{oldPrice}</span>
            )}
          </div>

          {/* Stock Status */}
          {stock && (
            <div className={cn('mt-1 text-xs font-medium', stockColors[stock])}>
              {stockLabel || stockLabels[stock]}
            </div>
          )}

          {/* CTA Button */}
          {onCtaClick && (
            <Button
              className="mt-3 w-full"
              onClick={onCtaClick}
              disabled={ctaDisabled || stock === 'out-of-stock'}
              intent="primary"
              size="md"
            >
              {stock === 'out-of-stock' ? 'Rupture de stock' : ctaLabel}
            </Button>
          )}

          {/* Custom Footer */}
          {footer && <div className="mt-3">{footer}</div>}
        </div>
      </div>
    );
  }
);

ProductCard.displayName = 'ProductCard';

export { ProductCard, productCardVariants };
