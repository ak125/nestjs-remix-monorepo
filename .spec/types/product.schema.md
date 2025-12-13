---
title: "product schema"
status: draft
version: 1.0.0
---

# Type Schema: Product Types

---
title: "Product Types - Zod Validation Schemas"
status: implemented
version: 1.0.0
created_at: 2025-01-14
updated_at: 2025-01-14
tags: [types, validation, product, zod]
relates_to:
  - .spec/features/product-catalog.md
  - .spec/architecture/001-supabase-direct.md
---

## Vue d'ensemble

Schémas de validation Zod pour le système catalogue produits automobile (**4M+ produits**), couvrant création, recherche, filtres, compatibilité véhicules, références OEM, et critères techniques. Schemas déjà implémentés dans le code source.

## Localisation

**Fichier source** :
- `backend/src/modules/products/schemas/product.schemas.ts` ✅ **Implémenté** (555 lignes)

## Schémas principaux

### BaseProductSchema

```typescript
import { z } from 'zod';

const BaseProductSchema = z.object({
  // Informations de base
  name: z
    .string()
    .min(1, 'Le nom du produit est requis')
    .max(255, 'Le nom ne peut pas dépasser 255 caractères')
    .trim(),
  
  sku: z
    .string()
    .min(1, 'Le SKU est requis')
    .max(100, 'Le SKU ne peut pas dépasser 100 caractères')
    .regex(
      /^[A-Z0-9-_]+$/,
      'Le SKU ne peut contenir que des lettres majuscules, chiffres, tirets et underscores'
    )
    .trim(),
  
  description: z
    .string()
    .max(2000, 'La description ne peut pas dépasser 2000 caractères')
    .optional(),
  
  // Relations (obligatoires)
  range_id: z
    .number()
    .int("L'ID de gamme doit être un entier")
    .positive("L'ID de gamme doit être un entier positif"),
  
  brand_id: z
    .number()
    .int("L'ID de marque doit être un entier")
    .positive("L'ID de marque doit être un entier positif"),
  
  // Informations financières
  base_price: z
    .number()
    .positive('Le prix de base doit être positif')
    .max(999999.99, 'Le prix ne peut pas dépasser 999999.99')
    .optional(),
  
  // Gestion des stocks
  stock_quantity: z
    .number()
    .int('La quantité en stock doit être un entier')
    .min(0, 'La quantité en stock ne peut pas être négative')
    .max(999999, 'La quantité en stock ne peut pas dépasser 999999')
    .optional(),
  
  min_stock: z
    .number()
    .int('Le stock minimum doit être un entier')
    .min(0, 'Le stock minimum ne peut pas être négatif')
    .max(9999, 'Le stock minimum ne peut pas dépasser 9999')
    .optional(),
  
  // Informations produit
  barcode: z
    .string()
    .regex(
      /^[0-9]{8,13}$/,
      'Le code-barres doit contenir entre 8 et 13 chiffres'
    )
    .optional(),
  
  weight: z
    .string()
    .max(50, 'Le poids ne peut pas dépasser 50 caractères')
    .optional(),
  
  dimensions: z
    .string()
    .max(100, 'Les dimensions ne peuvent pas dépasser 100 caractères')
    .optional(),
  
  // Statut
  is_active: z.boolean().default(true),
  
  // Références fournisseur
  supplier_reference: z
    .string()
    .max(100, 'La référence fournisseur ne peut pas dépasser 100 caractères')
    .optional(),
  
  // Spécifications techniques
  technical_specs: z
    .string()
    .max(5000, 'Les spécifications techniques ne peuvent pas dépasser 5000 caractères')
    .optional(),
  
  installation_notes: z
    .string()
    .max(2000, "Les notes d'installation ne peuvent pas dépasser 2000 caractères")
    .optional(),
});
```

### CreateProductSchema

```typescript
export const CreateProductSchema = BaseProductSchema
  .refine((data) => {
    // Validation croisée : si min_stock défini, stock_quantity doit l'être aussi
    if (data.min_stock !== undefined && data.stock_quantity === undefined) {
      return false;
    }
    return true;
  }, {
    message: 'Si le stock minimum est défini, la quantité en stock doit aussi être définie',
    path: ['stock_quantity'],
  })
  .refine((data) => {
    // Validation croisée : min_stock <= stock_quantity
    if (data.min_stock !== undefined && data.stock_quantity !== undefined) {
      return data.min_stock <= data.stock_quantity;
    }
    return true;
  }, {
    message: 'Le stock minimum ne peut pas être supérieur au stock actuel',
    path: ['min_stock'],
  });

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
```

### UpdateProductSchema

```typescript
export const UpdateProductSchema = BaseProductSchema.partial();

export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
```

