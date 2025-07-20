# Services Automobiles - TEMPORAIREMENT DÉSACTIVÉS

## État actuel
Ces services ont été temporairement désactivés car ils dépendent de Prisma et causent 15 erreurs de compilation TypeScript.

## Services déplacés
- `automotive-orders.service.ts` - Service principal automobiles
- `orders-automotive-integration.service.ts` - Service d'intégration Prisma
- `tax-calculation.service.ts` - Calcul des taxes
- `vehicle-data.service.ts` - Données véhicules
- `advanced-shipping.service.ts` - Livraison avancée

## Plan de refactorisation

### Phase 1: Migration des services individuels
1. **TaxCalculationService** → Migrer vers SupabaseRestService
2. **VehicleDataService** → Migrer vers SupabaseRestService  
3. **AdvancedShippingService** → Migrer vers SupabaseRestService

### Phase 2: Reconstruction des services principaux
4. **OrdersAutomotiveIntegrationService** → Réécrire complètement avec SupabaseRestService
5. **AutomotiveOrdersService** → Reconfigurer avec nouveaux services

### Phase 3: Réactivation
6. Remettre les services dans `/services/`
7. Réactiver dans `orders.module.ts`
8. Tests d'intégration complets

## Priorité
🔥 **HAUTE** - Ces services représentent des fonctionnalités critiques pour le secteur automobile.

## Architecture cible
```typescript
// Remplacer Prisma par SupabaseRestService
const order = await this.supabaseService.query(
  'orders',
  { vehicle_type: 'automotive' }
);
```

## Contact
Voir `AUDIT_RAPPORT.md` pour les détails complets de l'architecture.
