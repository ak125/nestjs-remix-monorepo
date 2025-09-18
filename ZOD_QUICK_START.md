# 🚀 Démarrage Rapide - Validation Zod

Guide express pour utiliser le système de validation Zod dans notre monorepo.

## ⚡ Installation

```bash
# Zod est déjà installé et configuré
# Prêt à utiliser immédiatement !
```

## 🎯 Utilisation Rapide

### Backend (NestJS)

```typescript
import { AddToCartValidationPipe } from '../common/validation/cart-validation-fixed';

@Post('items')
async addItem(@Body(AddToCartValidationPipe) dto: AddToCartRequest) {
  // DTO automatiquement validé ✅
  return this.service.addItem(dto);
}
```

### Frontend (React)

```typescript
import { useZodForm } from '../hooks/useZodValidation';
import { AddToCartRequestSchema } from '../types/cart-validation';

function CartForm() {
  const { values, errors, isValid, handleSubmit, getFieldProps } = useZodForm(
    AddToCartRequestSchema
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit); }}>
      <input {...getFieldProps('product_id')} placeholder="ID produit" />
      {errors.product_id && <span>{errors.product_id}</span>}
      
      <button type="submit" disabled={!isValid}>Ajouter</button>
    </form>
  );
}
```

## 🛡️ Schémas Disponibles

- `AddToCartRequestSchema` - Ajout au panier
- `UpdateQuantityRequestSchema` - Mise à jour quantité  
- `PromoCodeSchema` - Codes promo
- `ProductIdSchema` - Validation ID produit
- `QuantitySchema` - Validation quantité (1-999)
- `PriceSchema` - Validation prix (≥0, 2 décimales)

## 🧪 Tester

```bash
# Tests automatisés backend
./test-zod-validation.sh

# Tests middleware global
./test-zod-middleware.sh

# Page de test frontend
# Visiter : http://localhost:3000/zod-test
```

## 📚 Documentation Complète

Voir [`docs/ZOD_VALIDATION_GUIDE.md`](./docs/ZOD_VALIDATION_GUIDE.md) pour la documentation détaillée.

## 🎉 Fonctionnalités

✅ Validation temps réel  
✅ Type safety complet  
✅ Messages d'erreur en français  
✅ Debounce configurable  
✅ Cache de validation  
✅ Hooks React avancés  
✅ Middleware global NestJS  
✅ Tests automatisés  

---

*Système prêt pour la production ! 🚀*