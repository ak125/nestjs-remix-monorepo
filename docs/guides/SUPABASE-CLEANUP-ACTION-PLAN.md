# 🎯 PLAN D'ACTION - NETTOYAGE BASE SUPABASE

## 📊 Vue d'ensemble

- **448 fichiers** scannés
- **143 tables** non trouvées 
- **77 colonnes** manquantes
- **48 tables** à traiter

---

## ✅ 1. CORRECTIONS AUTOMATIQUES (TERMINÉES)

### 🟢 Tables SEO corrigées (+12)
- `seo_gamme_car` → `__seo_gamme_car`
- `seo_gamme_car_switch` → `__seo_gamme_car_switch`
- `seo_item_switch` → `__seo_item_switch`
- etc.

### 🟢 Casse incorrecte à corriger (+26)
- `___XTR_ORDER` (14x) → `___xtr_order`
- `___META_TAGS_ARIANE` (5x) → `___meta_tags_ariane`
- `___XTR_ORDER_LINE` (3x) → `___xtr_order_line`
- `___XTR_ORDER_STATUS` (2x) → `___xtr_order_status`
- `___FOOTER_MENU` (2x) → `___footer_menu`

**Script:** `python3 scripts/fix-table-case.py`

---

## 🟡 2. TABLES BLOG (6 tables) - DÉCISION MÉTIER REQUISE

| Table | Occurrences | Fichiers concernés | Action recommandée |
|-------|-------------|-------------------|-------------------|
| `__blog_constructeur` | 15x | `blog/services/constructeur.service.ts` | ✅ **CRÉER** - Fonctionnalité blog constructeurs |
| `__blog_glossaire` | 10x | `blog/services/glossary.service.ts` | ✅ **CRÉER** - Glossaire blog |
| `__blog_constructeur_modele` | 4x | `blog/services/constructeur.service.ts` | ✅ **CRÉER** - Relations modèles |
| `blog_articles` | 3x | `blog/services/blog.service.ts` | ❓ **ÉVALUER** - Redondant avec `__blog_advice` ? |
| `__blog_constructeur_h2` | 1x | `blog/services/constructeur.service.ts` | ✅ **CRÉER** - Structure H2 |
| `__blog_constructeur_h3` | 1x | `blog/services/constructeur.service.ts` | ✅ **CRÉER** - Structure H3 |

---

## 🟠 3. SYSTÈME DE STOCK (3 tables) - À CRÉER

| Table | Occurrences | Action |
|-------|-------------|--------|
| `stock` | 16x | ✅ **CRÉER** - Table principale stocks |
| `stock_movements` | 5x | ✅ **CRÉER** - Mouvements de stock |
| `stock_alerts` | 2x | ✅ **CRÉER** - Alertes stock bas |

**Fichier concerné:** `modules/admin/services/stock-management.service.ts`

**Schema proposé:**
```sql
CREATE TABLE stock (
  id BIGSERIAL PRIMARY KEY,
  piece_id INTEGER REFERENCES pieces(piece_id),
  quantity INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  available INTEGER GENERATED ALWAYS AS (quantity - reserved) STORED,
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE stock_movements (
  id BIGSERIAL PRIMARY KEY,
  piece_id INTEGER,
  type VARCHAR(50), -- 'IN', 'OUT', 'ADJUSTMENT'
  quantity INTEGER,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE stock_alerts (
  id BIGSERIAL PRIMARY KEY,
  piece_id INTEGER,
  threshold INTEGER,
  is_active BOOLEAN DEFAULT TRUE
);
```

---

## 🔵 4. LOGS & ANALYTICS (5 tables) - SERVICE EXTERNE RECOMMANDÉ

| Table | Occurrences | Action recommandée |
|-------|-------------|-------------------|
| `upload_analytics` | 8x | 🔄 **UTILISER SENTRY/DATADOG** au lieu de DB |
| `error_logs` | 6x | 🔄 **UTILISER SENTRY** - Meilleure solution |
| `analytics_config` | 2x | ✅ Créer si nécessaire ou config JSON |
| `analytics_events` | 2x | 🔄 **UTILISER GA4/MIXPANEL** |
| `system_metrics` | 1x | 🔄 **UTILISER PROMETHEUS** |

**Recommandation:** Ne PAS créer ces tables, utiliser des services externes spécialisés.

---

## 🟣 5. TABLES MÉTIER (14 tables) - À ANALYSER

