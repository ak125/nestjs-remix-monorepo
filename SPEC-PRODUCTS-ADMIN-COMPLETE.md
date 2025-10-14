# 🏪 Spécifications - Page Products Admin Complète

## 📋 Problème Actuel

La page `/products/admin` est actuellement une **vitrine avec données fictives** :
- ❌ Produits hardcodés (Plaquettes Brembo, Huile Castrol)
- ❌ Pas de gestion réelle des tarifs
- ❌ Pas de gestion fournisseurs
- ❌ Pas de remises configurables
- ❌ Pas de disponibilité temps réel
- ❌ Pas de suppression/activation
- ❌ Pas d'édition en ligne

## 🎯 Objectif - Interface Commerciale Complète

Transformer `/products/admin` en **vrai outil de gestion quotidienne** pour :
- Commercial level 3-6 (gestion catalogue, ventes)
- Admin level 7+ (accès complet)

---

## 📊 Features Requises

### 1️⃣ **Gestion Tarifs** (Priorité HAUTE)

**Tarifs multiples par produit** :
```typescript
interface ProductPricing {
  piece_id: number;
  price_public: number;      // Prix public TTC
  price_pro: number;          // Prix professionnel HT
  price_cost: number;         // Prix d'achat fournisseur
  margin_percent: number;     // Marge calculée
  tva_rate: number;           // Taux TVA (20%, 5.5%, etc.)
}
```

**UI** :
- Affichage Prix Public / Prix Pro / Coût
- Calcul automatique marge %
- Édition inline ou modal
- Historique des prix (optionnel Phase 2)

---

### 2️⃣ **Gestion Fournisseurs** (Priorité HAUTE)

**Liaison produit ↔ fournisseur** :
```typescript
interface ProductSupplier {
  piece_id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_ref: string;       // Référence fournisseur
  lead_time_days: number;     // Délai livraison
  min_order_qty: number;      // Quantité minimum commande
  price_cost: number;         // Prix d'achat
  is_preferred: boolean;      // Fournisseur préféré
}
```

**UI** :
- Liste fournisseurs par produit
- Ajouter/supprimer fournisseur
- Marquer fournisseur préféré
- Affichage délais livraison

---

### 3️⃣ **Gestion Remises** (Priorité MOYENNE)

**Remises par produit** :
```typescript
interface ProductDiscount {
  piece_id: number;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  start_date: Date;
  end_date: Date;
  min_quantity: number;       // Remise quantité
  is_active: boolean;
}
```

**UI** :
- Badge "Promo" si remise active
- Configurer remises temporaires
- Remises par quantité
- Désactivation automatique après date fin

---

### 4️⃣ **Disponibilité Temps Réel** (Priorité HAUTE)

**Stock management** :
```typescript
interface ProductStock {
  piece_id: number;
  quantity_available: number;  // Stock disponible
  quantity_reserved: number;   // Stock réservé (commandes)
  quantity_incoming: number;   // Stock en cours livraison
  min_stock_alert: number;     // Seuil alerte
  reorder_point: number;       // Point de réapprovisionnement
  location: string;            // Emplacement entrepôt
}
```

**UI** :
- Badge couleur stock (Vert >50, Orange 10-50, Rouge <10)
- Alerte stock faible
- Affichage stock réservé
- Bouton "Réapprovisionner" (vers fournisseur)

---

### 5️⃣ **Activation / Désactivation** (Priorité HAUTE)

**Toggle product visibility** :
```typescript
interface ProductStatus {
  piece_id: number;
  is_active: boolean;          // Visible sur site
  is_featured: boolean;        // Produit mis en avant
  deactivation_reason?: string;
  deactivated_at?: Date;
  deactivated_by?: string;
}
```

**UI** :
- Toggle switch "Actif/Inactif"
- Badge "Inactif" si désactivé
- Filtrer par statut
- Historique activations

---

### 6️⃣ **Suppression Logique** (Priorité MOYENNE)

**Soft delete** :
```typescript
interface ProductDeletion {
  piece_id: number;
  is_deleted: boolean;
  deleted_at: Date;
  deleted_by: string;
  deletion_reason: string;
}
```

**UI** :
- Bouton "Archiver" (soft delete)
- Filtre "Afficher archivés"
- Possibilité restauration
- Suppression définitive (admin only)

---

## 🎨 UI/UX Proposée

