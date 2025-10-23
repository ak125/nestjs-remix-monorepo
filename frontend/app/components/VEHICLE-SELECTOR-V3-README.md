# 🚗 VehicleSelector v3 - Design System Integration

## 📋 Vue d'ensemble

**VehicleSelector v3** est un composant de sélection de véhicule modernisé qui utilise le Design System @fafa/ui. Il remplace les `<select>` natifs par des composants **Combobox** génériques avec recherche, keyboard navigation et variants CVA.

## 🎯 Objectifs

- ✅ **Design System ready** : Utilise composants @fafa/ui (Combobox + CSS variables)
- ✅ **Cascade intelligente** : Marque → Modèle → Type avec chargement dynamique
- ✅ **Type Mine search** : Recherche par code carte grise (case D.2)
- ✅ **A11y compliant** : ARIA labels, keyboard nav, focus-visible
- ✅ **Thème-agnostic** : CSS variables pour multi-thèmes (vitrine/admin + dark mode)
- ✅ **TypeScript strict** : Types pour Brand, Model, Type, TypeMineSearchResult

## 📦 Architecture

### Séparation des responsabilités

```
┌─────────────────────────────────────────────────────────────┐
│ @fafa/ui (Design System)                                     │
│ ├─ Combobox (générique, headless, réutilisable)            │
│ ├─ CVA variants (size, density, radius, state)             │
│ └─ CSS variables (thème-agnostic)                           │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ consomme
                            │
┌─────────────────────────────────────────────────────────────┐
│ frontend/app/components (Business Logic)                    │
│ ├─ VehicleSelectorV3 (métier Automecanik)                  │
│ ├─ API calls (/api/vehicles/brands, models, types)         │
│ ├─ State management (cascade, loading)                     │
│ └─ Domain types (Brand, Model, Type, TypeMineSearchResult) │
└─────────────────────────────────────────────────────────────┘
```

### Composants

#### 1. **Combobox** (`@fafa/ui`)
Composant générique de sélection avec recherche :
- Radix UI Popover (dropdown positioning)
- cmdk (Command palette avec search + keyboard nav)
- CVA variants : `size`, `density`, `radius`, `state`
- Props : `items`, `value`, `onChange`, `renderItem`, `loading`, `disabled`
- Features : Search, keyboard (Arrow Up/Down, Enter, Escape), ARIA labels

#### 2. **VehicleSelectorV3** (`frontend/app/components`)
Pattern métier pour sélection véhicule :
- **3 Combobox** en cascade : Marque → Modèle → Type
- **Type Mine search** : Input + résultats dropdown
- **API integration** : fetch `/api/vehicles/{brands,models,types}`
- **Custom rendering** : Affichage puissance, carburant, années
- **Callbacks** : `onVehicleSelect(vehicle)`

## 🎨 Features Design System

### CVA Variants supportés

```typescript
<VehicleSelectorV3
  size="sm" | "md" | "lg"           // Hauteur des Combobox
  density="compact" | "comfy"       // Espacement interne
  radius="sm" | "md" | "lg" | "full" // Border radius
/>
```

### CSS Variables utilisées

```css
/* Couleurs */
--color-primary-50, --color-primary-100, --color-primary-500, --color-primary-600, --color-primary-700
--text-primary, --text-secondary, --text-tertiary, --text-inverse
--bg-primary, --bg-secondary
--border-primary

/* Tokens sémantiques */
--color-success, --color-error, --color-warning
```

### Accessibilité (a11y)

- ✅ `aria-label` sur chaque Combobox
- ✅ `focus-visible:ring` avec couleurs tokens
- ✅ Keyboard navigation (Arrow Up/Down, Enter, Escape)
- ✅ WCAG 2.1 AA compliance (contraste validé)
- ✅ `disabled` states avec `cursor-not-allowed`

## 📖 Usage

### Installation

Le composant est disponible dans `/frontend/app/components/vehicle-selector-v3.tsx`.

### Exemple basique

```tsx
import { VehicleSelectorV3 } from '~/components/vehicle-selector-v3';

function MyPage() {
  return (
    <VehicleSelectorV3
      onVehicleSelect={(vehicle) => {
        console.log('Véhicule sélectionné:', vehicle);
      }}
    />
  );
}
```

### Exemple avancé

```tsx
import { VehicleSelectorV3 } from '~/components/vehicle-selector-v3';
import { useState } from 'react';

function CheckoutPage() {
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  return (
    <div>
      <VehicleSelectorV3
        preselectedBrand={42}              // Présélection marque (optionnel)
        enableTypeMineSearch={true}        // Activer recherche Type Mine
        size="lg"                          // Grande taille
        density="comfy"                    // Espacements généreux
        radius="md"                        // Border radius medium
        onVehicleSelect={(vehicle) => {
          setSelectedVehicle(vehicle);
          // Appel API, navigation, etc.
        }}
      />

      {selectedVehicle && (
        <div>
          <h3>Véhicule sélectionné:</h3>
          <p>{selectedVehicle.type_name}</p>
          <p>{selectedVehicle.type_power_ps} ch</p>
        </div>
      )}
    </div>
  );
}
```

## 🔧 Props API

### VehicleSelectorV3Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `preselectedBrand` | `number` | `undefined` | ID marque présélectionnée |
| `onVehicleSelect` | `(vehicle) => void` | `undefined` | Callback sélection finale |
| `enableTypeMineSearch` | `boolean` | `true` | Activer recherche Type Mine |
| `className` | `string` | `""` | Classes CSS additionnelles |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Taille Combobox |
| `density` | `'compact' \| 'comfy'` | `'comfy'` | Espacement interne |
| `radius` | `'sm' \| 'md' \| 'lg' \| 'full'` | `'md'` | Border radius |

