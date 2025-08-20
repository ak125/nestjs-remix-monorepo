/**
 * Utilitaires pour gérer les liens vers les ressources stockées sur Supabase Storage
 */

export const getBrandLogoUrl = (logoFilename: string): string => {
  if (!logoFilename) return '';
  
  const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
  const bucketName = 'uploads';
  const logoPath = 'constructeurs-automobiles/marques-logos';
  
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${logoPath}/${logoFilename}`;
};

/**
 * Génère une URL de fallback pour les logos manquants
 */
export function getBrandLogoFallback(brandName: string): string {
  // Générer une image placeholder avec les initiales de la marque
  const initials = brandName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
    
  // Utiliser un service de génération d'avatars ou d'images placeholder
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=64&background=e5e7eb&color=374151&format=svg`;
}

/**
 * Génère l'URL du logo avec fallback automatique
 */
export const getBrandLogoWithFallback = (logoPath: string | null, brandName: string): string => {
  // Toujours commencer par le fallback pour garantir qu'une image s'affiche
  const initials = brandName
    .split(' ')
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('');
    
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=96&background=f3f4f6&color=374151&font-size=0.33`;
};

export const getBrandLogoUrlWithFallback = (logoPath: string | null, brandName: string): { primary: string, fallback: string } => {
  // Générer le fallback
  const initials = brandName
    .split(' ')
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('');
    
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=96&background=f3f4f6&color=374151&font-size=0.33`;
  
  // Si on a un logo path, retourner l'URL Supabase comme primary
  if (logoPath) {
    const primary = getBrandLogoUrl(logoPath);
    return { primary, fallback };
  }
  
  return { primary: fallback, fallback };
};
