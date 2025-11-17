# 🎨 Guide de Migration des Pages Produits vers Design Tokens

## 🎯 Objectif

Migrer les pages produits (ex: `/pieces/bougie-de-prechauffage-243.html`) vers le design system avec tokens, tout en maintenant une architecture modulaire cohérente avec `_index.tsx`.

---

## 📋 Composants à Migrer

### Page Principale : `pieces.$slug.tsx`

#### Composants Utilisés
1. ✅ **Breadcrumbs** - Navigation fil d'Ariane
2. 🔄 **VehicleSelectorV2** - Sélecteur de véhicule
3. 🔄 **VehicleFilterBadge** - Badge de filtrage
4. 🔄 **PerformanceIndicator** - Indicateur de performance
5. 🔄 **CatalogueSection** - Section catalogue produits
6. 🔄 **MotorisationsSection** - Section motorisations
7. 🔄 **EquipementiersSection** - Section équipementiers
8. 🔄 **ConseilsSection** - Section conseils
9. 🔄 **GuideSection** - Section guide
10. 🔄 **InformationsSection** - Section informations

---

## 🎨 Mapping des Tokens

### Couleurs de Base

| Usage | Hardcodé (Avant) | Token (Après) | Notes |
|-------|------------------|---------------|-------|
| **Action primaire** | `bg-blue-600 hover:bg-blue-700` | `bg-semantic-action hover:bg-semantic-action/90` | Boutons CTA |
| **Info/Liens** | `text-blue-600 hover:text-blue-800` | `text-semantic-info hover:text-semantic-info/80` | Liens, badges info |
| **Succès** | `bg-green-50 text-green-700` | `bg-semantic-success/10 text-semantic-success` | Messages de succès |
| **Warning** | `bg-orange-50 text-orange-700` | `bg-semantic-warning/10 text-semantic-warning` | Messages d'alerte |
| **Danger** | `bg-red-50 text-red-700` | `bg-semantic-danger/10 text-semantic-danger` | Messages d'erreur |
| **Neutre/Texte** | `text-gray-600` | `text-neutral-600` | Texte secondaire |
| **Neutre/Bordure** | `border-gray-300` | `border-neutral-300` | Bordures |
| **Neutre/Fond** | `bg-gray-50` | `bg-neutral-50` | Backgrounds légers |

### États Interactifs

| État | Hardcodé | Token |
|------|----------|-------|
| **Focus ring** | `focus:ring-blue-500` | `focus:ring-semantic-info` |
| **Focus border** | `focus:border-blue-500` | `focus:border-semantic-info` |
| **Hover CTA** | `hover:bg-blue-700` | `hover:bg-semantic-action/90` |
| **Active** | `active:bg-blue-800` | `active:bg-semantic-action/80` |
| **Disabled** | `disabled:bg-gray-300` | `disabled:bg-neutral-300 disabled:opacity-50` |

---

## 🏗️ Architecture Modulaire Recommandée

### Structure des Composants

```
frontend/app/
├── routes/
│   └── pieces.$slug.tsx                    # ← Page principale (orchestration)
├── components/
│   ├── pieces/
│   │   ├── CatalogueSection.tsx           # Section catalogue
│   │   ├── MotorisationsSection.tsx       # Section motorisations
│   │   ├── EquipementiersSection.tsx      # Section équipementiers
│   │   ├── ConseilsSection.tsx            # Section conseils
│   │   ├── GuideSection.tsx               # Section guide
│   │   ├── InformationsSection.tsx        # Section informations
│   │   ├── PerformanceIndicator.tsx       # Indicateur perf
│   │   ├── ProductCard.tsx                # 🆕 Card produit réutilisable
│   │   └── PriceDisplay.tsx               # 🆕 Affichage prix
│   ├── vehicle/
│   │   ├── VehicleSelectorV2.tsx          # Sélecteur véhicule
│   │   └── VehicleFilterBadge.tsx         # Badge filtre
│   └── ui/
│       ├── button.tsx                      # ✅ Déjà avec tokens
│       ├── card.tsx                        # ✅ Déjà avec tokens
│       └── badge.tsx                       # ✅ Déjà avec tokens
```

### Principes d'Architecture

#### 1. **Composants Atomiques** (ui/)
- Boutons, cards, badges, inputs
- **100% tokenisés**
- Pas de logique métier
- Hautement réutilisables

#### 2. **Composants de Domaine** (pieces/, vehicle/)
- Logique métier spécifique
- Utilisent les composants atomiques
- Peuvent contenir des tokens pour des cas spécifiques
- Modulaires et testables

#### 3. **Pages** (routes/)
- Orchestration des composants
- Gestion du state
- Chargement des données (loader)
- **Minimal de styles directs**

---

## 🔄 Plan de Migration par Priorité

### Phase 1 : Composants UI Critiques (Haute Visibilité)

