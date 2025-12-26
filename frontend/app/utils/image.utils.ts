/**
 * 🖼️ HELPER CENTRALISÉ - URLs D'IMAGES FRONTEND
 *
 * Normalise et optimise les URLs d'images pour compatibilité et performance
 * Gère la migration des anciennes URLs vers Supabase Storage
 * 🚀 Utilise proxy automecanik.com pour cache Cloudflare 1 an
 *
 * @see /workspaces/nestjs-remix-monorepo/scripts/verify-supabase-images.js - Script de vérification
 * @see /.spec/docs/ARCHITECTURE-IMAGES.md - Documentation complète
 */

// 🚀 URLs Supabase directes (render API pour transformation d'images)
const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const SUPABASE_RENDER_URL = `${SUPABASE_URL}/storage/v1/render/image/public`;
const UPLOADS_BUCKET = 'uploads';
const RACK_IMAGES_BUCKET = 'rack-images';

/**
 * Normalise une URL d'image vers le proxy automecanik.com
 *
 * 🚀 Utilise le proxy /img/{bucket}/{path} pour bénéficier du cache Cloudflare
 *
 * Gère 9 formats d'URLs découverts dans la BDD :
 * 1. /rack/{folder}/{file}.JPG → /img/rack-images/{folder}/{file}.JPG
 * 2. /upload/articles/gammes-produits/... → /img/uploads/articles/...
 * 3. /upload/articles/familles-produits/... → /img/uploads/articles/...
 * 4. /upload/constructeurs-automobiles/icon/... → /img/uploads/constructeurs-automobiles/...
 * 5. /upload/constructeurs-automobiles/icon-50/... → /img/uploads/constructeurs-automobiles/...
 * 6. /upload/constructeurs-automobiles/marques-logos/... → /img/uploads/constructeurs-automobiles/...
 * 7. /upload/equipementiers-automobiles/... → /img/uploads/equipementiers-automobiles/...
 * 8. /upload/blog/conseils/... → /img/uploads/blog/...
 * 9. /upload/upload/favicon/... → /img/uploads/upload/...
 *
 * @param url - URL de l'image (format BDD relatif)
 * @returns URL normalisée via proxy automecanik.com
 *
 * @example
 * normalizeImageUrl('/rack/101/34407_1.JPG')
 * // → '/img/rack-images/101/34407_1.JPG'
 *
 * @example
 * normalizeImageUrl('/upload/articles/gammes-produits/catalogue/filtre-a-huile.webp')
 * // → '/img/uploads/articles/gammes-produits/catalogue/filtre-a-huile.webp'
 */
export function normalizeImageUrl(url: string | undefined | null): string {
  // Vérification stricte : doit être une chaîne non vide
  if (!url || typeof url !== 'string') return '';

  // Si déjà une URL Supabase complète, retourner telle quelle
  if (url.includes('supabase.co/storage')) {
    return url;
  }

  // Si URL proxy /img/, convertir vers Supabase direct
  if (url.startsWith('/img/')) {
    const path = url.replace('/img/', '');
    return `${SUPABASE_RENDER_URL}/${path}`;
  }

  // CAS 1: Images produits /rack/ → Supabase render
  if (url.startsWith('/rack/')) {
    const path = url.replace('/rack/', '');
    return `${SUPABASE_RENDER_URL}/${RACK_IMAGES_BUCKET}/${path}`;
  }

  // CAS 2 & 3: Images gammes/familles /upload/ → Supabase render
  if (url.startsWith('/upload/')) {
    const path = url.replace('/upload/', '');
    return `${SUPABASE_RENDER_URL}/${UPLOADS_BUCKET}/${path}`;
  }

  // Si URL relative sans préfixe connu, supposer uploads bucket
  if (url.startsWith('/')) {
    const path = url.substring(1);
    return `${SUPABASE_RENDER_URL}/${UPLOADS_BUCKET}/${path}`;
  }

  // Si URL externe complète, retourner telle quelle
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  return url;
}

/**
 * Optimise une URL d'image via proxy avec transformation (resize + qualité)
 *
 * 🚀 Utilise le proxy /img/{bucket}/{path}?width=...&quality=...
 * Caddy forward vers Supabase transformation API et ajoute Cache-Control: 1 an
 *
 * @param imageUrl - URL de l'image (normalisée ou non)
 * @param width - Largeur cible en pixels (optionnel)
 * @param quality - Qualité 1-100 (défaut: 85)
 * @returns URL via proxy avec paramètres de transformation
 *
 * @example
 * optimizeImageUrl('/rack/30/image.JPG', 400)
 * // → '/img/rack-images/30/image.JPG?width=400&quality=85'
 */
export function optimizeImageUrl(
  imageUrl: string | undefined | null,
  width?: number,
  quality: number = 85,
): string {
  // Normaliser d'abord l'URL (convertit vers proxy format)
  const normalized = normalizeImageUrl(imageUrl);
  if (!normalized) return '';

  // Si pas de width, retourner l'URL normalisée sans transformation
  if (!width) {
    return normalized;
  }

  // Ajouter les paramètres de transformation pour URLs Supabase
  if (normalized.includes('supabase.co/storage')) {
    // 🔴 FIX: Ne pas ajouter si params déjà présents (évite HTTP 400)
    if (normalized.includes('width=') && normalized.includes('quality=')) {
      return normalized;
    }
    const params = new URLSearchParams();
    params.set('width', width.toString());
    params.set('quality', quality.toString());
    const separator = normalized.includes('?') ? '&' : '?';
    return `${normalized}${separator}${params.toString()}`;
  }

  // URL externe, retourner telle quelle
  return normalized;
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
