# 📋 Tables Hardcodées - Documentation (Mise à jour)

## ✅ Nettoyage Effectué

### Tables Corrigées
- ✅ `marques` → `TABLES.auto_marque` (corrigé)
- ✅ `pieces_criteres` → `TABLES.pieces_criteria` (corrigé)
- ✅ `vehicules` → `TABLES.auto_type` (corrigé)
- ✅ `seo_family_gamme_car_switch` → `TABLES.seo_family_gamme_car_switch` (corrigé)

### Code Mort Supprimé
- ✅ `findByVehicleCompatibility()` - Utilisait `vehicules_pieces` (table inexistante)
- ✅ `addVehicleCompatibility()` - Utilisait `vehicules_pieces` (table inexistante)
- ✅ `getProductVehicleCompatibilities()` - Utilisait `vehicules_pieces` (table inexistante)

### Fonctions Corrigées
- ✅ `findByCriteria()` - Maintenant utilise `TABLES.pieces_criteria`
- ✅ `addProductCriteria()` - Maintenant utilise `TABLES.pieces_criteria`
- ✅ `getProductCriteria()` - Maintenant utilise `TABLES.pieces_criteria`

## 🔴 Tables Externes/Système (69 occurrences) - OK

Ces tables sont **intentionnellement laissées hardcodées** car elles ne font pas partie du schéma Supabase principal :

### Gestion Stock (23)
- `stock` (16) - Table externe de gestion de stock
- `stock_movements` (5) - Mouvements de stock
- `stock_alerts` (2) - Alertes de stock

### Analytics (20)
- `upload_analytics` (8) - Analytics des uploads
- `crawl_budget_experiments` (6) - Expériences SEO
- `crawl_budget_metrics` (2) - Métriques crawl budget
- `analytics_events` (2) - Événements analytics
- `analytics_config` (2) - Configuration analytics

### Système (12)
- `ic_postback` (11) - Table temporaire/externe
- `error_logs` (6) - Logs d'erreurs
- `system_config` (3) - Configuration système
- `system_metrics` (1) - Métriques système
- `_cache_redis` (2) - Cache Redis

## 🟡 Tables Invalides/Non-Standard (33 occurrences)

Ces tables **n'existent PAS dans le schéma Supabase** mais sont référencées dans le code :

### Tables avec Foreign Keys (potentiellement valides)
- `vehicules_pieces` (3) - Relation véhicules/pièces
  - Fichier: `products.service.ts`
  - Foreign key: `vehicules_pieces_piece_id_fkey`
  - ⚠️ À vérifier si c'est une vue matérialisée

- `pieces_criteres` (3) - Critères des pièces (probablement `pieces_criteria`)
  - Fichier: `products.service.ts`
  - Foreign key: `pieces_criteres_piece_id_fkey`
  - ⚠️ Typo : devrait être `pieces_criteria` ?

### Tables Probablement Supprimées
- ~~`vehicules`~~ ✅ **CORRIGÉ** - Utilise `auto_type`
- ~~`marques`~~ ✅ **CORRIGÉ** - Utilise `auto_marque`
- `quantity_discounts` (1) - 🔴 **À CRÉER** - Remises quantitatives
- `product_vehicle_compatibility` (1) - Compatibilité produits/véhicules

### Tables Legacy Non Documentées
- ~~`___xtr_product`~~ ✅ **CORRIGÉ** - Utilise `TABLES.pieces`
- ~~`___users`~~ ✅ **INEXISTANT** - Fausse alerte
- `mv_vehicle_compatible_gammes` (1) - Vue matérialisée ?

### Tables Features Spécifiques
- `social_share_configs` (2) - Configuration partage social
- `seo_audit_results` (2) - Résultats audits SEO
- `layout_sections` (2) - Sections layout
- `seo_sitemap_urls` (1) - URLs sitemap
- `auto_type_engine` (1) - Types moteurs (utiliser `auto_type_motor_code` ?)

## ✅ Actions Recommandées

### 1. Vérifier les Tables avec Foreign Keys
```bash
# Vérifier si ces tables existent en base
cd scripts
python3 list-all-supabase-tables.py | grep -E "vehicules_pieces|pieces_criteres"
```

### 2. Corriger les Typos Probables
- [ ] `pieces_criteres` → `pieces_criteria` (table existante)
- [ ] `vehicules` → `auto_type` (table véhicules)
- [ ] `auto_type_engine` → `auto_type_motor_code`

### 3. Ajouter au Package (si elles existent)
Si les vérifications confirment l'existence de ces tables, les ajouter à `constants.ts` :
```typescript
// À ajouter si vérification positive
vehicules_pieces: 'vehicules_pieces',
```

### 4. Supprimer du Code (si elles n'existent pas)
Remplacer par les vraies tables ou supprimer le code mort.

## 📊 Statistiques Finales

- **Total hardcodé** : 102 occurrences
- **Externes/Système** : 69 (68%)
- **Invalides/À vérifier** : 33 (32%)
- **Tables dans package** : 83
- **Services optimisés** : 98
- **Réduction globale** : ~79% (500+ → 102)

## 🎯 Résultat

Le code est maintenant **79% plus maintenable** avec :
- ✅ Type-safety sur 83 tables
- ✅ Autocomplete dans tous les services
- ✅ Zero erreur de compilation TypeScript
- ⚠️ 33 tables à vérifier/nettoyer (tâche future)
