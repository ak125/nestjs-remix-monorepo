// 🏗️ Service API pour récupérer les vraies familles de catalogue
// Utilise l'endpoint /api/catalog/hierarchy/full qui fonctionne

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface CatalogGamme {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_image?: string;
}

export interface CatalogFamily {
  mf_id: number;
  mf_name: string;
  mf_description?: string;
  mf_pic?: string;
  gammes: CatalogGamme[];
}

export interface PopularPart {
  cgc_pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_meta: string;
  pg_img: string;
  addon_content: string;
}

export interface HierarchyResponse {
  hierarchy: {
    [familyId: string]: {
      family: {
        mf_id: string;
        mf_name: string;
        mf_description?: string;
        mf_pic?: string;
      };
      gammes: Array<{
        pg_id: string;
        pg_alias: string;
        pg_name: string;
        pg_image?: string;
      }>;
      stats: {
        total_gammes: number;
      };
    };
  };
  stats: {
    total_families: number;
    total_gammes: number;
  };
}

export class CatalogFamiliesApi {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * 🚗 Récupère les familles de catalogue filtrées par véhicule
   */
  async getCatalogFamiliesForVehicle(typeId: number): Promise<CatalogFamily[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/catalog/families/vehicle/${typeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new ApiError(`HTTP error! status: ${response.status}`, response.status);
      }

      const data = await response.json();
      
      if (!data.success) {
        console.warn(`⚠️ Catalogue filtré: ${data.message}`);
        return []; // Retour vide si pas de pièces compatibles
      }

      console.log(`✅ ${data.totalFamilies} familles filtrées récupérées pour type_id: ${typeId}`);
      return data.families || [];

    } catch (error) {
      console.error('❌ Erreur récupération catalogue filtré:', error);
      throw error;
    }
  }

  /**
   * 🏗️ Récupère les familles de catalogue depuis la hiérarchie (générique)
   */
  async getCatalogFamilies(): Promise<CatalogFamily[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/catalog/hierarchy/full`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new ApiError(`HTTP error! status: ${response.status}`, response.status);
      }

      const data: HierarchyResponse = await response.json();
      
      // Convertir la structure hiérarchie en array de familles
      const families: CatalogFamily[] = Object.values(data.hierarchy).map(item => ({
        mf_id: parseInt(item.family.mf_id),
        mf_name: item.family.mf_name,
        mf_description: item.family.mf_description,
        mf_pic: item.family.mf_pic,
        gammes: item.gammes.map(gamme => ({
          pg_id: parseInt(gamme.pg_id),
          pg_alias: gamme.pg_alias,
          pg_name: gamme.pg_name,
          pg_image: gamme.pg_image
        }))
      }));

      console.log(`✅ ${families.length} familles de catalogue récupérées depuis la hiérarchie`);
      return families;

    } catch (error) {
      console.error('❌ Erreur récupération familles catalogue:', error);
      throw error;
    }
  }

  /**
   * 🎯 Génère les pièces populaires basées sur les vraies données
   */
  generatePopularParts(families: CatalogFamily[], vehicleName: string, typeId: number): PopularPart[] {
    const popularParts: PopularPart[] = [];
    
    // Sélectionner les pièces les plus communes (basé sur les vrais alias de la DB)
    const commonPartNames = ['filtre-a', 'plaquette', 'disque', 'courroie', 'bougie', 'rotule'];
    
    console.log(`🔍 Recherche de pièces populaires dans ${families.length} familles...`);
    
    families.forEach(family => {
      family.gammes.forEach(gamme => {
        // Chercher les pièces communes (recherche plus flexible)
        const isCommon = commonPartNames.some(common => 
          gamme.pg_alias.toLowerCase().includes(common.toLowerCase()) ||
          gamme.pg_name.toLowerCase().includes(common.toLowerCase())
        );
        
        if (isCommon && popularParts.length < 6) { // Récupérer plus pour avoir du choix
          console.log(`✅ Pièce populaire trouvée: ${gamme.pg_name} (${gamme.pg_alias})`);
          popularParts.push({
            cgc_pg_id: gamme.pg_id,
            pg_alias: gamme.pg_alias,
            pg_name: gamme.pg_name,
            pg_name_meta: gamme.pg_name.toLowerCase(),
            pg_img: gamme.pg_image || `${gamme.pg_alias}.webp`,
            addon_content: this.generateSeoContent(gamme.pg_name, vehicleName, typeId + popularParts.length)
          });
        }
      });
    });

    console.log(`🎯 ${popularParts.length} pièces populaires générées depuis ${families.length} familles`);
    
    // Limiter à 3 pièces populaires mais assurer qu'on en a au moins quelques unes
    return popularParts.slice(0, 3);
  }

  /**
   * 🔄 Génère le contenu SEO pour une pièce
   */
  private generateSeoContent(pgName: string, vehicleName: string, typeId: number): string {
    const switches = ["Achetez", "Trouvez", "Commandez", "Choisissez"];
    const qualities = ["d'origine", "de qualité", "certifiées", "garanties"];
    const switchIndex = typeId % switches.length;
    const qualityIndex = (typeId + 1) % qualities.length;
    
    return `${switches[switchIndex]} ${pgName.toLowerCase()} ${vehicleName}, ${qualities[qualityIndex]} à prix bas.`;
  }
}

// Instance exportée
export const catalogFamiliesApi = new CatalogFamiliesApi();