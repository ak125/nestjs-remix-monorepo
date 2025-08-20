import { useState, useEffect } from 'react';

interface BrandImageProps {
  brandLogo: string | null;
  brandName: string;
}

export function BrandImage({ brandLogo, brandName }: BrandImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // S'assurer qu'on est côté client
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const availableLogos = [
    'audi.webp', 'bmw.webp', 'mercedes.webp', 'alfa-romeo.webp', 
    'renault.webp', 'peugeot.webp', 'citroen.webp', 'volkswagen.webp', 
    'ford.webp', 'toyota.webp', 'opel.webp', 'seat.webp', 'skoda.webp', 
    'fiat.webp', 'honda.webp', 'hyundai.webp', 'kia.webp', 'mazda.webp', 
    'mitsubishi.webp', 'nissan.webp'
  ];
  
  const initials = brandName.split(' ').map(w => w.charAt(0)).join('').slice(0, 2);
  
  // SVG fallback
  const svgFallback = `data:image/svg+xml;base64,${btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" fill="#f3f4f6" rx="8"/>
      <text x="32" y="40" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold" fill="#374151">${initials}</text>
    </svg>`
  )}`;
  
  // URL Supabase
  const supabaseUrl = brandLogo && availableLogos.includes(brandLogo)
    ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${brandLogo}`
    : null;
  
  // Si on n'est pas encore côté client, afficher le fallback
  if (!isClient) {
    return (
      <img 
        src={svgFallback}
        alt={brandName}
        className="w-full h-full object-contain"
      />
    );
  }
  
  // Si erreur d'image ou pas de logo Supabase, utiliser le fallback
  if (imageError || !supabaseUrl) {
    return (
      <img 
        src={svgFallback}
        alt={brandName}
        className="w-full h-full object-contain"
      />
    );
  }
  
  // Essayer l'image Supabase avec gestion d'erreur
  return (
    <img 
      src={supabaseUrl}
      alt={brandName}
      className="w-full h-full object-contain"
      onError={() => setImageError(true)}
      onLoad={() => setImageError(false)}
    />
  );
}
