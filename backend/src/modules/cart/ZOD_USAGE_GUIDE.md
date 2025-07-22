# Guide d'Utilisation de Zod dans le Module Cart

## 🎯 Objectifs de la Validation avec Zod

Ce guide explique comment utiliser Zod pour une validation robuste et type-safe dans le module Cart du projet NestJS.

## 📚 Concepts Clés

### 1. Schémas Zod vs Interfaces TypeScript

```typescript
// ❌ Interface TypeScript (compile-time uniquement)
interface User {
  id: number;
  name: string;
}

// ✅ Schéma Zod (runtime + compile-time)
const UserSchema = z.object({
  id: z.number(),
  name: z.string()
});

type User = z.infer<typeof UserSchema>; // Génère automatiquement l'interface
```

### 2. Validation vs Parsing

```typescript
// Validation simple (lance une exception si invalide)
const data = AddToCartSchema.parse(userInput);

// Validation sûre (retourne un objet de résultat)
const result = AddToCartSchema.safeParse(userInput);
if (result.success) {
  console.log(result.data);
} else {
  console.log(result.error.errors);
}
```

## 🛠️ Patterns d'Utilisation dans le Module Cart

### 1. Validation des Données d'Entrée (Controller)

```typescript
// cart.controller.ts
@Post('add')
async addToCart(@Body() body: unknown) {
  try {
    // Validation Zod avec gestion d'erreur personnalisée
    const validatedData = this.validateWithZod(body, validateAddToCart, 'add to cart data');
    return await this.cartService.addToCart(userId, validatedData);
  } catch (error) {
    // Les erreurs Zod sont automatiquement converties en BadRequestException
    throw error;
  }
}

private validateWithZod<T>(data: unknown, validator: (data: unknown) => T, fieldName: string): T {
  try {
    return validator(data);
  } catch (error: any) {
    throw new BadRequestException(`Données invalides pour ${fieldName}: ${error.message}`);
  }
}
```

### 2. Validation des Règles Métier (Service)

```typescript
// cart.service.ts
constructor() {
  // Initialisation avec validation Zod
  this.defaultCartRules = CartRulesSchema.parse({
    max_quantity_per_item: 99,
    max_total_items: 50,
    // ... autres règles
  });
}

async addToCart(userId: string, addToCartDto: AddToCartDto) {
  // Re-validation des données pour sécurité supplémentaire
  const validatedData = this.validateWithZod(addToCartDto, validateAddToCart, 'service data');
  
  // Validation des métadonnées si présentes
  if (validatedData.metadata) {
    this.validateWithZod(validatedData.metadata, (data) => CartItemMetadataSchema.parse(data), 'metadata');
  }
  
  // Logique métier...
}
```

### 3. Validation des Réponses (Optionnel mais Recommandé)

```typescript
// Validation des données sortantes pour garantir la cohérence
async getCart(userId: string): Promise<CartResponse> {
  const cartData = await this.cartService.getCompleteCart(userId);
  
  // Validation de la réponse avant envoi au client
  return this.validateWithZod(cartData, validateCartResponse, 'cart response');
}
```

## 🏗️ Architecture des Schémas

### 1. Schémas de Base (Primitifs)

```typescript
// Schémas réutilisables pour des types communs
const PositiveIntegerSchema = z.number().int().positive();
const UserIdSchema = z.string().min(1);
const ProductIdSchema = z.number().int().positive();
```

### 2. Schémas Composés

```typescript
// Composition de schémas pour des structures complexes
const CartItemSchema = z.object({
  id: PositiveIntegerSchema,
  user_id: UserIdSchema,
  product_id: ProductIdSchema,
  quantity: PositiveIntegerSchema.max(99),
  // ...
});

const CartResponseSchema = z.object({
  items: z.array(CartItemWithProductSchema),
  summary: CartSummarySchema,
  promo_code: z.string().optional(),
  // ...
});
```

### 3. Schémas avec Transformations

```typescript
// Transformation automatique des données
const CartQueryParamsSchema = z.object({
  page: z.string().transform(val => parseInt(val)).pipe(z.number().int().positive().default(1)),
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().int().positive().max(100).default(10)),
  include_details: z.string().transform(val => val === 'true').pipe(z.boolean().default(true))
});
```

