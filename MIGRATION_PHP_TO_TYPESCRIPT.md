# Migration PHP vers TypeScript - Service Analytics

## 📋 Résumé

Les anciens fichiers PHP du service analytics ont été **complètement remplacés** par des endpoints TypeScript modernes dans le framework NestJS.

## 🔄 Mapping des Endpoints

### Endpoints Modernes (Recommandés)
```
🆕 GET /api/analytics/track.js         → Remplace analytics.track.php
🆕 GET /api/analytics/track.min.js     → Remplace analytics.track.min.php
🆕 GET /api/analytics/script           → Endpoint API JSON moderne
🆕 POST /api/analytics/track           → Tracking moderne avec JSON
```

### Endpoints de Compatibilité (Legacy)
```
🔄 GET /api/analytics/track.php        → Compatibilité avec ancien PHP
🔄 GET /api/analytics/track.min.php    → Compatibilité avec ancien PHP minifié
🔄 GET /api/analytics/v7.track.php     → Compatibilité version 7
```

## ✅ Avantages de la Migration

### 1. **Performance**
- ❌ PHP : Interprétation à chaque requête
- ✅ TypeScript : Code compilé et optimisé
- ✅ Cache Redis intégré (TTL: 1 heure)

### 2. **Maintenance**
- ❌ PHP : Code isolé, difficile à maintenir
- ✅ TypeScript : Intégration complète avec le monorepo
- ✅ Type safety et validation automatique

### 3. **Fonctionnalités**
- ✅ Support multi-providers (Google Analytics, Matomo, Plausible)
- ✅ Configuration via variables d'environnement
- ✅ Logging et monitoring intégrés
- ✅ Headers HTTP optimisés pour le cache

## 🚀 Utilisation

### Pour Nouveaux Projets
```html
<!-- Script moderne -->
<script src="https://votre-domaine.com/api/analytics/track.js"></script>

<!-- Script minifié -->
<script src="https://votre-domaine.com/api/analytics/track.min.js"></script>
```

### Pour Projets Existants
```html
<!-- Continue à fonctionner (compatibilité) -->
<script src="https://votre-domaine.com/api/analytics/track.php"></script>
<script src="https://votre-domaine.com/api/analytics/track.min.php"></script>
```

## 🔧 Configuration

### Variables d'Environnement
```bash
# Analytics Providers
ANALYTICS_GOOGLE_ID=GA_MEASUREMENT_ID
ANALYTICS_MATOMO_URL=https://matomo.example.com
ANALYTICS_MATOMO_SITE_ID=1
ANALYTICS_PLAUSIBLE_DOMAIN=example.com

# Provider Priority
ANALYTICS_PROVIDER=google  # ou 'matomo', 'plausible', 'custom'
```

## 📊 Endpoints Disponibles

### 1. Health Check
```bash
curl http://localhost:3000/api/analytics/health
```

### 2. Configuration
```bash
curl http://localhost:3000/api/analytics/config
```

### 3. Script Tracking
```bash
# Moderne
curl http://localhost:3000/api/analytics/track.js

# Legacy (compatibilité)
curl http://localhost:3000/api/analytics/track.php
```

### 4. Tracking d'Événements
```bash
curl -X POST http://localhost:3000/api/analytics/track \
  -H "Content-Type: application/json" \
  -d '{"event": "page_view", "page": "/home"}'
```

## 🎯 Migration Progressive

### Phase 1 : Coexistence (Actuelle)
- ✅ Endpoints TypeScript opérationnels
- ✅ Endpoints de compatibilité .php
- ✅ Monitoring des deux systèmes

### Phase 2 : Transition (Recommandée)
- 🔄 Migrer les nouveaux projets vers .js
- 🔄 Maintenir .php pour l'existant
- 🔄 Ajouter headers de dépréciation

### Phase 3 : Finalisation
- 🎯 Supprimer les endpoints .php
- 🎯 Full TypeScript moderne
- 🎯 Documentation complète

## 📝 Notes Techniques

- **Content-Type**: `application/javascript` pour tous les scripts
- **Cache-Control**: `public, max-age=3600` (1 heure)
- **Compression**: Gzip automatique via NestJS
- **Error Handling**: Logging centralisé
- **Monitoring**: Métriques intégrées

## 🔗 Liens Utiles

- [Documentation NestJS Analytics](./src/modules/analytics/README.md)
- [Configuration Service](./src/modules/analytics/services/simple-analytics.service.ts)
- [Tests d'Intégration](./test/analytics.e2e-spec.ts)

---

**✅ Migration Complète** : Les fichiers PHP ont été entièrement remplacés par TypeScript avec compatibilité backward totale.
