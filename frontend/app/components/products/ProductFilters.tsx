/**
 * 🎯 FILTRES PRODUITS - Composant barre de filtrage avancée
 * 
 * Features:
 * - Recherche texte (nom, référence)
 * - Filtre par gamme (dropdown)
 * - Filtre par marque (dropdown)
 * - Toggle stock faible
 * - Toggle actif seulement
 * - Reset filtres
 */

import { useSearchParams, useNavigate } from '@remix-run/react';
import { Search, Filter, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface Gamme {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface ProductFiltersProps {
  gammes: Gamme[];
  brands: Brand[];
  activeFiltersCount: number;
}

export function ProductFilters({
  gammes,
  brands,
  activeFiltersCount,
}: ProductFiltersProps) {

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const currentSearch = searchParams.get('search') || '';
  const currentGamme = searchParams.get('gammeId') || '';
  const currentBrand = searchParams.get('brandId') || '';
  const currentLowStock = searchParams.get('lowStock') === 'true';
  // Par défaut actifs = true (sauf si explicitement false)
  const currentActiveOnly = searchParams.get('isActive') !== 'false';

  // États locaux pour les sélections
  const [selectedGamme, setSelectedGamme] = useState(currentGamme);
  const [selectedBrand, setSelectedBrand] = useState(currentBrand);
  const [searchValue, setSearchValue] = useState(currentSearch);

  // Synchroniser avec l'URL au chargement
  useEffect(() => {
    setSelectedGamme(currentGamme);
    setSelectedBrand(currentBrand);
    setSearchValue(currentSearch);
  }, [currentGamme, currentBrand, currentSearch]);

  // Fonction pour construire et naviguer vers la nouvelle URL
  const buildAndNavigate = (params: {
    gammeId?: string;
    brandId?: string;
    search?: string;
    lowStock?: boolean;
    activeOnly?: boolean;
  }) => {
    const urlParams = new URLSearchParams();
    urlParams.set('page', '1'); // Reset à la page 1

    if (params.search?.trim()) urlParams.set('search', params.search.trim());
    if (params.gammeId) urlParams.set('gammeId', params.gammeId);
    if (params.brandId) urlParams.set('brandId', params.brandId);
    if (params.lowStock) urlParams.set('lowStock', 'true');
    if (params.activeOnly) urlParams.set('activeOnly', 'true');

    navigate(`?${urlParams.toString()}`);
  };

  // Handler pour le changement de gamme
  const handleGammeChange = (gammeId: string) => {
    setSelectedGamme(gammeId);
    
    // Appliquer automatiquement
    buildAndNavigate({
      gammeId: gammeId || undefined,
      brandId: selectedBrand || undefined,
      search: searchValue,
      lowStock: currentLowStock,
      activeOnly: currentActiveOnly,
    });
  };

  // Handler pour le changement de marque
  const handleBrandChange = (brandId: string) => {
    setSelectedBrand(brandId);
    
    // Appliquer automatiquement
    buildAndNavigate({
      gammeId: selectedGamme || undefined,
      brandId: brandId || undefined,
      search: searchValue,
      lowStock: currentLowStock,
      activeOnly: currentActiveOnly,
    });
  };

  // Handle apply filters - can be called from button or form submit
  const applyFilters = () => {
    
    // Get values from form elements by ID
    const searchInput = document.getElementById('search') as HTMLInputElement;
    const gammeSelect = document.getElementById('gammeId') as HTMLSelectElement;
    const brandSelect = document.getElementById('brandId') as HTMLSelectElement;
    const lowStockCheckbox = document.querySelector('input[name="lowStock"]') as HTMLInputElement;
    const activeOnlyCheckbox = document.querySelector('input[name="activeOnly"]') as HTMLInputElement;
    
    const search = searchInput?.value || '';
    const gammeId = gammeSelect?.value || '';
    const brandId = brandSelect?.value || '';
    const lowStock = lowStockCheckbox?.checked ? 'true' : '';
    const activeOnly = activeOnlyCheckbox?.checked ? 'true' : '';
    
    const params = new URLSearchParams();
    params.set('page', '1');

    if (search.trim()) params.set('search', search.trim());
    if (gammeId) params.set('gammeId', gammeId);
    if (brandId) params.set('brandId', brandId);
    if (lowStock === 'true') params.set('lowStock', 'true');
    if (activeOnly === 'true') params.set('activeOnly', 'true');

    navigate(`?${params.toString()}`);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    applyFilters();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Filtres</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary">{activeFiltersCount} actifs</Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={() => window.location.href = window.location.pathname}
          >
            <X className="h-4 w-4" />
            Réinitialiser
          </Button>
        )}
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Champs hidden pour les valeurs sélectionnées (compatibilité Form) */}
        <input type="hidden" name="page" value="1" />
        
        {/* Ligne 1: Recherche + Gamme */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recherche */}
          <div className="space-y-2">
            <Label htmlFor="search">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                name="search"
                type="text"
                placeholder="Nom ou référence..."
                defaultValue={currentSearch}
                className="pl-10"
              />
            </div>
          </div>

          {/* Gamme */}
          <div className="space-y-2">
            <Label htmlFor="gammeId">Gamme</Label>
            <select
              id="gammeId"
              name="gammeId"
              value={selectedGamme}
              onChange={(e) => handleGammeChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Toutes les gammes</option>
              {gammes.map((gamme) => (
                <option key={gamme.id} value={gamme.id}>
                  {gamme.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Ligne 2: Marque + Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Marque */}
          <div className="space-y-2">
            <Label htmlFor="brandId">Marque</Label>
            <select
              id="brandId"
              name="brandId"
              value={selectedBrand}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Toutes les marques</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          {/* Options rapides */}
          <div className="space-y-2">
            <Label>Options</Label>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="lowStock"
                  value="true"
                  defaultChecked={currentLowStock}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Stock faible</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="activeOnly"
                  value="true"
                  defaultChecked={currentActiveOnly}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Actifs seulement</span>
              </label>
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-end gap-2">
          <button 
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium"
            onClick={(e) => {
              e.preventDefault();
              applyFilters();
            }}
          >
            <Filter className="h-4 w-4" />
            Appliquer les filtres
          </button>
        </div>
      </form>
    </div>
  );
}
