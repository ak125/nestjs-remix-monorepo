// 🔧 Composant Grid des Pièces - Architecture Modulaire
// ✅ Images WebP optimisées automatiquement
import React, { useState, useMemo } from 'react';
import { Link } from "@remix-run/react";

interface Piece {
  pie_id: number;
  pie_designation: string;
  marque_nom: string;
  prix_unitaire: number;
  consigne: number;
  image_url?: string;
  disponibilite: boolean;
  oe_reference: string;
}

interface PiecesGridProps {
  pieces: Piece[];
  gamme: {
    name: string;
    alias: string;
  };
  vehicle: {
    marque: string;
    modele: string;
    type: string;
  };
  filters: {
    marque: string;
    search: string;
    sortBy: string;
  };
  onFilterChange: (key: string, value: string) => void;
}

export const PiecesGrid: React.FC<PiecesGridProps> = ({
  pieces,
  gamme,
  vehicle,
  filters,
  onFilterChange
}) => {
  // Filtres et tri
  const filteredAndSortedPieces = useMemo(() => {
    let filtered = pieces;

    // Filtre par marque
    if (filters.marque && filters.marque !== 'all') {
      filtered = filtered.filter(piece => 
        piece.marque_nom.toLowerCase().includes(filters.marque.toLowerCase())
      );
    }

    // Filtre par recherche
    if (filters.search) {
      filtered = filtered.filter(piece =>
        piece.pie_designation.toLowerCase().includes(filters.search.toLowerCase()) ||
        piece.oe_reference.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Tri
    switch (filters.sortBy) {
      case 'price_asc':
        return filtered.sort((a, b) => a.prix_unitaire - b.prix_unitaire);
      case 'price_desc':
        return filtered.sort((a, b) => b.prix_unitaire - a.prix_unitaire);
      case 'brand':
        return filtered.sort((a, b) => a.marque_nom.localeCompare(b.marque_nom));
      case 'name':
      default:
        return filtered.sort((a, b) => a.pie_designation.localeCompare(b.pie_designation));
    }
  }, [pieces, filters]);

  // Extraire les marques uniques pour le filtre
  const uniqueBrands = useMemo(() => {
    const brands = pieces.map(p => p.marque_nom);
    return [...new Set(brands)].sort();
  }, [pieces]);

  return (
    <div className="space-y-6">
      {/* Header avec filtres */}
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {gamme.name} - {vehicle.marque} {vehicle.modele}
            </h1>
            <p className="text-gray-600">
              {filteredAndSortedPieces.length} pièce{filteredAndSortedPieces.length > 1 ? 's' : ''} disponible{filteredAndSortedPieces.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Motorisation</div>
            <div className="font-medium text-gray-900">{vehicle.type}</div>
          </div>
        </div>

        {/* Filtres */}
        <PiecesFilters
          filters={filters}
          brands={uniqueBrands}
          onFilterChange={onFilterChange}
        />
      </div>

      {/* Statistiques rapides */}
      <PiecesStats pieces={filteredAndSortedPieces} />

      {/* Grid des pièces */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredAndSortedPieces.map(piece => (
          <PieceCard key={piece.pie_id} piece={piece} />
        ))}
      </div>

      {/* Message si aucune pièce */}
      {filteredAndSortedPieces.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucune pièce trouvée
          </h3>
          <p className="text-gray-500">
            Essayez de modifier vos critères de recherche
          </p>
        </div>
      )}
    </div>
  );
};

// Composant Filtres
const PiecesFilters: React.FC<{
  filters: { marque: string; search: string; sortBy: string };
  brands: string[];
  onFilterChange: (key: string, value: string) => void;
}> = ({ filters, brands, onFilterChange }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {/* Recherche */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        🔍 Rechercher
      </label>
      <input
        type="text"
        value={filters.search}
        onChange={(e) => onFilterChange('search', e.target.value)}
        placeholder="Nom ou référence..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>

    {/* Filtre par marque */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        🏷️ Marque
      </label>
      <select
        value={filters.marque}
        onChange={(e) => onFilterChange('marque', e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Toutes les marques</option>
        {brands.map(brand => (
          <option key={brand} value={brand}>{brand}</option>
        ))}
      </select>
    </div>

    {/* Tri */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        📊 Trier par
      </label>
      <select
        value={filters.sortBy}
        onChange={(e) => onFilterChange('sortBy', e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="name">Nom</option>
        <option value="price_asc">Prix croissant</option>
        <option value="price_desc">Prix décroissant</option>
        <option value="brand">Marque</option>
      </select>
    </div>
  </div>
);

// Composant Statistiques
const PiecesStats: React.FC<{ pieces: Piece[] }> = ({ pieces }) => {
  const stats = useMemo(() => {
    if (pieces.length === 0) return null;

    const prices = pieces.map(p => p.prix_unitaire);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const availableCount = pieces.filter(p => p.disponibilite).length;

    return { minPrice, maxPrice, avgPrice, availableCount };
  }, [pieces]);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="text-2xl font-bold text-blue-600">
          {stats.minPrice.toFixed(2)}€
        </div>
        <div className="text-sm text-blue-800">Prix minimum</div>
      </div>
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <div className="text-2xl font-bold text-green-600">
          {stats.maxPrice.toFixed(2)}€
        </div>
        <div className="text-sm text-green-800">Prix maximum</div>
      </div>
      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
        <div className="text-2xl font-bold text-purple-600">
          {stats.avgPrice.toFixed(2)}€
        </div>
        <div className="text-sm text-purple-800">Prix moyen</div>
      </div>
      <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
        <div className="text-2xl font-bold text-orange-600">
          {stats.availableCount}
        </div>
        <div className="text-sm text-orange-800">Disponibles</div>
      </div>
    </div>
  );
};

// Composant Carte Pièce
// 🖼️ Helper pour optimiser les URLs d'images en WebP
const optimizeImageUrl = (imageUrl: string | undefined, width: number = 400): string => {
  if (!imageUrl) return '';
  
  // Si c'est une URL Supabase, utiliser la transformation d'image
  if (imageUrl.includes('supabase.co/storage')) {
    const match = imageUrl.match(/\/public\/(.+?)(?:\?|$)/);
    if (match) {
      const path = match[1];
      const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
      return `${SUPABASE_URL}/storage/v1/render/image/public/${path}?format=webp&width=${width}&quality=85`;
    }
  }
  
  return imageUrl;
};

const generateSrcSet = (imageUrl: string | undefined): string => {
  if (!imageUrl) return '';
  
  return [300, 400, 600]
    .map(width => `${optimizeImageUrl(imageUrl, width)} ${width}w`)
    .join(', ');
};

const PieceCard: React.FC<{ piece: Piece }> = ({ piece }) => (
  <div className="bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all duration-300 overflow-hidden group">
    {/* Image - ✅ OPTIMISÉE WEBP */}
    <div className="aspect-square bg-gray-100 relative overflow-hidden">
      {piece.image_url ? (
        <img
          src={optimizeImageUrl(piece.image_url, 400)}
          srcSet={generateSrcSet(piece.image_url)}
          sizes="(max-width: 640px) 300px, 400px"
          alt={piece.pie_designation}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-gray-400 text-4xl">🔧</span>
        </div>
      )}
      
      {/* Badge disponibilité */}
      <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
        piece.disponibilite 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        {piece.disponibilite ? '✅ Dispo' : '❌ Rupture'}
      </div>
    </div>

    {/* Contenu */}
    <div className="p-4">
      {/* Marque */}
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {piece.marque_nom}
      </div>

      {/* Nom */}
      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
        {piece.pie_designation}
      </h3>

      {/* Référence OE */}
      <div className="text-xs text-gray-500 mb-3 font-mono">
        Réf: {piece.oe_reference}
      </div>

      {/* Prix */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-gray-900">
            {piece.prix_unitaire.toFixed(2)}€
          </div>
          {piece.consigne > 0 && (
            <div className="text-xs text-gray-500">
              + {piece.consigne.toFixed(2)}€ consigne
            </div>
          )}
        </div>

        {/* Bouton d'action */}
        <button 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!piece.disponibilite}
        >
          {piece.disponibilite ? '🛒 Ajouter' : '❌ Indisponible'}
        </button>
      </div>
    </div>
  </div>
);

export default PiecesGrid;