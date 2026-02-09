# Analyse Complete Base de Donnees Supabase

> Date: 2026-02-09 | Status: Production | Plan: Supabase Small
> Projet: AutoMecanik - E-commerce pieces automobiles

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Schema - 97 Tables](#2-schema---97-tables)
3. [Architecture d'acces (SupabaseBaseService)](#3-architecture-dacces)
4. [Fonctions RPC (218+)](#4-fonctions-rpc)
5. [Securite (4 couches)](#5-securite)
6. [Migrations (116 fichiers)](#6-migrations)
7. [Metriques et performance](#7-metriques-et-performance)
8. [Risques et recommandations](#8-risques-et-recommandations)

---

## 1. Vue d'ensemble

### Chiffres cles

| Metrique | Valeur |
|----------|--------|
| Tables totales | **97** |
| Produits (pieces) | **4M+** |
| Clients | **59k+ actifs** (150k comptes) |
| Categories (gammes) | **9k+** |
| Commandes | **~500k** (depuis 2010) |
| Taille DB | **~45 GB** |
| Fonctions RPC | **218+** (154 allowlist, 64 denylist) |
| Migrations SQL | **116** (oct 2025 - fev 2026) |
| Services backend | **160+ fichiers** utilisent Supabase |

### Heritage PHP Legacy

La base provient d'un systeme PHP legacy avec des particularites :

- **Typage permissif** : quasi toutes les colonnes sont `TEXT | null`
- **Pas de foreign keys SQL** : relations gerees au niveau applicatif
- **IDs mixtes** : `SERIAL` (commandes/clients) vs `TEXT` (produits/catalogue)
- **Convention prefixes** :
  - `___` = tables transactionnelles (commandes, clients, factures)
  - `__` = tables SEO/contenu (blog, sitemaps, meta tags)
  - sans prefixe = tables catalogue (pieces, vehicules)

### Provider Supabase

- **URL** : `https://cxpojprgwgubzjyqzmoq.supabase.co`
- **Region** : EU Central (Frankfurt) via AWS pooler
- **Plan** : Small (~60 connexions max)
- **Acces** :
  - Backend : `service_role` key (bypass RLS)
  - Frontend : `anon` key (via backend proxy, jamais direct)
  - Dev : `dev_readonly` role (SELECT-only, optionnel)

---

## 2. Schema - 97 Tables

### 2.1 Produits (18 tables) - Coeur du catalogue

| Table | Description | Volume estime |
|-------|-------------|---------------|
| `pieces` | Produits principaux | 4M+ refs |
| `pieces_price` | Prix multi-niveaux (HT, TTC, consigne) | 4M+ |
| `pieces_marque` | Marques equipementiers (BOSCH, VALEO...) | ~200 |
| `pieces_gamme` | Categories hierarchiques (freinage, filtration) | 9k+ |
| `pieces_media_img` | Images produits | ~2M |
| `pieces_relation_type` | Compatibilites piece ↔ vehicule (N:N) | ~50M |
| `pieces_criteria` | Criteres techniques (diametre, voltage) | ~20M |
| `pieces_criteria_link` | Liaison criteres ↔ gammes | ~5k |
| `pieces_criteria_group` | Groupes criteres (dimensions, electrique) | ~100 |
| `pieces_details` | Details supplementaires (poids, accessoires) | ~4M |
| `pieces_ref_oem` | References OEM constructeur | ~10M |
| `pieces_ref_ean` | Codes-barres EAN13 | ~3M |
| `pieces_ref_search` | Index recherche references | ~15M |
| `pieces_ref_brand` | Marques references (OEM, IAM) | ~50 |
| `pieces_gamme_cross` | Gammes associees (cross-sell) | ~1k |
| `pieces_list` | Kits multi-composants | ~500k |
| `pieces_side_filtre` | Filtres lateralite (G/D) | ~10 |
| `pieces_status` | Statuts (actif, obsolete) | ~5 |

**Relations cles** :
```
pieces.piece_pm_id → pieces_marque.pm_id
pieces.piece_pg_id → pieces_gamme.pg_id
pieces_relation_type (piece_id, type_id) = TABLE PIVOT pieces ↔ auto_type
```

### 2.2 Vehicules (8 tables) - Catalogue automobile

| Table | Description | Volume estime |
|-------|-------------|---------------|
| `auto_marque` | Marques constructeurs (VW, BMW...) | ~80 |
| `auto_modele` | Modeles (Golf, Serie 3...) | ~3k |
| `auto_modele_group` | Groupes modeles | ~500 |
| `auto_modele_robot` | Modeles pour indexation robot | ~3k |
| `auto_type` | Motorisations specifiques | ~50k |
| `auto_type_motor_code` | Codes moteur (CUNA, DFGA...) | ~30k |
| `auto_type_motor_fuel` | Types carburant | ~20 |
| `auto_type_number_code` | Codes CNIT/type-mine | ~40k |

**Hierarchie** :
```
auto_marque → auto_modele → auto_type
                ↑
         auto_modele_group
```

### 2.3 Commandes & Clients (14 tables)

| Table | Description |
|-------|-------------|
| `___xtr_customer` | Clients (email, mdp, adresse, pro/particulier) |
| `___xtr_customer_billing_address` | Adresses facturation |
| `___xtr_customer_delivery_address` | Adresses livraison |
| `___xtr_order` | Commandes (statut, total, paiement) |
| `___xtr_order_line` | Lignes de commande |
| `___xtr_order_line_equiv_ticket` | Tickets equivalence |
| `___xtr_order_line_status` | Statuts lignes |
| `___xtr_order_status` | Referentiel statuts commande |
| `___xtr_invoice` | Factures |
| `___xtr_invoice_line` | Lignes factures |
| `___xtr_msg` | Messages client/support |
| `___xtr_supplier` | Fournisseurs |
| `___xtr_supplier_link_pm` | Liaison fournisseur ↔ marque |
| `___xtr_delivery_*` | 5 tables livraison (transporteurs + grilles tarifaires) |

### 2.4 SEO & Blog (20+ tables)

| Table | Description |
|-------|-------------|
| `__seo_gamme` | Meta SEO par gamme |
| `__seo_gamme_car` | SEO gamme + vehicule |
| `__seo_marque` | SEO par marque constructeur |
| `__seo_item_switch` | Rotation contenu dynamique |
| `__seo_type_switch` | Switch par motorisation |
| `__seo_equip_gamme` | SEO equipementier + gamme |
| `__seo_reference` | Donnees SEO de reference |
| `__seo_observable` | Metriques SEO observables |
| `__seo_keywords` | Mots-cles V-Level (V1-V5) |
| `__seo_index_status` | Statut indexation Google |
| `__seo_crawl_hub` | Hub crawl budget |
| `__blog_advice` | Articles conseil (avec H2/H3 hierarchiques) |
| `__blog_guide` | Guides d'achat (avec H2/H3) |
| `__blog_seo_marque` | SEO blog par marque |
| `__sitemap_*` | 6 tables sitemap (marque, motorisation, blog, liens) |

### 2.5 Configuration & Systeme (16 tables)

| Table | Description |
|-------|-------------|
| `___config` | Configuration site (nom, domaine, TVA) |
| `___config_admin` | Comptes administrateurs |
| `___config_ip` | Configuration IP |
| `___config_old` | Ancienne config (archive) |
| `___footer_menu` / `___header_menu` | Menus navigation |
| `___meta_tags_ariane` | Fil d'Ariane + meta tags |
| `cart_items` | Panier (sessions Redis + DB) |
| `promo_codes` | Codes promotionnels |
| `quantity_discounts` | Remises quantite |
| `shipping_rates_cache` | Cache tarifs livraison |
| `users` | Utilisateurs authentification |
| `sessions` | Sessions (backup DB) |
| `ic_postback` | Callbacks paiement (Paybox/SystemPay) |
| `v_index_usage` / `v_table_health` | Vues monitoring PostgreSQL |

### 2.6 Tables ajoutees post-migration (SEO V4, KG, RM, UX)

Tables creees via migrations 2025-2026, non presentes dans le schema legacy :

| Domaine | Tables | Description |
|---------|--------|-------------|
| Knowledge Graph | `kg_*` (14 tables) | Diagnostic IA vehicule |
| Read Model | `rm_*` (5 tables) | Cache materialise listings |
| UX/DCO | `__ux_*` (3 tables) | Performance CWV et design |
| RAG | `__rag_knowledge` | Base connaissances IA |
| Claims/Quotes | `__claims`, `__quote_*` | Reclamations et devis |
| SEO Extended | `__seo_entity*`, `__seo_page` | SEO entite V4 |
| MCP | `mcp_validation_log` | Logs validation MCP |

---

## 3. Architecture d'acces

### 3.1 SupabaseBaseService (classe abstraite)

**Fichier** : `backend/src/database/services/supabase-base.service.ts` (489 lignes)

Classe abstraite dont heritent tous les services d'acces donnees :

```
SupabaseBaseService (abstract)
├── CartDataService        - Panier
├── UserDataService        - Utilisateurs
├── OrdersService          - Commandes
├── ShippingDataService    - Livraison
├── PromoDataService       - Promotions
├── StaffDataService       - Administration
├── CatalogService         - Catalogue
├── SeoGeneratorService    - SEO dynamique
├── PaymentDataService     - Paiements
└── ... (~160+ services)
```

**Fonctionnalites cles** :

| Feature | Implementation |
|---------|---------------|
| **Client Supabase** | `createClient()` avec `service_role` key (bypass RLS) |
| **HTTP Transport** | `undici` fetch (pas native) avec timeout 15s |
| **Semaphore connexions** | Max 20 concurrentes (plan Small = ~60 max) |
| **Circuit Breaker** | 5 echecs max → OPEN (1min reset) → HALF-OPEN (3 tentatives) |
| **Retry avec backoff** | 3 tentatives, delai exponentiel (max 10s) |
| **Kill-switch DEV** | `DEV_KILL_SWITCH=true` → utilise `dev_readonly` key (SELECT-only) |
| **RPC Gate** | Integration optionnelle avec `RpcGateService` pour gouvernance |

### 3.2 DatabaseModule (NestJS)

**Fichier** : `backend/src/database/database.module.ts`

```typescript
@Module({
  imports: [ConfigModule, CacheModule],
  providers: [
    CartDataService, UserDataService, OrdersService,
    ShippingDataService, PromoDataService, StaffDataService,
    DatabaseCompositionService, UserService, RedisCacheService,
  ],
  exports: [/* tous les services ci-dessus */],
})
export class DatabaseModule {}
```

### 3.3 DatabaseCompositionService (Facade)

Orchestre les services Cart/User/Orders pour operations cross-domaine :
- `convertCartToOrder()` : panier → commande → vide panier
- `getUserStats()` : stats panier + commandes en parallele

### 3.4 Package @repo/database-types

**Fichier** : `packages/database-types/src/`

| Export | Description |
|--------|-------------|
| `types.ts` | 97 interfaces TypeScript auto-generees |
| `constants.ts` | `TABLES`, `COLUMNS`, `LEVELS`, `DEFAULT_VALUES` |
| `schemas.ts` | 90+ schemas Zod pour validation runtime |
| `enums/` | Enums vehicules, produits, cache |
| `helpers/` | Utilitaires (formatDate, generateSlug, etc.) |

Constantes `TABLES` = source unique de verite pour noms de tables :
```typescript
TABLES.pieces → 'pieces'
TABLES.xtr_customer → '___xtr_customer'
TABLES.seo_gamme → '__seo_gamme'
```

Systeme `LEVELS` (4 hierarchies) :
- **CGC** : Curation vehicules par gamme (1=vedette, 2=marque, 3=type, 5=blog)
- **PCL** : Criteres techniques (1=critique, 2=secondaire)
- **PG** : Categories gammes (1=principal, 2=sous-categorie)
- **FM** : Menu footer (1=politiques, 2=legal)

---

## 4. Fonctions RPC

### 4.1 Synthese

| Classification | Nombre | Acces |
|----------------|--------|-------|
| **Allowlist** (safe) | 154 | Public/Authenticated |
| **P0 - Critique** | 7 | **TOUJOURS BLOQUE** |
| **P1 - Eleve** | 17 | service_role uniquement |
| **P2 - Moyen** | 40 | SECURITY_DEFINER, service_role |
| **Total** | **218+** | |

### 4.2 RPC Principales par domaine

#### Homepage & Catalogue (7 fonctions)

| Fonction | Params | Description | Perf |
|----------|--------|-------------|------|
| `get_homepage_data_optimized` | - | Combine 4 API calls en 1 RPC | <150ms |
| `get_catalog_hierarchy_optimized` | - | Arbre catalogue navigation | ~50ms |
| `get_brands_with_pieces` | - | Marques avec compteurs | ~100ms |
| `get_gammes_with_pieces` | - | Gammes avec compteurs | ~100ms |
| `get_catalog_families_for_vehicle` | `type_id` | Categories compatibles vehicule | ~200ms |
| `get_catalog_type_ids_for_gamme` | `pg_id` | type_ids compatibles gamme | ~150ms |
| `get_brand_bestsellers_optimized` | `type_id?` | Meilleures ventes par marque | ~200ms |

#### Listing produits (8 fonctions)

| Fonction | Params | Description | Perf |
|----------|--------|-------------|------|
| `get_pieces_for_type_gamme_v3` | `type_id`, `pg_id` | **RPC principale** - listing + SEO | 300-500ms |
| `get_pieces_for_type_gamme_v2` | `type_id`, `pg_id` | Version precedente (deprecated) | 1500-2500ms |
| `get_listing_products_for_build` | `gamme_id`, `vehicle_id` | Build Read Model | ~500ms |
| `get_oem_refs_for_vehicle` | `type_id`, `pg_id` | Refs OEM constructeur | ~200ms |
| `rm_get_listing_page` | `slug` | Page listing cached (Read Model) | <50ms |
| `rm_get_page_complete_v2` | `slug` | Page complete V2 | <100ms |

**`get_pieces_for_type_gamme_v3`** est la RPC la plus complexe (1162 lignes SQL) :
- Traitement SEO switches (`#CompSwitch#`, `#LinkGammeCar_Y#`) directement en PostgreSQL
- Groupage pieces par position (Avant/Arriere/Gauche/Droite)
- Deduplication OEM avec normalisation
- Calcul scores qualite (Premium/Qualite/Economique)

#### Vehicules (4 fonctions)

| Fonction | Params | Description |
|----------|--------|-------------|
| `get_auto_types_batch` | `type_ids[]` | Enrichissement batch vehicules |
| `get_vehicle_compatible_gammes_php` | `type_id` | Gammes compatibles vehicule |
| `get_substitution_data` | `piece_id` | Pieces equivalentes/substitution |
| `get_vehicle_page_data_optimized` | `type_id` | Page vehicule complete |

#### Knowledge Graph / Diagnostic IA (15 fonctions)

| Fonction | Description |
|----------|-------------|
| `kg_diagnose_vehicle_aware` | **Core** - Diagnostic vehicule avec boost moteur |
| `kg_diagnose_by_labels` | Diagnostic par labels observables |
| `kg_diagnose_contextual` | Diagnostic contexte (phase/temp/vitesse) |
| `kg_diagnose_with_explainable_score` | IA explicable |
| `kg_diagnose_with_safety` | Diagnostic avec porte securite |
| `kg_explain_diagnosis_result` | Explication lisible humain |
| `kg_find_parts_for_fault` | Pieces remplacement pour panne |
| `kg_calculate_confidence_score` | Score confiance |
| `kg_calculate_risk_level` | Niveau risque |
| `kg_check_safety_gate` | Validation securite |

#### V-Level Analytics & SEO (5 fonctions)

| Fonction | Description |
|----------|-------------|
| `get_vlevel_data` | Stats V-Level par gamme (V1-V5) |
| `get_vlevel_section_k_metrics` | Conformite Section K |
| `get_vlevel_section_k_missing` | Type_ids manquants V4 |
| `get_vlevel_section_k_extras` | Type_ids en surplus V4 |
| `get_vlevel_dashboard` | Dashboard V-Level global |

#### UX/DCO - Performance (5 fonctions, service_role)

| Fonction | Description |
|----------|-------------|
| `get_ux_debt_by_roi` | Issues UX triees par ROI |
| `get_latest_ux_capture` | Derniere capture DevTools |
| `get_cwv_summary_by_role` | Core Web Vitals par page role |
| `get_design_system` | Config design system |
| `validate_capture_against_gates` | Validation CWV vs seuils |

### 4.3 Fonctions P0 BLOQUEES (7 fonctions dangereuses)

| Fonction | Risque | Impact |
|----------|--------|--------|
| `exec_sql` | **INJECTION SQL** | Execution SQL arbitraire |
| `delete_duplicates_batch` | DELETE massif | Perte jusqu'a 31M lignes |
| `delete_first_records_batch` | DELETE massif | Perte jusqu'a 31M lignes |
| `rollback_switch` | Rollback etat prod | Corruption etat |
| `switch_to_next` | Switch etat prod | Corruption etat |
| `run_import_pipeline` | Pipeline import complet | Corruption donnees |
| `apply_decisions_shadow` | Application batch | Modification massive |

---

## 5. Securite

### 5.1 Architecture 4 couches

```
[Internet] → [Caddy/HTTPS] → [NestJS Backend]
                                    │
                           ┌────────┼────────┐
                           │   RPC Gate      │  ← Couche 1: Firewall applicatif
                           │   (allow/deny)  │
                           └────────┼────────┘
                                    │
                           ┌────────┼────────┐
                           │  Supabase SDK   │  ← Couche 2: service_role key
                           │  (bypass RLS)   │
                           └────────┼────────┘
                                    │
                           ┌────────┼────────┐
                           │   RLS Policies  │  ← Couche 3: Row Level Security
                           │   (FORCE RLS)   │
                           └────────┼────────┘
                                    │
                           ┌────────┼────────┐
                           │  Kill-switch +  │  ← Couche 4: Protection DB
                           │  Break-glass    │
                           └─────────────────┘
```

### 5.2 RPC Gate (Couche 1)

**Fichier** : `backend/src/security/rpc-gate/`

- **Mode** : `observe` | `enforce` | `disabled`
- **Niveaux** : P0 (toujours bloque), P1, P2, ALL
- **Gouvernance** : `backend/governance/rpc/rpc_allowlist.json` (154) + `rpc_denylist.json` (64)
- **Bypass admin** : Token (`RPC_ADMIN_TOKEN`)
- **Sampling logs** : 1/100 pour ALLOW, 100% pour BLOCK

### 5.3 RLS Policies (Couche 3)

| Role | Acces |
|------|-------|
| `anon` | **REFUSE** sur toutes les tables sensibles |
| `authenticated` | **LECTURE** tables SEO publiques uniquement |
| `service_role` | **COMPLET** (backend uniquement) |
| `dev_readonly` | **SELECT** uniquement |

**Tables protegees FORCE RLS** :
- Clients : `___xtr_customer*`, `__claims`, `__quote_*`
- Paiements : `ic_postback`
- Commandes : `___xtr_order*`, `___xtr_invoice*`
- Auth : `users`
- Interne : `mcp_validation_log`, `__rag_knowledge`, `kg_*`, `__ux_*`

### 5.4 Kill-switch DEV (Couche 4)

- Role `dev_readonly` : `NOINHERIT, NOSUPERUSER, NOCREATEDB`
- SELECT-only sur toutes les tables
- INSERT/UPDATE/DELETE/TRUNCATE/DDL bloques
- 24 fonctions P0+P1 explicitement revoquees
- Audit dans `_killswitch_audit`

### 5.5 Break-glass (urgence)

- Acces ecriture temporaire (max 24h)
- Token hashe SHA256
- Specification tables obligatoire
- Full audit trail
- Cleanup automatique expiration

---

## 6. Migrations

### 6.1 Timeline

| Periode | Nombre | Focus principal |
|---------|--------|-----------------|
| Oct 2025 | 1 | Crawl budget experiments |
| Dec 2025 | 8 | Knowledge Graph, SEO, bootstrap |
| Jan 2026 (1-7) | 30 | Contenu SEO (freinage, filtres, distribution), badges |
| Jan 2026 (8-15) | 10 | RM module, substitution, aggregates |
| Jan 2026 (17-25) | 25 | Sitemap V10, KG V3, SEO enterprise |
| Jan 2026 (27-31) | 20 | Indexes, backfill, DCO V2, MCP, RAG |
| Fev 2026 (1-6) | 22 | RLS, securite, kill-switch, break-glass, quotes |

### 6.2 Migrations notables

| Migration | Impact |
|-----------|--------|
| `20260115_rm_*` | Module Read Model (tables, enums, helpers, RPC) |
| `20260122_sitemap_v10_*` | Sitemap enterprise scalable 1M+ URLs |
| `20260125_kg_v3_*` | Knowledge Graph V3 (14 fonctions diagnostic) |
| `20260128_dco_v2_*` | Design Continuous Optimization |
| `20260202_rls_*` | Securisation RLS complete |
| `20260204_*` | Kill-switch, break-glass, protection tables critiques |
| `20260206_add_total_pieces` | Ajout compteur pieces homepage |

---

## 7. Metriques et performance

### 7.1 Latences mesurees

| Operation | Latence | Methode |
|-----------|---------|---------|
| `get_homepage_data_optimized` | <150ms | RPC combine |
| `get_pieces_for_type_gamme_v3` | 300-500ms | RPC complexe |
| `rm_get_listing_page` (Read Model) | <50ms | Cache materialise |
| Requete Supabase SDK moyenne | ~24ms | Benchmark interne |
| Timeout max configure | 15s | AbortSignal |

### 7.2 Limites techniques

| Contrainte | Valeur | Gestion |
|------------|--------|---------|
| Connexions concurrentes | 20 (sur 60 plan Small) | Semaphore global |
| Timeout requete | 15s | AbortSignal.timeout |
| Circuit breaker open | 5 echecs consecutifs | Reset 1 minute |
| Retry max | 3 tentatives | Backoff exponentiel |
| RPC max rows | Variable (500-1000) | Parametre `p_limit` |

### 7.3 Vues monitoring

- `v_table_health` : dead rows, vacuum, taille tables
- `v_index_usage` : utilisation index, taille, scans

---

## 8. Risques et recommandations

### 8.1 Matrice de risques

| Risque | Probabilite | Impact | Statut mitigation |
|--------|-------------|--------|-------------------|
| Exposition RPC P0 publique | Faible | **CRITIQUE** | Bloque (3 niveaux) |
| Fuite service_role key | Moyen | **CRITIQUE** | Partiel (rotation manquante) |
| Bypass RLS | Faible | Eleve | FORCE RLS actif |
| Injection SQL via params RPC | Faible | Eleve | Prepared statements |
| DDoS via RPC publiques | Moyen | Moyen | **Pas de rate limiting** |
| Abus break-glass | Faible | Moyen | Audit trail + 24h limit |
| Dev modifie prod | Faible | Eleve | Kill-switch actif |

### 8.2 Actions recommandees

#### Immediate (P0)

1. **Verifier RPC Gate en mode `enforce` en production**
   ```bash
   RPC_GATE_MODE=enforce
   RPC_GATE_ENFORCE_LEVEL=P0
   ```

2. **Confirmer RLS active sur tables critiques**
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables
   WHERE tablename IN ('ic_postback','___xtr_order','___xtr_customer','users');
   ```

3. **Rotation service_role key** tous les 90 jours

#### Court terme (1 mois)

4. **Rate limiting** sur endpoints RPC publics (100 req/min/IP)
5. **Logging RPC** : tous les appels avec user_id, role, rpc_name, timestamp
6. **Revue break-glass hebdomadaire** : alerter si duree > 24h

#### Long terme (3 mois)

7. **Migrer fonctions SECURITY_DEFINER** vers RLS policies quand possible
8. **Chiffrement colonnes PII** avec `pgcrypto` (emails, telephones)
9. **Detection anomalies** : spike appels RPC, nouveau RPC appele, P0 tentative

### 8.3 Score securite global

**7.5/10 (BON)** - Architecture defense-en-profondeur solide (4 couches), fonctions P0 correctement bloquees, RLS FORCE sur tables sensibles. Axes d'amelioration : rotation cles, rate limiting, chiffrement at rest.

---

## Diagramme relationnel principal

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ auto_marque  │────→│ auto_modele  │────→│  auto_type   │
│  (~80)       │ 1:N │  (~3k)       │ 1:N │  (~50k)      │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │ N:N
                                    ┌─────────────┤ (pieces_relation_type)
                                    │             │
┌──────────────┐     ┌──────────────┤     ┌───────┴──────┐
│pieces_marque │←────│   pieces     │────→│ pieces_gamme │
│  (~200)      │ N:1 │   (4M+)      │ N:1 │  (9k+)       │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │ 1:N
              ┌─────────────┼─────────────┐
              │             │             │
     ┌────────┴───┐  ┌─────┴────┐  ┌─────┴──────┐
     │pieces_price│  │pieces_img│  │pieces_criteria│
     │   (4M+)   │  │  (~2M)   │  │   (~20M)    │
     └────────────┘  └──────────┘  └─────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│___xtr_customer│───→│ ___xtr_order │────→│___xtr_order_ │
│   (~59k)     │ 1:N │  (~500k)     │ 1:N │    line      │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │ 1:1
                     ┌──────┴───────┐
                     │___xtr_invoice│
                     └──────────────┘
```

---

> **Genere par Claude** le 2026-02-09
> Base sur l'analyse de 97 tables, 218+ fonctions RPC, 116 migrations SQL
> et ~160 services backend utilisant Supabase SDK
