/**
 * 🎨 Service de gestion des couleurs des constructeurs automobiles
 * 
 * Ce service centralise la logique de récupération des couleurs officielles
 * des marques automobiles depuis les design tokens.
 * 
 * @module BrandColorsService
 */

/**
 * Interface pour les données de gradient d'une marque
 */
interface BrandGradient {
  from: string;
  via: string;
  to: string;
}

/**
 * Interface pour les couleurs d'une marque
 */
interface BrandColors {
  primary: string;
  gradient: BrandGradient;
}

/**
 * Couleurs officielles des constructeurs automobiles
 * Source: design-tokens/brand-colors.json
 */
const BRAND_COLORS_DATA = {
  brands: {
    // A-C
    "alfa-romeo": { primary: "#931E1D", gradient: { from: "#931E1D", via: "#2A7B3F", to: "#012B5B" } },
    audi: { primary: "#F50538", gradient: { from: "#000000", via: "#F50538", to: "#8A8D8F" } },
    bmw: { primary: "#0066B1", gradient: { from: "#00334E", via: "#0066B1", to: "#0088CC" } },
    chevrolet: { primary: "#F9D400", gradient: { from: "#00285E", via: "#0056B3", to: "#F9D400" } },
    chrysler: { primary: "#0F4D92", gradient: { from: "#0F4D92", via: "#1E6BB8", to: "#55575A" } },
    citroen: { primary: "#C3002F", gradient: { from: "#000000", via: "#8B0020", to: "#C3002F" } },
    
    // D-H
    dacia: { primary: "#004E9F", gradient: { from: "#003B7A", via: "#004E9F", to: "#A7A9AC" } },
    daewoo: { primary: "#004B84", gradient: { from: "#003366", via: "#004B84", to: "#0066AA" } },
    ds: { primary: "#000000", gradient: { from: "#000000", via: "#4D4D4D", to: "#9D9FA2" } },
    fiat: { primary: "#B11116", gradient: { from: "#8B0D10", via: "#B11116", to: "#C0C0C0" } },
    ford: { primary: "#003399", gradient: { from: "#002266", via: "#003399", to: "#0044CC" } },
    honda: { primary: "#E40521", gradient: { from: "#B30419", via: "#E40521", to: "#FF0626" } },
    hyundai: { primary: "#002C5F", gradient: { from: "#001A3A", via: "#002C5F", to: "#004080" } },
    
    // I-N
    iveco: { primary: "#003399", gradient: { from: "#002266", via: "#003399", to: "#0044CC" } },
    jeep: { primary: "#3A3A35", gradient: { from: "#2A2A25", via: "#3A3A35", to: "#556B2F" } },
    kia: { primary: "#C4172C", gradient: { from: "#9B1223", via: "#C4172C", to: "#E01E38" } },
    lada: { primary: "#0055A4", gradient: { from: "#003D78", via: "#0055A4", to: "#0077D1" } },
    lancia: { primary: "#003A70", gradient: { from: "#002952", via: "#003A70", to: "#BEBEBE" } },
    "land-rover": { primary: "#003A1C", gradient: { from: "#002814", via: "#003A1C", to: "#005A2B" } },
    mazda: { primary: "#B11116", gradient: { from: "#8B0D10", via: "#B11116", to: "#D11419" } },
    mercedes: { primary: "#000000", gradient: { from: "#000000", via: "#4D4D4D", to: "#C0C0C0" } },
    "mercedes-benz": { primary: "#000000", gradient: { from: "#000000", via: "#4D4D4D", to: "#C0C0C0" } },
    mini: { primary: "#000000", gradient: { from: "#000000", via: "#333333", to: "#666666" } },
    mitsubishi: { primary: "#E60012", gradient: { from: "#B3000E", via: "#E60012", to: "#FF1A26" } },
    nissan: { primary: "#C3002F", gradient: { from: "#9B0025", via: "#C3002F", to: "#A6A6A6" } },
    
    // O-S
    opel: { primary: "#FFCD00", gradient: { from: "#000000", via: "#CCA300", to: "#FFCD00" } },
    peugeot: { primary: "#002454", gradient: { from: "#001936", via: "#002454", to: "#003876" } },
    porsche: { primary: "#DDBB00", gradient: { from: "#CC0000", via: "#DDBB00", to: "#F5D633" } },
    renault: { primary: "#FFD200", gradient: { from: "#000000", via: "#CCA800", to: "#FFD200" } },
    saab: { primary: "#003399", gradient: { from: "#002266", via: "#003399", to: "#C40C0C" } },
    seat: { primary: "#CC0000", gradient: { from: "#000000", via: "#990000", to: "#CC0000" } },
    skoda: { primary: "#00A651", gradient: { from: "#008040", via: "#00A651", to: "#33CC77" } },
    smart: { primary: "#FFCC00", gradient: { from: "#A6A6A6", via: "#CCA300", to: "#FFCC00" } },
    suzuki: { primary: "#0D4BA0", gradient: { from: "#0A3A7F", via: "#0D4BA0", to: "#E30613" } },
    
    // T-V
    toyota: { primary: "#EB0A1E", gradient: { from: "#B30818", via: "#EB0A1E", to: "#58595B" } },
    volkswagen: { primary: "#001E50", gradient: { from: "#00152E", via: "#001E50", to: "#00A0E4" } },
    volvo: { primary: "#003057", gradient: { from: "#00203A", via: "#003057", to: "#8A8D8F" } },
    
    // Marques premium (ajout)
    ferrari: { primary: "#DC0300", gradient: { from: "#A30200", via: "#DC0300", to: "#FF1A1A" } },
    lamborghini: { primary: "#DDBB00", gradient: { from: "#B39700", via: "#DDBB00", to: "#F5D633" } },
    maserati: { primary: "#003A70", gradient: { from: "#002952", via: "#003A70", to: "#0055A8" } },
    tesla: { primary: "#E40521", gradient: { from: "#B30419", via: "#E40521", to: "#FF0626" } },
    lexus: { primary: "#000000", gradient: { from: "#000000", via: "#333333", to: "#58595B" } },
    infiniti: { primary: "#000000", gradient: { from: "#000000", via: "#333333", to: "#666666" } },
    cadillac: { primary: "#000000", gradient: { from: "#000000", via: "#333333", to: "#8A8D8F" } },
    "rolls-royce": { primary: "#680021", gradient: { from: "#4A0018", via: "#680021", to: "#9B003A" } },
    bentley: { primary: "#003A1C", gradient: { from: "#002814", via: "#003A1C", to: "#005A2B" } },
    "aston-martin": { primary: "#003A1C", gradient: { from: "#002814", via: "#003A1C", to: "#005A2B" } },
    jaguar: { primary: "#003A1C", gradient: { from: "#002814", via: "#003A1C", to: "#005A2B" } },
    "range-rover": { primary: "#003A1C", gradient: { from: "#002814", via: "#003A1C", to: "#005A2B" } },
    dodge: { primary: "#E40521", gradient: { from: "#B30419", via: "#E40521", to: "#FF0626" } },
    gmc: { primary: "#C4172C", gradient: { from: "#9B1223", via: "#C4172C", to: "#E01E38" } },
    subaru: { primary: "#0055A4", gradient: { from: "#003D78", via: "#0055A4", to: "#0077D1" } },
    cupra: { primary: "#CC0000", gradient: { from: "#993300", via: "#CC6633", to: "#996633" } },
  },
  fallback: { primary: "#546E7A", gradient: { from: "#37474F", via: "#546E7A", to: "#78909C" } }
};

