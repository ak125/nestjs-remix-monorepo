# 🏗️ Stratégie de Migration Monorepo - Design System Unifié

> **Objectif**: Migrer les meilleurs composants vers `@fafa/ui` pour partage frontend + backend admin

## 📊 État Actuel (Octobre 2025)

### Architecture Existante

```
packages/
├── design-tokens/          ✅ Tokens centralisés (JSON + TS)
├── ui/                     ✅ Composants shadcn (Button, Input, Dialog...)
├── theme-admin/            ✅ Thème back-office
├── theme-automecanik/      ✅ Thème front-office
└── shared-types/           ✅ Types partagés

frontend/app/components/ecommerce/
├── ConversionButton.tsx    ⭐ À migrer (330 lignes)
├── SocialProof.tsx         ⭐ À migrer (380 lignes)
├── TechnicalReference.tsx  ⭐ À migrer (420 lignes)
├── MobileOptimizedCard.tsx ⭐ À migrer (480 lignes)
└── [13 autres composants]  🔍 À évaluer
```

### Problèmes Identifiés

❌ **Duplication**: `@fafa/ui/Button` vs `frontend/ConversionButton`  
❌ **Isolation**: Composants e-commerce non réutilisables par admin  
❌ **Incohérence**: Design tokens pas utilisés partout  
❌ **Maintenance**: Code dupliqué entre projets  
❌ **Tree-shaking**: Imports non optimisés  

---

## 🎯 Stratégie de Migration (4 Phases)

### Phase 1: Amélioration Button Existant ⭐ PRIORITÉ

**Objectif**: Fusionner `Button` + `ConversionButton` en un seul composant avec variantes CVA

#### Actions

1. **Analyser les forces de chaque implémentation**
   - `@fafa/ui/Button`: CVA + Radix, 7 intents, 6 sizes, bien structuré
   - `ConversionButton`: Analytics, animations succès, espacement respirant, mobile-first

2. **Ajouter variantes manquantes à Button**
   ```typescript
   // packages/ui/src/components/button.tsx
   
   const buttonVariants = cva(
     'inline-flex items-center justify-center gap-2 ...',
     {
       variants: {
         intent: {
           primary: '...',
           accent: '...',
           secondary: '...',
           success: '...',
           danger: '...',
           ghost: '...',
           outline: '...',
           link: '...',
           
           // 🎯 NOUVEAUX (de ConversionButton)
           conversion: 'bg-gradient-to-r from-[#FF3B30] to-[#FF6B30] text-white hover:from-[#E63428] hover:to-[#E65B28] shadow-lg hover:shadow-xl',
           urgent: 'bg-[#C0392B] text-white animate-pulse-soft shadow-xl',
         },
         size: {
           xs: 'h-7 px-2 text-xs',
           sm: 'h-8 px-3 text-sm',
           md: 'h-10 px-4 text-base',
           lg: 'h-12 px-6 text-lg',
           xl: 'h-14 px-8 text-xl',
           
           // 🎯 NOUVEAU (mobile-first)
           hero: 'h-16 px-10 text-2xl min-h-[64px]',
           icon: 'h-10 w-10 p-0',
         },
         // 🎯 NOUVEAUX
         breathing: {
           true: 'my-6 mx-auto',
           false: '',
         },
         fullWidthMobile: {
           true: 'w-full md:w-auto',
           false: 'w-auto',
         },
       }
     }
   );
   ```

3. **Ajouter props analytics + animations**
   ```typescript
   export interface ButtonProps extends ... {
     // Existing
     asChild?: boolean;
     
     // 🎯 NOUVEAUX
     onClickTracking?: (event: React.MouseEvent) => void;
     trackingLabel?: string;
     showSuccessAnimation?: boolean;
     breathing?: boolean;
     fullWidthMobile?: boolean;
   }
   ```

4. **Exporter variantes pré-configurées**
   ```typescript
   // packages/ui/src/components/button.tsx
   
   export function ConversionCTA(props: ButtonProps) {
     return <Button intent="conversion" size="hero" breathing {...props} />;
   }
   
   export function UrgentCTA(props: ButtonProps) {
     return <Button intent="urgent" size="lg" {...props} />;
   }
   
   export function MobileCTA(props: ButtonProps) {
     return <Button size="lg" fullWidthMobile breathing {...props} />;
   }
   ```

