const SUPABASE_URL = "https://cxpojprgwgubzjyqzmoq.supabase.co";
const STORAGE_BUCKET = "uploads"; // bucket contenant les logos

export function getLogoUrl(logoFileName: string | null): string {
  if (!logoFileName) {
    return "/images/categories/default.svg"; // image de fallback
  }

  // Si c'est déjà une URL complète, la retourner telle quelle
  if (logoFileName.startsWith("http")) {
    return logoFileName;
  }

  // Construire l'URL Supabase Storage
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${logoFileName}`;
}

// Fonction pour créer un avatar avec les initiales si l'image échoue
export function createInitialsAvatar(brandName: string): string {
  const initials = brandName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  // URL vers un service de génération d'avatar avec initiales
  return `https://ui-avatars.com/api/?name=${initials}&size=48&background=f1f5f9&color=475569&font-size=0.6`;
}
