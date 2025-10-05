# 🔄 MIGRATION VERS PROMO SERVICE AVANCÉ

**Date**: 5 octobre 2025  
**Objectif**: Migrer le CartModule vers le PromoService avancé avec Zod et Cache

---

## 📊 SITUATION ACTUELLE

### PromoService Simple (CartModule - ACTUEL)
**Fichier**: `/modules/cart/promo.service.ts`

**Caractéristiques**:
- ✅ Simple et fonctionnel
- ✅ Délègue à PromoDataService
- ❌ Pas de cache Redis
- ❌ Pas de validation Zod stricte
- ❌ Interface simple (3 paramètres: code, userId, subtotal)

### PromoService Avancé (PromoModule - CIBLE)
**Fichier**: `/modules/promo/promo.service.ts`

**Caractéristiques**:
- ✅ Validation stricte avec Zod schemas
- ✅ Cache Redis intégré (30 min TTL)
- ✅ Cache négatif pour codes invalides
- ✅ Invalidation automatique du cache
- ✅ Gestion avancée des erreurs
- ✅ Interface avec CartSummary (userId: number, subtotal, shipping, items)

---

## 🎯 PLAN DE MIGRATION (5 étapes)

### Étape 1: Importer PromoModule dans CartModule ✅

**Fichier**: `backend/src/modules/cart/cart.module.ts`

**Changement**:
```typescript
imports: [
  DatabaseModule,
  CacheModule,
  ShippingModule,
  ProductsModule,
  PromoModule,  // 🆕 AJOUTER
]
```

**Supprimer**:
```typescript
import { PromoService } from './promo.service';  // ❌ SUPPRIMER
providers: [
  PromoService,  // ❌ SUPPRIMER (viendra de PromoModule)
]
```

**Ajouter**:
```typescript
import { PromoModule } from '../promo/promo.module';  // ✅ AJOUTER
```

---

### Étape 2: Adapter CartService pour nouvelle interface

**Fichier**: `backend/src/modules/cart/services/cart.service.ts`

**Changement dans l'import**:
```typescript
// AVANT:
import { PromoService } from '../promo.service';

// APRÈS:
import { PromoService } from '../../promo/promo.service';
```

**Adapter la méthode applyPromoCode()** - Ligne ~350

**AVANT**:
```typescript
const validation = await this.promoService.validatePromoCode(
  promoCode,
  userIdForCart,
  cart.stats.subtotal,
);
```

**APRÈS**:
```typescript
// Préparer CartSummary pour le nouveau PromoService
const cartSummary = {
  userId: parseInt(userIdForCart) || 0,  // Convertir en number
  subtotal: cart.stats.subtotal,
  shipping: cart.stats.shippingCost || 0,
  items: cart.items,
};

const validation = await this.promoService.validatePromoCode(
  promoCode,
  cartSummary,
);
```

**Adapter la gestion du résultat**:
```typescript
// Le nouveau service retourne: PromoValidationResult
// { valid, discount, message?, promoCode? }

if (!validation.valid) {
  throw new BadRequestException(
    validation.message || 'Code promo invalide',
  );
}

// Utiliser validation.discount au lieu de validation.discount
const discount = validation.discount;
const promoId = validation.promoCode?.id;
```

---

### Étape 3: Mettre à jour CartController (si nécessaire)

**Fichier**: `backend/src/modules/cart/cart.controller.ts`

Vérifier que l'endpoint `/cart/promo` gère correctement les erreurs.

**Pas de changement majeur normalement** car CartService encapsule la logique.

---

### Étape 4: Supprimer l'ancien PromoService

**Une fois les tests validés**, supprimer:
```bash
rm backend/src/modules/cart/promo.service.ts
```

---

### Étape 5: Activer PromoModule dans app.module.ts

**Fichier**: `backend/src/app.module.ts`

**Ajouter**:
```typescript
import { PromoModule } from './modules/promo/promo.module';

@Module({
  imports: [
    // ... autres modules
    CartModule,
    PromoModule,  // 🆕 AJOUTER après CartModule
    // ... autres modules
  ]
})
```

---