**Résultat**: Un seul `Button` ultra-flexible au lieu de 2 composants séparés

---

### Phase 2: Migration Composants Métier Conversion

**Objectif**: Migrer `SocialProof`, `TechnicalReference` vers `@fafa/ui`

#### 2.1 SocialProof → `@fafa/ui/social-proof`

```typescript
// packages/ui/src/components/social-proof.tsx

export {
  SalesCounter,
  RecentPurchases,
  TrustBadge,
  LiveActivity,
  InlineStat,
  SocialProofGroup,
} from './social-proof';
```

**Export modulaire**:
```json
// packages/ui/package.json
{
  "exports": {
    "./social-proof": {
      "types": "./dist/components/social-proof.d.ts",
      "import": "./dist/components/social-proof.js"
    }
  }
}
```

**Usage**:
```typescript
// frontend/app/routes/product.tsx
import { SalesCounter, TrustBadge } from '@fafa/ui/social-proof';

// backend/src/admin/dashboard.tsx
import { SalesCounter } from '@fafa/ui/social-proof';
```

#### 2.2 TechnicalReference → `@fafa/ui/technical-reference`

Même stratégie pour `OEMReference`, `TechnicalSpec`, etc.

---

### Phase 3: Migration Composants Layout Mobile

**Objectif**: Créer package dédié `@fafa/ui/mobile` ou intégrer dans `@fafa/ui`

#### Options

**Option A: Package séparé** (recommandé si >10 composants mobiles)
```
packages/ui-mobile/
├── src/
│   ├── mobile-product-card.tsx
│   ├── mobile-cart-summary.tsx
│   ├── thumb-zone.tsx
│   └── index.ts
└── package.json
```

**Option B: Sous-dossier ui/mobile** (plus simple)
```
packages/ui/src/
├── components/
│   ├── button.tsx
│   └── ...
├── mobile/
│   ├── mobile-product-card.tsx
│   ├── mobile-cart-summary.tsx
│   └── index.ts
└── index.ts
```

**Export**:
```json
{
  "exports": {
    "./mobile": {
      "types": "./dist/mobile/index.d.ts",
      "import": "./dist/mobile/index.js"
    }
  }
}
```

---

### Phase 4: Migration Hooks Analytics

**Objectif**: Créer `@fafa/analytics` ou `@fafa/hooks`

#### Structure Recommandée

```
packages/hooks/
├── src/
│   ├── use-conversion-tracking.tsx
│   ├── use-vehicle-persistence.tsx
│   ├── use-ab-test.tsx
│   ├── use-heatmap.tsx
│   └── index.ts
└── package.json
```

**Export modulaire**:
```typescript
// packages/hooks/src/index.ts
export { useConversionTracking } from './use-conversion-tracking';
export { useVehiclePersistence } from './use-vehicle-persistence';
export { useABTest } from './use-ab-test';
```

**Usage partagé**:
```typescript
// frontend/app/routes/product.tsx
import { useConversionTracking } from '@fafa/hooks';

// backend/src/admin/analytics.tsx
import { useConversionTracking } from '@fafa/hooks';
```

---

## 📦 Nouvelle Architecture Cible

```
packages/
├── design-tokens/          ✅ Tokens (JSON + TS)
│   └── src/tokens/design-tokens.json
│
├── ui/                     ⭐ AMÉLIORÉ
│   ├── components/
│   │   ├── button.tsx                  (+ conversion, urgent variants)
│   │   ├── social-proof.tsx            (NOUVEAU)
│   │   ├── technical-reference.tsx     (NOUVEAU)
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── mobile/                         (NOUVEAU)
│   │   ├── mobile-product-card.tsx
│   │   ├── mobile-cart-summary.tsx
│   │   └── thumb-zone.tsx
│   └── package.json
│
├── hooks/                  ⭐ NOUVEAU PACKAGE
│   └── src/
│       ├── use-conversion-tracking.tsx
│       ├── use-vehicle-persistence.tsx
│       └── use-ab-test.tsx
│
├── theme-admin/            ✅ Inchangé
├── theme-automecanik/      ✅ Inchangé
└── shared-types/           ✅ Inchangé
```

---

## 🔄 Plan de Migration Détaillé

### Étape 1: Améliorer Button (Semaine 1)

