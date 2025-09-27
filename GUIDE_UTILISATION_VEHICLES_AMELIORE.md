# 🚗 Guide d'Utilisation - Service Véhicules Amélioré

## 🎯 Vue d'Ensemble

Le `VehiclesService` a été considérablement amélioré en combinant le meilleur du service existant avec les fonctionnalités demandées. Il conserve **100% de compatibilité** avec l'API existante tout en ajoutant de nouvelles capacités.

## 🔧 Installation et Configuration

### Module Integration
```typescript
// Le service est automatiquement disponible via VehiclesModule
import { VehiclesModule } from './modules/vehicles/vehicles.module';

@Module({
  imports: [VehiclesModule],
})
export class AppModule {}
```

### Injection du Service
```typescript
import { VehiclesService, VehicleDetailsEnhanced } from './modules/vehicles/vehicles.service';

@Controller()
export class MyController {
  constructor(private vehiclesService: VehiclesService) {}
}
```

## 📖 Guide d'Utilisation des Méthodes

### 1. 🚗 Détails Complets d'un Véhicule

#### Nouvelle méthode `getVehicleDetails()`
```typescript
// Récupérer les détails complets avec relations
const vehicle: VehicleDetailsEnhanced = await this.vehiclesService.getVehicleDetails(
  140,    // marqueId: Renault
  140004, // modeleId: Clio III
  34746   // typeId: 1.5 dCi
);

// Accès aux données enrichies
console.log('Véhicule:', vehicle.auto_marque.marque_name, vehicle.auto_modele.modele_name, vehicle.type_name);
console.log('Puissance:', vehicle.type_power_ps, 'ch');
console.log('Carburant:', vehicle.type_fuel);
console.log('Période:', vehicle.type_year_from, '-', vehicle.type_year_to);
console.log('Logo marque:', vehicle.auto_marque.marque_logo);
console.log('Codes moteur:', vehicle.auto_type_motor_code?.map(c => c.tmc_code));
```

#### Exemple de réponse
```json
{
  "type_id": 34746,
  "type_name": "1.5 dCi",
  "type_power_ps": 68,
  "type_fuel": "Diesel",
  "type_year_from": "2005",
  "type_year_to": "2012",
  "auto_marque": {
    "marque_id": 140,
    "marque_name": "Renault",
    "marque_alias": "renault",
    "marque_logo": "renault-logo.png"
  },
  "auto_modele": {
    "modele_id": 140004,
    "modele_name": "Clio III",
    "modele_alias": "clio-iii"
  },
  "auto_type_motor_code": [
    {"tmc_code": "K9K 768", "tmc_description": "1.5 dCi 68ch"},
    {"tmc_code": "K9K 766", "tmc_description": "1.5 dCi 68ch"}
  ]
}
```

### 2. 🏭 Véhicules par Marque Optimisé

#### Nouvelle méthode `getVehiclesByMarque()`
```typescript
// Récupérer tous les véhicules d'une marque avec types
const renaultVehicles = await this.vehiclesService.getVehiclesByMarque(140);

console.log(`Total: ${renaultVehicles.total} modèles Renault`);

// Parcourir les modèles avec leurs types
renaultVehicles.data.forEach(modele => {
  console.log(`\n${modele.modele_name} (${modele.modele_year_from}-${modele.modele_year_to}):`);
  modele.auto_type.forEach(type => {
    console.log(`  - ${type.type_name} (${type.type_power_ps}ch, ${type.type_fuel})`);
  });
});
```

### 3. 📊 Gestion du Cache Intelligent

#### Statistiques du Cache
```typescript
const stats = this.vehiclesService.getCacheStats();
console.log('Cache Stats:', {
  totalEntries: stats.totalEntries,
  activeEntries: stats.activeEntries, 
  memoryUsage: stats.memoryUsage,
  ttl: stats.ttl
});
```

#### Nettoyage du Cache
```typescript
// Nettoyage complet
const deletedAll = this.vehiclesService.clearCache();
console.log(`Cache nettoyé: ${deletedAll} entrées supprimées`);

// Nettoyage sélectif
const deletedVehicles = this.vehiclesService.clearCache('vehicle_details');
console.log(`${deletedVehicles} détails véhicules supprimés du cache`);
```

### 4. 🔍 Méthodes Existantes (Compatibilité)

Toutes les méthodes existantes fonctionnent exactement comme avant :

```typescript
// Marques avec pagination
const brands = await this.vehiclesService.findAll({ 
  limit: 20, 
  search: 'ren' 
});

// Modèles d'une marque
const models = await this.vehiclesService.findModelsByBrand('140', {
  year: 2010,
  limit: 50
});

// Types d'un modèle
const types = await this.vehiclesService.findTypesByModel('140004', {
  year: 2010
});

// Recherche avancée
const results = await this.vehiclesService.searchAdvanced('clio', 10);

// Années par marque
const years = await this.vehiclesService.findYearsByBrand('140');

// Statistiques
const stats = await this.vehiclesService.getVehicleStats();
```

## 🌐 Endpoints API Disponibles

### Endpoints Existants (Compatibilité 100%)
```bash
# API REST classique
GET /api/vehicles/brands
GET /api/vehicles/brands/:brandId/models
GET /api/vehicles/models/:modelId/types
GET /api/vehicles/brands/:brandId/years
GET /api/vehicles/stats
```

