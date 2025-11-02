# 🔍 Advanced Filters - Documentation Complète

## Vue d'ensemble

**Emplacement**: `frontend/app/components/ecommerce/AdvancedFilters.tsx`  
**Lignes**: ~600  
**Status**: ✅ Production Ready  
**Dernière mise à jour**: 2025

### Rôle

Composant de filtrage multi-critères optimisé pour un **catalogue automobile garage**. Permet aux utilisateurs de filtrer les produits par véhicule, catégorie, prix, stock et compatibilité avec **affichage visuel des filtres actifs** sous forme de tags cliquables.

---

## 🎯 Features Principales

### ✅ Multi-critères

- **Véhicule**: Marque, modèle, année, moteur
- **Produit**: Catégorie, référence OEM
- **Prix**: Min/Max
- **Options**: Stock uniquement, Compatible uniquement

### 🏷️ Tags Visuels Actifs

```tsx
// Exemple d'affichage
Peugeot • 208 • 2016 • diesel • freinage • 20-100€
```

- Chaque filtre actif apparaît comme un **tag cliquable**
- Cliquer sur un tag **supprime ce filtre**
- Tags affichés en permanence (au-dessus du formulaire)

### 🔄 Reset Clair

- Bouton "Réinitialiser" visible **uniquement quand filtres actifs**
- Badge compteur sur bouton "Appliquer"
- Compteur résultats en temps réel

### 📱 Responsive

- **Mobile**: Filtres repliables par défaut
- **Desktop**: Filtres visibles
- Adaptation automatique grille → colonne

---

## 📋 Props API

```typescript
interface AdvancedFiltersProps {
  // État des filtres (contrôlé)
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onReset?: () => void;

  // Data sources
  brands?: string[];         // Liste marques disponibles
  categories?: string[];     // Liste catégories disponibles

  // Affichage résultats
  resultCount?: number;      // Nombre résultats filtrés
  totalCount?: number;       // Total produits

  // Options d'affichage
  collapsed?: boolean;       // Fermé par défaut (mobile)
  showVehicleFilters?: boolean; // Afficher section véhicule
  showPriceFilter?: boolean;    // Afficher filtres prix
  showStockFilter?: boolean;    // Afficher options stock
}
```

### FilterValues (Type)

```typescript
interface FilterValues {
  // Véhicule
  brand?: string;      // ex: "Peugeot"
  model?: string;      // ex: "208"
  year?: number;       // ex: 2016
  engine?: string;     // ex: "1.6 HDi"

  // Produit
  category?: string;   // ex: "Freinage"
  oemRef?: string;     // ex: "7701208265"

  // Prix
  priceMin?: number;   // ex: 20
  priceMax?: number;   // ex: 100

  // Options
  inStockOnly?: boolean;      // ex: true
  compatibleOnly?: boolean;   // ex: true
}
```

### FilterTag (Interne)

```typescript
interface FilterTag {
  key: string;         // Identifiant unique (ex: "brand")
  label: string;       // Label affiché (ex: "Marque")
  value: string;       // Valeur affichée (ex: "Peugeot")
  removable: boolean;  // Si cliquable pour suppression
}
```

---

## 🎨 Design System Integration

### Couleurs Utilisées

