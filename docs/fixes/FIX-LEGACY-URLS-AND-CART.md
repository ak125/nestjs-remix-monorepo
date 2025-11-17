# 🔧 Fix : URLs Legacy et Panier Vide

## 📋 Problèmes Identifiés

### 1. ❌ URL avec ID au lieu d'alias (410/404)

**URL problématique** :
```
/constructeurs/audi-22/80-break-22016.html
```

**Format attendu** :
```
/constructeurs/{marque-alias}/{modele-alias}/{type-alias}
Exemple: /constructeurs/audi/80-break/1-6-i
```

**Cause** :
- L'URL contient `22016` (type_id) au lieu du `type_alias`
- Le routeur Remix ne reconnaît pas ce format
- Retourne 404 au lieu de 410 (Gone)

### 2. ❌ Panier reste vide côté frontend

**Symptôme** :
- L'API `/api/cart/add` fonctionne (✅ backend)
- Le panier frontend ne se met pas à jour (❌ UI)

**Cause potentielle** :
- Problème de session/cookie
- React state non synchronisé
- Rechargement de la page nécessaire

---

## 🔧 Solutions

### Solution 1 : Middleware de Redirection (Backend)

Créer un middleware NestJS qui intercepte les anciennes URLs et redirige vers les nouvelles.

#### Fichier : `backend/src/middleware/legacy-url-redirect.middleware.ts`

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class LegacyUrlRedirectMiddleware implements NestMiddleware {
  constructor(private readonly supabase: SupabaseService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const url = req.path;

    // Pattern: /constructeurs/{brand}-{id}/{model}-{id}.html
    const legacyPattern = /^\/constructeurs\/([a-z0-9-]+)-(\d+)\/([a-z0-9-]+)-(\d+)\.html$/i;
    const match = url.match(legacyPattern);

    if (match) {
      const [, brandSlug, brandId, modelSlug, typeId] = match;

      try {
        // Récupérer les vrais alias depuis la DB
        const { data: vehicle } = await this.supabase.client
          .from('type_v')
          .select('marque_alias, modele_alias, type_alias')
          .eq('type_id', typeId)
          .single();

        if (vehicle) {
          const newUrl = `/constructeurs/${vehicle.marque_alias}/${vehicle.modele_alias}/${vehicle.type_alias}`;
          
          // Redirection 301 (permanente)
          return res.redirect(301, newUrl);
        }

        // Si véhicule introuvable, retourner 410 Gone
        return res.status(410).send({
          error: 'Vehicle no longer available',
          message: 'Ce véhicule n\'est plus disponible dans notre catalogue',
          code: 'VEHICLE_GONE'
        });
      } catch (error) {
        console.error('[LegacyRedirect] Error:', error);
      }
    }

    next();
  }
}
```

#### Enregistrer le middleware dans `app.module.ts`

```typescript
import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { LegacyUrlRedirectMiddleware } from './middleware/legacy-url-redirect.middleware';

@Module({
  // ...
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LegacyUrlRedirectMiddleware)
      .forRoutes({ path: 'constructeurs/*', method: RequestMethod.GET });
  }
}
```

---

### Solution 2 : Catch-all Route Remix (Fallback)

#### Fichier : `frontend/app/routes/constructeurs.$.tsx`

```tsx
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const catchAll = params["*"];
  
  if (!catchAll) {
    throw new Response("Not Found", { status: 404 });
  }

  // Pattern legacy : brand-ID/model-ID.html
  const legacyMatch = catchAll.match(/^([a-z0-9-]+)-(\d+)\/([a-z0-9-]+)-(\d+)\.html$/i);
  
  if (legacyMatch) {
    const [, brandSlug, brandId, modelSlug, typeId] = legacyMatch;
    
    // Appeler l'API backend pour résoudre les alias
    try {
      const response = await fetch(
        `http://localhost:3000/api/vehicles/legacy-resolve?type_id=${typeId}`,
        { headers: { 'User-Agent': 'RemixSSR' } }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Redirection 301
        return redirect(
          `/constructeurs/${data.marque_alias}/${data.modele_alias}/${data.type_alias}`,
          { status: 301 }
        );
      }
      
      // Véhicule supprimé/introuvable → 410 Gone
      if (response.status === 404 || response.status === 410) {
        throw new Response("Vehicle No Longer Available", {
          status: 410,
          statusText: "Gone",
        });
      }
    } catch (error) {
      console.error('[LegacyRedirect]', error);
    }
  }

  // Autres URLs inconnues → 404
  throw new Response("Not Found", { status: 404 });
}