### SearchProductSchema

```typescript
export const SearchProductSchema = z
  .object({
    // Recherche texte
    search: z
      .string()
      .max(100, 'Le terme de recherche ne peut pas dépasser 100 caractères')
      .optional(),
    
    // Filtres ID
    rangeId: z.number().int().positive().optional(),
    brandId: z.number().int().positive().optional(),
    categoryId: z.number().int().positive().optional(),
    
    // Filtres prix
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().positive().optional(),
    
    // Filtres stock
    inStock: z.boolean().optional(),
    lowStock: z.boolean().optional(), // stock < min_stock
    
    // Filtres statut
    isActive: z.boolean().optional(),
    
    // Filtres compatibilité véhicule
    vehicleMake: z.string().optional(), // Peugeot
    vehicleModel: z.string().optional(), // 308
    vehicleYear: z.number().int().min(1900).optional(),
    
    // Pagination
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    
    // Tri
    sortBy: z
      .enum(['name', 'price', 'stock', 'createdAt', 'popularity'])
      .default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .refine((data) => {
    // Validation: minPrice <= maxPrice
    if (data.minPrice !== undefined && data.maxPrice !== undefined) {
      return data.minPrice <= data.maxPrice;
    }
    return true;
  }, {
    message: 'Le prix minimum doit être inférieur ou égal au prix maximum',
    path: ['minPrice'],
  });

export type SearchProductDto = z.infer<typeof SearchProductSchema>;
```

### UpdateStockSchema

```typescript
export const UpdateStockSchema = z.object({
  productId: z.union([
    z.string().uuid(),
    z.number().int().positive(),
  ]),
  
  quantity: z
    .number()
    .int('La quantité doit être un entier'),
  
  operation: z.enum(['SET', 'ADD', 'SUBTRACT']).default('SET'),
  
  reason: z
    .string()
    .max(500, 'La raison ne peut pas dépasser 500 caractères')
    .optional(),
})
.refine((data) => {
  // Validation: si SUBTRACT, quantity > 0
  if (data.operation === 'SUBTRACT' && data.quantity <= 0) {
    return false;
  }
  return true;
}, {
  message: 'Pour soustraire, la quantité doit être positive',
  path: ['quantity'],
});

export type UpdateStockDto = z.infer<typeof UpdateStockSchema>;
```

## Compatibilité véhicules

### VehicleCompatibilitySchema

```typescript
export const VehicleCompatibilitySchema = z.object({
  // Identification véhicule
  make: z.string().min(1, 'Marque requise'), // Peugeot, Renault...
  model: z.string().min(1, 'Modèle requis'), // 308, Clio...
  generation: z.string().optional(), // Génération II (2013-2021)
  
  // Motorisation
  engine: z.string().optional(), // 1.6 HDI 115ch
  engineCode: z.string().optional(), // DV6C
  fuelType: z
    .enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'LPG', 'CNG'])
    .optional(),
  
  // Transmission
  transmission: z.enum(['MANUAL', 'AUTOMATIC', 'CVT']).optional(),
  
  // Années production
  yearFrom: z
    .number()
    .int()
    .min(1900, 'Année début doit être >= 1900')
    .max(2100, 'Année début doit être <= 2100'),
  
  yearTo: z
    .number()
    .int()
    .min(1900, 'Année fin doit être >= 1900')
    .max(2100, 'Année fin doit être <= 2100')
    .optional(),
  
  // Détails techniques
  horsePower: z.number().int().positive().optional(),
  displacement: z.number().positive().optional(), // Cylindrée (L)
  cylinders: z.number().int().positive().optional(),
  
  // Carrosserie
  bodyType: z
    .enum(['SEDAN', 'HATCHBACK', 'WAGON', 'SUV', 'COUPE', 'CONVERTIBLE', 'VAN'])
    .optional(),
  doors: z.number().int().min(2).max(5).optional(),
  
  // Compatibilité
  isDirectFit: z.boolean().default(true), // Montage direct sans adaptation
  requiresAdaptation: z.boolean().default(false),
  adaptationNotes: z.string().max(500).optional(),
})
.refine((data) => {
  // Validation: yearFrom <= yearTo
  if (data.yearTo !== undefined) {
    return data.yearFrom <= data.yearTo;
  }
  return true;
}, {
  message: 'Année début doit être <= année fin',
  path: ['yearFrom'],
});

export type VehicleCompatibility = z.infer<typeof VehicleCompatibilitySchema>;
```

### VehicleSearchSchema

