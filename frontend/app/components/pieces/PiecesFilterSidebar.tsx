/**
 * 🎛️ Sidebar Filtres pour Route Pièces - VERSION MIGRÉE
 * ✅ Utilise shadcn/ui (Checkbox, RadioGroup, ScrollArea, Label)
 * ✅ Utilise design tokens sémantiques
 * ✅ Utilise FilterSection pour réduire duplication
 * ✅ Support dark mode via tokens
 */

import React from 'react';
import { 
  Badge, 
  Checkbox, 
  FilterOption, 
  FilterSection, 
  Label, 
  RadioGroup, 
  RadioGroupItem, 
  ScrollArea 
} from '@fafa/ui';
import { Search, Package, DollarSign, Star, Box, RotateCcw } from 'lucide-react';
import { type PiecesFilters } from '../../types/pieces-route.types';
import { StarRating } from '../common/StarRating';

interface FilterOptionData {
  id: number | string;
  label: string;
  count: number;
  trending?: boolean;
}

interface FilterGroup {
  type: string;
  options: FilterOptionData[];
}

interface FiltersData {
  filters: FilterGroup[];
  summary?: {
    total_filters: number;
    total_options: number;
    trending_options?: number;
  };
}

interface PiecesFilterSidebarProps {
  activeFilters: PiecesFilters;
  setActiveFilters: (filters: PiecesFilters) => void;
  uniqueBrands: string[];
  piecesCount: number;
  resetAllFilters: () => void;
  getBrandCount?: (brand: string) => number;
  getQualityCount?: (quality: string) => number;
  getPriceRangeCount?: (range: string) => number;
  filtersData?: FiltersData | null;
}

