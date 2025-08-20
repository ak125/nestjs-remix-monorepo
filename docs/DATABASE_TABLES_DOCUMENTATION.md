# 🗄️ Documentation des Tables de Base de Données

## 📊 Vue d'ensemble
**Base de données :** Supabase PostgreSQL  
**Nombre total de tables :** 90+  
**Type :** Migration automatique MySQL → PostgreSQL  
**Date de documentation :** 19 Août 2025  

---

## 🔑 Tables Principales par Domaine

### 🧾 **FACTURES & COMMANDES**
#### Tables principales
- **`___xtr_invoice`** - Table principale des factures (1 facture, 17 colonnes)
  - `inv_id` : Identifiant unique de la facture
  - `inv_ord_id` : ID de la commande liée
  - `inv_cst_id` : ID du client
  - `inv_date` : Date de facture
  - `inv_amount_ht`, `inv_total_ttc` : Montants HT/TTC
  - `inv_info` : Informations supplémentaires (JSON)

- **`___xtr_invoice_line`** - Lignes de factures détaillées (1 ligne, 17 colonnes)
  - `invl_inv_id` : Référence à la facture parent
  - `invl_pg_id`, `invl_pg_name` : Gamme de produit
  - `invl_pm_id`, `invl_pm_name` : Marque de pièce
  - `invl_art_ref` : Référence article
  - `invl_art_quantity` : Quantité
  - Prix unitaires et totaux HT/TTC

#### Tables liées
- **`___xtr_order`** - Commandes (1,440 enregistrements, 23 colonnes)
- **`___xtr_order_line`** - Lignes de commandes (1,833 enregistrements, 35 colonnes)

### 👥 **CLIENTS & ADRESSES**
- **`___xtr_customer`** - Clients (59,137 enregistrements, 20 colonnes)
  - `cst_id` : Identifiant unique client
  - `cst_mail`, `cst_pswd` : Login/mot de passe
  - `cst_name`, `cst_fname` : Nom/prénom
  - `cst_address`, `cst_zip_code`, `cst_city` : Adresse
  - `cst_is_pro` : Client professionnel (0/1)
  - `cst_activ` : Compte actif (0/1)

- **`___xtr_customer_billing_address`** - Adresses de facturation (59,109 enregistrements)
- **`___xtr_customer_delivery_address`** - Adresses de livraison (59,110 enregistrements)

### 🏭 **FOURNISSEURS**
- **`___xtr_supplier`** - Fournisseurs (70 enregistrements, 5 colonnes)
  - `spl_id` : Identifiant fournisseur
  - `spl_name` : Nom du fournisseur
  - `spl_alias` : Alias/code court
  - `spl_display` : Affichage public (0/1)

### 🚗 **AUTOMOBILES & PIÈCES**
#### Référentiel automobile
- **`auto_marque`** - Marques automobiles (117 enregistrements, 13 colonnes)
- **`auto_modele`** - Modèles automobiles (5,745 enregistrements, 21 colonnes)
- **`auto_type`** - Types/versions automobiles (48,918 enregistrements, 21 colonnes)
- **`auto_modele_group`** - Groupes de modèles (1,957 enregistrements)

#### Catalogue pièces
- **`pieces`** - Pièces automobiles **[TABLE MASSIVE]** (4,037,422 enregistrements, 24 colonnes)
- **`pieces_criteria`** - Critères des pièces **[TABLE MASSIVE]** (17,559,813 enregistrements)
- **`pieces_relation_type`** - Relations pièces/véhicules **[TABLE MASSIVE]** (14,498,123 enregistrements)
- **`pieces_price`** - Prix des pièces (440,173 enregistrements, 44 colonnes)
- **`pieces_media_img`** - Images des pièces **[TABLE MASSIVE]** (4,617,297 enregistrements)

#### Organisation catalogue
- **`pieces_gamme`** - Gammes de pièces (9,532 enregistrements, 16 colonnes)
- **`pieces_marque`** - Marques de pièces (981 enregistrements, 16 colonnes)
- **`catalog_family`** - Familles de catalogue (19 enregistrements)
- **`catalog_gamme`** - Gammes de catalogue (230 enregistrements)