/**
 * Service de gestion des couleurs des constructeurs automobiles
 */
class BrandColorsService {
  private brands: Record<string, BrandColors>;
  private fallback: BrandColors;

  constructor() {
    this.brands = BRAND_COLORS_DATA.brands as Record<string, BrandColors>;
    this.fallback = BRAND_COLORS_DATA.fallback as BrandColors;
  }

  /**
   * Récupère le gradient CSS inline d'une marque
   * 
   * @param alias - L'alias de la marque (ex: 'bmw', 'mercedes', 'renault')
   * @returns Objet style CSS avec backgroundImage
   * 
   * @example
   * ```typescript
   * brandColorsService.getBrandGradient('bmw')
   * // Retourne: { backgroundImage: 'linear-gradient(to bottom right, #1C69D4, #0066B1, #005A9C)' }
   * ```
   */
  getBrandGradient(alias: string): { backgroundImage: string } {
    const normalizedAlias = alias?.toLowerCase() || '';
    const brand = this.brands[normalizedAlias];

    if (!brand) {
      return this.getFallbackGradient();
    }

    const { from, via, to } = brand.gradient;
    return {
      backgroundImage: `linear-gradient(to bottom right, ${from}, ${via}, ${to})`
    };
  }

  /**
   * Récupère la couleur primaire d'une marque
   * 
   * @param alias - L'alias de la marque
   * @returns Code couleur hexadécimal (ex: '#1C69D4')
   */
  getBrandPrimaryColor(alias: string): string {
    const normalizedAlias = alias?.toLowerCase() || '';
    const brand = this.brands[normalizedAlias];

    return brand?.primary || this.fallback.primary;
  }

  /**
   * Vérifie si une marque possède des couleurs définies
   * 
   * @param alias - L'alias de la marque
   * @returns true si la marque a des couleurs définies, false sinon
   */
  hasBrandColors(alias: string): boolean {
    const normalizedAlias = alias?.toLowerCase() || '';
    return normalizedAlias in this.brands;
  }

  /**
   * Récupère le gradient de fallback pour les marques inconnues
   * 
   * @returns Objet style CSS avec backgroundImage
   */
  private getFallbackGradient(): { backgroundImage: string } {
    const { from, via, to } = this.fallback.gradient;
    return {
      backgroundImage: `linear-gradient(to bottom right, ${from}, ${via}, ${to})`
    };
  }

  /**
   * Récupère la liste de tous les alias de marques disponibles
   * 
   * @returns Tableau des alias de marques
   */
  getAvailableBrands(): string[] {
    return Object.keys(this.brands);
  }

  /**
   * Récupère toutes les informations de couleur d'une marque
   * 
   * @param alias - L'alias de la marque
   * @returns Objet complet avec primary et gradient, ou null si non trouvé
   */
  getBrandColors(alias: string): BrandColors | null {
    const normalizedAlias = alias?.toLowerCase() || '';
    return this.brands[normalizedAlias] || null;
  }
}

// Export singleton
export const brandColorsService = new BrandColorsService();
export default brandColorsService;
