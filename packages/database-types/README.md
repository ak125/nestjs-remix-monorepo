# @repo/database-types

> 🗂️ Package de types partagés pour la base de données PostgreSQL/Supabase  
> **Stratégie 3** : Source unique de vérité avec validation Zod et génération automatique

## 🎯 Objectif

Éliminer définitivement les erreurs de synchronisation de schéma entre backend et frontend :
- ✅ Noms de tables type-safe (fini `pieces_prix` vs `pieces_price`)
- ✅ Noms de colonnes type-safe (fini `pm_qualite` vs `pm_quality`)
- ✅ Validation runtime avec Zod
- ✅ Génération automatique depuis Supabase

## 📦 Contenu

### Types TypeScript (97 tables)
```typescript
import type { Pieces, PiecesPrice, PiecesMarque } from '@repo/database-types';
```

### Constantes type-safe
```typescript
import { TABLES, COLUMNS } from '@repo/database-types';

// ❌ AVANT : Risque d'erreur
supabase.from('pieces_prix')  // ERREUR silencieuse !

// ✅ APRÈS : Autocomplete + Type-safe
supabase.from(TABLES.pieces_price)  // Détecté à la compilation
```

### Schémas Zod (90 schémas)
```typescript
import { PiecesSchema, PiecesPriceSchema } from '@repo/database-types';

// Validation runtime
const validated = PiecesSchema.parse(data);
```

## 🚀 Installation

Le package est automatiquement disponible dans le monorepo via npm workspaces.

### Backend (NestJS)
```json
{
  "dependencies": {
    "@repo/database-types": "*"
  }
}
```

### Frontend (Remix)
```json
{
  "dependencies": {
    "@repo/database-types": "*"
  }
}
```

## 💻 Utilisation

### 1. Imports de base
```typescript
// Types TypeScript
import type { Pieces, PiecesPrice } from '@repo/database-types';

// Constantes (recommandé !)
import { TABLES, COLUMNS } from '@repo/database-types';

// Schémas Zod
import { PiecesSchema } from '@repo/database-types';
```

### 2. Requêtes Supabase (Backend)
```typescript
// ❌ AVANT
const { data } = await supabase
  .from('pieces_prix')  // ⚠️ Erreur : table inexistante
  .select('pm_qualite');  // ⚠️ Erreur : colonne inexistante

// ✅ APRÈS
import { TABLES, COLUMNS } from '@repo/database-types';

const { data } = await supabase
  .from(TABLES.pieces_price)  // ✅ Autocomplete + Type-safe
  .select(COLUMNS.pieces_marque.quality);  // ✅ pm_quality (correct)
```

### 3. Validation API (Frontend)
```typescript
import { PiecesPriceSchema } from '@repo/database-types';

// Valider la réponse API
try {
  const validated = PiecesPriceSchema.parse(apiResponse);
  console.log('✅ Données valides', validated);
} catch (error) {
  console.error('❌ Données invalides', error);
}
```

### 4. Helpers types
```typescript
import type { GetTableType, GetInsertType } from '@repo/database-types';

// Obtenir le type d'une ligne
type PiecesRow = GetTableType<'pieces'>;

// Obtenir le type d'insertion
type NewPiece = GetInsertType<'pieces'>;

const piece: NewPiece = {
  piece_ref: 'ABC123',
  piece_name: 'Filtre à huile',
  // TypeScript force tous les champs requis
};
```

## 🔧 Scripts

### Build
```bash
npm run build
```

### Watch mode (développement)
```bash
npm run dev
```

### Générer les types depuis Supabase
```bash
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types.ts
npm run build
```

### Régénérer les schémas Zod
```bash
npm run generate:zod
```

## 📊 Structure

```
packages/database-types/
├── src/
│   ├── index.ts          # 🎯 Point d'entrée principal
│   ├── types.ts          # 📋 Types TypeScript (97 tables)
│   ├── constants.ts      # 🔑 TABLES + COLUMNS
│   └── schemas.ts        # 🔐 Schémas Zod (auto-généré)
├── scripts/
│   └── generate-zod-schemas.ts  # 🏗️ Générateur Zod
├── package.json
├── tsconfig.json
└── README.md
```

## 🎨 Tables principales

