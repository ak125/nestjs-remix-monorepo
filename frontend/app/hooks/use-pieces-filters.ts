/**
 * 🎯 Hook personnalisé pour gérer les filtres et la sélection des pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 */

import { useState, useMemo } from 'react';
import { type PieceData, type PiecesFilters, type SortBy, type ViewMode } from '../types/pieces-route.types';

export function usePiecesFilters(inputPieces: PieceData[] | undefined | null) {
  // ✅ Protection: S'assurer que pieces est toujours un tableau (stabilisé avec useMemo)
  const pieces = useMemo(() => inputPieces ?? [], [inputPieces]);
  
  // État des filtres
  const [activeFilters, setActiveFilters] = useState<PiecesFilters>({
    brands: [],
    priceRange: "all",
    quality: "all",
    availability: "all",
    searchText: "",
    minNote: undefined,
    position: "all",
  });

  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedPieces, setSelectedPieces] = useState<number[]>([]);
  const [favoritesPieces, setFavoritesPieces] = useState<number[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(true);

  // Filtrage et tri des produits
  const filteredProducts = useMemo(() => {
    let result = [...pieces];

    // Recherche textuelle - ✅ Protection contre undefined
    if (activeFilters.searchText) {
      const q = activeFilters.searchText.toLowerCase();
      result = result.filter(piece => 
        (piece.name || '').toLowerCase().includes(q) ||
        (piece.reference || '').toLowerCase().includes(q) ||
        (piece.brand || '').toLowerCase().includes(q)
      );
    }

    // Filtres par marque (⚡ Optimisé avec Set pour O(1) lookup)
    if (activeFilters.brands.length) {
      const brandsSet = new Set(activeFilters.brands);
      result = result.filter(piece => 
        brandsSet.has(piece.brand)
      );
    }

    // Filtre par qualité
    if (activeFilters.quality !== "all") {
      result = result.filter(piece => 
        piece.quality === activeFilters.quality
      );
    }

    // Filtre par position (Avant/Arrière ou Gauche/Droite)
    if (activeFilters.position && activeFilters.position !== "all") {
      result = result.filter(piece => 
        piece.side === activeFilters.position
      );
    }

    // Filtre par prix
    if (activeFilters.priceRange !== "all") {
      result = result.filter(piece => {
        const price = piece.price;
        switch (activeFilters.priceRange) {
          case "low": return price < 50;
          case "medium": return price >= 50 && price < 150;
          case "high": return price >= 150;
          default: return true;
        }
      });
    }

    // Filtre par disponibilité
    if (activeFilters.availability === "stock") {
      result = result.filter(piece => piece.stock === "En stock");
    }

    // Filtre par note minimale (sur 10, calculée depuis stars)
    if (activeFilters.minNote && activeFilters.minNote > 0) {
      result = result.filter(piece => {
        const stars = piece.stars || 3;
        const note = Math.round((stars / 6) * 10);
        return note >= activeFilters.minNote!;
      });
    }

    // Tri avec protection contre les valeurs undefined
    // ⚡ Optimisé avec Intl.Collator (2-3x plus rapide que localeCompare)
    const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
    
    switch (sortBy) {
      case "name":
        result.sort((a, b) => collator.compare(a.name || '', b.name || ''));
        break;
      case "price-asc":
        result.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case "price-desc":
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "brand":
        result.sort((a, b) => collator.compare(a.brand || '', b.brand || ''));
        break;
    }

    return result;
  }, [pieces, activeFilters, sortBy]);

  // Marques uniques avec protection contre undefined
  const uniqueBrands = useMemo(() => {
    const brands = new Set(pieces.map(p => p.brand || 'Inconnu').filter(Boolean));
    return Array.from(brands).sort();
  }, [pieces]);

  // ✨ NOUVEAU: Comptages dynamiques croisés pour filtres
  // Calcule les comptages en tenant compte des autres filtres actifs
  const dynamicFilterCounts = useMemo(() => {
    // Créer une copie des pièces pour chaque type de filtre
    let basePieces = [...pieces];

    // Appliquer recherche textuelle (toujours active) - ✅ Protection contre undefined
    if (activeFilters.searchText) {
      const q = activeFilters.searchText.toLowerCase();
      basePieces = basePieces.filter(piece => 
        (piece.name || '').toLowerCase().includes(q) ||
        (piece.reference || '').toLowerCase().includes(q) ||
        (piece.brand || '').toLowerCase().includes(q)
      );
    }

    // Comptages par marque (exclut filtre marque, inclut qualité/prix/dispo)
    const brandCounts = new Map<string, number>();
    let piecesForBrands = basePieces;
    
    if (activeFilters.quality !== "all") {
      piecesForBrands = piecesForBrands.filter(p => p.quality === activeFilters.quality);
    }
    if (activeFilters.priceRange !== "all") {
      piecesForBrands = piecesForBrands.filter(p => {
        const price = p.price;
        switch (activeFilters.priceRange) {
          case "low": return price < 50;
          case "medium": return price >= 50 && price < 150;
          case "high": return price >= 150;
          default: return true;
        }
      });
    }
    if (activeFilters.availability === "stock") {
      piecesForBrands = piecesForBrands.filter(p => p.stock === "En stock");
    }

    piecesForBrands.forEach(p => {
      if (p.brand) {
        brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
      }
    });

    // Comptages par qualité (exclut filtre qualité, inclut marque/prix/dispo)
    const qualityCounts = new Map<string, number>();
    let piecesForQuality = basePieces;
    
    if (activeFilters.brands.length) {
      const brandsSet = new Set(activeFilters.brands);
      piecesForQuality = piecesForQuality.filter(p => brandsSet.has(p.brand));
    }
    if (activeFilters.priceRange !== "all") {
      piecesForQuality = piecesForQuality.filter(p => {
        const price = p.price;
        switch (activeFilters.priceRange) {
          case "low": return price < 50;
          case "medium": return price >= 50 && price < 150;
          case "high": return price >= 150;
          default: return true;
        }
      });
    }
    if (activeFilters.availability === "stock") {
      piecesForQuality = piecesForQuality.filter(p => p.stock === "En stock");
    }

    piecesForQuality.forEach(p => {
      if (p.quality) {
        qualityCounts.set(p.quality, (qualityCounts.get(p.quality) || 0) + 1);
      }
    });

    // Comptages par gamme de prix (exclut filtre prix, inclut marque/qualité/dispo)
    let piecesForPrice = basePieces;
    
    if (activeFilters.brands.length) {
      const brandsSet = new Set(activeFilters.brands);
      piecesForPrice = piecesForPrice.filter(p => brandsSet.has(p.brand));
    }
    if (activeFilters.quality !== "all") {
      piecesForPrice = piecesForPrice.filter(p => p.quality === activeFilters.quality);
    }
    if (activeFilters.availability === "stock") {
      piecesForPrice = piecesForPrice.filter(p => p.stock === "En stock");
    }

    const priceCounts = {
      low: piecesForPrice.filter(p => p.price < 50).length,
      medium: piecesForPrice.filter(p => p.price >= 50 && p.price < 150).length,
      high: piecesForPrice.filter(p => p.price >= 150).length,
    };

    return {
      brandCounts,
      qualityCounts,
      priceCounts,
    };
  }, [pieces, activeFilters]);

  // ✨ NOUVEAU: Notes moyennes par marque (calculées à partir des pièces)
  const brandAverageNotes = useMemo(() => {
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
  }, [pieces]);

  // Pièces recommandées
  const recommendedPieces = useMemo(() => {
    if (!showRecommendations) return [];
    
    return filteredProducts
      .filter(piece => piece.quality === 'OES' && piece.stars && piece.stars >= 4)
      .slice(0, 3);
  }, [filteredProducts, showRecommendations]);

  // Données des pièces sélectionnées
  const selectedPiecesData = useMemo(() => {
    return pieces.filter(piece => selectedPieces.includes(piece.id));
  }, [pieces, selectedPieces]);

  // Actions
  const resetAllFilters = () => {
    setActiveFilters({
      brands: [],
      priceRange: "all",
      quality: "all", 
      availability: "all",
      searchText: "",
      minNote: undefined,
    });
    setSortBy("name");
  };

  const togglePieceSelection = (pieceId: number) => {
    setSelectedPieces(prev => 
      prev.includes(pieceId) 
        ? prev.filter(id => id !== pieceId)
        : [...prev, pieceId]
    );
  };

  const toggleFavorite = (pieceId: number) => {
    setFavoritesPieces(prev => 
      prev.includes(pieceId)
        ? prev.filter(id => id !== pieceId)
        : [...prev, pieceId]
    );
  };

  const clearAllSelections = () => {
    setSelectedPieces([]);
    setFavoritesPieces([]);
  };

  const updateFilters = (updates: Partial<PiecesFilters>) => {
    setActiveFilters(prev => ({ ...prev, ...updates }));
  };

  return {
    // État
    activeFilters,
    sortBy,
    viewMode,
    selectedPieces,
    favoritesPieces,
    showRecommendations,
    
    // Données calculées
    filteredProducts,
    uniqueBrands,
    recommendedPieces,
    selectedPiecesData,
    dynamicFilterCounts, // ✨ NOUVEAU: Comptages dynamiques croisés
    brandAverageNotes, // ✨ Notes moyennes par marque
    
    // Actions
    setActiveFilters,
    setSortBy,
    setViewMode,
    setShowRecommendations,
    resetAllFilters,
    togglePieceSelection,
    toggleFavorite,
    clearAllSelections,
    updateFilters,
  };
}
