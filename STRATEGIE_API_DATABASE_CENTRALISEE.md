# 📋 STRATÉGIE API REST & DATABASE CENTRALISÉE

## 🎯 Objectif
Éviter les confusions de schéma database et centraliser la gestion des APIs REST pour une maintenance optimale.

## 📊 1. SERVICE DE SCHÉMA CENTRALISÉ

### `DatabaseSchemaService`
```typescript
@Injectable()
export class DatabaseSchemaService {
  private schemas = new Map();
  
  // Enregistrer les schémas réels depuis Supabase
  async loadSchema(tableName: string) {
    const schema = await this.introspectTable(tableName);
    this.schemas.set(tableName, schema);
  }
  
  // Valider les requêtes avant exécution
  validateQuery(tableName: string, fields: string[]) {
    const schema = this.schemas.get(tableName);
    return fields.every(field => schema.columns.includes(field));
  }
}
```

## 🔧 2. FACTORY PATTERN POUR LES APIS

### `ApiServiceFactory`
```typescript
@Injectable()
export class ApiServiceFactory {
  private services = new Map();
  
  createService(entity: string): BaseApiService {
    if (!this.services.has(entity)) {
      const service = new BaseApiService(entity, this.schemaService);
      this.services.set(entity, service);
    }
    return this.services.get(entity);
  }
}
```

## 📝 3. BASE SERVICE AVEC VALIDATION

### `BaseApiService`
```typescript
export abstract class BaseApiService {
  constructor(
    protected tableName: string,
    protected schemaService: DatabaseSchemaService
  ) {}
  
  async find(fields: string[], conditions: any) {
    // Validation automatique du schéma
    this.schemaService.validateQuery(this.tableName, fields);
    
    // Exécution sécurisée
    return await this.client
      .from(this.tableName)
      .select(fields.join(','))
      .match(conditions);
  }
}
```

## 🏗️ 4. ARCHITECTURE RECOMMANDÉE

```
backend/src/
├── database/
│   ├── schemas/           # Schémas centralisés
│   │   ├── pieces.schema.ts
│   │   ├── pieces_marque.schema.ts
│   │   └── pieces_price.schema.ts
│   ├── services/
│   │   ├── schema.service.ts       # Service de validation
│   │   ├── api-factory.service.ts  # Factory pour APIs
│   │   └── base-api.service.ts     # Service de base
│   └── validators/
│       └── query.validator.ts      # Validation des requêtes
```

## 🎯 5. IMPLÉMENTATION CONCRÈTE

### Étape 1: Créer le service de schéma
```bash
nest g service database/services/schema
```

### Étape 2: Enregistrer les schémas au démarrage
```typescript
@Injectable()
export class AppInitService implements OnModuleInit {
  async onModuleInit() {
    await this.schemaService.loadSchema('pieces');
    await this.schemaService.loadSchema('pieces_marque');
    await this.schemaService.loadSchema('pieces_price');
  }
}
```

### Étape 3: Utiliser dans CartDataService
```typescript
export class CartDataService extends BaseApiService {
  constructor(schemaService: DatabaseSchemaService) {
    super('pieces', schemaService);
  }
  
  async getProductWithAllData(productId: number) {
    // Validation automatique des champs
    const validFields = this.validateFields([
      'piece_id', 'piece_name', 'piece_ref', 'piece_pm_id'
    ]);
    
    return await this.find(validFields, { piece_id: productId });
  }
}
```

## ✅ 6. AVANTAGES DE CETTE APPROCHE

1. **🔒 Validation automatique** : Plus d'erreurs de colonnes inexistantes
2. **📊 Centralisation** : Un seul endroit pour les schémas
3. **🔄 Auto-découverte** : Introspection automatique des tables
4. **🛡️ Sécurité** : Validation avant exécution
5. **📈 Maintenabilité** : Code réutilisable et évolutif

## 🚀 7. MIGRATION PROGRESSIVE

### Phase 1: Créer les services de base
- DatabaseSchemaService
- BaseApiService  
- ApiServiceFactory

### Phase 2: Migrer CartDataService
- Hériter de BaseApiService
- Utiliser la validation automatique

### Phase 3: Étendre aux autres services
- ProductsService
- VehiclesService
- Etc.

## 🔧 8. EXEMPLE D'UTILISATION

```typescript
// Avant (problématique)
const { data } = await this.client
  .from('pieces')
  .select('piece_marque')  // ❌ Colonne inexistante
  .eq('piece_id', id);

// Après (sécurisé)
const product = await this.apiFactory
  .createService('pieces')
  .getWithBrand(id);  // ✅ Validation automatique
```

## 📋 9. CHECKLIST D'IMPLÉMENTATION

- [ ] Créer DatabaseSchemaService
- [ ] Créer BaseApiService
- [ ] Créer ApiServiceFactory
- [ ] Migrer CartDataService
- [ ] Ajouter tests unitaires
- [ ] Documentation API
- [ ] Formation équipe

## 🎯 10. RÉSULTAT ATTENDU

Fini les erreurs de schéma ! Plus de confusion entre `piece_marque` et `piece_pm_id`. 
Un système robuste et évolutif pour toutes les APIs.