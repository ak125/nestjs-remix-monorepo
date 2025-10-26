/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔍 ADVANCED FILTERS - EXEMPLES D'UTILISATION
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { AdvancedFilters, type FilterValues } from './AdvancedFilters';
import { ProductCard } from './ProductCard';

// Mock data
const MOCK_BRANDS = ['Peugeot', 'Renault', 'Citroën', 'Ford', 'Volkswagen'];
const MOCK_CATEGORIES = ['Freinage', 'Filtration', 'Moteur', 'Transmission', 'Suspension', 'Éclairage'];

const MOCK_PRODUCTS = [
  {
    id: '1',
    name: 'Plaquettes de frein avant',
    oemRef: '7701208265',
    brand: 'Renault',
    model: 'Clio 4',
    category: 'Freinage',
    price: 45.90,
    originalPrice: 55.90,
    stockStatus: 'in-stock' as const,
    imageUrl: '/images/plaquettes.jpg',
    isCompatible: true,
  },
  {
    id: '2',
    name: 'Disques de frein (x2)',
    oemRef: '7701207795',
    brand: 'Renault',
    model: 'Mégane',
    category: 'Freinage',
    price: 89.00,
    stockStatus: 'low-stock' as const,
    imageUrl: '/images/disques.jpg',
    isCompatible: true,
  },
  {
    id: '3',
    name: 'Filtre à huile',
    oemRef: '8200768913',
    brand: 'Peugeot',
    model: '208',
    category: 'Filtration',
    price: 12.50,
    stockStatus: 'out-of-stock' as const,
    imageUrl: '/images/filtre.jpg',
    isCompatible: false,
  },
];

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 1: Utilisation Basique
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function AdvancedFiltersBasic() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [filteredProducts, setFilteredProducts] = useState(MOCK_PRODUCTS);

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    
    // Appliquer filtres
    let results = [...MOCK_PRODUCTS];
    
    if (newFilters.brand) {
      results = results.filter((p) => p.brand === newFilters.brand);
    }
    
    if (newFilters.category) {
      results = results.filter((p) => p.category === newFilters.category);
    }
    
    if (newFilters.oemRef) {
      results = results.filter((p) => p.oemRef.includes(newFilters.oemRef!));
    }
    
    if (newFilters.priceMin) {
      results = results.filter((p) => p.price >= newFilters.priceMin!);
    }
    
    if (newFilters.priceMax) {
      results = results.filter((p) => p.price <= newFilters.priceMax!);
    }
    
    if (newFilters.inStockOnly) {
      results = results.filter((p) => p.stockStatus === 'in-stock');
    }
    
    if (newFilters.compatibleOnly) {
      results = results.filter((p) => p.isCompatible);
    }
    
    setFilteredProducts(results);
  };

  return (
    <div className="max-w-7xl mx-auto px-md py-xl">
      <h1 className="font-heading text-3xl font-bold text-neutral-900 mb-lg">
        Catalogue avec Filtres
      </h1>

      {/* Filtres */}
      <div className="mb-xl">
        <AdvancedFilters
          values={filters}
          onChange={handleFilterChange}
          onReset={() => setFilters({})}
          brands={MOCK_BRANDS}
          categories={MOCK_CATEGORIES}
          resultCount={filteredProducts.length}
          totalCount={MOCK_PRODUCTS.length}
        />
      </div>

      {/* Résultats */}
      {filteredProducts.length === 0 ? (
        <div className="bg-neutral-100 rounded-lg p-xl text-center">
          <p className="font-sans text-lg text-neutral-600">
            Aucun produit ne correspond à vos critères
          </p>
          <button
            onClick={() => handleFilterChange({})}
            className="mt-md px-lg py-sm bg-primary-500 text-white rounded-lg font-heading font-semibold"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              {...product}
              imageAlt={product.name}
              compactMode={true}
              onAddToCart={(id) => console.log('Ajout:', id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 2: Mode Sidebar (Layout Catalogue)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function AdvancedFiltersSidebar() {
  const [filters, setFilters] = useState<FilterValues>({});

  return (
    <div className="max-w-7xl mx-auto px-md py-xl">
      <h1 className="font-heading text-3xl font-bold text-neutral-900 mb-lg">
        Catalogue - Layout Sidebar
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-lg">
        {/* Sidebar filtres (sticky) */}
        <aside className="lg:col-span-1">
          <div className="sticky top-xl">
            <AdvancedFilters
              values={filters}
              onChange={setFilters}
              brands={MOCK_BRANDS}
              categories={MOCK_CATEGORIES}
              resultCount={MOCK_PRODUCTS.length}
              totalCount={MOCK_PRODUCTS.length}
            />
          </div>
        </aside>

        {/* Grille produits */}
        <main className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">
            {MOCK_PRODUCTS.map((product) => (
              <ProductCard
                key={product.id}
                {...product}
                imageAlt={product.name}
                compactMode={true}
                onAddToCart={(id) => console.log('Ajout:', id)}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 3: Filtres avec Véhicule Pré-configuré
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function AdvancedFiltersWithVehicle() {
  const [filters, setFilters] = useState<FilterValues>({
    brand: 'Peugeot',
    model: '208',
    year: 2016,
    engine: '1.6 HDi',
    compatibleOnly: true,
  });

  return (
    <div className="max-w-7xl mx-auto px-md py-xl">
      {/* Info véhicule configuré */}
      <div className="bg-success-50 border border-success-200 rounded-lg p-md mb-lg">
        <p className="font-sans text-success-800">
          <strong className="font-heading">✓ Véhicule configuré:</strong> Peugeot 208 1.6 HDi 2016
        </p>
      </div>

      <AdvancedFilters
        values={filters}
        onChange={setFilters}
        brands={MOCK_BRANDS}
        categories={MOCK_CATEGORIES}
        resultCount={5}
        totalCount={MOCK_PRODUCTS.length}
      />
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 EXEMPLE 4: Showcase Complet (Tous les États)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function AdvancedFiltersShowcase() {
  const [scenario, setScenario] = useState<'empty' | 'partial' | 'full'>('empty');

  const filtersEmpty: FilterValues = {};
  
  const filtersPartial: FilterValues = {
    brand: 'Renault',
    category: 'Freinage',
    inStockOnly: true,
  };
  
  const filtersFull: FilterValues = {
    brand: 'Peugeot',
    model: '208',
    year: 2016,
    engine: '1.6 HDi',
    category: 'Freinage',
    oemRef: '7701',
    priceMin: 20,
    priceMax: 100,
    inStockOnly: true,
    compatibleOnly: true,
  };

  const currentFilters = {
    empty: filtersEmpty,
    partial: filtersPartial,
    full: filtersFull,
  }[scenario];

  return (
    <div className="min-h-screen bg-neutral-50 py-xl px-md">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-heading text-4xl font-bold text-neutral-900 mb-xl text-center">
          🔍 Advanced Filters - Showcase
        </h1>

        {/* Switcher scénarios */}
        <div className="bg-white rounded-lg shadow-md p-md mb-xl">
          <h2 className="font-heading text-sm font-bold text-neutral-900 mb-sm">
            🎬 Scénarios de démonstration
          </h2>
          <div className="flex flex-wrap gap-sm">
            <button
              onClick={() => setScenario('empty')}
              className={`
                px-md py-sm rounded-lg font-heading text-sm transition-colors
                ${scenario === 'empty' ? 'bg-primary-500 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}
              `}
            >
              Vide (0 filtre)
            </button>
            <button
              onClick={() => setScenario('partial')}
              className={`
                px-md py-sm rounded-lg font-heading text-sm transition-colors
                ${scenario === 'partial' ? 'bg-primary-500 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}
              `}
            >
              Partiel (3 filtres)
            </button>
            <button
              onClick={() => setScenario('full')}
              className={`
                px-md py-sm rounded-lg font-heading text-sm transition-colors
                ${scenario === 'full' ? 'bg-primary-500 text-white' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}
              `}
            >
              Complet (10 filtres)
            </button>
          </div>
        </div>

        {/* Filtres */}
        <AdvancedFilters
          values={currentFilters}
          onChange={(newFilters) => console.log('Filtres:', newFilters)}
          onReset={() => console.log('Reset')}
          brands={MOCK_BRANDS}
          categories={MOCK_CATEGORIES}
          resultCount={scenario === 'empty' ? 156 : scenario === 'partial' ? 42 : 8}
          totalCount={156}
        />

        {/* Documentation */}
        <div className="mt-xl bg-white rounded-lg shadow-md p-xl">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-lg">
            📚 Features
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-md">
              <h3 className="font-heading text-lg font-bold text-secondary-900 mb-sm">
                🎯 Multi-critères
              </h3>
              <ul className="font-sans text-sm text-secondary-700 space-y-xs">
                <li>• Marque, modèle, année, moteur</li>
                <li>• Catégorie, référence OEM</li>
                <li>• Prix min/max</li>
                <li>• Stock, compatibilité</li>
              </ul>
            </div>

            <div className="bg-primary-50 border border-primary-200 rounded-lg p-md">
              <h3 className="font-heading text-lg font-bold text-primary-900 mb-sm">
                🏷️ Tags Visuels
              </h3>
              <ul className="font-sans text-sm text-primary-700 space-y-xs">
                <li>• Affichage clair des filtres actifs</li>
                <li>• Cliquable pour supprimer</li>
                <li>• Exemple: "Peugeot 208 2016 • diesel • freinage"</li>
              </ul>
            </div>

            <div className="bg-success-50 border border-success-200 rounded-lg p-md">
              <h3 className="font-heading text-lg font-bold text-success-900 mb-sm">
                🔄 Reset Clair
              </h3>
              <ul className="font-sans text-sm text-success-700 space-y-xs">
                <li>• Bouton visible et accessible</li>
                <li>• Compteur filtres actifs</li>
                <li>• Compteur résultats en temps réel</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdvancedFiltersShowcase;
