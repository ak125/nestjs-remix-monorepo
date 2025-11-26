# 📝 TODO - Actions Restantes

## ✅ Priorité Haute (RÉSOLU)

### ~~1. Corriger `___xtr_product` (2 occurrences)~~
**Statut** : ✅ **DÉJÀ CORRIGÉ**  
**Fichier** : `backend/src/modules/dashboard/dashboard.service.ts`

**Vérification** : 
- Ligne 367 : ✅ Utilise `TABLES.pieces`
- Ligne 376 : ✅ Utilise `TABLES.pieces`

**Conclusion** : Aucune action nécessaire, le code est correct.

---

### ~~2. Corriger `___users` (2 occurrences)~~
**Statut** : ✅ **N'A JAMAIS EXISTÉ**  
**Fichier** : `backend/src/modules/users/users.service.ts`

**Vérification** : 
- ❌ Le fichier `users.service.ts` n'existe pas
- ✅ Tous les services users utilisent déjà `TABLES.users`

**Conclusion** : Fausse alerte dans la documentation, rien à faire.

---

### ~~3. Corriger `___xtr_cat` (1 occurrence)~~
**Statut** : ✅ **DÉJÀ CORRIGÉ**  
**Fichier** : `backend/src/modules/dashboard/dashboard.service.ts`

**Vérification** : 
- Ligne 385 : ✅ Utilise `TABLES.catalog_family`

**Conclusion** : Aucune action nécessaire, le code est correct.

---

## 🔴 Priorité Haute (À faire maintenant)

### 1. ✅ Déployer migration `quantity_discounts` sur Supabase

**Statut** : 🔄 **EN ATTENTE DE DÉPLOIEMENT**

**Fichier** : `migrations/001_create_quantity_discounts.sql`

**Actions à faire** :
1. Ouvrir Supabase SQL Editor
2. Copier-coller le contenu de la migration
3. Décommenter les données de test si besoin (après avoir identifié les bons product_id)
4. Exécuter la migration
5. Vérifier que la table est créée : `SELECT * FROM quantity_discounts LIMIT 1;`

**Prérequis** : Identifier les vrais `product_id` pour les données de test

---

### 2. Tester fonctionnalité remises par quantité

### 4. Gérer `quantity_discounts`
**Fichier** : `backend/src/modules/cart/services/cart-calculation.service.ts`

**Options** :
1. Créer la table dans Supabase
2. Utiliser une logique alternative (règles de remise en dur)
3. Utiliser `promo_codes` existant

**Migration SQL si création** :
```sql
CREATE TABLE quantity_discounts (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  min_quantity INTEGER NOT NULL,
  discount_percent DECIMAL(5,2),
  discount_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 5. Vérifier Tables Legacy XTR
**Tables concernées** :
- `___xtr_order_line_equiv_ticket`
- `___xtr_order_line_audit`
- `___xtr_order_history`
- `___xtr_order_status_history`
- `___xtr_delivery_agent`

**Action** : Vérifier si ces tables sont toujours utilisées en production
```bash
# Dans Supabase SQL Editor
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = '___xtr_order_history'
);
```

---

## 🟢 Priorité Basse (Nice to have)

### 6. Nettoyer Tables Invalides Restantes (~25)
**Liste** :
- `product_vehicle_compatibility`
- `mv_vehicle_compatible_gammes` (vue matérialisée ?)
- `social_share_configs`
- `seo_audit_results`
- `layout_sections`
- etc.

**Action** : Pour chaque table :
1. Vérifier si utilisée en production
2. Si oui : ajouter au schéma + package
3. Si non : supprimer le code

---

### 7. Créer Vues Matérialisées (si pertinent)
**Candidats** :
- `mv_vehicle_compatible_gammes` - Vue pour compatibilité véhicules/gammes
- `mv_popular_products` - Vue pour produits populaires
- `mv_category_stats` - Vue pour stats catégories

**Bénéfice** : Performance améliorée sur requêtes complexes

---

### 8. Documenter Convention de Nommage
**Créer** : `NAMING-CONVENTIONS.md`

**Contenu** :
- Préfixes tables : `___` (legacy), `__` (SEO), aucun (standard)
- Préfixes colonnes : `pc_` (pieces_criteria), `pri_` (pieces_price)
- Convention pluriel vs singulier
- Exemples bons/mauvais

---

## ✅ Checklist de Validation

Avant de merger :
- [ ] Toutes les priorités hautes corrigées (___xtr_product, ___users, ___xtr_cat)
- [ ] Tests backend passent
- [ ] 0 erreur TypeScript
- [ ] Documentation à jour
- [ ] Script `verify-optimization.sh` exécuté
- [ ] PR review approuvée

---

## 🔧 Commandes Utiles

### Vérifier tables hardcodées restantes
```bash
cd backend/src
grep -r "\.from('" . --include="*.service.ts" | \
  sed "s/.*\.from('\([^']*\)').*/\1/" | \
  grep -v "^TABLES\." | \
  sort | uniq -c | sort -rn
```

### Vérifier si une table existe dans le schéma
```bash
cd packages/database-types/src
grep -c "'nom_table'" types.ts
# Retourne 0 si inexistante, >0 si existe
```

### Tester compilation
```bash
# Package
cd packages/database-types && npm run build

# Backend
cd backend && npx tsc --noEmit

# Tout
npm run build
```

### Statistiques
```bash
./verify-optimization.sh
```

---

## 📚 Références

- **Schéma Supabase** : `packages/database-types/src/types.ts`
- **Constantes** : `packages/database-types/src/constants.ts`
- **Documentation** :
  - `RAPPORT-FINAL-OPTIMISATION.md` - Rapport complet
  - `OPTIMISATION-TABLES-SUMMARY.md` - Résumé optimisation
  - `TABLES-INVALIDES.md` - Tables problématiques
  - `NETTOYAGE-CODE-MORT.md` - Code supprimé

---

**Date création** : 24 novembre 2025  
**Dernière mise à jour** : 24 novembre 2025  
**Responsable** : Dev Team  
**Estimation totale** : 2-4h pour priorités hautes + moyennes
