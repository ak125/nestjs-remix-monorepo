# 📚 INDEX RAPIDE DES TABLES PAR FONCTIONNALITÉ

*Référence rapide pour développeurs - Basé sur DATABASE_TABLES_DOCUMENTATION.md*

---

## 🔧 **MODULES PRIORITAIRES**

### 👥 **CUSTOMERS** (59K+ clients)
```
Tables: ___xtr_customer, ___xtr_customer_billing_address, ___xtr_customer_delivery_address
API: /api/customers
Colonnes clés: cst_id, cst_mail, cst_name, cst_fname, cst_address, cst_city
```

### 📦 **ORDERS** (1,440 commandes)
```
Tables: ___xtr_order, ___xtr_order_line, ___xtr_order_status
API: /api/orders
Colonnes clés: ord_id, ord_cst_id, ord_date, ord_total_ttc
Relations: ord_cst_id → ___xtr_customer.cst_id
```

### 🏭 **SUPPLIERS** (70 fournisseurs)
```
Tables: ___xtr_supplier, ___xtr_supplier_link_pm, am_2022_suppliers
API: /api/suppliers
Colonnes clés: spl_id, spl_name, spl_alias, spl_display
```

---

## 🚗 **AUTOMOBILE**

### 🏷️ **MANUFACTURERS** ✅ *Opérationnel*
```
Tables: auto_marque, auto_modele, auto_type
API: /api/manufacturers (ACTIF)
Colonnes clés: marque_id, marque_name, modele_id, type_id
Cache: 5min TTL ✅
```

### 🔧 **PIECES** ⚠️ *Tables Massives*
```
Tables principales: pieces (4M), pieces_criteria (17M), pieces_relation_type (14M)
Tables support: pieces_price, pieces_gamme, pieces_marque
⚠️ ATTENTION: Tables >1M enregistrements - Cache obligatoire
API suggérée: /api/pieces (avec pagination stricte)
```

---

## 🛒 **E-COMMERCE**

### 🧾 **INVOICES** ✅ *Opérationnel*
```
Tables: ___xtr_invoice, ___xtr_invoice_line
API: /api/invoices (ACTIF)
Colonnes clés: inv_id, inv_ord_id, inv_cst_id, inv_total_ttc
Relations: inv_cst_id → ___xtr_customer.cst_id
Cache: 5min TTL ✅
```

### 🛍️ **CART**
```
Tables: cart_items, cart_analytics, cart_metadata
API: /api/cart
Colonnes clés: cart_id, user_id, product_id, quantity
```

### 💰 **PROMOTIONS**
```
Tables: promo_codes, promo_usage
API: /api/promotions
Colonnes clés: code, discount_percent, valid_from, valid_until
```

---

## 📝 **CONTENU**

### 📰 **BLOG**
```
Tables: __blog_advice (85), __blog_guide, __blog_advice_h2, __blog_advice_h3
API: /api/blog
Colonnes clés: id, title, content, category, published_date
```

### 🔍 **SEO**
```
Tables: __seo_gamme, __seo_marque, __sitemap_blog, __sitemap_marque
API: /api/seo
Usage: Optimisation moteurs de recherche, sitemaps automatiques
```

---

## ⚙️ **SYSTÈME**

### 🔧 **CONFIGURATION**
```
Tables: ___config, ___config_admin, ___header_menu, ___footer_menu
API: /api/config
Usage: Paramètres site, menus navigation
```

### 🚚 **DELIVERY**
```
Tables: ___xtr_delivery_agent, ___xtr_delivery_ape_*
API: /api/delivery
Zones: France, Corse, DOM-TOM
```

### 👤 **USERS** (système)
```
Tables: users, sessions, password_resets
API: /api/auth
Colonnes clés: user_id, email, password_hash, role
```

---

## 📊 **COMMANDES RAPIDES**

### Générer un module automatiquement
```bash
./scripts/generate-modules.sh
# Choisir le module désiré
```

### Tester une API
```bash
curl "http://localhost:3000/api/[module]/stats"
curl "http://localhost:3000/api/[module]?page=1&limit=5"
```

### Pattern de développement
```typescript
1. Service extends SupabaseBaseService
2. Cache 5min TTL 
3. Pagination obligatoire
4. Gestion d'erreurs complète
5. Logs détaillés
```

---

## 🔥 **TABLES À ÉVITER** (sans préparation)

```
⚠️  pieces_ref_search (21M enregistrements, 4199 MB)
⚠️  pieces_criteria (17M enregistrements, 3610 MB)  
⚠️  pieces_relation_criteria (15M enregistrements, 2914 MB)
⚠️  pieces_relation_type (14M enregistrements, 835 MB)

💡 Solution: Cache agressif + pagination stricte + index optimisés
```

---

## ✅ **MODULES RECOMMANDÉS** (ordre de priorité)

1. **CustomersModule** - Base utilisateurs (59K clients)
2. **OrdersModule** - Commandes business (1,440 commandes) 
3. **SuppliersModule** - Gestion fournisseurs (70 fournisseurs)
4. **BlogModule** - Contenu éditorial (85 articles)
5. **CartModule** - Panier e-commerce
6. **ConfigModule** - Paramètres système
7. **DeliveryModule** - Gestion livraisons

**Total estimé :** 7 modules prioritaires + 2 modules existants = **9 modules complets**

---

*Dernière mise à jour: 19 Août 2025*  
*Basé sur: DATABASE_TABLES_DOCUMENTATION.md*