### Pièces automobiles
- `pieces` - Produits (97 colonnes)
- `pieces_price` - Prix et disponibilité
- `pieces_marque` - Marques (pm_quality ✅)
- `pieces_media_img` - Images produits
- `pieces_criteria` - Critères techniques
- `pieces_criteria_link` - Définitions critères

### Véhicules
- `auto_marque` - Marques véhicules
- `auto_modele` - Modèles
- `auto_type` - Types moteur

### SEO & Blog
- `blog_advice` - Articles blog
- `seo_gamme` - SEO gammes produits
- `seo_marque` - SEO marques

## ⚠️ Erreurs courantes évitées

| ❌ Erreur | ✅ Correct | Solution |
|-----------|-----------|----------|
| `pieces_prix` | `pieces_price` | `TABLES.pieces_price` |
| `pm_qualite` | `pm_quality` | `COLUMNS.pieces_marque.quality` |
| `pieces_images` | `pieces_media_img` | `TABLES.pieces_media_img` |
| `pieces_criteres` | `pieces_criteria` | `TABLES.pieces_criteria` |
| `pim_ordre` | `pmi_sort` | `COLUMNS.pieces_media_img.sort` |

## 🔄 Workflow de mise à jour

1. **Modification du schéma Supabase** (via dashboard ou migration)
2. **Régénération des types**
   ```bash
   cd packages/database-types
   supabase gen types typescript --project-id YOUR_ID > src/types.ts
   ```
3. **Mise à jour des constantes** (si nouvelles tables/colonnes)
   ```bash
   # Éditer src/constants.ts
   ```
4. **Régénération des schémas Zod**
   ```bash
   npm run generate:zod
   ```
5. **Rebuild**
   ```bash
   npm run build
   ```
6. **Propagation automatique** vers backend et frontend (via npm workspaces)

## 📝 Avantages

### Pour le développement
- 🎯 **Autocomplete** : VS Code suggère les noms corrects
- 🛡️ **Type-safety** : Erreurs détectées à la compilation
- 🔍 **Refactoring** : Renommer une table met à jour tous les usages
- 📚 **Documentation** : Les types servent de référence

### Pour la production
- 🐛 **Moins de bugs** : Impossible d'utiliser un mauvais nom
- ✅ **Validation** : Zod vérifie les données à l'exécution
- 🚀 **Performance** : Pas de surcoût runtime (types TypeScript)
- 🔐 **Sécurité** : Validation stricte des données entrantes

## 🎓 Exemple complet

```typescript
// Backend: catalog.service.ts
import { TABLES, COLUMNS } from '@repo/database-types';
import type { Pieces, PiecesPrice, PiecesMarque } from '@repo/database-types';

async getPieceDetails(pieceId: string) {
  // Récupérer la pièce
  const { data: piece } = await this.supabase
    .from(TABLES.pieces)
    .select('*')
    .eq(COLUMNS.pieces.id, pieceId)
    .single();

  // Récupérer le prix
  const { data: price } = await this.supabase
    .from(TABLES.pieces_price)
    .select('pri_vente_ttc, pri_dispo')
    .eq(COLUMNS.pieces_price.piece_id, pieceId)
    .single();

  // Récupérer la marque
  const { data: brand } = await this.supabase
    .from(TABLES.pieces_marque)
    .select('pm_name, pm_quality')  // ✅ pm_quality (correct)
    .eq(COLUMNS.pieces_marque.id, piece.piece_pm_id)
    .single();

  return { piece, price, brand };
}
```

```typescript
// Frontend: product-detail.tsx
import { PiecesSchema, PiecesPriceSchema } from '@repo/database-types';

export async function loader({ params }: LoaderArgs) {
  const response = await fetch(`/api/pieces/${params.id}`);
  const data = await response.json();

  // Validation runtime
  const validated = {
    piece: PiecesSchema.parse(data.piece),
    price: PiecesPriceSchema.parse(data.price),
  };

  return json(validated);
}
```

## 📄 Licence

MIT - Monorepo NestJS/Remix

## 👥 Contributeurs

Package créé dans le cadre de la **Stratégie 3** pour résoudre les bugs de synchronisation de schéma.

---

✨ **Résultat** : Plus jamais d'erreur `marque="0"` ou `prix=0.00` due à un mauvais nom de table/colonne !