#### 1.1 **Boutons CTA** (Impact Immédiat)
```tsx
// ❌ AVANT
<button className="bg-blue-600 hover:bg-blue-700 text-white">
  Voir les pièces
</button>

// ✅ APRÈS
<Button 
  variant="default" 
  className="bg-semantic-action hover:bg-semantic-action/90 text-semantic-action-contrast"
>
  Voir les pièces
</Button>
```

#### 1.2 **Liens et Navigation**
```tsx
// ❌ AVANT
<Link className="text-blue-600 hover:text-blue-800">
  En savoir plus
</Link>

// ✅ APRÈS
<Link className="text-semantic-info hover:text-semantic-info/80">
  En savoir plus
</Link>
```

#### 1.3 **Prix et Indicateurs Financiers**
```tsx
// ❌ AVANT
<span className="text-2xl font-bold text-blue-600">
  49,99 €
</span>

// ✅ APRÈS
<span className="text-2xl font-bold text-semantic-info">
  49,99 €
</span>
```

### Phase 2 : Composants Sections (Contenu)

#### 2.1 **CatalogueSection**
- Headers de section : `bg-neutral-50 border-neutral-200`
- Cards produits : Utiliser `<Card>` avec tokens
- Badges disponibilité : `semantic-success` / `semantic-warning`

#### 2.2 **MotorisationsSection**
- Cards motorisations : `border-neutral-300`
- Badges puissance : `bg-semantic-info/10 text-semantic-info`
- Liens techniques : `text-semantic-info hover:text-semantic-info/80`

#### 2.3 **EquipementiersSection**
- Logos équipementiers : `border-neutral-200`
- Hover states : `hover:border-semantic-info`

### Phase 3 : Composants Interactifs

#### 3.1 **VehicleSelectorV2**
- Inputs : `focus:ring-semantic-info focus:border-semantic-info`
- Dropdown : `border-neutral-300 bg-white`
- Selected : `bg-semantic-info/10 text-semantic-info`

#### 3.2 **VehicleFilterBadge**
- Badge actif : `bg-semantic-info text-semantic-info-contrast`
- Badge inactif : `bg-neutral-100 text-neutral-700`
- Close button : `hover:bg-semantic-danger/10 text-semantic-danger`

---

## 📝 Checklist de Migration par Composant

### Template de Migration

Pour chaque composant, suivre ces étapes :

```markdown
## Composant : [NOM]

### 1. Audit
- [ ] Identifier tous les `blue-`, `gray-`, `slate-`, `green-`, `red-`, `orange-`
- [ ] Lister les états interactifs (hover, focus, active)
- [ ] Noter les cas spéciaux (gradients, ombres)

### 2. Mapping
- [ ] Créer un tableau de mapping (Avant → Après)
- [ ] Valider avec le design system
- [ ] Identifier les tokens manquants

### 3. Migration
- [ ] Remplacer les couleurs une par une
- [ ] Tester visuellement chaque état
- [ ] Vérifier les contrastes WCAG AA

### 4. Tests
- [ ] Test visuel : Aucun changement visible
- [ ] Test interactions : Hover, focus, active
- [ ] Test responsive : Mobile, tablette, desktop
- [ ] Test accessibilité : Contraste, keyboard navigation

### 5. Documentation
- [ ] Ajouter des commentaires si nécessaire
- [ ] Mettre à jour le composant dans Storybook (si applicable)
- [ ] Commit avec message descriptif
```

---

## 🎨 Exemples Concrets

### Exemple 1 : ProductCard

```tsx
// ❌ AVANT
export function ProductCard({ product }: Props) {
  return (
    <div className="border border-gray-300 rounded-lg p-4 hover:shadow-lg">
      <img src={product.image} alt={product.name} />
      <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>
      <p className="text-gray-600">{product.description}</p>
      <div className="flex items-center justify-between mt-4">
        <span className="text-2xl font-bold text-blue-600">{product.price} €</span>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
          Ajouter au panier
        </button>
      </div>
      {product.inStock ? (
        <span className="inline-block mt-2 text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
          ✓ En stock
        </span>
      ) : (
        <span className="inline-block mt-2 text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded">
          ⏱ Délai 5-7 jours
        </span>
      )}
    </div>
  );
}

// ✅ APRÈS
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

export function ProductCard({ product }: Props) {
  return (
    <Card className="hover:shadow-xl transition-shadow duration-slower">
      <CardContent className="p-4">
        <img src={product.image} alt={product.name} />
        <h3 className="text-lg font-bold text-neutral-900">{product.name}</h3>
        <p className="text-neutral-600">{product.description}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-2xl font-bold text-semantic-info">{product.price} €</span>
          <Button 
            variant="default"
            className="bg-semantic-action hover:bg-semantic-action/90 text-semantic-action-contrast"
          >
            Ajouter au panier
          </Button>
        </div>
        {product.inStock ? (
          <Badge 
            variant="outline"
            className="mt-2 bg-semantic-success/10 text-semantic-success border-semantic-success/20"
          >
            ✓ En stock
          </Badge>
        ) : (
          <Badge 
            variant="outline"
            className="mt-2 bg-semantic-warning/10 text-semantic-warning border-semantic-warning/20"
          >
            ⏱ Délai 5-7 jours
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
```