### 🛒 **E-COMMERCE**
- **`cart_items`** - Articles dans les paniers (2 enregistrements, 11 colonnes)
- **`cart_analytics`** - Analytics des paniers (0 enregistrements, 13 colonnes)
- **`promo_codes`** - Codes promotionnels (7 enregistrements, 21 colonnes)
- **`shipping_rates_cache`** - Cache des frais de port (5 enregistrements)

### 👤 **UTILISATEURS & SESSIONS**
- **`users`** - Utilisateurs système (2 enregistrements, 6 colonnes)
- **`sessions`** - Sessions utilisateurs (0 enregistrements)
- **`password_resets`** - Réinitialisations mots de passe (0 enregistrements)

### 🌐 **SEO & CONTENU**
#### Blog & conseils
- **`__blog_advice`** - Articles de conseils (85 enregistrements, 16 colonnes)
- **`__blog_guide`** - Guides techniques (1 enregistrement, 15 colonnes)
- **`__blog_advice_h2`** - Sous-titres H2 (451 enregistrements)

#### SEO & référencement
- **`__seo_gamme`** - SEO par gamme (131 enregistrements)
- **`__seo_marque`** - SEO par marque (35 enregistrements)
- **`__sitemap_*`** - Tables de sitemaps multiples

### ⚙️ **CONFIGURATION**
- **`___config`** - Configuration générale (1 enregistrement, 23 colonnes)
- **`___config_admin`** - Configuration admin (9 enregistrements)
- **`___header_menu`** - Menu header (6 enregistrements)
- **`___footer_menu`** - Menu footer (13 enregistrements)

---

## 🔗 Relations Identifiées

### Relations Factures
```
___xtr_customer (cst_id) 
    ↓
___xtr_order (ord_cst_id)
    ↓  
___xtr_invoice (inv_ord_id)
    ↓
___xtr_invoice_line (invl_inv_id)
```

### Relations Pièces Automobiles
```
auto_marque (id_marque)
    ↓
auto_modele (id_marque → marque)
    ↓
auto_type (id_modele → modele)
    ↓
pieces_relation_type (type_id → auto_type)
    ↓
pieces (id → pieces_relation_type)
```

---

## 📈 Tables par Taille

### 🔥 Tables Massives (>1M enregistrements)
1. **`pieces_ref_search`** - 21,282,442 enregistrements (4,199 MB)
2. **`pieces_criteria`** - 17,559,813 enregistrements (3,610 MB) 
3. **`pieces_relation_criteria`** - 15,369,500 enregistrements (2,914 MB)
4. **`pieces_relation_type`** - 14,498,123 enregistrements (835 MB)
5. **`pieces_media_img`** - 4,617,297 enregistrements (759 MB)
6. **`pieces`** - 4,037,422 enregistrements (1,230 MB)
7. **`pieces_ref_ean`** - 3,033,729 enregistrements (739 MB)
8. **`pieces_list`** - 1,811,579 enregistrements (299 MB)

### 📊 Tables Moyennes (10K-1M enregistrements)
- **`__cross_gamme_car_new`** - 175,524 enregistrements
- **`auto_type_number_code`** - 169,164 enregistrements
- **`___xtr_customer`** - 59,137 enregistrements
- **`auto_type`** - 48,918 enregistrements
- **`cars_engine`** - 35,661 enregistrements

### 📋 Tables Standards (<10K enregistrements)
- Toutes les autres tables de configuration, SEO, blog, etc.

---

## 🎯 Recommandations d'Architecture

### Pour le Module Invoices
- ✅ **Table principale :** `___xtr_invoice`
- ✅ **Table détail :** `___xtr_invoice_line`
- ✅ **Relations :** `___xtr_customer`, `___xtr_order`
- ✅ **Pattern :** Suivre l'architecture ManufacturersModule avec cache
- ✅ **Service :** SupabaseBaseService + Cache (5min TTL)

