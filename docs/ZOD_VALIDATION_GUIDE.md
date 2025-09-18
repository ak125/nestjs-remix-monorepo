# 🛡️ Guide Complet de Validation Zod

Ce guide présente notre système de validation Zod intégré pour React + NestJS, offrant une validation type-safe, performante et facile à utiliser.

## 📋 Table des Matières

- [Installation et Configuration](#installation-et-configuration)
- [Validation Backend (NestJS)](#validation-backend-nestjs)
- [Validation Frontend (React)](#validation-frontend-react)
- [Hooks de Validation Avancés](#hooks-de-validation-avancés)
- [Middleware Global](#middleware-global)
- [Schémas Disponibles](#schémas-disponibles)
- [Exemples Pratiques](#exemples-pratiques)
- [Bonnes Pratiques](#bonnes-pratiques)
- [Dépannage](#dépannage)

## 🚀 Installation et Configuration

### Prérequis

```bash
# Zod est déjà installé dans le projet
npm list zod
# frontend: zod@3.25.76
# backend: zod@3.25.76
```

### Configuration Backend

```typescript
// app.module.ts
import { ZodValidationModule } from './common/validation/zod-validation.module';

@Module({
  imports: [
    ZodValidationModule.forRoot(), // Active la validation globale
    // ... autres modules
  ],
})
export class AppModule {}
```

### Configuration Frontend

```typescript
// Pas de configuration spéciale requise
// Les hooks sont prêts à l'emploi
import { useZodForm } from './hooks/useZodValidation';
```

## 🔧 Validation Backend (NestJS)

### Pipes de Validation

Notre système fournit des pipes pré-configurés pour toutes les opérations courantes :

```typescript
import { 
  AddToCartValidationPipe,
  UpdateQuantityValidationPipe,
  PromoCodeValidationPipe 
} from '../common/validation/cart-validation-fixed';

@Controller('cart')
export class CartController {
  @Post('items')
  async addItem(
    @Body(AddToCartValidationPipe) dto: AddToCartRequest
  ) {
    // DTO automatiquement validé et typé
    return this.cartService.addItem(dto);
  }
}
```

### Validation Personnalisée

```typescript
import { ZodValidationPipe } from '../common/validation/cart-validation-fixed';
import { z } from 'zod';

// Créer un schéma personnalisé
const CustomSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});

@Post('custom')
async customEndpoint(
  @Body(new ZodValidationPipe(CustomSchema)) data: z.infer<typeof CustomSchema>
) {
  // Données validées et typées
}
```

### Gestion d'Erreur Globale

Le middleware global capture automatiquement les erreurs de validation :

```typescript
// Réponse automatique en cas d'erreur
{
  "statusCode": 400,
  "timestamp": "2025-09-18T18:39:24.549Z",
  "path": "/api/cart/items",
  "method": "POST",
  "message": "Validation échouée: product_id: L'ID du produit ne peut pas être vide, quantity: La quantité doit être au moins 1",
  "details": {
    "field_errors": [
      {
        "field": "product_id",
        "message": "L'ID du produit ne peut pas être vide",
        "code": "too_small"
      }
    ],
    "error_count": 2
  }
}
```

## ⚛️ Validation Frontend (React)

### Hook de Formulaire Complet

```typescript
import { useZodForm } from '../hooks/useZodValidation';
import { AddToCartRequestSchema } from '../types/cart-validation';

function CartForm() {
  const {
    values,
    errors,
    isValid,
    isValidating,
    setValue,
    handleSubmit,
    getFieldProps,
  } = useZodForm(AddToCartRequestSchema, {
    product_id: '',
    quantity: 1,
  }, {
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 500,
  });

  const onSubmit = async (data) => {
    await fetch('/api/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(onSubmit);
    }}>
      <input
        {...getFieldProps('product_id')}
        placeholder="ID du produit"
      />
      {errors.product_id && <span>{errors.product_id}</span>}
      
      <button type="submit" disabled={!isValid}>
        Ajouter au panier
      </button>
    </form>
  );
}
```

### Validation Simple

```typescript
import { useZodValidation } from '../hooks/useZodValidation';
import { z } from 'zod';

const EmailSchema = z.string().email();

function EmailInput() {
  const { value, error, isValid, updateValue } = useZodValidation(EmailSchema);

  return (
    <div>
      <input
        value={value || ''}
        onChange={(e) => updateValue(e.target.value)}
        className={error ? 'border-red-500' : 'border-gray-300'}
      />
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}
```

### Validation de Liste

```typescript
import { useZodArrayValidation } from '../hooks/useZodValidation';

function ItemsList() {
  const {
    items,
    errors,
    isValid,
    addItem,
    updateItem,
    removeItem,
  } = useZodArrayValidation(AddToCartRequestSchema);

  return (
    <div>
      {items.map((item, index) => (
        <div key={index}>
          <span>{item.name}</span>
          {errors[index] && <span>{errors[index]}</span>}
          <button onClick={() => removeItem(index)}>Supprimer</button>
        </div>
      ))}
    </div>
  );
}
```

## 🎯 Hooks de Validation Avancés

### `useZodForm<T>`

Hook principal pour la gestion complète de formulaires.

**Paramètres :**
- `schema`: Schéma Zod pour la validation
- `initialValues`: Valeurs initiales (optionnel)
- `options`: Options de configuration

**Options :**
```typescript
interface ValidationOptions {
  validateOnChange?: boolean; // Validation à chaque modification
  validateOnBlur?: boolean;   // Validation quand le champ perd le focus
  debounceMs?: number;        // Délai de debounce (défaut: 300ms)
  mode?: 'onChange' | 'onBlur' | 'onSubmit'; // Mode de validation
}
```

**Retour :**
```typescript
{
  // État
  values: Partial<T>;
  errors: Record<string, string>;
  isValid: boolean;
  isValidating: boolean;
  isDirty: boolean;
  touchedFields: Record<string, boolean>;
  
  // Actions
  setValue: (field: keyof T, value: any) => void;
  setFieldTouched: (field: keyof T, touched?: boolean) => void;
  validateData: (data: Partial<T>) => Promise<ValidationResult<T>>;
  validateField: (field: keyof T, value: any) => Promise<void>;
  reset: (newValues?: Partial<T>) => void;
  handleSubmit: (onSubmit: (data: T) => Promise<void>) => Promise<void>;
  
  // Utilitaires
  getFieldProps: (field: keyof T) => FieldProps;
}
```

### `useZodValidation<T>`

Hook pour validation simple d'une valeur unique.

```typescript
const { value, error, isValid, updateValue } = useZodValidation(
  z.string().email(),
  'initial@email.com'
);
```

### `useZodArrayValidation<T>`

Hook pour validation de listes/tableaux.

```typescript
const { items, errors, addItem, updateItem, removeItem } = useZodArrayValidation(
  ItemSchema
);
```

### `useAsyncZodValidation<T>`

Hook pour validation asynchrone avec cache.

```typescript
const { validateAsync, isValidating, clearCache } = useAsyncZodValidation(
  UserSchema,
  async (user) => {
    // Validation côté serveur
    const response = await fetch('/api/validate-user', {
      method: 'POST',
      body: JSON.stringify(user),
    });
    return response.ok;
  }
);
```

## 🛡️ Middleware Global

### Filtre d'Exception

Le `ZodValidationExceptionFilter` capture automatiquement les erreurs de validation et les formate de manière consistante :

```typescript
// Réponse standardisée
{
  "statusCode": 400,
  "timestamp": "2025-09-18T18:39:24.549Z",
  "path": "/api/endpoint",
  "method": "POST",
  "message": "Validation échouée: field: message",
  "details": {
    "field_errors": [...],
    "error_count": 2
  }
}
```

### Service d'Utilitaires

```typescript
import { ValidationUtilsService } from '../common/validation/zod-global-middleware';

// Validation asynchrone
const result = await ValidationUtilsService.validateAsync(schema, data);

// Validation safe (sans exception)
const { success, data, errors } = ValidationUtilsService.validateSafe(schema, data);

// Formatage d'erreurs
const formattedErrors = ValidationUtilsService.formatZodErrors(zodError);
```

## 📚 Schémas Disponibles

### Schémas de Base

```typescript
// ID de produit : alphanumérique, 1-50 caractères
ProductIdSchema = z.string()
  .min(1, "L'ID du produit ne peut pas être vide")
  .max(50, "L'ID du produit ne peut pas dépasser 50 caractères")
  .regex(/^[a-zA-Z0-9_-]+$/, "Format invalide");

// Quantité : entier positif, 1-999
QuantitySchema = z.number()
  .int("La quantité doit être un nombre entier")
  .min(1, "La quantité doit être au moins 1")
  .max(999, "La quantité ne peut pas dépasser 999");

// Prix : nombre positif, 2 décimales max
PriceSchema = z.number()
  .min(0, "Le prix ne peut pas être négatif")
  .max(999999.99, "Le prix ne peut pas dépasser 999,999.99")
  .multipleOf(0.01, "Le prix doit avoir au maximum 2 décimales");

// Nom de produit : chaîne non vide, max 200 caractères
ProductNameSchema = z.string()
  .min(1, "Le nom du produit ne peut pas être vide")
  .max(200, "Le nom du produit ne peut pas dépasser 200 caractères")
  .trim();
```

### Schémas Composés

```typescript
// Requête d'ajout au panier
AddToCartRequestSchema = z.object({
  product_id: ProductIdSchema,
  quantity: QuantitySchema,
  price: PriceSchema.optional(),
  name: ProductNameSchema.optional(),
  description: z.string().max(500).optional(),
  image_url: z.string().url().optional(),
  category: z.string().max(100).optional(),
});

// Mise à jour de quantité
UpdateQuantityRequestSchema = z.object({
  quantity: QuantitySchema,
});

// Code promotionnel
PromoCodeSchema = z.string()
  .min(3, "Le code promo doit contenir au moins 3 caractères")
  .max(20, "Le code promo ne peut pas dépasser 20 caractères")
  .regex(/^[A-Z0-9_-]+$/, "Format de code promo invalide")
  .transform(str => str.toUpperCase());
```

## 💡 Exemples Pratiques

### 1. Formulaire de Connexion

```typescript
const LoginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Mot de passe trop court"),
});

function LoginForm() {
  const { values, errors, isValid, handleSubmit, getFieldProps } = useZodForm(
    LoginSchema,
    { email: '', password: '' }
  );

  const onSubmit = async (data) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (response.ok) {
      window.location.href = '/dashboard';
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit); }}>
      <input {...getFieldProps('email')} type="email" placeholder="Email" />
      {errors.email && <span>{errors.email}</span>}
      
      <input {...getFieldProps('password')} type="password" placeholder="Mot de passe" />
      {errors.password && <span>{errors.password}</span>}
      
      <button type="submit" disabled={!isValid}>Se connecter</button>
    </form>
  );
}
```

### 2. API avec Validation Complète

```typescript
@Controller('products')
export class ProductsController {
  @Post()
  async createProduct(
    @Body(new ZodValidationPipe(CreateProductSchema)) dto: CreateProductRequest
  ) {
    return this.productsService.create(dto);
  }

  @Get()
  async getProducts(
    @Query(new ZodValidationPipe(ProductQuerySchema)) query: ProductQuery
  ) {
    return this.productsService.findAll(query);
  }

  @Put(':id')
  async updateProduct(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) dto: UpdateProductRequest
  ) {
    return this.productsService.update(id, dto);
  }
}
```

### 3. Validation avec Transformation

```typescript
const UserRegistrationSchema = z.object({
  email: z.string().email().transform(email => email.toLowerCase()),
  username: z.string().min(3).transform(name => name.trim()),
  age: z.string().transform(age => parseInt(age, 10)).pipe(z.number().min(18)),
  terms: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter les conditions" }) }),
});
```

## 🎯 Bonnes Pratiques

### 1. Organisation des Schémas

```typescript
// schemas/user.schemas.ts
export const UserBaseSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

export const CreateUserSchema = UserBaseSchema.extend({
  password: z.string().min(8),
});

export const UpdateUserSchema = UserBaseSchema.partial();
```

### 2. Réutilisation et Composition

```typescript
// Schéma de base
const BaseProductSchema = z.object({
  name: ProductNameSchema,
  price: PriceSchema,
});

// Extension pour création
const CreateProductSchema = BaseProductSchema.extend({
  category_id: z.string().uuid(),
});

// Extension pour mise à jour
const UpdateProductSchema = BaseProductSchema.partial();
```

### 3. Messages d'Erreur Personnalisés

```typescript
const CustomSchema = z.object({
  email: z.string().email("Veuillez saisir un email valide"),
  password: z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
});
```

### 4. Validation Asynchrone

```typescript
const EmailSchema = z.string().email();

const validateEmailUnique = async (email: string): Promise<boolean> => {
  const response = await fetch(`/api/users/check-email/${email}`);
  return response.status === 404; // Email disponible si 404
};

function EmailField() {
  const { validateAsync, isValidating, error } = useAsyncZodValidation(
    EmailSchema,
    validateEmailUnique
  );

  return (
    <div>
      <input
        onChange={(e) => validateAsync(e.target.value)}
        className={error ? 'border-red-500' : 'border-gray-300'}
      />
      {isValidating && <span>Vérification...</span>}
      {error && <span>{error}</span>}
    </div>
  );
}
```

### 5. Performance et Cache

```typescript
// Cache des schémas compilés
const schemaCache = new Map();

function getCachedSchema(key: string, schemaFactory: () => z.ZodSchema) {
  if (!schemaCache.has(key)) {
    schemaCache.set(key, schemaFactory());
  }
  return schemaCache.get(key);
}

// Utilisation
const ProductSchema = getCachedSchema('product', () => 
  z.object({
    name: z.string(),
    price: z.number(),
  })
);
```

## 🔧 Dépannage

### Erreurs Courantes

#### 1. "Schema not found" ou types incorrects

```typescript
// ❌ Mauvais
import { AddToCartRequest } from 'somewhere-wrong';

// ✅ Correct
import { AddToCartRequest } from '../types/cart-validation';
```

#### 2. Validation qui ne se déclenche pas

```typescript
// ❌ Mode incorrect
const { ... } = useZodForm(schema, {}, { mode: 'onSubmit' });

// ✅ Mode onChange pour validation temps réel
const { ... } = useZodForm(schema, {}, { mode: 'onChange' });
```

#### 3. Erreurs de performance avec debounce

```typescript
// ❌ Debounce trop court
const { ... } = useZodForm(schema, {}, { debounceMs: 50 });

// ✅ Debounce approprié
const { ... } = useZodForm(schema, {}, { debounceMs: 300 });
```

### Debug et Logs

```typescript
// Activer les logs de validation
const { validateData } = useZodForm(schema);

const debugValidation = async (data) => {
  console.log('🔍 Validation data:', data);
  const result = await validateData(data);
  console.log('🔍 Validation result:', result);
  return result;
};
```

### Tests

```typescript
// Test des schémas Zod
describe('ProductSchema', () => {
  it('should validate correct product data', () => {
    const validData = {
      product_id: 'test-123',
      quantity: 5,
      price: 19.99,
      name: 'Test Product',
    };
    
    expect(() => AddToCartRequestSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid product data', () => {
    const invalidData = {
      product_id: '',
      quantity: 0,
    };
    
    expect(() => AddToCartRequestSchema.parse(invalidData)).toThrow();
  });
});
```

## 📈 Métriques et Monitoring

### Suivi des Validations

```typescript
// Service de métriques (optionnel)
class ValidationMetricsService {
  private static validationCount = 0;
  private static errorCount = 0;

  static trackValidation(success: boolean) {
    this.validationCount++;
    if (!success) this.errorCount++;
  }

  static getMetrics() {
    return {
      total: this.validationCount,
      errors: this.errorCount,
      successRate: ((this.validationCount - this.errorCount) / this.validationCount) * 100,
    };
  }
}
```

## 🚀 Conclusion

Ce système de validation Zod offre :

- ✅ **Type Safety** : Validation et types TypeScript cohérents
- ⚡ **Performance** : Cache, debounce, et optimisations
- 🎯 **UX** : Validation temps réel et messages d'erreur clairs
- 🛡️ **Sécurité** : Validation côté client ET serveur
- 🔧 **Maintenabilité** : Code modulaire et réutilisable

Pour toute question ou suggestion d'amélioration, consultez la documentation Zod officielle ou contactez l'équipe de développement.

---

*Dernière mise à jour : Septembre 2025*  
*Version système : 2.0.0*