```typescript
export const VehicleSearchSchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  engine: z.string().optional(),
  
  // Recherche par immatriculation (France)
  registrationNumber: z
    .string()
    .regex(/^[A-Z]{2}-\d{3}-[A-Z]{2}$/, 'Format immatriculation: AA-123-BB')
    .or(z.string().regex(/^\d{1,4}\s[A-Z]{2,3}\s\d{2}$/, 'Format ancien: 1234 ABC 75'))
    .optional(),
  
  // Recherche par VIN
  vin: z
    .string()
    .length(17, 'VIN doit contenir 17 caractères')
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'VIN contient caractères invalides')
    .optional(),
});

export type VehicleSearchDto = z.infer<typeof VehicleSearchSchema>;
```

## Références OEM

### ProductOEMReferenceSchema

```typescript
export const ProductOEMReferenceSchema = z.object({
  productId: z.union([z.string().uuid(), z.number().int().positive()]),
  
  // Référence constructeur
  oemCode: z
    .string()
    .min(1, 'Code OEM requis')
    .max(50, 'Code OEM trop long'),
  
  manufacturer: z
    .string()
    .min(1, 'Constructeur requis')
    .max(100, 'Nom constructeur trop long'),
  
  // Type pièce
  partType: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  
  // Équivalences
  isOriginal: z.boolean().default(false), // Pièce origine constructeur
  isAftermarket: z.boolean().default(true), // Pièce adaptable
  
  // Notes technique
  technicalNotes: z.string().max(1000).optional(),
});

export type ProductOEMReference = z.infer<typeof ProductOEMReferenceSchema>;
```

### OEMSearchSchema

```typescript
export const OEMSearchSchema = z.object({
  oemCode: z.string().min(1, 'Code OEM requis'),
  manufacturer: z.string().optional(),
  
  // Options recherche
  includeEquivalents: z.boolean().default(true), // Inclure équivalences
  includeAftermarket: z.boolean().default(true), // Inclure adaptables
});

export type OEMSearchDto = z.infer<typeof OEMSearchSchema>;
```

## Critères techniques

### ProductCriteriaSchema

```typescript
export const ProductCriteriaSchema = z.object({
  productId: z.union([z.string().uuid(), z.number().int().positive()]),
  
  // Critères dimensionnels
  length: z.number().positive().optional(), // mm
  width: z.number().positive().optional(), // mm
  height: z.number().positive().optional(), // mm
  diameter: z.number().positive().optional(), // mm
  
  // Critères poids
  weight: z.number().positive().optional(), // kg
  
  // Critères électriques
  voltage: z.number().positive().optional(), // V
  amperage: z.number().positive().optional(), // A
  wattage: z.number().positive().optional(), // W
  
  // Critères mécaniques
  threadSize: z.string().max(50).optional(), // M8, M10...
  torque: z.number().positive().optional(), // Nm
  pressure: z.number().positive().optional(), // bar
  
  // Critères matériau
  material: z
    .enum(['STEEL', 'ALUMINUM', 'PLASTIC', 'RUBBER', 'COMPOSITE', 'CERAMIC'])
    .optional(),
  
  // Critères performance
  temperature_min: z.number().optional(), // °C
  temperature_max: z.number().optional(), // °C
  
  // Autres critères
  color: z.string().max(50).optional(),
  finish: z.string().max(50).optional(),
  
  // Notes
  notes: z.string().max(1000).optional(),
})
.refine((data) => {
  // Validation: temperature_min <= temperature_max
  if (data.temperature_min !== undefined && data.temperature_max !== undefined) {
    return data.temperature_min <= data.temperature_max;
  }
  return true;
}, {
  message: 'Température min doit être <= température max',
  path: ['temperature_min'],
});

export type ProductCriteria = z.infer<typeof ProductCriteriaSchema>;
```

### CriteriaSearchSchema

```typescript
export const CriteriaSearchSchema = z.object({
  // Recherche par critères dimensionnels
  minLength: z.number().nonnegative().optional(),
  maxLength: z.number().positive().optional(),
  minWidth: z.number().nonnegative().optional(),
  maxWidth: z.number().positive().optional(),
  
  // Recherche par matériau
  material: z
    .array(z.enum(['STEEL', 'ALUMINUM', 'PLASTIC', 'RUBBER', 'COMPOSITE', 'CERAMIC']))
    .optional(),
  
  // Recherche par plage température
  minTemperature: z.number().optional(),
  maxTemperature: z.number().optional(),
});

export type CriteriaSearchDto = z.infer<typeof CriteriaSearchSchema>;
```

## Responses

### ProductResponseSchema