### Pour les Modules Automobiles
- ✅ **Référentiel :** `auto_marque` → `auto_modele` → `auto_type`
- ✅ **Catalogue :** `pieces_gamme` → `pieces_marque` → `pieces`
- ⚠️ **Performance :** Cache obligatoire pour les tables massives

### Optimisations Recommandées
- 🔄 **Cache Redis :** 5-10min pour les données référentiel
- 📄 **Pagination :** Obligatoire pour tables >100K enregistrements
- 🎯 **Index :** Vérifier les index sur clés étrangères
- 🚀 **Requêtes :** Limiter les jointures sur tables massives

---

## 🔧 Intégration avec l'Architecture Existante

### Pattern Standard (ManufacturersModule)
```typescript
@Module({
  imports: [CacheModule.register({ ttl: 300 })],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService]
})
export class InvoicesModule {}
```

### Service Type
```typescript
@Injectable()
export class InvoicesService extends SupabaseBaseService {
  constructor(@Inject(CACHE_MANAGER) cacheManager: Cache) {
    super(cacheManager);
  }
  // Méthodes CRUD avec cache automatique
}
```

---

## 📋 **INVENTAIRE COMPLET DES TABLES**

### 🔧 **CONFIGURATION SYSTÈME**
- **`___config`** - Configuration générale (1 enr., 400 kB, 23 colonnes)
- **`___config_admin`** - Configuration admin (9 enr., 208 kB, 11 colonnes)  
- **`___config_ip`** - Configuration IP (3 enr., 96 kB, 4 colonnes)
- **`___config_old`** - Ancienne configuration (1 enr., 224 kB, 12 colonnes)

### 🎨 **INTERFACE & NAVIGATION**
- **`___header_menu`** - Menu en-tête (6 enr., 128 kB, 6 colonnes)
- **`___footer_menu`** - Menu pied de page (13 enr., 112 kB, 5 colonnes)
- **`___meta_tags_ariane`** - Fil d'Ariane SEO (0 enr., 240 kB, 9 colonnes)

### 🧾 **FACTURATION & COMMANDES** ✅ *Module Opérationnel*
- **`___xtr_invoice`** - **FACTURES PRINCIPALES** (1 enr., 304 kB, 17 colonnes)
- **`___xtr_invoice_line`** - **LIGNES FACTURES** (1 enr., 304 kB, 17 colonnes)
- **`___xtr_order`** - Commandes (1,440 enr., 1672 kB, 23 colonnes)
- **`___xtr_order_line`** - Lignes commandes (1,833 enr., 2416 kB, 35 colonnes)
- **`___xtr_order_line_equiv_ticket`** - Équivalences tickets (13 enr., 112 kB, 5 col.)
- **`___xtr_order_line_status`** - Statuts lignes (10 enr., 112 kB, 5 colonnes)
- **`___xtr_order_status`** - Statuts commandes (4 enr., 112 kB, 5 colonnes)

### 👥 **CLIENTS & ADRESSES**
- **`___xtr_customer`** - **CLIENTS PRINCIPAUX** (59,137 enr., 33 MB, 20 colonnes)
- **`___xtr_customer_billing_address`** - Adresses facturation (59,109 enr., 29 MB, 12 col.)
- **`___xtr_customer_delivery_address`** - Adresses livraison (59,110 enr., 29 MB, 12 col.)

### 🚚 **LIVRAISONS**
- **`___xtr_delivery_agent`** - Agents livraison (1 enr., 176 kB, 9 colonnes)
- **`___xtr_delivery_ape_corse`** - Livraison Corse (9 enr., 112 kB, 5 colonnes)
- **`___xtr_delivery_ape_domtom1`** - Livraison DOM-TOM 1 (16 enr., 112 kB, 5 col.)
- **`___xtr_delivery_ape_domtom2`** - Livraison DOM-TOM 2 (16 enr., 112 kB, 5 col.)
- **`___xtr_delivery_ape_france`** - Livraison France (31 enr., 144 kB, 7 colonnes)

