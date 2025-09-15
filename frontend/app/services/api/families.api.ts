// 📁 frontend/app/services/api/families.api.ts
// 🏭 Service API pour récupérer les familles de produits

export interface FamilyCategory {
  pg_id: string;
  pg_alias: string;
  pg_name: string;
  pg_name_url: string;
  pg_pic?: string;
  pg_img?: string;
  pg_display: string;
  pg_top: string;
  pg_parent: string;
  pg_level: string;
  pg_sitemap: string;
  is_featured: boolean;
  is_displayed: boolean;
  mf_description?: string; // Description de la famille
}

export interface FamiliesResponse {
  [familyId: string]: FamilyCategory[];
}

class FamiliesApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'http://localhost:3000';
  }

  /**
   * 👨‍👩‍👧‍👦 Récupère toutes les familles organisées (avec gammes seulement)
   */
  async getFamilies(): Promise<FamiliesResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/catalog/pieces-gammes/families`);
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur récupération familles:', error);
      return {};
    }
  }

  /**
   * 👨‍👩‍👧‍👦 Récupère toutes les familles du catalogue (pour homepage)
   */
  async getAllFamilies(): Promise<FamiliesResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/catalog/families/all`);
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur récupération toutes les familles:', error);
      return {};
    }
  }

  /**
   * 🏷️ Obtient le nom d'affichage pour une famille
   */
  getFamilyDisplayName(familyId: string, categories: FamilyCategory[]): string {
    // Mapping des IDs vers des noms d'affichage basé sur le HTML fourni
    const familyNames: { [key: string]: string } = {
      '7': 'Système de filtration',
      '402': 'Système de freinage',
      '10': 'Courroie, galet, poulie et chaîne',
      '243': 'Préchauffage et allumage',
      '2066': 'Direction et liaison au sol',
      '854': 'Amortisseur et suspension',
      '247': 'Support moteur',
      '479': 'Embrayage',
      '13': 'Transmission',
      '4': 'Système électrique',
      '805': 'Capteurs',
      '3927': 'Système d\'alimentation',
      '318': 'Moteur',
      '1260': 'Refroidissement',
      '2669': 'Climatisation',
      '429': 'Echappement',
      '259': 'Eclairage',
      '298': 'Accessoires',
      '2234': 'Turbo'
    };

    return familyNames[familyId] || `Famille ${familyId}`;
  }

  /**
   * 🎨 Obtient l'icône pour une famille
   */
  getFamilyIcon(familyId: string): string {
    const familyIcons: { [key: string]: string } = {
      '1': '🔍',      // Filtres
      '2': '🛑',      // Freinage
      '3': '⚙️',      // Courroie, galet, poulie et chaîne
      '4': '⚡',      // Préchauffage et allumage
      '5': '🎯',      // Direction et liaison au sol
      '6': '🌊',      // Amortisseur et suspension
      '7': '🔧',      // Support moteur
      '9': '🔄',      // Embrayage
      '10': '🔩',     // Transmission
      '11': '🔌',     // Système électrique
      '12': '📡',     // Capteurs
      '13': '⛽',     // Système d'alimentation
      '14': '🏭',     // Moteur
      '15': '❄️',     // Refroidissement
      '16': '🌡️',    // Climatisation
      '17': '💨',     // Echappement
      '18': '💡',     // Eclairage
      '19': '🔧',     // Accessoires
      '20': '🌪️'     // Turbo
    };

    return familyIcons[familyId] || '📦';
  }
}

export const familiesApi = new FamiliesApiService();