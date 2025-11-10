// 📁 backend/src/modules/catalog/types/gamme.types.ts
// 🎯 Types unifiés pour les gammes de produits

export interface Gamme {
  // Identifiants
  id: string; // pg_id ou gamme_id unifié
  alias?: string; // URL-friendly name

  // Affichage
  name: string; // Nom d'affichage
  description?: string; // Description
  image?: string; // Image de la gamme

  // Métadonnées
  is_active: boolean; // Actif/inactif
  is_featured: boolean; // Mis en avant
  is_displayed: boolean; // Affiché sur le site

  // Hiérarchie
  family_id?: string; // ID de la famille parent
  level: number; // Niveau hiérarchique
  sort_order: number; // Ordre de tri

  // Statistiques
  products_count?: number; // Nombre de produits
}

export interface GammeWithFamily extends Gamme {
  family: {
    id: string;
    name: string;
    system_name: string;
    description?: string;
    image?: string;
  };
}

export interface FamilyWithGammes {
  // Informations famille
  id: string;
  name: string;
  system_name: string;
  description?: string;
  image?: string;
  sort_order: number; // Ordre de tri de la famille

  // Gammes associées
  gammes: Gamme[];

  // Statistiques
  stats: {
    total_gammes: number;
    manufacturers_count: number;
  };
}

export interface GammeHierarchyResponse {
  families: FamilyWithGammes[];
  stats: {
    total_families: number;
    total_gammes: number;
    total_manufacturers: number;
  };
}