### 🏭 **FOURNISSEURS**
- **`___xtr_supplier`** - **FOURNISSEURS** (70 enr., 112 kB, 5 colonnes)
- **`___xtr_supplier_link_pm`** - Liens fournisseurs-marques (108 enr., 96 kB, 4 col.)
- **`am_2022_suppliers`** - Fournisseurs 2022 (1,087 enr., 936 kB, 9 colonnes)

### 💬 **MESSAGERIE**
- **`___xtr_msg`** - Messages système (85 enr., 288 kB, 12 colonnes)

### 📝 **BLOG & CONTENU**
- **`__blog_advice`** - Articles conseils (85 enr., 536 kB, 16 colonnes)
- **`__blog_advice_cross`** - Références croisées (321 enr., 112 kB, 3 colonnes)
- **`__blog_advice_h2`** - Sous-titres H2 (451 enr., 1496 kB, 9 colonnes)
- **`__blog_advice_h3`** - Sous-titres H3 (200 enr., 768 kB, 9 colonnes)
- **`__blog_advice_old`** - Anciens articles (0 enr., 280 kB, 15 colonnes)
- **`__blog_guide`** - Guides techniques (1 enr., 272 kB, 15 colonnes)
- **`__blog_guide_h2`** - Guides H2 (6 enr., 208 kB, 9 colonnes)
- **`__blog_guide_h3`** - Guides H3 (2 enr., 192 kB, 9 colonnes)
- **`__blog_meta_tags_ariane`** - SEO Blog (5 enr., 176 kB, 9 colonnes)
- **`__blog_seo_marque`** - SEO marques blog (1 enr., 144 kB, 7 colonnes)

### 🚗 **AUTOMOBILES** ✅ *Module Opérationnel* 
- **`auto_marque`** - **MARQUES AUTO** (117 enr., 64 kB, 13 colonnes)
- **`auto_modele`** - **MODÈLES AUTO** (5,745 enr., 1096 kB, 21 colonnes)
- **`auto_modele_group`** - Groupes modèles (1,957 enr., 600 kB, 6 colonnes)
- **`auto_modele_robot`** - Modèles robot (1 enr., 104 kB, 18 colonnes)
- **`auto_type`** - **TYPES/VERSIONS** (48,918 enr., 32 MB, 21 colonnes)
- **`auto_type_motor_code`** - Codes moteur (1 enr., 64 kB, 2 colonnes)
- **`auto_type_motor_fuel`** - Carburants (26 enr., 160 kB, 6 colonnes)
- **`auto_type_number_code`** - Codes numéros (169,164 enr., 35 MB, 3 colonnes)
- **`cars_engine`** - Moteurs (35,661 enr., 10160 kB, 3 colonnes)

### 🔧 **PIÈCES AUTOMOBILES** 🚨 *Tables Massives*
#### Catalogue Principal
- **`pieces`** - **PIÈCES PRINCIPALES** (4,037,422 enr., 1230 MB, 24 colonnes) 🔥
- **`pieces_criteria`** - **CRITÈRES PIÈCES** (17,559,813 enr., 3610 MB, 10 col.) 🔥🔥
- **`pieces_relation_criteria`** - Relations critères (15,369,500 enr., 2914 MB, 10 col.) 🔥🔥
- **`pieces_relation_type`** - Relations types (14,498,123 enr., 835 MB, 8 col.) 🔥🔥

#### Références & Recherche
- **`pieces_ref_search`** - **RECHERCHE REF** (21,282,442 enr., 4199 MB, 7 col.) 🔥🔥🔥
- **`pieces_ref_ean`** - Codes EAN (3,033,729 enr., 739 MB, 2 colonnes) 🔥
- **`pieces_ref_brand`** - Références marques (5,853 enr., 1408 kB, 8 colonnes)
- **`pieces_ref_oem`** - Références OEM (1 enr., 112 kB, 5 colonnes)

#### Images & Médias
- **`pieces_media_img`** - **IMAGES PIÈCES** (4,617,297 enr., 759 MB, 6 col.) 🔥