export function PiecesFilterSidebar({
  activeFilters,
  setActiveFilters,
  uniqueBrands,
  piecesCount,
  resetAllFilters,
  getBrandCount,
  getQualityCount,
  getPriceRangeCount,
  filtersData
}: PiecesFilterSidebarProps) {
  
  // Extract data from API response
  const brandFilters = filtersData?.filters?.find(f => f.type === 'brand')?.options || [];
  const qualityFilters = filtersData?.filters?.find(f => f.type === 'quality')?.options || [];
  
  // Use API data if available, fallback to old uniqueBrands
  const brandsToDisplay = brandFilters.length > 0 
    ? brandFilters 
    : uniqueBrands.map(brand => ({ id: brand, label: brand, count: getBrandCount?.(brand) || 0 }));
  
  return (
    <div className="w-80 space-y-6">
      {/* Card principale des filtres - avec tokens sémantiques */}
      <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden transition-all duration-300 hover:shadow-xl">
        
        {/* Header avec gradient (utilise tokens primary) */}
        <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 px-6 py-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
          
          <div className="relative z-10">
            <h3 className="font-bold text-lg text-primary-foreground flex items-center gap-2.5">
              <Package className="w-5 h-5" />
              Filtres
            </h3>
            <p className="text-primary-foreground/80 text-xs mt-1 font-medium">
              {piecesCount} résultat{piecesCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          
          {/* Recherche moderne avec FilterSection */}
          <FilterSection 
            title="Recherche rapide" 
            icon={<Search className="w-4 h-4 text-muted-foreground" />}
            variant="compact"
          >
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Rechercher une pièce..."
                value={activeFilters.searchText}
                onChange={(e) => setActiveFilters({...activeFilters, searchText: e.target.value})}
                className="w-full pl-10 pr-4 py-3 border-2 border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all bg-muted/50 hover:bg-background text-foreground placeholder:text-muted-foreground"
              />
              {activeFilters.searchText && (
                <button
                  onClick={() => setActiveFilters({...activeFilters, searchText: ''})}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </FilterSection>

          {/* Marques avec ScrollArea et Checkbox de shadcn/ui */}
          {brandsToDisplay.length > 1 && (
            <FilterSection 
              title="Marques" 
              icon={<Package className="w-4 h-4 text-muted-foreground" />}
              badge={
                <Badge variant="secondary" className="text-xs">
                  {brandsToDisplay.length}
                </Badge>
              }
            >
              <ScrollArea className="h-48">
                <div className="space-y-2 pr-4">
                  {brandsToDisplay.map(brandOption => {
                    const brandName = brandOption.label;
                    const isSelected = activeFilters.brands.includes(brandName);
                    
                    const logoFileName = `${brandName.toLowerCase().replace(/\s+/g, '-')}.webp`;
                    const logoUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/equipementiers-automobiles/${logoFileName}`;
                    
                    return (
                      <FilterOption 
                        key={brandOption.id} 
                        isSelected={isSelected}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setActiveFilters({
                                  ...activeFilters,
                                  brands: [...activeFilters.brands, brandName]
                                });
                              } else {
                                setActiveFilters({
                                  ...activeFilters,
                                  brands: activeFilters.brands.filter(b => b !== brandName)
                                });
                              }
                            }}
                          />
                          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                            <img 
                              src={logoUrl}
                              alt={`Logo ${brandName}`}
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                          <Label className="text-sm cursor-pointer flex-1">
                            {brandOption.label}
                          </Label>
                          {brandOption.trending && (
                            <span className="text-xs" title="Marque tendance">🔥</span>
                          )}
                        </div>
                        {brandOption.count > 0 && (
                          <Badge variant="secondary" className="text-xs ml-2">
                            {brandOption.count}
                          </Badge>
                        )}
                      </FilterOption>
                    );
                  })}
                </div>
              </ScrollArea>
            </FilterSection>
          )}

          {/* Prix avec RadioGroup de shadcn/ui */}
          <FilterSection 
            title="Prix" 
            icon={<DollarSign className="w-4 h-4 text-muted-foreground" />}
          >
            <RadioGroup
              value={activeFilters.priceRange}
              onValueChange={(value) => setActiveFilters({...activeFilters, priceRange: value as any})}
            >
              {[
                { id: 'all', label: 'Tous les prix', desc: '' },
                { id: 'low', label: 'Moins de 50€', desc: '(économique)' },
                { id: 'medium', label: '50€ - 150€', desc: '(standard)' },
                { id: 'high', label: 'Plus de 150€', desc: '(premium)' }
              ].map(price => {
                const isSelected = activeFilters.priceRange === price.id;
                const dynamicCount = price.id !== 'all' && getPriceRangeCount 
                  ? getPriceRangeCount(price.id) 
                  : undefined;
                const isDisabled = price.id !== 'all' && dynamicCount === 0;
                
                return (
                  <FilterOption 
                    key={price.id} 
                    isSelected={isSelected}
                    isDisabled={isDisabled}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <RadioGroupItem 
                        value={price.id} 
                        disabled={isDisabled}
                      />
                      <div className="flex-1">
                        <Label className={`text-sm cursor-pointer block ${isDisabled ? 'text-muted-foreground' : ''}`}>
                          {price.label}
                        </Label>
                        {price.desc && (
                          <span className="text-xs text-muted-foreground block">{price.desc}</span>
                        )}
                      </div>
                    </div>
                    {dynamicCount !== undefined && dynamicCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dynamicCount}
                      </Badge>
                    )}
                  </FilterOption>
                );
              })}
            </RadioGroup>
          </FilterSection>

          {/* Qualité avec RadioGroup */}
          <FilterSection 
            title="Qualité" 
            icon={<Star className="w-4 h-4 text-muted-foreground" />}
            badge={
              qualityFilters.length > 0 ? (
                <Badge variant="secondary" className="text-xs">
                  {qualityFilters.reduce((sum, q) => sum + q.count, 0)} pièces
                </Badge>
              ) : null
            }
          >
            <RadioGroup
              value={activeFilters.quality}
              onValueChange={(value) => setActiveFilters({...activeFilters, quality: value})}
            >
              <FilterOption isSelected={activeFilters.quality === 'all'}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="all" />
                  <Label className="text-sm cursor-pointer">
                    🔧 Toutes qualités
                  </Label>
                </div>
              </FilterOption>
              
              {qualityFilters.length > 0 ? (
                qualityFilters.map(qualityOption => {
                  const isSelected = activeFilters.quality === String(qualityOption.id);
                  const dynamicCount = getQualityCount ? getQualityCount(String(qualityOption.id)) : qualityOption.count;
                  const isDisabled = dynamicCount === 0;
                  
                  const iconMap: Record<string, string> = {
                    'OES': '🏆',
                    'A': '⭐',
                    'aftermarket': '⭐',
                    'O': '🔧'
                  };
                  const icon = iconMap[String(qualityOption.id)] || '🔧';
                  
                  return (
                    <FilterOption 
                      key={String(qualityOption.id)}
                      isSelected={isSelected}
                      isDisabled={isDisabled}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <RadioGroupItem 
                          value={String(qualityOption.id)}
                          disabled={isDisabled}
                        />
                        <Label className={`text-sm cursor-pointer ${isDisabled ? 'text-muted-foreground' : ''}`}>
                          {icon} {qualityOption.label}
                        </Label>
                      </div>
                      {dynamicCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {dynamicCount}
                        </Badge>
                      )}
                    </FilterOption>
                  );
                })
              ) : (
                [
                  { id: 'OES', label: 'OES (Origine)', icon: '🏆' },
                  { id: 'AFTERMARKET', label: 'Aftermarket', icon: '⭐' },
                  { id: 'Echange Standard', label: 'Échange Standard', icon: '🔄' }
                ].map(quality => {
                  const isSelected = activeFilters.quality === quality.id;
                  return (
                    <FilterOption key={quality.id} isSelected={isSelected}>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={quality.id} />
                        <Label className="text-sm cursor-pointer flex items-center gap-2">
                          <span>{quality.icon}</span>
                          {quality.label}
                        </Label>
                      </div>
                    </FilterOption>
                  );
                })
              )}
            </RadioGroup>
          </FilterSection>

          {/* Filtre Étoiles (Note minimale) */}
          <FilterSection 
            title="Note minimale" 
            icon={<Star className="w-4 h-4 text-muted-foreground" />}
          >
            <RadioGroup
              value={activeFilters.minStars?.toString() || 'all'}
              onValueChange={(value) => setActiveFilters({
                ...activeFilters, 
                minStars: value === 'all' ? undefined : parseInt(value)
              })}
            >
              <FilterOption isSelected={!activeFilters.minStars}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="all" />
                  <Label className="text-sm cursor-pointer">
                    Toutes les notes
                  </Label>
                </div>
              </FilterOption>

              <FilterOption isSelected={activeFilters.minStars === 3}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="3" />
                  <div className="flex items-center gap-1">
                    <StarRating rating={3} size="sm" />
                    <Label className="text-sm cursor-pointer ml-1">
                      et plus
                    </Label>
                  </div>
                </div>
              </FilterOption>

              <FilterOption isSelected={activeFilters.minStars === 5}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="5" />
                  <div className="flex items-center gap-1">
                    <StarRating rating={5} size="sm" />
                    <Label className="text-sm cursor-pointer ml-1">
                      et plus
                    </Label>
                  </div>
                </div>
              </FilterOption>
            </RadioGroup>
          </FilterSection>

          {/* Disponibilité */}
          <FilterSection 
            title="Disponibilité" 
            icon={<Box className="w-4 h-4 text-muted-foreground" />}
          >
            <RadioGroup
              value={activeFilters.availability}
              onValueChange={(value) => setActiveFilters({...activeFilters, availability: value as any})}
            >
              <FilterOption isSelected={activeFilters.availability === "all"}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="all" />
                  <Label className="text-sm cursor-pointer">
                    Toutes disponibilités
                  </Label>
                </div>
              </FilterOption>
              
              <FilterOption isSelected={activeFilters.availability === "stock"}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="stock" />
                  <Label className="text-sm cursor-pointer flex items-center gap-2">
                    <span className="w-2 h-2 bg-success rounded-full"></span>
                    En stock uniquement
                  </Label>
                </div>
              </FilterOption>
            </RadioGroup>
          </FilterSection>

          {/* Bouton reset moderne avec tokens */}
          <button
            onClick={resetAllFilters}
            className="w-full bg-muted hover:bg-muted/80 text-foreground font-medium py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 border border-border hover:border-primary"
          >
            <RotateCcw className="w-4 h-4" />
            Réinitialiser les filtres
          </button>
        </div>
      </div>

      {/* Stats résumé avec tokens */}
      <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">{piecesCount}</div>
          <div className="text-sm text-primary/80">
            pièce{piecesCount > 1 ? 's' : ''} trouvée{piecesCount > 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
