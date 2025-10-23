import { useState } from "react";
import { Button } from '~/components/ui/button';
import  { type VehicleData } from "~/types/vehicle.types";

interface VehiclePart {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  availability: 'in-stock' | 'low-stock' | 'out-of-stock';
  brand: string;
  partNumber: string;
  category: string;
}

interface VehiclePartsGridProps {
  vehicle: VehicleData;
  parts?: VehiclePart[];
  loading?: boolean;
}

export function VehiclePartsGrid({ vehicle, parts = [], loading = false }: VehiclePartsGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'price' | 'name' | 'availability'>('name');

  // Catégories disponibles
  const categories = ['all', ...new Set(parts.map(part => part.category))];
  
  // Filtrage et tri des pièces
  const filteredParts = parts
    .filter(part => selectedCategory === 'all' || part.category === selectedCategory)
    .sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.price - b.price;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'availability':
          const order = { 'in-stock': 0, 'low-stock': 1, 'out-of-stock': 2 };
          return order[a.availability] - order[b.availability];
        default:
          return 0;
      }
    });

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'in-stock':
        return 'text-success bg-success/20';
      case 'low-stock':
        return 'text-warning bg-warning/20';
      case 'out-of-stock':
        return 'text-destructive bg-destructive/20';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getAvailabilityText = (availability: string) => {
    switch (availability) {
      case 'in-stock':
        return 'En stock';
      case 'low-stock':
        return 'Stock limité';
      case 'out-of-stock':
        return 'Rupture de stock';
      default:
        return 'Non disponible';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Pièces disponibles pour {vehicle.brand} {vehicle.model}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 aspect-square rounded-lg mb-3"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded mb-2 w-3/4"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">
          Pièces disponibles pour {vehicle.brand} {vehicle.model}
        </h2>
        <div className="text-sm text-gray-600">
          {filteredParts.length} pièce{filteredParts.length > 1 ? 's' : ''} trouvée{filteredParts.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Filtres et tri */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Catégorie
          </label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="all">Toutes les catégories</option>
            {categories.filter(cat => cat !== 'all').map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-1">
            Trier par
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'price' | 'name' | 'availability')}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="name">Nom</option>
            <option value="price">Prix</option>
            <option value="availability">Disponibilité</option>
          </select>
        </div>
      </div>

      {/* Grille des pièces */}
      {filteredParts.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-lg text-gray-500">Aucune pièce trouvée</p>
          <p className="text-sm text-gray-400">
            Essayez de modifier vos filtres ou contactez-nous pour plus d'informations
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredParts.map((part) => (
            <div
              key={part.id}
              className="group relative bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              {/* Image */}
              <div className="aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
                {part.imageUrl ? (
                  <img
                    src={part.imageUrl}
                    alt={part.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Contenu */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                    {part.name}
                  </h3>
                  <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAvailabilityColor(part.availability)}`}>
                    {getAvailabilityText(part.availability)}
                  </span>
                </div>

                {part.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {part.description}
                  </p>
                )}

                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">
                    Réf: {part.partNumber}
                  </span>
                  <span className="text-sm text-gray-500">
                    {part.brand}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">
                    {part.price.toFixed(2)} {part.currency}
                  </span>
                  <Button className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-muted/50 disabled:cursor-not-allowed" variant="blue" type="button"
                    disabled={part.availability === 'out-of-stock'}>\n  {part.availability === 'out-of-stock' ? 'Indisponible' : 'Ajouter'}\n</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}