#### Organisation & Pricing
- **`pieces_list`** - Liste pièces (1,811,579 enr., 299 MB, 5 colonnes) 🔥
- **`pieces_price`** - Prix pièces (440,173 enr., 322 MB, 44 colonnes)
- **`pieces_gamme`** - Gammes pièces (9,532 enr., 6248 kB, 16 colonnes)
- **`pieces_marque`** - Marques pièces (981 enr., 664 kB, 16 colonnes)
- **`pieces_criteria_group`** - Groupes critères (4,266 enr., 1488 kB, 8 col.)
- **`pieces_criteria_link`** - Liens critères (77,434 enr., 18 MB, 12 colonnes)
- **`pieces_gamme_cross`** - Gammes croisées (1,406 enr., 416 kB, 6 colonnes)
- **`pieces_details`** - Détails pièces (1 enr., 256 kB, 14 colonnes)
- **`pieces_side_filtre`** - Filtres latéraux (5 enr., 32 kB, 4 colonnes)
- **`pieces_status`** - Statuts pièces (13 enr., 128 kB, 4 colonnes)

### 📊 **CATALOGUE & ORGANISATION**
- **`catalog_family`** - Familles catalogue (19 enr., 224 kB, 8 colonnes)
- **`catalog_gamme`** - Gammes catalogue (230 enr., 144 kB, 5 colonnes)

### 🔗 **RÉFÉRENCES CROISÉES**
- **`__cross_gamme_car`** - Croisement gammes (75,289 enr., 13 MB, 6 colonnes)
- **`__cross_gamme_car_new`** - Nouveau croisement (175,524 enr., 32 MB, 7 col.)
- **`__cross_gamme_car_new2`** - Croisement v2 (164,632 enr., 30 MB, 7 colonnes)

### 🔍 **SEO & RÉFÉRENCEMENT**
#### SEO Général
- **`__seo_gamme`** - SEO gammes (131 enr., 400 kB, 7 colonnes)
- **`__seo_marque`** - SEO marques (35 enr., 240 kB, 7 colonnes)
- **`__seo_gamme_car`** - SEO gammes auto (118 enr., 544 kB, 7 colonnes)
- **`__seo_gamme_conseil`** - Conseils SEO (772 enr., 1560 kB, 4 colonnes)
- **`__seo_gamme_info`** - Infos SEO (986 enr., 632 kB, 3 colonnes)
- **`__seo_equip_gamme`** - SEO équipements (132 enr., 208 kB, 4 colonnes)

#### Switches & Filtres SEO
- **`__seo_gamme_car_switch`** - Switch gammes (0 enr., 96 kB, 4 colonnes)
- **`__seo_item_switch`** - Switch articles (13,883 enr., 2680 kB, 4 colonnes)
- **`__seo_type_switch`** - Switch types (134 enr., 112 kB, 3 colonnes)
- **`__seo_family_gamme_car_switch`** - Switch familles (3,790 enr., 1872 kB, 5 col.)

### 🗺️ **SITEMAPS**
- **`__sitemap_blog`** - Sitemap blog (109 enr., 112 kB, 3 colonnes)
- **`__sitemap_gamme`** - Sitemap gammes (0 enr., 80 kB, 3 colonnes)
- **`__sitemap_marque`** - Sitemap marques (35 enr., 80 kB, 3 colonnes)
- **`__sitemap_motorisation`** - Sitemap moteurs (12,756 enr., 3200 kB, 7 col.)
- **`__sitemap_p_link`** - **SITEMAP LIENS** (714,336 enr., 89 MB, 10 col.) 🔥
- **`__sitemap_p_xml`** - Sitemap XML (1,960 enr., 672 kB, 5 colonnes)
- **`__sitemap_search_link`** - Liens recherche (1 enr., 176 kB, 9 colonnes)

