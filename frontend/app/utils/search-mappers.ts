/**
 * 🔄 Mappers pour convertir les données API search vers PieceData
 * Permet d'utiliser PiecesGridView et usePiecesFilters sur la page search
 */

import type { PieceData } from '../types/pieces-route.types';

/**
 * Interface pour les items retournés par l'API search
 */
export interface SearchResultItem {
  id: number | string;
  piece_id?: number;
  title?: string;
  name?: string;
  description?: string;
  reference?: string;
  brand?: string;
  brandId?: number;
  brandAlias?: string; // 🔧 Alias marque pour logo
  category?: string;
  categoryId?: number;
  categoryAlias?: string;
  qualite?: string;
  quality?: string;
  stars?: number;
  nb_stars?: number;
  PM_NB_STARS?: number;
  price?: number;
  prix_ttc?: number;
  prix_unitaire?: number;
  prices?: {
    vente_ttc?: number;
    consigne_ttc?: number;
    total_ttc?: number;
    formatted?: string;
  };
  image?: string;
  images?: string[];
  hasImage?: boolean; // 🖼️ Flag si image réelle
  inStock?: boolean;
  dispo?: boolean;
  stock?: string;
  side?: string;
  filtre_side?: string;
  PIECE_NAME_SIDE?: string;
  marque_id?: number;
  marque_logo?: string;
  PM_LOGO?: string;
  PM_ALIAS?: string;
  _score?: number;
  _relevance?: number;
  _qualityLevel?: number;
  oemRef?: string;
  _prsKind?: number; // 0=direct, 1=OEM équip, 2=OEM constr, 3-4=équivalences
  matchKind?: number; // Alias pour _prsKind
}

/**
 * Interface pour les facettes retournées par l'API search
 */
export interface SearchFacet {
  field: string;
  label: string;
  values: SearchFacetValue[];
}

export interface SearchFacetValue {
  value: string;
  label: string;
  count: number;
  logo?: string;
  note?: number;
}

/**
 * Interface pour les résultats groupés par gamme
 */
export interface GroupedSearchResults {
  gammeId: number;
  gammeName: string;
  gammeAlias: string;
  items: PieceData[];
  count: number;
}

/**
 * Convertit un item API search vers PieceData
 * Compatible avec PiecesGridView et usePiecesFilters
 */
export function mapSearchItemToPieceData(item: SearchResultItem): PieceData {
  // Extraction du prix
  const price = item.price 
    || item.prix_ttc 
    || item.prix_unitaire 
    || item.prices?.vente_ttc 
    || item.prices?.total_ttc 
    || 0;
  
  // Extraction des étoiles (nb_stars en base = 1-6, on convertit si besoin)
  const stars = item.stars 
    || item.nb_stars 
    || item.PM_NB_STARS 
    || (item._qualityLevel ? (6 - item._qualityLevel) : 3);
  
  // Extraction qualité
  const quality = item.qualite 
    || item.quality 
    || (item._qualityLevel === 1 ? 'OES' : 'AFTERMARKET');
  
  // Construction du logo marque équipementier
  const brandAlias = item.brandAlias || item.PM_ALIAS || (item.brand || '').toLowerCase().replace(/\s+/g, '-').replace(/ö/g, 'o').replace(/ü/g, 'u');
  const marque_logo = item.marque_logo 
    || item.PM_LOGO 
    || `${brandAlias}.webp`;
  
  // Extraction side/position
  const side = item.side 
    || item.filtre_side 
    || item.PIECE_NAME_SIDE 
    || undefined;
  
  // Extraction stock
  let stock = 'En stock';
  if (item.stock) {
    stock = item.stock;
  } else if (item.inStock === false || item.dispo === false) {
    stock = 'Sur commande';
  }
  
  return {
    id: typeof item.id === 'string' ? parseInt(item.id) : (item.piece_id || item.id),
    name: item.name || item.title || item.reference || 'Pièce auto',
    price,
    priceFormatted: price.toFixed(2).replace('.', ',') + ' €',
    brand: item.brand || 'Marque inconnue',
    stock,
    reference: item.reference || '',
    oemRef: item.oemRef || undefined,
    matchKind: item._prsKind ?? item.matchKind ?? undefined, // Prioriser kind 2-3 (OEM constructeur)
    quality,
    stars,
    side,
    description: item.description || '',
    image: item.image || '',
    images: item.images || [],
    marque_id: item.marque_id || item.brandId,
    marque_logo,
  };
}

/**
 * Convertit un tableau d'items API search vers PieceData[]
 */
