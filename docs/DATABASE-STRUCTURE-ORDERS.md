# Structure Base de Données - Module Orders

**Date:** 2025-10-05  
**Base:** Supabase  
**Schéma:** public

---

## 📋 Tables Principales

### `___xtr_order` - Commandes

**Colonnes principales:**
```
ord_id                  - ID unique de la commande (text)
ord_cst_id             - ID client (text)
ord_date               - Date de commande (text/ISO)
ord_ords_id            - ID statut (text)
ord_total_ht           - Total HT (text)
ord_total_ttc          - Total TTC (text)
ord_amount_ht          - Montant HT (text)
ord_amount_ttc         - Montant TTC (text)
ord_shipping_fee_ht    - Frais de port HT (text)
ord_shipping_fee_ttc   - Frais de port TTC (text)
ord_tva                - TVA (text)
ord_is_pay             - Est payé (text/boolean)
ord_date_pay           - Date de paiement (text/ISO)
ord_info               - Informations (text)
ord_link               - Lien (text)
ord_parent             - Parent (text)
```

**Notes:**
- ⚠️ Toutes les colonnes sont de type `text`
- Les montants doivent être convertis avec `parseFloat()`
- Les IDs doivent être convertis avec `.toString()`
- Les dates sont au format ISO string

---

### `___xtr_order_line` - Lignes de commande

**Colonnes principales:**
```
orl_id                              - ID ligne (text)
orl_ord_id                          - ID commande (text)
orl_pg_id                           - ID groupe produit (text)
orl_pg_name                         - Nom groupe produit (text)
orl_pm_id                           - ID modèle produit (text)
orl_pm_name                         - Nom modèle produit (text)
orl_art_ref                         - Référence article (text)
orl_art_ref_clean                   - Référence nettoyée (text)
orl_art_quantity                    - Quantité (text)
orl_art_price_sell_unit_ht          - Prix vente unitaire HT (text)
orl_art_price_sell_unit_ttc         - Prix vente unitaire TTC (text)
orl_art_price_sell_ht               - Prix vente total HT (text)
orl_art_price_sell_ttc              - Prix vente total TTC (text)
orl_art_price_buy_unit_ht           - Prix achat unitaire HT (text)
orl_art_price_buy_ht                - Prix achat total HT (text)
orl_spl_id                          - ID fournisseur (text)
orl_spl_name                        - Nom fournisseur (text)
orl_orls_id                         - ID statut ligne (text)
orl_equiv_id                        - ID équivalence (text)
```

**Notes:**
- ⚠️ Toutes les colonnes sont de type `text`
- Les prix doivent être convertis avec `parseFloat()`
- Les quantités doivent être converties avec `parseInt()`

---

## 🔄 Mapping avec le Modèle OrdersService

### Structure attendue par OrdersService vs Supabase

| OrdersService (attendu) | Supabase (réel) | Type | Conversion |
|------------------------|-----------------|------|------------|
| `order_id` | `ord_id` | number → text | `.toString()` |
| `customer_id` | `ord_cst_id` | number → text | `.toString()` |
| `order_status` | `ord_ords_id` | number → text | `.toString()` |
| `total_ttc` | `ord_total_ttc` | number → text | `.toString()` |
| `created_at` | `ord_date` | Date → text | `.toISOString()` |
| `updated_at` | ❌ N'existe pas | - | - |

### Exemple de requête corrigée

**❌ Avant (ne fonctionne pas):**
```typescript
const { data } = await this.supabase
  .from('___XTR_ORDER')
  .select('*')
  .eq('customer_id', customerId);
```

**✅ Après (fonctionne):**
```typescript
const { data } = await this.supabase
  .from('___xtr_order')
  .select('*')
  .eq('ord_cst_id', customerId.toString());
```

---

## 🎯 Actions à Faire