### **Vue Liste Améliorée**

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏪 Gestion Produits Commercial                                  │
│                                                                  │
│ [🔍 Recherche]  [🎛️ Filtres]  [➕ Nouveau]  [📊 Stats]         │
│                                                                  │
│ ┌──────────────┬─────────┬──────────┬─────────┬─────────────┐  │
│ │ Produit      │ Prix    │ Stock    │ Fourniss│ Actions     │  │
│ ├──────────────┼─────────┼──────────┼─────────┼─────────────┤  │
│ │ 🔧 Plaquette │ 129.99€ │ 🟢 25    │ Brembo  │ ✏️ 👁️ 🗑️  │  │
│ │   Brembo     │ Pro:89€ │ Min:10   │ (3j)    │ [Actif ✓]  │  │
│ │              │ Marge:  │          │ +2 autre│             │  │
│ │              │ 31%     │          │         │             │  │
│ ├──────────────┼─────────┼──────────┼─────────┼─────────────┤  │
│ │ 🛢️ Huile    │ 34.50€  │ 🟢 150   │ Castrol │ ✏️ 👁️ 🗑️  │  │
│ │   Castrol    │ Pro:25€ │ Min:30   │ (24h)   │ [Actif ✓]  │  │
│ │              │ Marge:  │          │         │             │  │
│ │              │ 28%     │          │         │             │  │
│ └──────────────┴─────────┴──────────┴─────────┴─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### **Modal Édition Produit**

```
┌───────────────────────────────────────────────┐
│ ✏️ Éditer Produit: Plaquettes Brembo         │
├───────────────────────────────────────────────┤
│                                               │
│ 💰 TARIFS                                     │
│ ┌─────────────────────────────────────────┐  │
│ │ Prix Public TTC:  [129.99€]  [Auto ⚙️] │  │
│ │ Prix Pro HT:      [89.00€]              │  │
│ │ Prix Coût:        [65.00€]              │  │
│ │ TVA:              [20%] ▼               │  │
│ │ Marge:            31% (calculé auto)    │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│ 🏢 FOURNISSEURS                               │
│ ┌─────────────────────────────────────────┐  │
│ │ ⭐ Brembo France (préféré)              │  │
│ │    Réf: BRE-PL-001 | Délai: 3j         │  │
│ │    Prix: 65€ | Min: 10 unités          │  │
│ │    [Modifier] [Retirer]                 │  │
│ │                                          │  │
│ │ 🔹 Auto Parts Distrib                   │  │
│ │    Réf: APD-9876 | Délai: 7j           │  │
│ │    Prix: 70€ | Min: 5 unités           │  │
│ │    [Modifier] [⭐ Préférer] [Retirer]   │  │
│ │                                          │  │
│ │ [➕ Ajouter Fournisseur]                │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│ 📦 STOCK                                      │
│ ┌─────────────────────────────────────────┐  │
│ │ Stock Disponible:  [25]                 │  │
│ │ Stock Réservé:     [3] (commandes)      │  │
│ │ Stock Entrant:     [50] (livraison 2j)  │  │
│ │ Seuil Alerte:      [10]                 │  │
│ │ Emplacement:       [A12-B3]             │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│ 🎯 STATUT                                     │
│ ┌─────────────────────────────────────────┐  │
│ │ [✓ Actif] [  Vedette] [  Promo]        │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│ [Enregistrer] [Annuler]                       │
└───────────────────────────────────────────────┘
```

---

## 🔧 Plan d'Implémentation

### **Phase 1 - Fondations** (2-3h)

1. **Schéma BDD étendu**
   - Tables: `product_pricing`, `product_suppliers`, `product_discounts`, `product_stock`
   - Vues: `v_products_full` (jointures optimisées)

2. **API Backend**
   - `GET /api/products/admin` - Liste complète avec filtres
   - `PUT /api/products/:id/pricing` - Update tarifs
   - `PUT /api/products/:id/status` - Toggle actif/inactif
   - `GET /api/products/:id/suppliers` - Fournisseurs produit
   - `POST /api/products/:id/suppliers` - Ajouter fournisseur

3. **Types TypeScript**
   - Interfaces complètes dans `shared-types`
   - Validation Zod/Yup

### **Phase 2 - UI Liste** (2h)

1. **Tableau produits**
   - Colonnes: Image, Nom, Prix (Public/Pro), Stock, Fournisseur, Actions
   - Tri par colonne
   - Pagination 25/50/100
   - Filtres: Actif, Stock faible, Catégorie, Marque

