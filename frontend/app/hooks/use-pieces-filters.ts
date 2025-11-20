/**
 * 🎯 Hook personnalisé pour gérer les filtres et la sélection des pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 */

import { useState, useMemo } from 'react';
import { type PieceData, type PiecesFilters, type SortBy, type ViewMode } from '../types/pieces-route.types';

export function usePiecesFilters(pieces: PieceData[]) {
  // État des filtres
  const [activeFilters, setActiveFilters] = useState<PiecesFilters>({
    brands: [],
    priceRange: "all",
    quality: "all",
    availability: "all",
    searchText: "",
  });

  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedPieces, setSelectedPieces] = useState<number[]>([]);
  const [favoritesPieces, setFavoritesPieces] = useState<number[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(true);

  // Filtrage et tri des produits
  const filteredProducts = useMemo(() => {
    let result = [...pieces];

    // Recherche textuelle
    if (activeFilters.searchText) {
      const q = activeFilters.searchText.toLowerCase();
      result = result.filter(piece => 
        piece.name.toLowerCase().includes(q) ||
        piece.reference.toLowerCase().includes(q) ||
        piece.brand.toLowerCase().includes(q)
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