### 🛒 **E-COMMERCE**
- **`cart_items`** - Articles paniers (2 enr., 128 kB, 11 colonnes)
- **`cart_analytics`** - Analytics paniers (0 enr., 48 kB, 13 colonnes)
- **`cart_metadata`** - Métadonnées paniers (1 enr., 64 kB, 18 colonnes)
- **`promo_codes`** - Codes promo (7 enr., 144 kB, 21 colonnes)
- **`promo_usage`** - Usage promos (0 enr., 48 kB, 9 colonnes)
- **`shipping_rates_cache`** - Cache frais port (5 enr., 72 kB, 11 colonnes)

### 👤 **UTILISATEURS & SESSIONS**
- **`users`** - Utilisateurs système (2 enr., 48 kB, 6 colonnes)
- **`sessions`** - Sessions utilisateurs (0 enr., 48 kB, 6 colonnes)  
- **`password_resets`** - Reset mots de passe (0 enr., 56 kB, 7 colonnes)

### 📊 **ANALYTICS & TRACKING**
- **`ic_postback`** - Postback tracking (5,826 enr., 4256 kB, 15 colonnes)

### 📁 **DIVERS**
- **`categories`** - Catégories générales (0 enr., 24 kB, 4 colonnes)
- **`products`** - Produits génériques (0 enr., 24 kB, 6 colonnes)

---

## 🔥 **CLASSIFICATION PAR PRIORITÉ**

### 🚨 **TABLES CRITIQUES** (>10M enregistrements)
1. **`pieces_ref_search`** - 21,282,442 enr. (4199 MB) - Recherche pièces
2. **`pieces_criteria`** - 17,559,813 enr. (3610 MB) - Critères pièces  
3. **`pieces_relation_criteria`** - 15,369,500 enr. (2914 MB) - Relations
4. **`pieces_relation_type`** - 14,498,123 enr. (835 MB) - Relations types

### 🔥 **TABLES MASSIVES** (1M-10M enregistrements)
1. **`pieces_media_img`** - 4,617,297 enr. (759 MB) - Images pièces
2. **`pieces`** - 4,037,422 enr. (1230 MB) - **PIÈCES PRINCIPALES**
3. **`pieces_ref_ean`** - 3,033,729 enr. (739 MB) - Codes EAN
4. **`pieces_list`** - 1,811,579 enr. (299 MB) - Liste pièces

### ⭐ **TABLES IMPORTANTES** (100K-1M enregistrements)
- **`__sitemap_p_link`** - 714,336 enr. (89 MB) - Liens sitemap
- **`pieces_price`** - 440,173 enr. (322 MB) - Prix pièces
- **`__cross_gamme_car_new`** - 175,524 enr. (32 MB) - Croisements
- **`auto_type_number_code`** - 169,164 enr. (35 MB) - Codes types

### 📊 **TABLES BUSINESS** (10K-100K enregistrements)
- **`___xtr_customer`** - 59,137 enr. (33 MB) - **CLIENTS**
- **`auto_type`** - 48,918 enr. (32 MB) - Types automobiles
- **`cars_engine`** - 35,661 enr. (10160 kB) - Moteurs

---

## 🎯 **MODULES RECOMMANDÉS**

### ✅ **Modules Opérationnels**
1. **InvoicesModule** - Tables `___xtr_invoice*` + clients
2. **ManufacturersModule** - Tables `auto_*` (marques, modèles, types)

### 🚀 **Modules Prioritaires**
1. **CustomersModule** - Tables `___xtr_customer*` (59K+ clients)
2. **OrdersModule** - Tables `___xtr_order*` (1,440 commandes)
3. **SuppliersModule** - Tables `___xtr_supplier*` (70 fournisseurs)
4. **PiecesModule** - Tables `pieces*` ⚠️ *Attention: tables massives*

### 📈 **Modules Avancés**
1. **BlogModule** - Tables `__blog_*` (contenus éditoriaux)
2. **SEOModule** - Tables `__seo_*` + `__sitemap_*`
3. **DeliveryModule** - Tables `___xtr_delivery_*`
4. **CartModule** - Tables `cart_*` + `promo_*`

**Dernière mise à jour :** 19 Août 2025, 16:15 UTC  
**Tables inventoriées :** 103 tables complètes  
**Données totales :** >90 millions d'enregistrements
