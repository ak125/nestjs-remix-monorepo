/**
 * 🛒 StickyBuyBar — Mobile bottom sticky CTA on R2 product pages.
 *
 * Conversion-critical : above-the-fold buy intent shortcut on mobile
 * where the regular CTA scrolls out of view. Hidden on lg+ (desktop has
 * sticky sidebar via PiecesVehicleContent).
 *
 * Activation : scrollY > 400px AND not at bottom (≥ footer in viewport)
 * to avoid double-CTA with footer.
 *
 * Plan ref : superpower-1-d-abord-proud-cookie.md step 6 (commerce-loop V1).
 * Reuses : PricingDisplay (existing) + lucide-react icons + shadcn Button.
 * Anti-régression : `feedback_no_url_changes_ever` — additive only, no route
 * change ; `feedback_verify_existing_first` — checked TrustBadge / PricingDisplay
 * / FrictionReducer already exist and are used directly.
 */
import { ShoppingCart, Phone } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { PricingDisplay } from "~/components/trust/PricingDisplay";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface StickyBuyBarProps {
  minPrice: number;
  productCount?: number;
  primaryHref?: string;
  primaryLabel?: string;
  phoneNumber?: string;
  /** Pixel scroll threshold before the bar appears. Default 400. */
  showAfterScrollPx?: number;
  className?: string;
}

export const StickyBuyBar = memo(function StickyBuyBar({
  minPrice,
  productCount,
  primaryHref = "#products",
  primaryLabel = "Voir les produits",
  phoneNumber,
  showAfterScrollPx = 400,
  className,
}: StickyBuyBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY > showAfterScrollPx;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 200;
      setVisible(scrolled && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [showAfterScrollPx]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-t bg-background/95 backdrop-blur",
        "px-3 py-2 shadow-[0_-2px_10px_-3px_rgba(0,0,0,0.08)]",
        "animate-in slide-in-from-bottom-2 duration-200",
        className,
      )}
      role="region"
      aria-label="Acheter maintenant"
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            À partir de
            {typeof productCount === "number" && productCount > 0
              ? ` (${productCount} réf.)`
              : ""}
          </span>
          <PricingDisplay price={minPrice} size="sm" showTax={false} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {phoneNumber ? (
            <a
              href={`tel:${phoneNumber.replace(/\s+/g, "")}`}
              aria-label="Appeler le service client"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center",
                "rounded-md border bg-background text-foreground",
                "hover:bg-accent transition-colors",
              )}
            >
              <Phone className="h-4 w-4" />
            </a>
          ) : null}
          <Button asChild size="sm" className="h-10 px-4">
            <a href={primaryHref}>
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              {primaryLabel}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
});