1. ✅ Copier variantes `conversion` et `urgent` de ConversionButton
2. ✅ Ajouter props `breathing`, `fullWidthMobile`, `trackingLabel`
3. ✅ Implémenter animations succès
4. ✅ Créer variantes pré-configurées (`ConversionCTA`, `UrgentCTA`, etc.)
5. ✅ Tests unitaires + Storybook
6. ✅ Mettre à jour `packages/ui/package.json` version
7. ✅ Publier sur npm (ou registry interne)

### Étape 2: Migrer SocialProof (Semaine 2)

1. ✅ Créer `packages/ui/src/components/social-proof.tsx`
2. ✅ Copier code de `frontend/app/components/ecommerce/SocialProof.tsx`
3. ✅ Remplacer couleurs hard-codées par tokens (`#FF3B30` → `var(--color-primary-500)`)
4. ✅ Ajouter export dans `packages/ui/src/components/index.ts`
5. ✅ Ajouter export modulaire dans `package.json`
6. ✅ Tests + Storybook
7. ✅ Migrer frontend vers import `@fafa/ui/social-proof`
8. ✅ Supprimer ancien fichier frontend

### Étape 3: Migrer TechnicalReference (Semaine 2)

Même processus que SocialProof

### Étape 4: Créer @fafa/hooks (Semaine 3)

1. ✅ Créer nouveau package `packages/hooks/`
2. ✅ Copier `useConversionTracking.tsx`
3. ✅ Copier `useVehiclePersistence.tsx`
4. ✅ Extraire `useABTest` et `useHeatmapTracking`
5. ✅ Configurer build (tsup)
6. ✅ Ajouter à turbo.json
7. ✅ Tests unitaires
8. ✅ Migrer imports frontend + backend

### Étape 5: Migrer Mobile Components (Semaine 4)

1. ✅ Créer `packages/ui/src/mobile/`
2. ✅ Copier `MobileOptimizedCard.tsx` → `mobile-product-card.tsx`
3. ✅ Remplacer hard-coded colors par tokens
4. ✅ Export modulaire
5. ✅ Tests responsive (Playwright)
6. ✅ Migrer frontend

---

## 🎨 Utilisation des Design Tokens

### Avant (hard-coded)

```typescript
// ❌ Mauvais
className="bg-[#FF3B30] text-white hover:bg-[#E63428]"
```

### Après (tokens)

```typescript
// ✅ Bon
className="bg-[var(--color-primary-500)] text-[var(--text-inverse)] hover:bg-[var(--color-primary-600)]"
```

### Avec Tailwind + tokens

```typescript
// tailwind.config.js (frontend + backend)
import tokens from '@fafa/design-tokens';

export default {
  theme: {
    extend: {
      colors: {
        primary: tokens.colors.primary,
        secondary: tokens.colors.secondary,
      }
    }
  }
}

// ✅ Usage
className="bg-primary-500 text-white hover:bg-primary-600"
```

---

## 📊 Métriques de Succès

### Avant Migration

- **Composants dupliqués**: 15
- **Lignes de code redondantes**: ~3,000
- **Temps ajout feature**: 2h (modifier frontend + backend)
- **Cohérence design**: 60%
- **Réutilisation code**: 40%

### Après Migration (Objectif)

- **Composants dupliqués**: 0
- **Lignes de code redondantes**: 0
- **Temps ajout feature**: 30min (1 seul endroit)
- **Cohérence design**: 95%
- **Réutilisation code**: 90%
- **Bundle size frontend**: -25% (tree-shaking)
- **Bundle size backend**: -30%

---

## 🚀 Usage Final (Après Migration)

### Frontend (Remix)

```typescript
// app/routes/product.tsx
import { ConversionCTA, UrgentCTA } from '@fafa/ui/button';
import { SalesCounter, TrustBadge } from '@fafa/ui/social-proof';
import { OEMReference } from '@fafa/ui/technical-reference';
import { MobileProductCard } from '@fafa/ui/mobile';
import { useConversionTracking } from '@fafa/hooks';

export default function ProductPage() {
  const { trackCTAClick } = useConversionTracking();
  
  return (
    <div>
      <SalesCounter count={12847} label="Pièces vendues" />
      <TrustBadge type="verified-seller" rating={4.8} />
      <OEMReference value="04E115561H" manufacturer="VAG" />
      
      <ConversionCTA
        onClick={(e) => {
          trackCTAClick('add-to-cart', { productId: '123' }, e);
          addToCart();
        }}
      >
        Ajouter au panier
      </ConversionCTA>
    </div>
  );
}
```