export function mapSearchResultsToPieces(items: SearchResultItem[]): PieceData[] {
  return items.map(mapSearchItemToPieceData);
}

/**
 * Groupe les résultats de recherche par gamme (catégorie)
 * Retourne des groupes avec titre H2 comme sur la page pièces
 * 
 * ⚠️ Groupement par NOM de gamme (pas par ID) pour éviter les doublons H2
 * Ex: "Plaquettes de frein" avec categoryId 0 et 123 = même groupe
 * 
 * 🎯 OPTION A: Si searchQuery fourni, les groupes contenant un match exact
 * de référence sont prioritaires (ex: "49650" → FEBI 49650 en premier)
 */
export function groupSearchResultsByGamme(
  items: SearchResultItem[], 
  searchQuery?: string
): GroupedSearchResults[] {
  // 🎯 Grouper par NOM normalisé (lowercase) pour éviter doublons
  const groupMap = new Map<string, GroupedSearchResults>();
  
  // Normaliser la query pour comparaison (case-insensitive, trim)
  const normalizedQuery = searchQuery?.trim().toUpperCase() || '';
  
  items.forEach(item => {
    const gammeName = item.category || 'Autres pièces';
    const gammeKey = gammeName.toLowerCase().trim(); // Clé normalisée
    const gammeId = item.categoryId || 0;
    const gammeAlias = item.categoryAlias || gammeName.toLowerCase().replace(/\s+/g, '-');
    
    if (!groupMap.has(gammeKey)) {
      groupMap.set(gammeKey, {
        gammeId, // Premier ID trouvé (peut varier)
        gammeName,
        gammeAlias,
        items: [],
        count: 0,
      });
    }
    
    const group = groupMap.get(gammeKey)!;
    group.items.push(mapSearchItemToPieceData(item));
    group.count++;
  });
  
  // Convertir en tableau pour tri
  const groups = Array.from(groupMap.values());
  
  // 🎯 NOUVEAU: Si la query est un match exact d'une référence OU d'une référence OEM,
  // prioriser les groupes avec matchKind = 2-3 (OEM constructeur comme PSA 1109.91)
  // Normaliser en enlevant espaces/tirets/points pour matcher les variantes
  const normalizedQueryClean = normalizedQuery.replace(/[\s\-\.]/g, '');
  
  // Fonction helper pour vérifier si une pièce matche la query
  const itemMatchesQuery = (item: PieceData) => {
    const refUpper = item.reference?.toUpperCase() || '';
    const refClean = refUpper.replace(/[\s\-\.]/g, '');
    const oemUpper = item.oemRef?.toUpperCase() || '';
    const oemClean = oemUpper.replace(/[\s\-\.]/g, '');
    
    // Match sur référence équipementier (exact ou normalisé)
    if (refUpper === normalizedQuery || refClean === normalizedQueryClean) return true;
    
    // Match sur oemRef (exact ou normalisé)
    if (oemUpper === normalizedQuery || oemClean === normalizedQueryClean) return true;
    
    return false;
  };
  
  // 🎯 NOUVEAU: Vérifier si un item a un matchKind OEM constructeur (2 ou 3)
  const itemHasOemConstructeurKind = (item: PieceData) => {
    return item.matchKind === 2 || item.matchKind === 3;
  };
  
  if (normalizedQuery) {
    // Chercher les groupes avec au moins un match exact de référence OU oemRef
    const groupsWithExactMatch = groups.filter(group =>
      group.items.some(itemMatchesQuery)
    );
    
    if (groupsWithExactMatch.length > 1) {
      // 🎯 NOUVEAU: Prioriser les groupes ayant des matchs avec kind=2-3 (OEM constructeur)
      // D'abord, identifier les groupes avec au moins un match kind=2-3
      const groupsWithOemMatch = groupsWithExactMatch.filter(group =>
        group.items.some(item => itemMatchesQuery(item) && itemHasOemConstructeurKind(item))
      );
      
      // Si on a des groupes avec kind=2-3, les prioriser
      const priorityGroups = groupsWithOemMatch.length > 0 ? groupsWithOemMatch : groupsWithExactMatch;
      
      // Compter les matchs OEM par groupe (pour départager)
      const groupsWithMatchCount = priorityGroups.map(group => {
        const oemMatchCount = group.items.filter(item => 
          itemMatchesQuery(item) && itemHasOemConstructeurKind(item)
        ).length;
        const totalMatchCount = group.items.filter(itemMatchesQuery).length;
        return {
          group,
          oemMatchCount,
          totalMatchCount,
          // Score: prioriser kind=2-3, sinon utiliser le total
          score: oemMatchCount > 0 ? oemMatchCount * 100 : totalMatchCount
        };
      });
      
      // Trouver le max de score
      const maxScore = Math.max(...groupsWithMatchCount.map(g => g.score));
      
      // Ne garder que les groupes avec un score suffisant (50% du max)
      const threshold = maxScore * 0.5;
      const topGroups = groupsWithMatchCount
        .filter(g => g.score >= threshold)
        .map(g => g.group);
      
      // Trier les items dans chaque groupe: matchs kind=2-3 en premier, puis matchs exacts
      topGroups.forEach(group => {
        group.items.sort((a, b) => {
          const aExact = itemMatchesQuery(a);
          const bExact = itemMatchesQuery(b);
          const aOem = aExact && itemHasOemConstructeurKind(a);
          const bOem = bExact && itemHasOemConstructeurKind(b);
          
          // Prioriser OEM kind=2-3
          if (aOem && !bOem) return -1;
          if (!aOem && bOem) return 1;
          // Puis match exact
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return 0;
        });
      });
      
      return topGroups.sort((a, b) => b.count - a.count);
    }
    
    // Si un seul groupe avec match exact
    if (groupsWithExactMatch.length > 0) {
      // Trier les items: matchs OEM kind=2-3 en premier
      groupsWithExactMatch.forEach(group => {
        group.items.sort((a, b) => {
          const aExact = itemMatchesQuery(a);
          const bExact = itemMatchesQuery(b);
          const aOem = aExact && itemHasOemConstructeurKind(a);
          const bOem = bExact && itemHasOemConstructeurKind(b);
          
          if (aOem && !bOem) return -1;
          if (!aOem && bOem) return 1;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return 0;
        });
      });
      
      return groupsWithExactMatch.sort((a, b) => b.count - a.count);
    }
  }
  
  // Pas de match exact → comportement normal
  if (normalizedQuery) {
    groups.forEach(group => {
      group.items.sort((a, b) => {
        const aExact = itemMatchesQuery(a);
        const bExact = itemMatchesQuery(b);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });
    });
  }
  
  // Tri par count décroissant
  return groups.sort((a, b) => b.count - a.count);
}