### Nouveaux Endpoints (Améliorations)
```bash
# API améliorée avec cache
GET /api/vehicles-enhanced/details/:marqueId/:modeleId/:typeId
GET /api/vehicles-enhanced/marque/:marqueId/vehicles
GET /api/vehicles-enhanced/cache/stats
DELETE /api/vehicles-enhanced/cache?pattern=vehicle_details
GET /api/vehicles-enhanced/stats/detailed
GET /api/vehicles-enhanced/health
```

## 💡 Exemples d'Usage Frontend

### React/TypeScript
```typescript
// Service API côté frontend
class VehicleApiService {
  async getVehicleDetails(marqueId: number, modeleId: number, typeId: number) {
    const response = await fetch(
      `/api/vehicles-enhanced/details/${marqueId}/${modeleId}/${typeId}`
    );
    return response.json();
  }
  
  async getMarqueVehicles(marqueId: number) {
    const response = await fetch(
      `/api/vehicles-enhanced/marque/${marqueId}/vehicles`
    );
    return response.json();
  }
}

// Utilisation dans un composant
const VehicleDetailComponent = ({ marqueId, modeleId, typeId }) => {
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadVehicle = async () => {
      try {
        const data = await vehicleApi.getVehicleDetails(marqueId, modeleId, typeId);
        setVehicle(data);
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadVehicle();
  }, [marqueId, modeleId, typeId]);
  
  if (loading) return <div>Chargement...</div>;
  
  return (
    <div>
      <h1>{vehicle.auto_marque.marque_name} {vehicle.auto_modele.modele_name}</h1>
      <p>{vehicle.type_name} - {vehicle.type_power_ps}ch</p>
      <p>Carburant: {vehicle.type_fuel}</p>
      <p>Période: {vehicle.type_year_from} - {vehicle.type_year_to}</p>
      {vehicle.auto_type_motor_code && (
        <div>
          <h3>Codes moteur:</h3>
          <ul>
            {vehicle.auto_type_motor_code.map(code => (
              <li key={code.tmc_code}>{code.tmc_code} - {code.tmc_description}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

## ⚡ Performance et Cache

### Métriques Typiques
```typescript
// Premier appel (base de données)
const start1 = Date.now();
const vehicle1 = await service.getVehicleDetails(140, 140004, 34746);
console.log(`Premier appel: ${Date.now() - start1}ms`); // ~800ms

// Deuxième appel (cache)
const start2 = Date.now(); 
const vehicle2 = await service.getVehicleDetails(140, 140004, 34746);
console.log(`Deuxième appel: ${Date.now() - start2}ms`); // ~5ms
```

### Monitoring du Cache
```typescript
// Surveiller les performances
setInterval(async () => {
  const stats = service.getCacheStats();
  console.log(`Cache: ${stats.activeEntries}/${stats.totalEntries} actives, ${stats.memoryUsage} mémoire`);
  
  // Nettoyage automatique si trop de mémoire
  if (parseInt(stats.memoryUsage) > 1024) { // > 1MB
    const deleted = service.clearCache();
    console.log(`Cache nettoyé automatiquement: ${deleted} entrées`);
  }
}, 60000); // Chaque minute
```

## 🔧 Configuration Avancée

### Personnalisation du TTL Cache
```typescript
// Dans le service, modifier la constante
private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes au lieu de 5
```

### Désactiver le Cache (Debug)
```typescript
// Remplacer dans les méthodes
const cached = null; // this.getCached<T>(cacheKey);
// this.setCache(cacheKey, data); // Commenter
```

### Logging Détaillé
```typescript
// Le service utilise déjà Logger de NestJS
// Pour plus de détails, ajuster le niveau de log dans main.ts
app.useLogger(['log', 'debug', 'error', 'verbose', 'warn']);
```

## 🚨 Gestion d'Erreurs

### Exceptions Possibles
```typescript
try {
  const vehicle = await service.getVehicleDetails(999, 999, 999);
} catch (error) {
  if (error.message.includes('non trouvé')) {
    // Véhicule inexistant
    return res.status(404).json({ error: 'Véhicule non trouvé' });
  } else {
    // Erreur base de données
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
```

### Validation des Paramètres
```typescript
// Validation côté contrôleur
@Get('details/:marqueId/:modeleId/:typeId')
async getVehicleDetails(
  @Param('marqueId', ParseIntPipe) marqueId: number,
  @Param('modeleId', ParseIntPipe) modeleId: number,
  @Param('typeId', ParseIntPipe) typeId: number,
) {
  return this.vehiclesService.getVehicleDetails(marqueId, modeleId, typeId);
}
```

## 📋 Checklist Migration

### Pour Migrer vers le Service Amélioré

- [ ] **Installer** : Le service amélioré est rétro-compatible
- [ ] **Tester** : Les méthodes existantes fonctionnent identiquement  
- [ ] **Intégrer** : Ajouter `VehiclesEnhancedController` au module
- [ ] **Utiliser** : Commencer par `getVehicleDetails()` et `getVehiclesByMarque()`
- [ ] **Monitorer** : Vérifier `getCacheStats()` régulièrement
- [ ] **Optimiser** : Ajuster TTL cache selon utilisation

### Pas de Breaking Changes
✅ Toutes les méthodes existantes conservent leur signature  
✅ Les réponses JSON restent identiques  
✅ Les endpoints API ne changent pas  
✅ Migration transparente et progressive possible  

---

**Le service véhicules amélioré est maintenant prêt à l'utilisation !** 🚀

Il combine le meilleur du service existant validé avec les nouvelles fonctionnalités demandées, tout en conservant une compatibilité totale et en ajoutant un système de cache intelligent pour optimiser les performances.