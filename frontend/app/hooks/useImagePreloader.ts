import { useState, useCallback } from "react";

interface Brand {
  marque_id: number;
  marque_name: string;
}

// Mapping pour les noms de fichiers spéciaux
const BRAND_LOGO_MAPPING: Record<string, string> = {
  'CITROËN': 'citroen',
  'LAND ROVER': 'land-rover',
  'ALFA ROMEO': 'alfa-romeo',
  'MERCEDES': 'mercedes',
  'DS': 'ds',
  'KIA': 'kia',
  'JEEP': 'jeep',
  'MINI': 'mini',
  'SEAT': 'seat',
  'SKODA': 'skoda',
};

export function getBrandLogoUrl(brandName: string): string {
  const normalizedName = BRAND_LOGO_MAPPING[brandName.toUpperCase()] || 
                         brandName.toLowerCase().replace(/\s+/g, '-');
  
  return `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${normalizedName}.webp`;
}

export const useImagePreloader = () => {
  const [imageCache] = useState(() => new Map<string, HTMLImageElement>());

  const preloadImage = useCallback((url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      // Vérifier si l'image est déjà en cache
      const cachedImage = imageCache.get(url);
      if (cachedImage) {
        resolve(cachedImage);
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        imageCache.set(url, img);
        resolve(img);
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to preload image: ${url}`));
      };
      
      img.src = url;
    });
  }, [imageCache]);

  const preloadBatch = useCallback(async (urls: string[]): Promise<void> => {
    const promises = urls.map(url => preloadImage(url).catch(() => null));
    await Promise.allSettled(promises);
  }, [preloadImage]);

  const preloadVisibleBrands = useCallback(async (brands: Brand[], limit = 20) => {
    const visibleBrands = brands.slice(0, limit);
    const urls = visibleBrands.map(brand => getBrandLogoUrl(brand.marque_name));
    await preloadBatch(urls);
  }, [preloadBatch]);

  const isImageCached = useCallback((url: string): boolean => {
    return imageCache.has(url);
  }, [imageCache]);

  const getCachedImage = useCallback((url: string): HTMLImageElement | null => {
    return imageCache.get(url) || null;
  }, [imageCache]);

  const getCacheStats = useCallback(() => {
    return {
      total: imageCache.size,
      urls: Array.from(imageCache.keys())
    };
  }, [imageCache]);

  return {
    preloadImage,
    preloadBatch,
    preloadVisibleBrands,
    isImageCached,
    getCachedImage,
    getCacheStats,
    getBrandLogoUrl
  };
};