2. **Actions rapides**
   - Toggle Actif/Inactif inline
   - Badge stock coloré
   - Tooltip infos fournisseur

### **Phase 3 - Modal Édition** (3h)

1. **Section Tarifs**
   - 3 inputs: Prix Public, Pro, Coût
   - Calcul auto marge %
   - Dropdown TVA

2. **Section Fournisseurs**
   - Liste fournisseurs avec infos
   - Marquer préféré
   - Ajouter/retirer

3. **Section Stock**
   - Stock disponible/réservé/entrant
   - Seuil alerte
   - Emplacement entrepôt

### **Phase 4 - Features Avancées** (2h)

1. **Remises**
   - Configurer promo temporaire
   - Remises par quantité

2. **Import/Export**
   - Export CSV produits
   - Import tarifs en masse

3. **Historique**
   - Logs modifications prix
   - Logs activations

---

## 📊 Comparaison Avant/Après

| Feature | Avant (Vitrine) | Après (Gestion) |
|---------|-----------------|-----------------|
| **Données** | Fictives hardcodées | BDD réelle temps réel |
| **Tarifs** | Affichage seul | Édition Prix Public/Pro/Coût |
| **Fournisseurs** | Aucun | Multi-fournisseurs par produit |
| **Stock** | Nombre fixe | Dispo/Réservé/Entrant |
| **Actions** | Bouton "Voir" inutile | Éditer/Activer/Archiver |
| **Remises** | Aucune | Config promos temporaires |
| **Filtres** | Recherche basique | Filtres avancés multi-critères |

---

## 🎯 Priorités Recommandées

### **Sprint 1 - Quick Wins** (1 jour)
1. ✅ Connexion BDD réelle (remplacer mock)
2. ✅ Affichage tarifs Public/Pro/Coût + Marge
3. ✅ Toggle Actif/Inactif fonctionnel
4. ✅ Badge stock coloré (vert/orange/rouge)

### **Sprint 2 - Gestion Complète** (2 jours)
5. ✅ Modal édition produit complet
6. ✅ Section tarifs éditable
7. ✅ Section fournisseurs (liste + ajout)
8. ✅ Section stock (seuils + alerte)

### **Sprint 3 - Polish** (1 jour)
9. ✅ Filtres avancés
10. ✅ Remises/promos
11. ✅ Export CSV
12. ✅ Tests + documentation

---

## 💡 Recommandations Architecture

### **Séparation des responsabilités**

```
/products/admin (ICI)
├─ 🎯 Usage: Gestion commerciale quotidienne
├─ 📊 Features: Tarifs, Stock, Fournisseurs, Remises
├─ 👥 Audience: Commercial (3+) + Admin (7+)
└─ 🔗 APIs: /api/products/* (full CRUD)

/admin/products (Système)
├─ 🎯 Usage: Configuration technique
├─ 📊 Features: CRUD basique, SKU, Activation
├─ 👥 Audience: Admin système (7+)
└─ 🔗 APIs: /api/admin/products/* (config)
```

### **Base de données**

```sql
-- Vue optimisée pour interface commerciale
CREATE VIEW v_products_commercial AS
SELECT 
  p.piece_id,
  p.piece_name,
  p.piece_alias,
  pp.price_public,
  pp.price_pro,
  pp.price_cost,
  pp.margin_percent,
  ps.quantity_available AS stock,
  ps.min_stock_alert,
  ps.quantity_reserved,
  psup.supplier_name AS preferred_supplier,
  psup.lead_time_days,
  p.piece_activ AS is_active,
  p.piece_top AS is_featured,
  pd.discount_value,
  pd.is_active AS has_discount
FROM ___xtr_piece p
LEFT JOIN product_pricing pp ON p.piece_id = pp.piece_id
LEFT JOIN product_stock ps ON p.piece_id = ps.piece_id
LEFT JOIN product_suppliers psup ON p.piece_id = psup.piece_id AND psup.is_preferred = true
LEFT JOIN product_discounts pd ON p.piece_id = pd.piece_id AND pd.is_active = true;
```

---

## ✅ Conclusion

**Action immédiate recommandée** :

Commencer par **Sprint 1 - Quick Wins** pour avoir rapidement une interface fonctionnelle avec données réelles.

Voulez-vous que je commence l'implémentation du Sprint 1 maintenant ? 🚀