### Backend Admin (NestJS + React)

```typescript
// src/admin/dashboard.tsx
import { ConversionCTA } from '@fafa/ui/button';
import { SalesCounter } from '@fafa/ui/social-proof';
import { useConversionTracking } from '@fafa/hooks';

export function AdminDashboard() {
  return (
    <div>
      <SalesCounter count={12847} label="Commandes ce mois" />
      
      <ConversionCTA onClick={exportData}>
        Exporter les données
      </ConversionCTA>
    </div>
  );
}
```

---

## 🔧 Configuration Monorepo

### turbo.json

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false
    }
  }
}
```

### Root package.json

```json
{
  "workspaces": [
    "packages/*",
    "frontend",
    "backend"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "lint": "turbo run lint"
  }
}
```

### packages/ui/package.json

```json
{
  "name": "@fafa/ui",
  "version": "2.0.0",
  "exports": {
    ".": "./dist/index.js",
    "./button": "./dist/components/button.js",
    "./social-proof": "./dist/components/social-proof.js",
    "./technical-reference": "./dist/components/technical-reference.js",
    "./mobile": "./dist/mobile/index.js"
  },
  "dependencies": {
    "@fafa/design-tokens": "*",
    "@fafa/theme-admin": "*"
  }
}
```

---

## 🎯 Résumé Stratégique

### Ce qu'on Garde

✅ `@fafa/design-tokens` - Source unique de vérité  
✅ `@fafa/ui/Button` - Composant de base solide (CVA + Radix)  
✅ `@fafa/theme-admin` - Thème back-office  
✅ Architecture monorepo existante  

### Ce qu'on Améliore

⭐ **Button** - Ajouter variantes `conversion`, `urgent`, analytics  
⭐ **Exports modulaires** - Tree-shaking optimal  
⭐ **Design tokens** - Utilisation systématique (pas de hard-coded colors)  

### Ce qu'on Migre

📦 `SocialProof` → `@fafa/ui/social-proof`  
📦 `TechnicalReference` → `@fafa/ui/technical-reference`  
📦 `MobileOptimizedCard` → `@fafa/ui/mobile`  
📦 `useConversionTracking` → `@fafa/hooks`  
📦 `useVehiclePersistence` → `@fafa/hooks`  

### Ce qu'on Supprime

❌ `frontend/components/ecommerce/ConversionButton.tsx` (fusionné dans Button)  
❌ Toutes les couleurs hard-codées (#FF3B30 → tokens)  
❌ Code dupliqué entre frontend/backend  

---

## 📅 Timeline

| Semaine | Tâches | Livrable |
|---------|--------|----------|
| **S1** | Améliorer Button + variantes conversion | `@fafa/ui@2.0.0` |
| **S2** | Migrer SocialProof + TechnicalReference | `@fafa/ui@2.1.0` |
| **S3** | Créer @fafa/hooks + migrer analytics | `@fafa/hooks@1.0.0` |
| **S4** | Migrer Mobile components | `@fafa/ui@2.2.0` |
| **S5** | Tests E2E + Documentation | Storybook complet |
| **S6** | Migration frontend/backend | Production ready |

---

## ✅ Checklist Finale

- [ ] Button avec variantes conversion/urgent
- [ ] SocialProof dans @fafa/ui
- [ ] TechnicalReference dans @fafa/ui
- [ ] Mobile components dans @fafa/ui/mobile
- [ ] Hooks analytics dans @fafa/hooks
- [ ] Tous les hard-coded colors → tokens
- [ ] Exports modulaires configurés
- [ ] Tests unitaires (95% coverage)
- [ ] Storybook stories pour tous composants
- [ ] Documentation usage (README.md)
- [ ] Migration frontend complète
- [ ] Migration backend admin complète
- [ ] Suppression ancien code
- [ ] Performance benchmarks (bundle size)
- [ ] Production deployment

---

**Résultat Final**: Design system unifié, 0 duplication, frontend + backend admin partagent le même code, maintenance simplifiée, DX améliorée ! 🎉
