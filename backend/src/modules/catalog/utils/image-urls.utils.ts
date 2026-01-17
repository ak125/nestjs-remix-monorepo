/**
 * 🖼️ HELPER CENTRALISÉ - URLs D'IMAGES PRODUITS
 *
 * Gère la construction des URLs d'images vers Supabase Storage
 * Compatible avec les anciennes structures de données (pmi_folder, pmi_name)
 */

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const RACK_IMAGES_BUCKET = 'rack-images';
const DEFAULT_IMAGE = '/images/pieces/default.png';

/**
 * Interface pour les données d'image depuis la BDD
 */
export interface PieceImageData {
  pmi_folder?: string | number;
  pmi_name?: string;
}

/**
 * Construit l'URL complète d'une image de pièce automobile (image brute)
 * ⚠️ PAS de transformation (désactivé pour éviter coûts $5/1000 images)
 *
 * @param imageData - Données image (pmi_folder, pmi_name)
 * @returns URL complète Supabase sans transformation
 *
 * @example
 * buildRackImageUrl({ pmi_folder: 30, pmi_name: '0986479103DRFRWHCO00MM.JPG' })
 * // → 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/rack-images/30/0986479103DRFRWHCO00MM.JPG'
 */
export function buildRackImageUrl(imageData?: PieceImageData | null): string {
  // Si pas de données d'image, retourner l'image par défaut
  if (!imageData || !imageData.pmi_folder || !imageData.pmi_name) {
    return DEFAULT_IMAGE;
  }

  // Construire l'URL Supabase Storage SANS transformation
  // Note: pmi_name contient déjà l'extension (.JPG, .webp, etc.)
  const folder = imageData.pmi_folder.toString();
  const filename = imageData.pmi_name;

  // ⚠️ Utiliser /object/public/ (image brute, pas de transformation, $0)
  return `${SUPABASE_URL}/storage/v1/object/public/${RACK_IMAGES_BUCKET}/${folder}/${filename}`;
}

/**
 * Construit l'URL avec transformation WebP via Supabase Image Transform
 * ⚠️ À utiliser avec précaution : peut impacter le SEO (change l'URL)
 *
 * @param imageData - Données image (pmi_folder, pmi_name)
 * @returns URL avec transformation WebP
 */
export function buildRackImageUrlWithTransform(
  imageData?: PieceImageData | null,
): string {
  // Si pas de données, retourner défaut
  if (!imageData || !imageData.pmi_folder || !imageData.pmi_name) {
    return DEFAULT_IMAGE;
  }

  const folder = imageData.pmi_folder.toString();
  const filename = imageData.pmi_name;

  // Utiliser /object/public/ (image brute, pas de transformation)
  return `${SUPABASE_URL}/storage/v1/object/public/${RACK_IMAGES_BUCKET}/${folder}/${filename}`;
}

/**
 * Construit les métadonnées alt/title pour l'image
 *
 * @param pieceName - Nom de la pièce
 * @param brandName - Nom de la marque équipementier
 * @param reference - Référence de la pièce
 * @returns Object avec alt et title
 */
export function buildImageMetadata(
  pieceName: string,
  brandName?: string,
  reference?: string,
): { alt: string; title: string } {
  const parts = [pieceName, brandName, reference].filter(Boolean);
  const alt = parts.join(' ');
  const title = [pieceName, reference].filter(Boolean).join(' ');

  return { alt, title };
}

/**
 * Vérifie si une URL est déjà une URL Supabase complète
 * Utile pour éviter de reconstruire une URL déjà construite
 */
export function isSupabaseUrl(url: string): boolean {
  return url.includes('supabase.co/storage');
}

/**
 * Extrait le nom du bucket et le chemin depuis une URL Supabase
 */
export function parseSupabaseUrl(url: string): {
  bucket: string;
  path: string;
} | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
  if (!match) return null;

  return {
    bucket: match[1],
    path: match[2],
  };
}