### À créer (probablement nécessaires)
- ✅ `vehicules_pieces` (3x) - Relations véhicules ↔ pièces
- ✅ `pieces_criteres` (3x) - Critères techniques pièces  
- ✅ `___xtr_order_history` (1x) - Historique commandes
- ✅ `___xtr_order_line_audit` (1x) - Audit lignes commandes
- ✅ `___xtr_order_status_history` (1x) - Historique statuts

### À corriger (tables qui existent sous un autre nom)
- `pieces_marques` → **`pieces_marque`** (existe déjà)
- `auto_gamme` → **`catalog_gamme`** ou **`pieces_gamme`** ?
- `auto_models` → **`auto_modele`** (existe déjà)
- `auto_types` → **`auto_type`** (existe déjà)
- `pieces_prices` → **`pieces_price`** (existe déjà)
- `auto_type_engine` → Utiliser **`auto_type.type_engine`** (colonne existe)

### À évaluer
- `product_vehicle_compatibility` - Redondant avec tables existantes ?
- `___xtr_product` - Quelle différence avec `products` ?
- `customers` - Redondant avec `___xtr_customer` ?

---

## 🔴 6. CODE MORT (12 tables) - À SUPPRIMER

| Table | Occurrences | Fichiers | Action |
|-------|-------------|----------|--------|
| `system_config` | 3x | `admin/services/configuration.service.ts` | 🗑️ Supprimer code |
| `___users` | 2x | `users/users.service.ts` | 🗑️ Utiliser `users` |
| `layout_sections` | 2x | `layout/services/footer*.service.ts` | 🗑️ Supprimer code |
| `social_share_configs` | 2x | `layout/services/footer*.service.ts` | 🗑️ Hardcoder config |
| `manufacturer_overview_enhanced` | 1x | `manufacturers/manufacturers.controller.ts` | 🗑️ Supprimer |
| `___xtr_cat` | 1x | `dashboard/dashboard.service.ts` | 🗑️ Supprimer |
| `vehicules` | 1x | `config/services/enhanced-metadata.service.ts` | 🗑️ Utiliser tables auto_ |
| `marques` | 1x | `config/services/enhanced-metadata.service.ts` | 🗑️ Utiliser auto_marque |
| `delivery_agents` | 1x | `cart/services/cart-calculation.service.ts` | ✅ Utiliser `___xtr_delivery_agent` |
| `quantity_discounts` | 1x | `cart/services/cart-calculation.service.ts` | 🗑️ À évaluer |
| `company_settings` | 1x | `layout/services/footer-unified.service.ts` | ✅ Utiliser `___config` |
| `user_sessions` | 1x | `users/services/password.service.ts` | ✅ Utiliser `sessions` |

---

## 📋 RÉSUMÉ DES ACTIONS

### ✅ À faire immédiatement (AUTO)
1. ✅ Corriger casse tables (5 tables) - `fix-table-case.py`
2. ✅ Corriger noms de tables singulier/pluriel (6 tables)

### 🟡 Décisions métier (1-2 jours)
3. Valider besoin fonctionnalités blog (6 tables)
4. Décider si système stock nécessaire (3 tables)

### 🔨 Développement (3-5 jours)
5. Créer tables stock si validé
6. Créer tables métier manquantes (5-8 tables)
7. Créer tables blog si validé

### 🗑️ Nettoyage (2-3 jours)  
8. Supprimer code mort (12 fichiers)
9. Migrer vers services externes (logs, analytics)

### 🔍 Validation finale
10. Relancer audit complet
11. Corriger colonnes manquantes (77)
12. Tests end-to-end

---

## 🎯 PRIORISATION

### Phase 1 - Quick Wins (MAINTENANT)
- ✅ Corriger casse tables → **-26 erreurs**
- ✅ Corriger noms tables → **-15 erreurs**

### Phase 2 - Décisions (CETTE SEMAINE)
- Valider blog + stock → **Décisions métier**

### Phase 3 - Développement (2 SEMAINES)
- Créer tables validées
- Nettoyer code mort

### Phase 4 - Peaufinage (1 SEMAINE)
- Corriger colonnes
- Tests complets

---

## 📊 OBJECTIF FINAL

**Passer de 220 problèmes à 0 problèmes**

- 155 tables → 0
- 75 colonnes → 0  
- 100% code propre ✅
