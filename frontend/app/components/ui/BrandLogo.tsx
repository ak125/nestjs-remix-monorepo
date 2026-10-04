import { type CSSProperties } from "react";
import { cn } from "~/lib/utils";
import { getOptimizedLogoUrl, isValidImagePath } from "~/utils/image-optimizer";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";

type BrandType = "constructeur" | "equipementier";

interface BrandLogoProps {
  logoPath: string | null;
  brandName: string;
  type?: BrandType;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
}

const sizeClasses = {
  xs: "h-5 w-5",
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

const textSizeClasses = {
  xs: "text-[8px]",
  sm: "text-[9px]",
  md: "text-[10px]",
  lg: "text-xs",
  xl: "text-sm",
};

/**
 * Logo de marque avec Avatar Shadcn UI
 * Supporte constructeurs automobiles et équipementiers
 */
export function BrandLogo({
  logoPath,
  brandName,
  type = "constructeur",
  className = "",
  size = "md",
}: BrandLogoProps) {
  // Déterminer le dossier selon le type
  const folder =
    type === "equipementier"
      ? "equipementiers-automobiles"
      : "constructeurs-automobiles/marques-logos";

  // Ne jamais inventer une cle d'objet depuis le nom commercial.
  // Un chemin complet garde sa provenance ; seul un filename utilise le dossier.
  const source = logoPath?.trim();
  const logoUrl =
    source && isValidImagePath(source)
      ? getOptimizedLogoUrl(
          source.includes("/") ? source : `${folder}/${source}`,
        )
      : undefined;

  // Calculer la taille en pixels (conservé pour référence future)
  const _pixelSize =
    typeof size === "number"
      ? size
      : {
          xs: 20,
          sm: 24,
          md: 32,
          lg: 40,
          xl: 48,
        }[size];

  // Initiales pour le fallback (2 premières lettres)
  const initials = brandName.substring(0, 2).toUpperCase();

  // Classes de taille
  const sizeClass = typeof size === "number" ? "" : sizeClasses[size];
  const textClass =
    typeof size === "number" ? "text-xs" : textSizeClasses[size];

  // Pour les tailles numériques, utiliser CSS custom properties avec Tailwind
  const customSizeStyle =
    typeof size === "number"
      ? ({ "--brand-size": `${size}px` } as CSSProperties)
      : undefined;

  return (
    <Avatar
      className={cn(
        sizeClass,
        "shrink-0",
        typeof size === "number" &&
          "w-[var(--brand-size)] h-[var(--brand-size)]",
        className,
      )}
      style={customSizeStyle}
    >
      {logoUrl && (
        <AvatarImage
          src={logoUrl}
          alt={`Logo ${brandName}`}
          className="object-contain p-0.5"
        />
      )}
      <AvatarFallback
        className={cn("bg-slate-100 text-slate-600 font-bold", textClass)}
        delayMs={logoUrl ? 100 : 0}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
