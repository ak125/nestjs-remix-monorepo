import { useState } from 'react';
import { VehicleSelectorV3 } from '../components/vehicle-selector-v3';

export default function UIKitPatterns() {
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
          Patterns
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          Patterns compositionnels stateless (ProductCard, VehicleSelector, AdminShell)
        </p>
      </div>

      {/* Coming Soon */}
      <div className="bg-white dark:bg-secondary-900 border-2 border-[var(--border-primary)] rounded-lg p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            🚗 VehicleSelector v3 - Design System
          </h2>
          <p className="text-[var(--text-secondary)]">
            Sélecteur de véhicule modernisé avec composants @fafa/ui (Combobox + cascade)
          </p>
        </div>

        {/* Live Demo */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-6">
          <VehicleSelectorV3
            onVehicleSelect={(vehicle) => {
              setSelectedVehicle(vehicle);
              console.log('Véhicule sélectionné:', vehicle);
            }}
            enableTypeMineSearch={true}
            size="md"
            density="comfy"
            radius="md"
          />
        </div>

        {/* Selected Vehicle Display */}
        {selectedVehicle && (
          <div className="mt-6 p-4 bg-[var(--color-primary-50)] border-2 border-[var(--color-primary-500)] rounded-lg">
            <h4 className="font-semibold text-[var(--color-primary-700)] mb-2">
              ✅ Véhicule sélectionné
            </h4>
            <div className="text-sm text-[var(--color-primary-900)] space-y-1">
              <div><strong>Type:</strong> {selectedVehicle.type_name}</div>
              {selectedVehicle.type_power_ps && (
                <div><strong>Puissance:</strong> {selectedVehicle.type_power_ps} ch</div>
              )}
              {selectedVehicle.type_fuel && (
                <div><strong>Carburant:</strong> {selectedVehicle.type_fuel}</div>
              )}
              {selectedVehicle.type_mine && (
                <div><strong>Type Mine:</strong> <code className="px-1 bg-white rounded">{selectedVehicle.type_mine}</code></div>
              )}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-[var(--text-primary)]">🎨 Features Design System</h4>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1">
              <li>✅ Combobox générique @fafa/ui</li>
              <li>✅ CVA variants (size, density, radius)</li>
              <li>✅ CSS variables (thème-agnostic)</li>
              <li>✅ Recherche + keyboard navigation</li>
              <li>✅ Loading states</li>
              <li>✅ ARIA labels (a11y)</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-[var(--text-primary)]">🚀 Features Métier</h4>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1">
              <li>✅ Cascade Marque → Modèle → Type</li>
              <li>✅ Recherche Type Mine (carte grise)</li>
              <li>✅ API calls dynamiques</li>
              <li>✅ Custom rendering (puissance, carburant)</li>
              <li>✅ Callbacks onVehicleSelect</li>
              <li>✅ Types TypeScript stricts</li>
            </ul>
          </div>
        </div>

        {/* Code Example */}
        <div className="mt-8">
          <h4 className="font-semibold text-[var(--text-primary)] mb-3">📝 Usage</h4>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-4">
            <pre className="text-sm font-mono text-[var(--text-primary)] overflow-x-auto">
{`import { VehicleSelectorV3 } from '~/components/vehicle-selector-v3';

<VehicleSelectorV3
  onVehicleSelect={(vehicle) => {
    console.log('Selected:', vehicle);
  }}
  enableTypeMineSearch={true}
  size="md"
  density="comfy"
  radius="md"
/>`}
            </pre>
          </div>
        </div>
      </div>

      {/* Pattern Categories */}
      <div className="mt-12 grid gap-6">
        <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🛒</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">
                E-Commerce Patterns
              </h3>
              <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
                Patterns pour produits, panier, checkout
              </p>
              <div className="flex flex-wrap gap-2">
                {['ProductCard', 'ProductGrid', 'ProductDetail', 'CartItem', 'CartSummary', 'CheckoutForm'].map((pattern) => (
                  <span key={pattern} className="px-3 py-1 bg-secondary-100 text-xs font-mono text-secondary-700 rounded">
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🚗</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">
                Vehicle Patterns
              </h3>
              <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
                Patterns métier Automecanik (véhicules, pièces)
              </p>
              <div className="flex flex-wrap gap-2">
                {['VehicleSelector', 'VehicleCard', 'PartFinder', 'CompatibilityChecker', 'PartCard'].map((pattern) => (
                  <span key={pattern} className="px-3 py-1 bg-secondary-100 text-xs font-mono text-secondary-700 rounded">
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">👤</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">
                User Patterns
              </h3>
              <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
                Patterns utilisateur (profil, auth, préférences)
              </p>
              <div className="flex flex-wrap gap-2">
                {['UserProfile', 'UserAvatar', 'UserMenu', 'LoginForm', 'RegisterForm', 'PasswordReset'].map((pattern) => (
                  <span key={pattern} className="px-3 py-1 bg-secondary-100 text-xs font-mono text-secondary-700 rounded">
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">⚙️</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">
                Admin Patterns
              </h3>
              <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
                Patterns administration (tables, formulaires, dashboards)
              </p>
              <div className="flex flex-wrap gap-2">
                {['AdminShell', 'DataTable', 'FormBuilder', 'DashboardCard', 'StatsWidget', 'FilterPanel'].map((pattern) => (
                  <span key={pattern} className="px-3 py-1 bg-secondary-100 text-xs font-mono text-secondary-700 rounded">
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">📐</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-2">
                Layout Patterns
              </h3>
              <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
                Patterns layout (header, footer, sidebar, navigation)
              </p>
              <div className="flex flex-wrap gap-2">
                {['AppShell', 'Header', 'Footer', 'Sidebar', 'Breadcrumb', 'Pagination'].map((pattern) => (
                  <span key={pattern} className="px-3 py-1 bg-secondary-100 text-xs font-mono text-secondary-700 rounded">
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pattern Philosophy */}
      <div className="mt-12 bg-brand-50 border border-brand-200 rounded-lg p-6">
        <h3 className="font-bold text-brand-900 mb-3 flex items-center gap-2">
          <span>💡</span>
          <span>Philosophie des Patterns</span>
        </h3>
        
        <ul className="space-y-2 text-sm text-brand-700">
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span><strong>Stateless:</strong> Pas de useState, props in → JSX out</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span><strong>Composables:</strong> Assemblage de composants @fafa/ui</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span><strong>Métier:</strong> Encapsule logique domaine (ProductCard, VehicleSelector)</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span><strong>TypeScript:</strong> Types stricts pour props (Product, Vehicle, etc.)</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✗</span>
            <span><strong>Évite:</strong> Dépendances externes (API calls, routing, state management)</span>
          </li>
        </ul>
      </div>

      {/* Example Structure */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
          Exemple de structure
        </h2>

        <div className="bg-secondary-900 rounded-lg p-6">
          <pre className="text-sm font-mono text-green-400 overflow-x-auto">
{`// packages/patterns/src/patterns/ProductCard.tsx
import { Button, Badge, Card } from '@fafa/ui';
import type { Product } from '@fafa/shared-types';

interface ProductCardProps {
  product: Product;
  onAddToCart?: (id: string) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <Card className="p-space-4">
      <img src={product.image} alt={product.name} />
      <h3 className="text-lg font-bold text-secondary-900">
        {product.name}
      </h3>
      <Badge variant={product.inStock ? 'success' : 'error'}>
        {product.inStock ? 'En stock' : 'Épuisé'}
      </Badge>
      <Button 
        onClick={() => onAddToCart?.(product.id)}
        disabled={!product.inStock}
      >
        Ajouter au panier
      </Button>
    </Card>
  );
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
