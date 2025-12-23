import { Avatar, AvatarImage, AvatarFallback } from './avatar';
import { cn } from '~/lib/utils';

type BrandType = 'constructeur' | 'equipementier';

interface BrandLogoProps {
  logoPath: string | null;
  brandName: string;
  type?: BrandType;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
}

const sizeClasses = {
  xs: 'h-5 w-5',
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
};

const textSizeClasses = {
  xs: 'text-[8px]',
  sm: 'text-[9px]',
  md: 'text-[10px]',
  lg: 'text-xs',
  xl: 'text-sm',
};

// Configuration selon environnement
const IS_PRODUCTION = typeof window !== 'undefined'
  ? window.location.hostname === 'www.automecanik.com' || window.location.hostname === 'automecanik.com'
  : process.env.NODE_ENV === 'production';

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';

/**
 * Logo de marque avec Avatar Shadcn UI
 * Supporte constructeurs automobiles et équipementiers
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  logoPath,
  brandName,
  type = 'constructeur',
  className = '',
  size = 'md',
}) => {
  // Déterminer le dossier selon le type
  const folder = type === 'equipementier'
    ? 'equipementiers-automobiles'
    : 'constructeurs-automobiles/marques-logos';

  // Extraire le nom de fichier si logoPath contient un chemin complet
  const extractFilename = (path: string | null): string => {
    if (!path) return `${brandName.toLowerCase().replace(/\s+/g, '-')}.webp`;
    // Si c'est déjà une URL complète, extraire juste le basename
    const parts = path.split('/');
    return parts[parts.length - 1] || `${brandName.toLowerCase().replace(/\s+/g, '-')}.webp`;
  };

  const filename = extractFilename(logoPath);

  // Calculer la taille en pixels pour l'URL
  const pixelSize = typeof size === 'number' ? size : {
    xs: 20, sm: 24, md: 32, lg: 40, xl: 48
  }[size];

  // URL selon environnement: proxy /img/ en prod, Supabase direct en dev
  const logoUrl = IS_PRODUCTION
    ? `/img/uploads/${folder}/${filename}?width=${pixelSize * 2}&quality=90`
    : `${SUPABASE_URL}/storage/v1/render/image/public/uploads/${folder}/${filename}?width=${pixelSize * 2}&quality=90`;

  // Initiales pour le fallback (2 premières lettres)
  const initials = brandName.substring(0, 2).toUpperCase();

  // Classes de taille
  const sizeClass = typeof size === 'number' ? '' : sizeClasses[size];
  const textClass = typeof size === 'number' ? 'text-xs' : textSizeClasses[size];

  return (
    <Avatar
      className={cn(sizeClass, 'flex-shrink-0', className)}
      style={typeof size === 'number' ? { width: size, height: size } : undefined}
    >
      <AvatarImage
        src={logoUrl}
        alt={`Logo ${brandName}`}
        className="object-contain p-0.5"
      />
      <AvatarFallback
        className={cn('bg-slate-100 text-slate-600 font-bold', textClass)}
        delayMs={100}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};