## 🚨 Gestion des Erreurs

### 1. Messages d'Erreur Personnalisés

```typescript
const AddToCartSchema = z.object({
  product_id: z.number({
    required_error: "L'ID du produit est requis",
    invalid_type_error: "L'ID du produit doit être un nombre"
  }).int("L'ID du produit doit être un entier").positive("L'ID du produit doit être positif"),
  
  quantity: z.number()
    .int("La quantité doit être un entier")
    .positive("La quantité doit être positive")
    .max(99, "Quantité maximale autorisée: 99")
});
```

### 2. Gestion Centralisée des Erreurs

```typescript
// Utilitaire pour standardiser les erreurs Zod
export function handleZodError(error: ZodError, context: string): BadRequestException {
  const messages = error.errors.map(err => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
  
  return new BadRequestException({
    message: `Erreur de validation dans ${context}`,
    errors: messages,
    statusCode: 400
  });
}
```

## 🧪 Tests et Validation

### 1. Tests Unitaires des Schémas

```typescript
describe('AddToCartSchema', () => {
  it('should validate correct data', () => {
    const validData = { product_id: 1, quantity: 2 };
    expect(() => AddToCartSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid data', () => {
    const invalidData = { product_id: 'abc', quantity: -1 };
    expect(() => AddToCartSchema.parse(invalidData)).toThrow(ZodError);
  });
});
```

### 2. Tests d'Intégration

```typescript
describe('Cart API with Zod Validation', () => {
  it('should return 400 for invalid cart data', async () => {
    const response = await request(app)
      .post('/cart/add')
      .send({ product_id: 'invalid', quantity: -1 })
      .expect(400);
    
    expect(response.body.message).toContain('Données invalides');
  });
});
```

## 📊 Métriques et Monitoring

### 1. Logging des Erreurs de Validation

```typescript
private validateWithZod<T>(data: unknown, validator: (data: unknown) => T, fieldName: string): T {
  try {
    return validator(data);
  } catch (error: any) {
    // Logging détaillé pour le monitoring
    this.logger.warn(`Validation échouée pour ${fieldName}`, {
      data: JSON.stringify(data),
      errors: error.errors,
      context: 'ZodValidation'
    });
    
    throw new BadRequestException(`Données invalides pour ${fieldName}: ${error.message}`);
  }
}
```

### 2. Métriques de Validation

```typescript
// Compteur d'erreurs de validation par endpoint
@Injectable()
export class ValidationMetricsService {
  private validationErrors = new Map<string, number>();
  
  recordValidationError(endpoint: string, fieldName: string) {
    const key = `${endpoint}.${fieldName}`;
    this.validationErrors.set(key, (this.validationErrors.get(key) || 0) + 1);
  }
  
  getValidationStats() {
    return Object.fromEntries(this.validationErrors);
  }
}
```

## 🚀 Bonnes Pratiques

### 1. ✅ À Faire

- **Valider tôt et souvent** : Au niveau du contrôleur ET du service
- **Messages d'erreur clairs** : Utilisez des messages explicites pour l'utilisateur
- **Réutiliser les schémas** : Créez des schémas de base réutilisables
- **Tester les schémas** : Tests unitaires pour chaque schéma
- **Documenter les validations** : Commentaires expliquant les règles métier

### 2. ❌ À Éviter

- **Validation uniquement côté client** : Toujours valider côté serveur
- **Schémas trop permissifs** : Soyez strict sur les types et formats
- **Ignorer les erreurs de validation** : Loggez et monitorer les erreurs
- **Schémas trop complexes** : Divisez en schémas plus petits
- **Validation sans contexte** : Incluez le contexte dans les messages d'erreur

## 🔗 Ressources Supplémentaires

- [Documentation officielle Zod](https://zod.dev/)
- [Zod avec NestJS](https://docs.nestjs.com/techniques/validation#using-zod)
- [Patterns avancés Zod](https://zod.dev/?id=advanced)
- [Tests avec Zod](https://zod.dev/?id=testing)

---

Ce guide vous donne toutes les clés pour utiliser Zod efficacement dans le module Cart et l'étendre à d'autres modules du projet.
