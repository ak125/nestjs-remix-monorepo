import React, { useState } from 'react';
import { getBrandLogoUrl } from '../../utils/storage';

interface BrandLogoProps {
  logoPath: string | null;
  brandName: string;
  className?: string;
  size?: number;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ 
  logoPath, 
  brandName, 
  className = "",
  size = 96 
}) => {
  const [imageError, setImageError] = useState(false);
  
  // Générer le fallback avec initiales
  const initials = brandName
    .split(' ')
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('');
    
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=${size}&background=f3f4f6&color=374151&font-size=0.33`;
  
  // Si pas de logo path ou erreur de chargement, utiliser le fallback
  if (!logoPath || imageError) {
    return (
      <img
        src={fallbackUrl}
        alt={`${brandName} logo`}
        className={className}
        style={{ width: size, height: size }}
      />
    );
  }
  
  // Essayer d'abord l'image Supabase
  const supabaseUrl = getBrandLogoUrl(logoPath);
  
  return (
    <img
      src={supabaseUrl}
      alt={`${brandName} logo`}
      className={className}
      style={{ width: size, height: size }}
      onError={() => setImageError(true)}
      onLoad={() => setImageError(false)}
    />
  );
};