### Exemple 2 : Section Header

```tsx
// ❌ AVANT
<div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
  <h2 className="text-2xl font-bold text-gray-900">Catalogue des pièces</h2>
  <p className="text-gray-600">Trouvez les pièces compatibles avec votre véhicule</p>
</div>

// ✅ APRÈS
<div className="border-b border-neutral-200 bg-neutral-50 px-6 py-4">
  <h2 className="text-2xl font-bold text-neutral-900">Catalogue des pièces</h2>
  <p className="text-neutral-600">Trouvez les pièces compatibles avec votre véhicule</p>
</div>
```

### Exemple 3 : Form Input

```tsx
// ❌ AVANT
<input
  type="text"
  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  placeholder="Rechercher une pièce..."
/>

// ✅ APRÈS
<input
  type="text"
  className="border border-neutral-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-semantic-info focus:border-semantic-info"
  placeholder="Rechercher une pièce..."
/>
```

---

## 🚨 Pièges à Éviter

### ❌ Piège 1 : Remplacer Tous les Gris
```tsx
// ❌ MAUVAIS - Le gray-900 du texte principal ne doit PAS devenir neutral-900
<h1 className="text-neutral-900"> {/* Trop clair ! */}

// ✅ BON - Garder les gris foncés pour le texte principal
<h1 className="text-gray-900">
```

**Règle** : `gray-900`, `gray-800` pour texte principal → **NE PAS CHANGER**

### ❌ Piège 2 : Perdre les Contrastes
```tsx
// ❌ MAUVAIS - Contraste insuffisant
<button className="bg-semantic-info/30 text-semantic-info-contrast">

// ✅ BON - Contraste suffisant (WCAG AA)
<button className="bg-semantic-info text-semantic-info-contrast">
```

### ❌ Piège 3 : Sur-utiliser les Tokens Sémantiques
```tsx
// ❌ MAUVAIS - Tout n'est pas une "info"
<div className="border-semantic-info"> {/* Bordure trop visible */}

// ✅ BON - Utiliser neutral pour les éléments secondaires
<div className="border-neutral-300">
```

---

## 🧪 Tests de Validation

### Checklist Visuelle

Avant de commiter, vérifier :

- [ ] **Aucun changement visuel** perceptible
- [ ] **Hover states** fonctionnent identiquement
- [ ] **Focus states** sont visibles et cohérents
- [ ] **Responsive** : Mobile, tablette, desktop OK
- [ ] **Dark mode** (si applicable) : Pas de régression
- [ ] **Contrastes** : WCAG AA minimum (4.5:1 pour texte)

### Outils de Test

```bash
# 1. Lancer le frontend
npm run dev

# 2. Comparer visuellement
# Ouvrir http://localhost:5173/pieces/bougie-de-prechauffage-243.html
# Comparer avec la version main (screenshot ou split screen)

# 3. Vérifier les contrastes
# Utiliser l'extension "WCAG Color contrast checker" sur Chrome/Firefox
```

---

## 📊 Tracking de la Migration

### Composants Migrés

| Composant | Statut | Tokens Migrés | Tests | Notes |
|-----------|--------|---------------|-------|-------|
| **pieces.$slug.tsx** | 🔄 En cours | - | - | Page principale |
| **CatalogueSection** | ⏳ À faire | - | - | - |
| **MotorisationsSection** | ⏳ À faire | - | - | - |
| **EquipementiersSection** | ⏳ À faire | - | - | - |
| **ConseilsSection** | ⏳ À faire | - | - | - |
| **GuideSection** | ⏳ À faire | - | - | - |
| **InformationsSection** | ⏳ À faire | - | - | - |
| **VehicleSelectorV2** | ⏳ À faire | - | - | - |
| **VehicleFilterBadge** | ⏳ À faire | - | - | - |
| **PerformanceIndicator** | ⏳ À faire | - | - | - |

---

## 🎯 Récapitulatif

### Ce que Vous Devez Faire

1. **Suivre l'ordre de priorité** (Phase 1 → 2 → 3)
2. **Utiliser la checklist** pour chaque composant
3. **Tester visuellement** avant de commiter
4. **Documenter** les cas spéciaux
5. **Valider l'ordre du catalogue** avec `./scripts/validate-catalog-order.sh`

### Ressources

- **Design Tokens** : `packages/design-tokens/src/tokens.json`
- **Tailwind Config** : `packages/design-tokens/tailwind.config.js`
- **Composants UI** : `frontend/app/components/ui/`
- **Exemple Migré** : `frontend/app/routes/_index.tsx`

---

**Créé le :** 10 novembre 2025  
**Version :** 1.0.0  
**Status :** 📝 Guide de référence
