/**
 * Types pour le système de navigation dynamique
 * Compatible avec le backend NavigationService optimisé
 */

export interface MenuItem {
  id: number;
  title: string;
  name?: string; // Alias pour title (compatibilité)
  url?: string;
  path?: string; // Alias pour url (compatibilité)
  icon?: string;
  children?: MenuItem[];
  badge?: {
    text: string;
    color: string;
  } | string; // Support string simple
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
}

export interface MenuSection {
  name: string;
  path: string;
  icon: string;
  description: string;
  children: MenuItem[];
}

export interface NavigationResponse {
  success: boolean;
  data: {
    type: string;
    title: string;
    sections: MenuSection[];
    timestamp: string;
  };
}

export interface UserPreferences {
  collapsed_items: number[];
  favorite_items?: number[];
  custom_order?: number[];
}

export interface NavigationModule {
  module: 'commercial' | 'expedition' | 'seo';
  title: string;
  icon: string;
  description: string;
}