### Phase 2 - En cours
- [x] Corriger `listOrders()` pour utiliser `ord_*` colonnes
- [ ] Créer un adaptateur/mapper pour convertir entre les deux structures
- [ ] Corriger `createOrder()` pour utiliser les bonnes colonnes
- [ ] Corriger `updateOrder()` pour utiliser les bonnes colonnes
- [ ] Corriger `getOrderById()` pour utiliser les bonnes colonnes

### Option 1: Adapter le service (rapide)
Modifier directement `OrdersService` pour utiliser les vrais noms de colonnes partout.

**Avantages:**
- Rapide à implémenter
- Moins de couches d'abstraction

**Inconvénients:**
- Code moins lisible (`ord_cst_id` vs `customerId`)
- Couplage fort avec la structure Supabase

### Option 2: Créer un mapper (propre)
Créer une couche d'abstraction qui transforme entre:
- Interface propre (OrdersService)
- Structure Supabase (colonnes `ord_*`)

**Avantages:**
- Code plus lisible
- Abstraction de la base de données
- Facilite les migrations futures

**Inconvénients:**
- Plus de code à maintenir
- Performance légèrement impactée

---

## 📝 Recommandation

Pour la **Phase 2**, continuer avec l'**Option 1** (adapter directement):
- Corriger les méthodes critiques seulement
- Documenter clairement le mapping
- Prévoir refactoring en Option 2 après Phase 3

Pour la **Phase 4** (nettoyage final):
- Implémenter Option 2 (mapper propre)
- Créer DTOs de transformation
- Tests complets

---

## 🔍 Tables Connexes

### `___xtr_customer` - Clients
```
cst_id              - ID client (text)
cst_mail            - Email (text)
cst_fname           - Prénom (text)
cst_name            - Nom (text)
```

### `___xtr_order_line_status` - Statuts de lignes de commande
```
orls_id         - ID statut (text)
orls_name       - Nom du statut (text)
orls_action     - Action associée (text)
orls_color      - Couleur pour UI (text)
orls_dept_id    - ID département (text)
```

**Notes:**
- Table de référence pour les statuts de lignes
- Exemples: En attente, Commandé, Reçu, Livré, etc.
- Utilisé par `orl_orls_id` dans `___xtr_order_line`

### `___xtr_order_status` - Statuts de commandes (référence)
```
ords_id         - ID statut (text)
ords_named      - Nom du statut (text)
ords_action     - Action associée (text)
ords_color      - Couleur pour UI (text)
ords_dept_id    - ID département (text)
```

**Notes:**
- Table de référence pour les statuts de commandes
- Exemples: Brouillon, Confirmée, Payée, Expédiée, Livrée, Annulée
- Utilisé par `ord_ords_id` dans `___xtr_order`
- Workflow: 1 (brouillon) → 2 (confirmée) → 3 (payée) → 4 (expédiée) → 5 (livrée)

### `___xtr_order_line_equiv_ticket` - Tickets SAV
```
orlet_id            - ID ticket (text)
orlet_ord_id        - ID commande (text)
orlet_orl_id        - ID ligne de commande (text)
orlet_equiv_id      - ID équivalence (text)
orlet_amount_ttc    - Montant TTC (text)
```

**Notes:**
- Lien entre lignes de commande et tickets d'équivalence
- Utilisé pour les avoirs, crédits, remplacements
- Toutes les colonnes en text

---

## 💡 Notes Importantes

1. **Toutes les colonnes sont des TEXT**
   - Faire attention aux conversions de types
   - Toujours utiliser `.toString()` pour les IDs
   - Utiliser `parseFloat()` pour les montants

2. **Pas de colonnes `created_at`/`updated_at`**
   - Utiliser `ord_date` pour la date de création
   - Pas de suivi automatique des modifications

3. **Préfixes cohérents**
   - `ord_` pour orders
   - `orl_` pour order_lines
   - `cst_` pour customers

4. **Relations**
   - Pas de foreign keys définies dans Supabase
   - Relations manuelles via IDs (text)

---

**Dernière mise à jour:** 2025-10-05  
**Statut:** Phase 2 - Corrections en cours