| Élément | Couleur | Usage |
|---------|---------|-------|
| **Bouton Appliquer** | `bg-secondary-500` | Navigation (bleu #0F4C81) |
| **Tags actifs** | `bg-primary-500` | CTA (rouge #FF3B30) |
| **Checkboxes** | `bg-success-500` | Validation (vert #27AE60) |
| **Barre tags / Footer** | `bg-neutral-50` | Arrière-plan clair |
| **Inputs focus** | `border-secondary-500` | État focus |

### Typographie

| Élément | Font | Taille | Usage |
|---------|------|--------|-------|
| Titres sections | `font-heading` | `text-lg` | "Filtres avancés", "Véhicule" |
| Labels inputs | `font-sans` | `text-sm` | "Marque", "Catégorie" |
| Inputs année/prix/OEM | `font-mono` | `text-base` | Données techniques |
| Boutons | `font-heading` | `text-sm` | CTA, Reset |

### Espacement (8px Grid)

| Zone | Spacing | Valeur |
|------|---------|--------|
| **Padding container** | `p-md` | 16px |
| **Gap sections** | `gap-lg` | 24px |
| **Gap inputs** | `gap-sm` | 8px |
| **Gap tags** | `gap-xs` | 4px |
| **Margin sections** | `mb-md` | 16px |

---

## 📦 Exemples d'Utilisation

### 1️⃣ Utilisation Basique

```tsx
import { AdvancedFilters, FilterValues } from '~/components/ecommerce/AdvancedFilters';

function CatalogPage() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [products, setProducts] = useState(allProducts);

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    
    // Appliquer filtres
    const filtered = allProducts.filter((p) => {
      if (newFilters.brand && p.brand !== newFilters.brand) return false;
      if (newFilters.category && p.category !== newFilters.category) return false;
      if (newFilters.priceMin && p.price < newFilters.priceMin) return false;
      if (newFilters.priceMax && p.price > newFilters.priceMax) return false;
      if (newFilters.inStockOnly && p.stock <= 0) return false;
      if (newFilters.compatibleOnly && !p.compatible) return false;
      return true;
    });
    
    setProducts(filtered);
  };

  return (
    <div>
      <AdvancedFilters
        values={filters}
        onChange={handleFilterChange}
        onReset={() => setFilters({})}
        brands={['Peugeot', 'Renault', 'Citroën']}
        categories={['Freinage', 'Filtration', 'Moteur']}
        resultCount={products.length}
        totalCount={allProducts.length}
      />
      
      {/* Affichage produits filtrés */}
      <div className="grid grid-cols-3 gap-lg">
        {products.map((p) => <ProductCard key={p.id} {...p} />)}
      </div>
    </div>
  );
}
```

### 2️⃣ Layout Sidebar (Desktop)

```tsx
function CatalogWithSidebar() {
  const [filters, setFilters] = useState<FilterValues>({});

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-lg">
      {/* Sidebar filtres (sticky sur desktop) */}
      <aside className="lg:col-span-1">
        <div className="sticky top-xl">
          <AdvancedFilters
            values={filters}
            onChange={setFilters}
            brands={brands}
            categories={categories}
            resultCount={filteredProducts.length}
            totalCount={allProducts.length}
          />
        </div>
      </aside>

      {/* Grille produits */}
      <main className="lg:col-span-3">
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-lg">
          {filteredProducts.map((p) => <ProductCard {...p} />)}
        </div>
      </main>
    </div>
  );
}
```

### 3️⃣ Avec Véhicule Pré-configuré

```tsx
function CatalogWithVehicle() {
  // Véhicule configuré depuis SmartHeader
  const savedVehicle = {
    brand: 'Peugeot',
    model: '208',
    year: 2016,
    engine: '1.6 HDi',
  };

  const [filters, setFilters] = useState<FilterValues>({
    ...savedVehicle,
    compatibleOnly: true, // Auto-activé si véhicule configuré
  });

  return (
    <>
      {/* Info véhicule */}
      <div className="bg-success-50 border border-success-200 rounded-lg p-md mb-lg">
        <p className="font-sans text-success-800">
          ✓ Véhicule configuré: {savedVehicle.brand} {savedVehicle.model} {savedVehicle.engine} {savedVehicle.year}
        </p>
      </div>

      <AdvancedFilters
        values={filters}
        onChange={setFilters}
        brands={brands}
        categories={categories}
        resultCount={compatibleProducts.length}
        totalCount={allProducts.length}
      />
    </>
  );
}
```

### 4️⃣ Mobile Collapsible

```tsx
function MobileCatalog() {
  const [filters, setFilters] = useState<FilterValues>({});

  return (
    <AdvancedFilters
      values={filters}
      onChange={setFilters}
      collapsed={true} // Fermé par défaut sur mobile
      brands={brands}
      categories={categories}
      resultCount={123}
      totalCount={456}
    />
  );
}
```

---

## 🏗️ Architecture Interne

### Structure Composant

```tsx
AdvancedFilters
├── Header
│   ├── Titre + Badge compteur filtres actifs
│   ├── Compteur résultats (X / Y)
│   └── Toggle mobile (visible < lg)
│
├── Barre Tags Actifs (toujours visible)
│   ├── Tag Marque (cliquable → remove)
│   ├── Tag Modèle (cliquable → remove)
│   ├── Tag Année (cliquable → remove)
│   └── ...autres tags dynamiques
│
├── Formulaire (collapsible mobile)
│   ├── Section Véhicule (optionnelle)
│   │   ├── Select Marque
│   │   ├── Input Modèle
│   │   ├── Input Année (number)
│   │   └── Input Moteur
│   │
│   ├── Section Produit (optionnelle)
│   │   ├── Select Catégorie
│   │   └── Input Référence OEM
│   │
│   ├── Section Prix (optionnelle)
│   │   ├── Input Prix Min (number)
│   │   └── Input Prix Max (number)
│   │
│   └── Section Options
│       ├── Checkbox En stock uniquement
│       └── Checkbox Compatible uniquement
│
└── Footer
    ├── Bouton Appliquer (Secondary-500 + badge)
    └── Bouton Reset (visible si filtres actifs)
```

### État Interne

```tsx
const [isCollapsed, setIsCollapsed] = useState(collapsed);
const [localValues, setLocalValues] = useState<FilterValues>(values);
```

- **localValues**: État local modifié lors saisie
- **values** (prop): État parent synchronisé au clic "Appliquer"
- **isCollapsed**: État collapse (mobile uniquement)

### Logique Tags Actifs

```tsx
// Génération automatique tags
const activeTags: FilterTag[] = [];

if (localValues.brand) {
  activeTags.push({
    key: 'brand',
    label: 'Marque',
    value: localValues.brand,
    removable: true,
  });
}

if (localValues.year) {
  activeTags.push({
    key: 'year',
    label: 'Année',
    value: String(localValues.year),
    removable: true,
  });
}

// ... etc pour tous les filtres
```

### Callbacks

#### `updateValue(key, value)`

Met à jour **localValues** en temps réel lors saisie.

```tsx
const updateValue = (key: keyof FilterValues, value: any) => {
  setLocalValues((prev) => ({
    ...prev,
    [key]: value || undefined,
  }));
};
```

#### `handleApply()`

Applique filtres → appelle **onChange(localValues)**.

```tsx
const handleApply = () => {
  onChange(localValues);
};
```

#### `handleRemoveTag(key)`

Supprime un filtre spécifique → appelle **onChange**.

```tsx
const handleRemoveTag = (key: string) => {
  const newValues = { ...localValues };
  delete newValues[key as keyof FilterValues];
  setLocalValues(newValues);
  onChange(newValues);
};
```

#### `handleReset()`

Réinitialise tous filtres → appelle **onReset()**.

```tsx
const handleReset = () => {
  setLocalValues({});
  if (onReset) {
    onReset();
  } else {
    onChange({});
  }
};
```

---

## 📱 Responsive Behavior

### Mobile (< 1024px)

- Filtres **repliés par défaut** (prop `collapsed={true}`)
- Toggle button visible en haut
- Tags actifs **toujours visibles** (scroll horizontal si nécessaire)
- Inputs **pleine largeur** (stack vertical)
- Footer buttons **stack vertical**

### Desktop (≥ 1024px)

- Filtres **visibles par défaut**
- Toggle button caché
- Grille 2 colonnes pour inputs
- Footer buttons horizontal

### Breakpoints

```tsx
// Toggle mobile uniquement
<button className="lg:hidden" />

// Grille responsive
<div className="grid grid-cols-1 md:grid-cols-2 gap-sm" />

// Sidebar sticky
<aside className="lg:col-span-1">
  <div className="sticky top-xl">
    <AdvancedFilters />
  </div>
</aside>
```

---

## ♿ Accessibilité

### Sémantique HTML

```tsx
<section aria-labelledby="filters-title">
  <h2 id="filters-title">Filtres avancés</h2>
  
  <div role="group" aria-label="Filtres actifs">
    {/* Tags */}
  </div>
  
  <form>
    <label htmlFor="brand-select">Marque</label>
    <select id="brand-select" />
  </form>
</section>
```

### Navigation Clavier

- Tous inputs accessibles via **Tab**
- Tags supprimables via **Enter/Space**
- Boutons accessibles au clavier
- Focus visible (ring-2 ring-secondary-500)

### Screen Readers

- Labels explicites sur tous inputs
- `aria-label` sur toggle button
- Compteur résultats annoncé
- Badge filtres actifs annoncé

---

## ⚡ Performance

### Optimisations

1. **État Local**: Modifications saisie n'appellent pas onChange (seulement au clic "Appliquer")
2. **Lazy Update**: onChange appelé uniquement quand nécessaire
3. **Mémoïsation Tags**: Tags calculés à chaque render (léger)
4. **Pas de re-render parent**: onChange contrôlé par parent

### Best Practices

```tsx
// ✅ BON: Filtrage côté parent, pas dans composant
function Parent() {
  const [filters, setFilters] = useState<FilterValues>({});
  
  const filteredProducts = useMemo(() => {
    return products.filter((p) => matchFilters(p, filters));
  }, [products, filters]);

  return <AdvancedFilters values={filters} onChange={setFilters} />;
}

// ❌ MAUVAIS: Filtrage dans AdvancedFilters
// (Responsabilité du composant parent)
```

---

## 🧪 Tests Suggérés

### Tests Unitaires (Jest/Vitest)

```tsx
describe('AdvancedFilters', () => {
  it('affiche compteur résultats', () => {
    render(<AdvancedFilters resultCount={42} totalCount={100} />);
    expect(screen.getByText(/42 \/ 100/)).toBeInTheDocument();
  });

  it('affiche tags actifs', () => {
    render(<AdvancedFilters values={{ brand: 'Peugeot' }} />);
    expect(screen.getByText('Peugeot')).toBeInTheDocument();
  });

  it('supprime tag au clic', () => {
    const onChange = jest.fn();
    render(<AdvancedFilters values={{ brand: 'Peugeot' }} onChange={onChange} />);
    
    fireEvent.click(screen.getByLabelText(/Supprimer Marque/));
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('reset tous filtres', () => {
    const onReset = jest.fn();
    render(<AdvancedFilters values={{ brand: 'Peugeot' }} onReset={onReset} />);
    
    fireEvent.click(screen.getByText(/Réinitialiser/));
    expect(onReset).toHaveBeenCalled();
  });
});
```

### Tests E2E (Playwright)

```tsx
test('filtrage catalogue complet', async ({ page }) => {
  await page.goto('/catalogue');
  
  // Ouvrir filtres (mobile)
  await page.click('text=Filtres avancés');
  
  // Sélectionner marque
  await page.selectOption('select[name="brand"]', 'Peugeot');
  
  // Saisir prix
  await page.fill('input[name="priceMin"]', '20');
  await page.fill('input[name="priceMax"]', '100');
  
  // Activer stock
  await page.check('input[name="inStockOnly"]');
  
  // Appliquer
  await page.click('text=Appliquer');
  
  // Vérifier tag affiché
  await expect(page.locator('text=Peugeot')).toBeVisible();
  await expect(page.locator('text=20 - 100 €')).toBeVisible();
  
  // Vérifier résultats filtrés
  await expect(page.locator('.product-card')).toHaveCount(8);
  
  // Supprimer tag marque
  await page.click('text=Peugeot >> .. >> button');
  await expect(page.locator('text=Peugeot')).not.toBeVisible();
  
  // Reset complet
  await page.click('text=Réinitialiser');
  await expect(page.locator('.product-card')).toHaveCount(156);
});
```

---

## 🔗 Intégration avec Autres Composants

### Avec SmartHeader (Véhicule)

```tsx
import { SmartHeader } from '~/components/ecommerce/SmartHeader';
import { AdvancedFilters } from '~/components/ecommerce/AdvancedFilters';

function CatalogPage() {
  const [savedVehicle, setSavedVehicle] = useState(null);
  const [filters, setFilters] = useState<FilterValues>({});

  // Quand véhicule configuré dans SmartHeader
  const handleVehicleSelect = (vehicle) => {
    setSavedVehicle(vehicle);
    
    // Auto-remplir filtres
    setFilters({
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      engine: vehicle.engine,
      compatibleOnly: true, // Auto-activé
    });
  };

  return (
    <>
      <SmartHeader
        savedVehicle={savedVehicle}
        onVehicleSelect={handleVehicleSelect}
      />
      
      <AdvancedFilters
        values={filters}
        onChange={setFilters}
        brands={brands}
        categories={categories}
      />
    </>
  );
}
```

### Avec ProductCard (Grille)

```tsx
import { ProductCard } from '~/components/ecommerce/ProductCard';
import { AdvancedFilters } from '~/components/ecommerce/AdvancedFilters';

function CatalogGrid() {
  const [filters, setFilters] = useState<FilterValues>({});
  const filteredProducts = useFilteredProducts(products, filters);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-lg">
      <aside className="lg:col-span-1">
        <AdvancedFilters
          values={filters}
          onChange={setFilters}
          resultCount={filteredProducts.length}
          totalCount={products.length}
        />
      </aside>
      
      <main className="lg:col-span-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-xl">
            <p>Aucun produit trouvé</p>
            <button onClick={() => setFilters({})}>
              Réinitialiser
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-lg">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                {...p}
                compactMode={true}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

---

## 🎨 Customization Options

### Masquer Sections

```tsx
// Uniquement filtres produit (pas véhicule)
<AdvancedFilters
  showVehicleFilters={false}
  showPriceFilter={true}
  showStockFilter={true}
/>

// Uniquement prix + stock
<AdvancedFilters
  showVehicleFilters={false}
  showPriceFilter={true}
  showStockFilter={true}
/>
```

### Custom Labels (via props futures)

```tsx
// À implémenter si besoin
<AdvancedFilters
  labels={{
    title: 'Recherche Avancée',
    applyButton: 'Filtrer',
    resetButton: 'Tout effacer',
  }}
/>
```

---

## 📊 Stats Composant

| Métrique | Valeur |
|----------|--------|
| **Lignes de code** | ~600 |
| **Interfaces** | 3 (FilterValues, FilterTag, AdvancedFiltersProps) |
| **Critères filtres** | 10 (brand, model, year, engine, category, oemRef, priceMin, priceMax, inStockOnly, compatibleOnly) |
| **Couleurs Design System** | 4 (Secondary, Primary, Success, Neutral) |
| **Fonts** | 3 (heading, sans, mono) |
| **Spacing values** | 5 (xs, sm, md, lg, xl) |
| **Responsive breakpoints** | 2 (md: 768px, lg: 1024px) |
| **État interne** | 2 (isCollapsed, localValues) |
| **Callbacks** | 4 (onChange, onReset, updateValue, handleApply, handleRemoveTag) |

---

## ✅ Checklist Intégration

- [ ] **Importer composant**: `import { AdvancedFilters } from '~/components/ecommerce/AdvancedFilters'`
- [ ] **Créer état**: `const [filters, setFilters] = useState<FilterValues>({})`
- [ ] **Passer brands/categories**: Récupérer depuis API
- [ ] **Implémenter logique filtrage**: Filtrer products selon FilterValues
- [ ] **Afficher compteur résultats**: Passer resultCount/totalCount
- [ ] **Tester responsive**: Mobile + Desktop
- [ ] **Vérifier accessibilité**: Navigation clavier, screen readers
- [ ] **Intégrer avec SmartHeader**: Pré-remplir véhicule si configuré
- [ ] **Intégrer avec ProductCard**: Afficher grille filtrée
- [ ] **Tests E2E**: Scénarios filtrage complets

---

## 🚀 Next Steps

1. **Persistence**: Sauvegarder filtres dans **localStorage** ou **URL query params**
2. **Analytics**: Tracker filtres populaires
3. **Suggestions**: Auto-complétion marque/modèle
4. **Performance**: Debounce inputs prix
5. **A/B Testing**: Tester position filtres (sidebar vs top)

---

## 📚 Voir Aussi

- [ECOMMERCE-SMART-HEADER.md](./ECOMMERCE-SMART-HEADER.md) - Header intelligent
- [ECOMMERCE-PRODUCT-CARD.md](./ECOMMERCE-PRODUCT-CARD.md) - Carte produit
- [GUIDE-IMPORT-CARDS.md](./GUIDE-IMPORT-CARDS.md) - Guide imports composants
- [ARCHITECTURE-AUDIT-COMPONENTS.md](./ARCHITECTURE-AUDIT-COMPONENTS.md) - Audit architecture
- [AdvancedFiltersExamples.tsx](./frontend/app/components/ecommerce/AdvancedFiltersExamples.tsx) - Exemples complets

---

**Version**: 1.0.0  
**Auteur**: Design System Team  
**License**: MIT