export default function LegacyCatchAll() {
  // Ce component ne sera jamais rendu (redirection ou erreur)
  return null;
}
```

---

### Solution 3 : Fix du Panier Frontend

Le panier s'ajoute en backend mais ne se reflète pas en frontend. Problèmes possibles :

#### A. Vérifier le Context/State du panier

```tsx
// frontend/app/root.tsx ou contexts/CartContext.tsx
import { createContext, useContext, useState, useEffect } from "react";

interface CartContextType {
  itemCount: number;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType>({
  itemCount: 0,
  refreshCart: async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [itemCount, setItemCount] = useState(0);

  const refreshCart = async () => {
    try {
      const response = await fetch('/api/cart', {
        credentials: 'include', // ⚠️ IMPORTANT pour les cookies
      });
      
      if (response.ok) {
        const data = await response.json();
        setItemCount(data.items?.length || 0);
      }
    } catch (error) {
      console.error('[Cart] Error refreshing:', error);
    }
  };

  useEffect(() => {
    refreshCart();
  }, []);

  return (
    <CartContext.Provider value={{ itemCount, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
```

#### B. Appeler `refreshCart()` après ajout

```tsx
// Dans votre component de produit
import { useCart } from "~/contexts/CartContext";

export default function ProductCard({ product }) {
  const { refreshCart } = useCart();

  const handleAddToCart = async () => {
    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // ⚠️ IMPORTANT
        body: JSON.stringify({
          product_id: product.id,
          quantity: 1,
        }),
      });

      if (response.ok) {
        // ✅ Rafraîchir le panier après ajout
        await refreshCart();
        
        // Optionnel : Toast notification
        toast.success('Produit ajouté au panier');
      }
    } catch (error) {
      console.error('[AddToCart] Error:', error);
      toast.error('Erreur lors de l\'ajout');
    }
  };

  return (
    <button onClick={handleAddToCart}>
      Ajouter au panier
    </button>
  );
}
```

---

## 🧪 Tests

### Test 1 : Redirection legacy URL

```bash
# Avant le fix (404)
curl -I http://localhost:3000/constructeurs/audi-22/80-break-22016.html
# HTTP/1.1 404 Not Found

# Après le fix (301 → nouvelle URL)
curl -I http://localhost:3000/constructeurs/audi-22/80-break-22016.html
# HTTP/1.1 301 Moved Permanently
# Location: /constructeurs/audi/80-break/1-6-i
```

### Test 2 : Panier

```bash
# 1. Ajouter un produit
curl -X POST http://localhost:3000/api/cart/add \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"product_id": 618770, "quantity": 1}'

# 2. Vérifier le panier
curl http://localhost:3000/api/cart \
  -b cookies.txt

# Résultat attendu: { items: [...], total: "13.51" }
```

---

## 📊 Checklist d'Implémentation

### Backend
- [ ] Créer `LegacyUrlRedirectMiddleware`
- [ ] Ajouter endpoint `/api/vehicles/legacy-resolve`
- [ ] Enregistrer middleware dans `AppModule`
- [ ] Tester redirections 301
- [ ] Tester code 410 pour véhicules supprimés

### Frontend
- [ ] Créer route catch-all `constructeurs.$.tsx`
- [ ] Implémenter `CartContext` global
- [ ] Ajouter `credentials: 'include'` dans tous les appels panier
- [ ] Appeler `refreshCart()` après chaque ajout
- [ ] Ajouter feedback visuel (toast/animation)
- [ ] Tester avec cookies désactivés (mode incognito)

### Tests E2E
- [ ] Test legacy URL → 301
- [ ] Test véhicule inexistant → 410
- [ ] Test ajout panier + refresh UI
- [ ] Test panier persistant après reload
- [ ] Test panier multi-onglets (même session)

---

## 🚀 Déploiement

1. **Backend** : Déployer le middleware
2. **Frontend** : Déployer la route catch-all
3. **Cache** : Purger cache Caddy/CDN si applicable
4. **Monitoring** : Suivre les 301/410 dans les logs

---

## 📚 Références

- [NestJS Middleware](https://docs.nestjs.com/middleware)
- [Remix Catch-all Routes](https://remix.run/docs/en/main/file-conventions/routes#splat-routes)
- [HTTP 301 vs 302](https://developer.mozilla.org/fr/docs/Web/HTTP/Status/301)
- [HTTP 410 Gone](https://developer.mozilla.org/fr/docs/Web/HTTP/Status/410)

---

**Date** : 2 novembre 2025  
**Priorité** : 🔴 Haute (impacte UX et SEO)