## 🔧 COMPATIBILITÉ DES INTERFACES

### Ancien PromoService (Simple)
```typescript
validatePromoCode(
  code: string,
  userId: string,
  cartSubtotal: number
): Promise<{
  valid: boolean;
  discount: number;
  discountType?: string;
  reason?: string;
  promoId?: number;
}>
```

### Nouveau PromoService (Avancé)
```typescript
validatePromoCode(
  code: string,
  cart: CartSummary  // { userId: number, subtotal, shipping, items }
): Promise<PromoValidationResult>  
// { valid, discount, message?, promoCode? }
```

### Adaptateur à créer
```typescript
// Dans CartService.applyPromoCode()
const cartSummary = {
  userId: parseInt(userId || sessionId, 10) || 0,
  subtotal: cart.stats.subtotal,
  shipping: cart.stats.shippingCost || 0,
  items: cart.items,
};
```

---

## ✅ AVANTAGES DE LA MIGRATION

| Fonctionnalité | Avant | Après |
|----------------|-------|-------|
| Cache Redis | ❌ | ✅ 30 min |
| Cache négatif | ❌ | ✅ 5 min |
| Validation Zod | ❌ | ✅ Stricte |
| Types inférés | ❌ | ✅ Automatique |
| Gestion erreurs | ⚠️ Basique | ✅ Avancée |
| Invalidation cache | ❌ | ✅ Auto |
| Performance | 🟡 | 🟢 Optimale |

---

## 🧪 PLAN DE TEST

### Tests Unitaires
- [ ] Validation code promo valide
- [ ] Validation code promo invalide
- [ ] Validation code promo expiré
- [ ] Validation montant minimum
- [ ] Calcul remise pourcentage
- [ ] Calcul remise montant fixe
- [ ] Calcul remise frais de port

### Tests d'Intégration
- [ ] POST /api/cart/promo avec code valide
- [ ] POST /api/cart/promo avec code invalide
- [ ] POST /api/cart/promo sans montant minimum
- [ ] Vérifier cache Redis actif
- [ ] Vérifier cache négatif
- [ ] DELETE /api/cart/promo

### Tests de Performance
- [ ] Temps réponse < 50ms (cache hit)
- [ ] Temps réponse < 200ms (cache miss)
- [ ] Pas de requêtes DB redondantes

---

## 🚨 POINTS D'ATTENTION

### 1. Type userId
**Problème**: L'ancien service utilise `string`, le nouveau utilise `number`

**Solution**:
```typescript
const userId = parseInt(userIdOrSessionId, 10) || 0;
```

### 2. Structure de retour différente
**Problème**: Noms de propriétés légèrement différents

**Solution**: Adapter dans CartService
```typescript
// Avant: validation.discountType
// Après: validation.promoCode?.type

// Avant: validation.promoId
// Après: validation.promoCode?.id
```

### 3. Cache Redis
**Important**: Le nouveau service utilise `RedisCacheService` 

**Vérifier**: Que RedisCacheService est bien disponible dans PromoModule

---

## 📝 CHECKLIST D'EXÉCUTION

- [ ] **Étape 1**: Importer PromoModule dans CartModule
- [ ] **Étape 2**: Adapter CartService.applyPromoCode()
- [ ] **Étape 3**: Mettre à jour les imports
- [ ] **Étape 4**: Tester en local
- [ ] **Étape 5**: Valider avec tests E2E
- [ ] **Étape 6**: Supprimer l'ancien PromoService
- [ ] **Étape 7**: Activer PromoModule dans app.module
- [ ] **Étape 8**: Redémarrer le serveur
- [ ] **Étape 9**: Tests de régression complets

---

## 🎯 RÉSULTAT ATTENDU

Après migration, vous aurez :

1. ✅ **Un seul PromoService** dans `/modules/promo/`
2. ✅ **Cache Redis** pour performances optimales
3. ✅ **Validation Zod** stricte et sécurisée
4. ✅ **Code DRY** sans duplication
5. ✅ **Architecture modulaire** propre

---

## 🚀 PRÊT À DÉMARRER ?

Commençons par **Étape 1** : Modifier `cart.module.ts`