### Vehicle Type (callback)

```typescript
{
  cgc_type_id: number;
  type_name: string;
  type_alias: string;
  type_power_ps?: number;
  type_power_kw?: number;
  type_fuel?: string;
  type_engine_code?: string;
  type_mine?: string;
  type_year_from?: number;
  type_year_to?: number;
  type_month_from?: number;
  type_month_to?: number;
  parts_count?: number;
  marque_id: number;
  modele_id: number;
}
```

## 🚀 Features Métier

### 1. Cascade Marque → Modèle → Type

Chargement automatique des dépendances :
- Sélection **Marque** → charge les **Modèles** de cette marque
- Sélection **Modèle** → charge les **Types** (motorisations) de ce modèle
- Sélection **Type** → déclenche `onVehicleSelect(vehicle)`

### 2. Recherche Type Mine

Mode alternatif pour recherche par code carte grise (case D.2) :
- Toggle button "Type Mine" dans le header
- Input avec icône recherche
- Debounce automatique (3+ caractères)
- Résultats avec marque, modèle, puissance, carburant
- Aide contextuelle : "Le type mine se trouve sur votre carte grise..."

### 3. Custom Rendering

Affichage enrichi dans les Combobox :
- **Marque** : Nom + nombre de modèles
- **Modèle** : Nom + années (year_from-year_to) + nombre de types
- **Type** : Nom + puissance (ch) + carburant + Type Mine

### 4. Loading States

Indicateurs visuels de chargement :
- `loading={true}` sur Combobox pendant fetch API
- Texte "Chargement..." dans placeholder
- `disabled={true}` sur Combobox dépendants (ex: Modèle si pas de Marque)

## 🛠️ API Endpoints

Le composant utilise les endpoints suivants (backend à implémenter) :

```
GET /api/vehicles/brands
  → { data: Brand[] }

GET /api/vehicles/models/brand/:brandId
  → { data: VehicleModel[] }

GET /api/vehicles/types/model/:modelId
  → { data: VehicleType[] }

GET /api/vehicles/search/mine/:query
  → { data: TypeMineSearchResult[] }
```

## 🎭 Showcase

Le composant est présenté dans `/ui-kit/patterns` avec :
- **Live demo** interactif
- **Affichage véhicule sélectionné** (Type, Puissance, Carburant, Type Mine)
- **Features list** (Design System + Métier)
- **Code example** prêt à copier-coller

URL : `http://localhost:3000/ui-kit/patterns`

## 🆚 Comparaison avec v2

| Feature | v2 (advanced-vehicle-selector) | v3 (vehicle-selector-v3) |
|---------|--------------------------------|--------------------------|
| UI Components | `<select>` natifs + lucide-react | Combobox @fafa/ui |
| CSS | Custom CSS classes | CSS variables tokens |
| Recherche | Aucune (select standard) | Recherche temps réel (cmdk) |
| Keyboard Nav | Tab seulement | Arrow Up/Down, Enter, Escape |
| A11y | Basique | ARIA labels + focus-visible |
| Themes | Hardcodé | Multi-thèmes (vitrine/admin + dark) |
| Variants | Aucun | CVA (size, density, radius) |
| TypeScript | Basique | Types stricts + ComboboxItem |
| Build Size | N/A (inline) | 31.72 KB ESM (Combobox inclus) |

## 🧪 Tests

À implémenter :
- [ ] Tests Playwright (sélection cascade)
- [ ] Tests a11y (@axe-core)
- [ ] Tests visuels (snapshots)
- [ ] Tests API mocks (MSW)

## 🔮 Évolutions futures

- [ ] Support années (désactivé temporairement)
- [ ] Recherche multi-critères (marque + puissance + carburant)
- [ ] Favoris véhicules (localStorage)
- [ ] Historique sélections
- [ ] Export vers @fafa/patterns (extraction pattern réutilisable)
- [ ] Storybook stories

## 📝 Notes techniques

### Pourquoi 2 modes (Cascade vs Type Mine) ?

- **Cascade** : Workflow standard, guidage utilisateur, découverte
- **Type Mine** : Recherche rapide pour utilisateurs connaissant leur code carte grise

### Gestion des états

Le composant utilise 7 `useState` :
- `brands`, `models`, `types` : Données API
- `selectedBrandId`, `selectedModelId`, `selectedTypeId` : Sélections utilisateur
- `typeMineQuery`, `typeMineResults` : Recherche Type Mine
- `isTypeMineMode` : Toggle mode
- `loadingBrands`, `loadingModels`, `loadingTypes`, `loadingTypeMine` : Loading states

### Performance

- Pas de re-fetch inutile (useEffect avec deps strictes)
- Debounce Type Mine search (3+ caractères)
- Disabled states pour bloquer actions invalides

## 📚 Ressources

- [Combobox source code](../../packages/ui/src/components/combobox.tsx)
- [Radix UI Popover](https://www.radix-ui.com/docs/primitives/components/popover)
- [cmdk](https://cmdk.paco.me/)
- [CVA docs](https://cva.style/docs)

---

**Auteur** : Design System FAFA  
**Version** : 3.0.0  
**Dernière mise à jour** : 2025-10-23
