/**
 * 🖼️ HELPER IMAGES - APPROCHE SIMPLE
 *
 * Principe : URLs Supabase directes + CSS Tailwind pour l'affichage
 * Pas de transformation serveur - le navigateur gère le redimensionnement
 */

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const SUPABASE_STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public`;

/**
 * Normalise une URL d'image vers Supabase Storage
 *
 * Convertit les URLs relatives de la BDD vers des URLs Supabase complètes
 *
 * @example
 * normalizeImageUrl('/rack/101/image.JPG')
 * // → 'https://...supabase.co/storage/v1/object/public/rack-images/101/image.JPG'
 */
export function normalizeImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';

  // Si déjà une URL complète (http/https), retourner telle quelle
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // /rack/... → rack-images bucket
  if (url.startsWith('/rack/')) {
    const path = url.replace('/rack/', '');
    return `${SUPABASE_STORAGE_URL}/rack-images/${path}`;
  }

  // /upload/... → uploads bucket
  if (url.startsWith('/upload/')) {
    const path = url.replace('/upload/', '');
    return `${SUPABASE_STORAGE_URL}/uploads/${path}`;
  }

  // /img/... → déjà formaté pour proxy, extraire le path
  if (url.startsWith('/img/')) {
    const path = url.replace('/img/', '');
    return `${SUPABASE_STORAGE_URL}/${path}`;
  }

  // Autre URL relative → uploads bucket par défaut
  if (url.startsWith('/')) {
    const path = url.substring(1);
    return `${SUPABASE_STORAGE_URL}/uploads/${path}`;
  }

  return url;
}

/**
 * Alias pour compatibilité - retourne simplement l'URL normalisée
 * L'affichage est géré par CSS (object-contain/object-cover)
 */
export function optimizeImageUrl(
  imageUrl: string | undefined | null,
  _width?: number,
  _quality?: number,
): string {
  return normalizeImageUrl(imageUrl);
}

/**
 * Génère un srcset (pour compatibilité, retourne juste l'URL)
 */
export function generateSrcSet(imageUrl: string | undefined | null): string {
  const url = normalizeImageUrl(imageUrl);
  return url ? `${url} 1x` : '';
}

/**
 * Placeholder pour images manquantes
 */
export function getImagePlaceholder(
  type: 'product' | 'brand' | 'vehicle' = 'product',
): string {
  const placeholders = {
    product: '/images/pieces/default.png',
    brand: '/images/default-brand.jpg',
    vehicle: '/images/default-guide.jpg',
  };
  return placeholders[type];
}

/**
 * Handler pour erreur de chargement d'image
 */
export function handleImageError(
  type: 'product' | 'brand' | 'vehicle' = 'product',
) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = getImagePlaceholder(type);
    e.currentTarget.onerror = null;
  };
}

/**
 * Vérifie si une URL est valide
 */
export function isValidImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.startsWith('http') || url.startsWith('/');
}
