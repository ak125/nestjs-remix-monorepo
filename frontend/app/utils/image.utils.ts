/**
 * 🖼️ HELPER CENTRALISÉ - URLs D'IMAGES FRONTEND
 * 
 * Normalise et optimise les URLs d'images pour compatibilité et performance
 * Gère la migration des anciennes URLs vers Supabase Storage
 * 
 * @see /workspaces/nestjs-remix-monorepo/scripts/verify-supabase-images.js - Script de vérification
 * @see /.spec/docs/ARCHITECTURE-IMAGES.md - Documentation complète
 */

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const UPLOADS_BUCKET = 'uploads';
const RACK_IMAGES_BUCKET = 'rack-images';

/**
 * Normalise une URL d'image vers Supabase Storage
 * 
 * Gère 9 formats d'URLs découverts dans la BDD :
 * 1. /rack/{folder}/{file}.JPG → rack-images bucket (produits - 136 dossiers)
 * 2. /upload/articles/gammes-produits/... → uploads bucket (catalogues)
 * 3. /upload/articles/familles-produits/... → uploads bucket (catégories)
 * 4. /upload/constructeurs-automobiles/icon/... → uploads bucket (icons marques)
 * 5. /upload/constructeurs-automobiles/icon-50/... → uploads bucket (icons 50px)
 * 6. /upload/constructeurs-automobiles/marques-logos/... → uploads bucket (logos)
 * 7. /upload/equipementiers-automobiles/... → uploads bucket (logos équipementiers)
 * 8. /upload/blog/conseils/... → uploads bucket (articles blog)
 * 9. /upload/upload/favicon/... → uploads bucket (assets/favicon)
 * 
 * @param url - URL de l'image (format BDD relatif)
 * @returns URL normalisée pointant vers Supabase Storage
 * 
 * @example
 * normalizeImageUrl('/rack/101/34407_1.JPG')
 * // → 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/rack-images/101/34407_1.JPG'
 * 
 * @example
 * normalizeImageUrl('/upload/articles/gammes-produits/catalogue/filtre-a-huile.webp')
 * // → 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/filtre-a-huile.webp'
 * 
 * @example
 * normalizeImageUrl('/upload/constructeurs-automobiles/icon/bmw.webp')
 * // → 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/icon/bmw.webp'
 */
export function normalizeImageUrl(url: string | undefined | null): string {
  // Vérification stricte : doit être une chaîne non vide
  if (!url || typeof url !== 'string') return '';
  
  // Si déjà une URL Supabase complète, retourner telle quelle
  if (url.includes('supabase.co/storage')) {
    return url;
  }
  
  // CAS 1: Images produits /rack/ → bucket rack-images
  if (url.startsWith('/rack/')) {
    const path = url.replace('/rack/', '');
    return `${SUPABASE_URL}/storage/v1/object/public/${RACK_IMAGES_BUCKET}/${path}`;
  }
  
  // CAS 2 & 3: Images gammes/familles /upload/ → bucket uploads
  if (url.startsWith('/upload/')) {
    const path = url.replace('/upload/', '');
    return `${SUPABASE_URL}/storage/v1/object/public/${UPLOADS_BUCKET}/${path}`;
  }
  
  // Si URL relative sans préfixe connu, supposer uploads bucket
  if (url.startsWith('/')) {
    // Retirer le / initial et construire l'URL
    const path = url.substring(1);
    return `${SUPABASE_URL}/storage/v1/object/public/${UPLOADS_BUCKET}/${path}`;
  }
  
  // Si URL externe complète, retourner telle quelle
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  return url;
}

/**
 * Optimise une URL d'image Supabase avec transformation WebP
 * ⚠️ Change l'URL → À utiliser avec précaution pour le SEO
 * 
 * @param imageUrl - URL de l'image (normalisée ou non)
 * @param width - Largeur cible en pixels
 * @param quality - Qualité 1-100 (défaut: 85)
 * @returns URL avec transformation Supabase
 * 
 * @example
 * optimizeImageUrl('https://.../rack-images/30/image.JPG', 400)
 * // → 'https://.../render/image/public/rack-images/30/image.JPG?format=webp&width=400&quality=85'
 */
export function optimizeImageUrl(
  imageUrl: string | undefined | null,
  width?: number,
  quality: number = 85,
): string {
  // Normaliser d'abord l'URL
  const normalized = normalizeImageUrl(imageUrl);
  if (!normalized) return '';
  
  // Ne transformer que les URLs Supabase
  if (!normalized.includes('supabase.co/storage')) {
    return normalized;
  }
  
  // Extraire le chemin après /public/
  const match = normalized.match(/\/storage\/v1\/object\/public\/(.+?)(?:\?|$)/);
  if (!match) return normalized;
  
  const path = match[1];
  
  // Construire l'URL de transformation
  let transformUrl = `${SUPABASE_URL}/storage/v1/render/image/public/${path}`;
  
  // Ajouter paramètres
  const params = new URLSearchParams();
  params.set('format', 'webp');
  params.set('quality', quality.toString());
  if (width) {
    params.set('width', width.toString());
  }
  
  return `${transformUrl}?${params.toString()}`;
}

/**
 * Génère un srcset responsive pour images
 * 
 * @param imageUrl - URL de base
 * @param widths - Largeurs à générer (défaut: [300, 400, 600])
 * @returns String srcset pour attribut HTML
 */
export function generateSrcSet(
  imageUrl: string | undefined | null,
  widths: number[] = [300, 400, 600],
): string {
  if (!imageUrl) return '';
  
  return widths
    .map(width => `${optimizeImageUrl(imageUrl, width)} ${width}w`)
    .join(', ');
}

/**
 * Génère un placeholder pour images manquantes
 */
export function getImagePlaceholder(type: 'product' | 'brand' | 'vehicle' = 'product'): string {
  const placeholders = {
    product: '/images/pieces/default.png',
    brand: '/images/default-brand.jpg',
    vehicle: '/images/default-guide.jpg',
  };
  
  return placeholders[type];
}

/**
 * Handler pour erreur de chargement d'image
 * À utiliser dans l'attribut onError des <img>
 */
export function handleImageError(type: 'product' | 'brand' | 'vehicle' = 'product') {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = getImagePlaceholder(type);
    e.currentTarget.onerror = null; // Éviter boucle infinie
  };
}

/**
 * Vérifie si une URL est valide
 */
export function isValidImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.startsWith('http') || url.startsWith('/');
}
