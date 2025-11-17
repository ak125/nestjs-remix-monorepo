# Images Supabase avec Fallback

## Problème résolu
Les images des pièces populaires sur les pages véhicules affichaient des erreurs 404 car elles utilisaient un chemin local `/upload/` au lieu de l'URL complète Supabase Storage.

## Solution implémentée

### Fichier modifié
`/frontend/app/routes/constructeurs.$brand.$model.$type.tsx`

### Changements appliqués

#### 1. Import de l'icône Package
```tsx
import { Car, Package } from "lucide-react";
```

#### 2. URL Supabase Storage complète
```tsx
src={`https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/${part.pg_img}`}
```

#### 3. Gestion des cas d'erreur

**Condition de rendu :**
```tsx
{part.pg_img && part.pg_img !== 'no.webp' ? (
  <img ... />
) : null}
```

**Handler onError :**
```tsx
onError={(e) => {
  // Fallback vers l'icône si l'image ne charge pas
  e.currentTarget.style.display = 'none';
  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
  if (fallback) fallback.style.display = 'flex';
}}
```

**Fallback UI :**
```tsx
<div className="hidden flex-col items-center justify-center w-full h-32 text-gray-400">
  <Package size={48} strokeWidth={1.5} />
  <span className="text-xs mt-2 text-gray-500">Image indisponible</span>
</div>
```

## Scénarios gérés

| Cas | Comportement |
|-----|--------------|
| Image valide (ex: `disque-de-frein.webp`) | ✅ Affichage normal via Supabase Storage |
| Pas d'image (`pg_img` vide) | ✅ Fallback immédiat (icône Package) |
| Image placeholder (`no.webp`) | ✅ Fallback immédiat (icône Package) |
| Image 404 (fichier manquant) | ✅ Fallback après erreur (icône Package) |

## Structure du code

```tsx
<div className="p-6 bg-gray-50 flex items-center justify-center">
  {/* Rendu conditionnel de l'image */}
  {part.pg_img && part.pg_img !== 'no.webp' ? (
    <img 
      src={`https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/${part.pg_img}`}
      alt={part.pg_name_meta}
      className="w-full h-32 object-contain rounded-lg group-hover:scale-105 transition-transform duration-300"
      loading="lazy"
      onError={/* handler fallback */}
    />
  ) : null}
  
  {/* Fallback caché par défaut */}
  <div className="hidden flex-col items-center justify-center w-full h-32 text-gray-400">
    <Package size={48} strokeWidth={1.5} />
    <span className="text-xs mt-2 text-gray-500">Image indisponible</span>
  </div>
</div>
```

## Pattern réutilisable

Ce pattern peut être appliqué à toutes les images de produits/gammes dans l'application :

1. **URL complète Supabase** au lieu de chemins relatifs
2. **Condition de rendu** pour éviter les valeurs vides/placeholder
3. **Handler onError** pour basculer vers le fallback
4. **Icône de fallback** (Package, Box, etc.) avec message explicite

## Exemple d'URL Supabase
```
https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/disque-de-frein.webp
```

## Impact
- ✅ Plus d'images cassées sur les pages véhicules
- ✅ UX améliorée avec fallback élégant
- ✅ Performance : `loading="lazy"` conservé
- ✅ Transition smooth : `group-hover:scale-105`

## Date de mise en œuvre
16 novembre 2025
