import { type CSSProperties } from "react";
import { cn } from "~/lib/utils";
import { getOptimizedLogoUrl } from "~/utils/image-optimizer";
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

  // Extraire le nom de fichier si logoPath contient un chemin complet
  const extractFilename = (path: string | null): string => {
    if (!path) return `${brandName.toLowerCase().replace(/\s+/g, "-")}.webp`;
    // Si c'est déjà une URL complète, extraire juste le basename
    const parts = path.split("/");
    return (
      parts[parts.length - 1] ||
      `${brandName.toLowerCase().replace(/\s+/g, "-")}.webp`
    );
  };

  const filename = extractFilename(logoPath);

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

  // URL via imgproxy (WebP optimisé)
  const logoUrl = getOptimizedLogoUrl(`${folder}/${filename}`);

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
        "flex-shrink-0",
        typeof size === "number" &&
          "w-[var(--brand-size)] h-[var(--brand-size)]",
        className,
      )}
      style={customSizeStyle}
    >
      <AvatarImage
        src={logoUrl}
        alt={`Logo ${brandName}`}
        className="object-contain p-0.5"
      />
      <AvatarFallback
        className={cn("bg-slate-100 text-slate-600 font-bold", textClass)}
        delayMs={100}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
