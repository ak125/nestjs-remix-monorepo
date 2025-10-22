# @fafa/patterns

Patterns compositionnels **stateless & réutilisables**.

## 🧩 Patterns Disponibles

- `ProductCard` - Carte produit vitrine
- `VehicleSelector` - Sélecteur véhicule
- `AdminShell` - Layout admin
- `FormLayout` - Layout formulaire
- `DataTable` - Tableau de données
- `PageHeader` - En-tête de page
- `DashboardCard` - Carte dashboard

## 📖 Usage

```typescript
import { ProductCard, VehicleSelector } from '@fafa/patterns';

<ProductCard 
  title="Product"
  price={99}
  onAddToCart={() => {}}
/>
```

## 🎨 Dépendances

- `@fafa/ui` (composants de base)
- `@fafa/theme-automecanik` (thème vitrine)
- `@fafa/theme-admin` (thème admin)
