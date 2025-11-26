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
    <div className="w-72 h-[calc(100vh-8rem)] flex flex-col">
      {/* Card principale des filtres - Glassmorphism premium */}
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/80 overflow-hidden flex flex-col flex-1 min-h-0">
        
        {/* Header avec gradient premium dark */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-5 py-4 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-5 -left-5 w-20 h-20 bg-purple-500/20 rounded-full blur-2xl"></div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/20">
                <Package className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Filtres</h3>
                <p className="text-white/60 text-[10px] font-medium">Affiner la recherche</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1 border border-white/20">
              <span className="text-white font-bold text-xs">{piecesCount}</span>
              <span className="text-white/60 text-[10px] ml-1">résultat{piecesCount > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        
        {/* Contenu scrollable */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
          
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
              <div className="space-y-2">
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
                          {/* Mini barre fiabilité avec couleur dynamique */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="w-8 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                                style={{ width: '75%' }}
                              />
                            </div>
                            <span className="text-[9px] font-bold text-emerald-600">7.5</span>
                          </div>
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
            </FilterSection>
          )}

          {/* Prix - Inline compact */}
          <FilterSection 
            title="Prix" 
            icon={<DollarSign className="w-4 h-4 text-muted-foreground" />}
          >
            <div className="flex gap-1">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'low', label: '<50€' },
                { id: 'medium', label: '50-150€' },
                { id: 'high', label: '>150€' }
              ].map(price => (
                <button
                  key={price.id}
                  onClick={() => setActiveFilters({...activeFilters, priceRange: price.id as any})}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                    activeFilters.priceRange === price.id 
                      ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg shadow-slate-900/30' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                  }`}
                >
                  {price.label}
                </button>
              ))}
            </div>
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

          {/* Fiabilité minimum - Compact avec couleurs vibrantes */}
          <FilterSection 
            title="Fiabilité min." 
            icon={<Star className="w-4 h-4 text-muted-foreground" />}
          >
            <div className="flex gap-1.5">
              {[
                { value: 'all', label: 'Tous', gradient: 'from-slate-600 to-slate-700' },
                { value: '3', label: '≥3', gradient: 'from-amber-500 to-orange-500' },
                { value: '5', label: '≥5', gradient: 'from-emerald-500 to-teal-500' }
              ].map(rating => {
                const isActive = (rating.value === 'all' && !activeFilters.minStars) ||
                  activeFilters.minStars?.toString() === rating.value;
                return (
                  <button
                    key={rating.value}
                    onClick={() => setActiveFilters({
                      ...activeFilters, 
                      minStars: rating.value === 'all' ? undefined : parseInt(rating.value)
                    })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? `bg-gradient-to-r ${rating.gradient} text-white shadow-lg shadow-black/20 scale-105` 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {rating.label}
                  </button>
                );
              })}
            </div>
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

          {/* Bouton reset premium */}
          <button
            onClick={resetAllFilters}
            className="w-full bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 border border-slate-300 hover:border-slate-400 shadow-sm hover:shadow-md group"
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            Réinitialiser les filtres
          </button>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
