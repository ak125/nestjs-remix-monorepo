// ✅ Migration 2026-01-21: Utiliser /img/* proxy au lieu d'URLs Supabase directes
// Avantages: Cache 1 an (Caddy), même comportement dev/prod (Vite proxy en dev)
const STORAGE_BUCKET = "uploads"; // bucket contenant les logos

export function getLogoUrl(logoFileName: string | null): string {
  if (!logoFileName) {
    return "/images/categories/default.svg"; // image de fallback
  }

  // Si c'est déjà une URL complète, la retourner telle quelle
  if (logoFileName.startsWith("http")) {
    return logoFileName;
  }

  // ✅ Utiliser le proxy /img/* au lieu d'URL Supabase directe
  return `/img/${STORAGE_BUCKET}/${logoFileName}`;
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