/**
 * Convertit les facettes API en format compatible avec PiecesFilterSidebar
 * Extrait les logos et notes des équipementiers si disponibles
 */
export function mapFacetsToFilterData(facets: SearchFacet[]) {
  const marqueFacet = facets?.find(f => f.field === 'marque' || f.field === 'brand');
  const gammeFacet = facets?.find(f => f.field === 'gamme' || f.field === 'category');
  const priceFacet = facets?.find(f => f.field === 'price_range' || f.field === 'price');
  const qualityFacet = facets?.find(f => f.field === 'quality' || f.field === 'qualite');
  
  // Extraction des marques avec logos et notes
  const uniqueBrands: string[] = [];
  const brandLogos = new Map<string, string>();
  const brandNotes = new Map<string, number>();
  
  if (marqueFacet) {
    marqueFacet.values.forEach(v => {
      uniqueBrands.push(v.label);
      if (v.logo) {
        brandLogos.set(v.label, v.logo);
      }
      if (v.note !== undefined) {
        brandNotes.set(v.label, v.note);
      }
    });
  }
  
  return {
    uniqueBrands,
    brandLogos,
    brandNotes,
    gammeFacet,
    priceFacet,
    qualityFacet,
    rawFacets: facets,
  };
}

/**
 * Calcule les notes moyennes par marque à partir des pièces
 * Compatible avec brandAverageNotes du hook usePiecesFilters
 */
export function calculateBrandAverageNotes(pieces: PieceData[]): Map<string, number> {
  const brandNoteSums = new Map<string, { sum: number; count: number }>();
  
  pieces.forEach(piece => {
    if (piece.brand && piece.stars !== undefined) {
      const existing = brandNoteSums.get(piece.brand) || { sum: 0, count: 0 };
      // Convertir nb_stars (1-6) en note sur 10
      const note = Math.round((piece.stars / 6) * 10);
      brandNoteSums.set(piece.brand, {
        sum: existing.sum + note,
        count: existing.count + 1
      });
    }
  });
  
  const averages = new Map<string, number>();
  brandNoteSums.forEach((data, brand) => {
    averages.set(brand, Math.round((data.sum / data.count) * 10) / 10);
  });
  
  return averages;
}