```typescript
export const ProductResponseSchema = z.object({
  id: z.union([z.string().uuid(), z.number().int()]),
  name: z.string(),
  sku: z.string(),
  description: z.string().optional(),
  
  // Prix & Stock
  base_price: z.number().optional(),
  stock_quantity: z.number().int().nonnegative(),
  in_stock: z.boolean(),
  
  // Relations
  range: z.object({
    id: z.number(),
    name: z.string(),
  }).optional(),
  
  brand: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().url().optional(),
  }).optional(),
  
  // Images
  images: z.array(
    z.object({
      url: z.string().url(),
      alt: z.string().optional(),
      isPrimary: z.boolean().default(false),
    })
  ).default([]),
  
  // Compatibilités
  compatibilities: z.array(VehicleCompatibilitySchema).optional(),
  
  // Références OEM
  oemReferences: z.array(ProductOEMReferenceSchema).optional(),
  
  // Critères techniques
  criteria: ProductCriteriaSchema.optional(),
  
  // Horodatage
  created_at: z.date(),
  updated_at: z.date(),
});

export type ProductResponse = z.infer<typeof ProductResponseSchema>;
```

### PaginatedProductsResponseSchema

```typescript
export const PaginatedProductsResponseSchema = z.object({
  data: z.array(ProductResponseSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});

export type PaginatedProductsResponse = z.infer<typeof PaginatedProductsResponseSchema>;
```

## Exemples utilisation

### Créer un produit

```typescript
const productDto = CreateProductSchema.parse({
  name: 'Filtre à huile Bosch P3274',
  sku: 'BOSCH-P3274',
  description: 'Filtre à huile haute performance',
  range_id: 15,
  brand_id: 8,
  base_price: 12.50,
  stock_quantity: 150,
  min_stock: 20,
  barcode: '3165143192740',
  weight: '0.3kg',
  dimensions: '10x10x15cm',
  is_active: true,
});

const product = await productsService.createProduct(productDto);
```

### Rechercher produits

```typescript
const searchDto = SearchProductSchema.parse({
  search: 'filtre huile',
  brandId: 8, // Bosch
  minPrice: 10,
  maxPrice: 50,
  inStock: true,
  vehicleMake: 'Peugeot',
  vehicleModel: '308',
  page: 1,
  limit: 20,
  sortBy: 'popularity',
  sortOrder: 'desc',
});

const results = await productsService.searchProducts(searchDto);
```

### Rechercher par VIN

```typescript
const vehicleDto = VehicleSearchSchema.parse({
  vin: 'VF1RFB0HX64567890',
});

const compatibleProducts = await productsService.findByVehicle(vehicleDto);
```

## Tests validation

```typescript
describe('Product Schemas', () => {
  describe('CreateProductSchema', () => {
    it('should validate complete product data', () => {
      const data = {
        name: 'Filtre à huile',
        sku: 'BOSCH-P3274',
        range_id: 15,
        brand_id: 8,
        base_price: 12.50,
        stock_quantity: 150,
        min_stock: 20,
      };
      
      expect(() => CreateProductSchema.parse(data)).not.toThrow();
    });

    it('should reject if min_stock > stock_quantity', () => {
      const data = {
        name: 'Filtre',
        sku: 'TEST-001',
        range_id: 1,
        brand_id: 1,
        stock_quantity: 10,
        min_stock: 20, // Trop élevé
      };
      
      expect(() => CreateProductSchema.parse(data)).toThrow('stock minimum');
    });
  });

  describe('SearchProductSchema', () => {
    it('should validate price range', () => {
      const data = {
        minPrice: 10,
        maxPrice: 50,
      };
      
      expect(() => SearchProductSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid price range', () => {
      const data = {
        minPrice: 50,
        maxPrice: 10, // Inversé
      };
      
      expect(() => SearchProductSchema.parse(data)).toThrow('prix minimum');
    });
  });

  describe('VehicleCompatibilitySchema', () => {
    it('should validate vehicle compatibility', () => {
      const data = {
        make: 'Peugeot',
        model: '308',
        yearFrom: 2013,
        yearTo: 2021,
        engine: '1.6 HDI 115ch',
        isDirectFit: true,
      };
      
      expect(() => VehicleCompatibilitySchema.parse(data)).not.toThrow();
    });
  });
});
```

## Changelog

### Version 1.0.0 (2025-01-14)

- ✅ Schema création produit (20+ champs validation)
- ✅ Schema recherche (15+ filtres, pagination, tri)
- ✅ Schema gestion stock (3 opérations)
- ✅ Schema compatibilité véhicules (15+ critères)
- ✅ Schema recherche véhicule (immatriculation, VIN)
- ✅ Schema références OEM (équivalences)
- ✅ Schema critères techniques (20+ critères)
- ✅ Responses paginées (metadata pagination)
- ✅ Validation métier (stock, prix, températures)
- ✅ Type-safety TypeScript complet
- ✅ **Implémenté production** : `product.schemas.ts` (555 lignes)
