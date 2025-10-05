# Plan de Consolidation du Module Orders

## 📊 État Actuel (Problématique)

### Contrôleurs (9 fichiers - TROP!)
- ❌ `automotive-orders.controller.ts` 
- ❌ `orders-fusion.controller.ts`
- ❌ `orders-simple.controller.ts`
- ❌ `orders-enhanced-simple.controller.ts`
- ❌ `customer-orders.controller.ts`
- ❌ `admin-orders.controller.ts`
- ❌ `legacy-orders.controller.ts`
- ✅ `order-status.controller.ts` (à garder)
- ✅ `order-archive.controller.ts` (à garder)
- ✅ `tickets.controller.ts` (à garder)

### Services (8 fichiers - TROP!)
- ❌ `orders-fusion.service.ts` (424 lignes)
- ❌ `orders-simple.service.ts` (282 lignes)
- ❌ `orders-enhanced-minimal.service.ts` (258 lignes)
- ❌ `order-archive-complete.service.ts` (215 lignes)
- ❌ `order-archive-minimal.service.ts` (241 lignes)
- ✅ `order-calculation.service.ts` (à garder)
- ✅ `order-status.service.ts` (à garder)
- ✅ `tickets-advanced.service.ts` (à garder)

### DTOs
- ✅ `automotive-orders.dto.ts` (289 lignes - OK)
- ✅ `orders-enhanced.dto.ts`
- ✅ `ticket.dto.ts`
- ✅ `index.ts`

### Repository
- ✅ `order.repository.ts` (300 lignes - à vérifier)

### Schemas
- ✅ `orders.schemas.ts` (112 lignes - OK)

---

## 🎯 Architecture Cible (Version Propre)

### 1. Contrôleurs (3 fichiers)
```
controllers/
├── orders.controller.ts          # API principale (customer + admin routes)
├── order-status.controller.ts    # Gestion statuts (existant)
└── order-archive.controller.ts   # Archivage (existant)
```

### 2. Services (5 fichiers)
```
services/
├── orders.service.ts              # Service principal (CRUD, création, validation)
├── order-calculation.service.ts  # Calculs (HT, TVA, port) - existant
├── order-status.service.ts       # Workflow statuts - existant
├── order-archive.service.ts      # Archivage consolidé
└── tickets.service.ts            # Gestion tickets SAV
```

### 3. DTOs (maintenir existants)
```
dto/
├── create-order.dto.ts           # Création commande
├── update-order.dto.ts           # Mise à jour
├── order-line.dto.ts             # Lignes de commande
├── order-filter.dto.ts           # Filtres recherche
└── index.ts                      # Barrel export
```

---

## 🔄 Plan de Migration

### Phase 1 : Analyse et Mapping
- [x] Lister tous les fichiers
- [ ] Identifier les fonctions uniques vs doublons
- [ ] Mapper les routes utilisées
- [ ] Vérifier les dépendances

### Phase 2 : Consolidation Services
1. **Créer `orders.service.ts` principal**
   - Fusionner logique de `orders-fusion.service.ts`
   - Intégrer `orders-simple.service.ts`
   - Ajouter méthodes de `orders-enhanced-minimal.service.ts`
   
2. **Créer `order-archive.service.ts` consolidé**
   - Fusionner `order-archive-complete.service.ts`
   - Fusionner `order-archive-minimal.service.ts`

3. **Renommer `tickets-advanced.service.ts`** → `tickets.service.ts`

### Phase 3 : Consolidation Contrôleurs
1. **Créer `orders.controller.ts` principal**
   - Routes client (ex-customer-orders.controller.ts)
   - Routes admin (ex-admin-orders.controller.ts)
   - Routes automotive (ex-automotive-orders.controller.ts)
   - Routes legacy (ex-legacy-orders.controller.ts)

2. **Garder contrôleurs spécialisés**
   - `order-status.controller.ts` (gestion workflow)
   - `order-archive.controller.ts` (archivage)
   - `tickets.controller.ts` (SAV)

### Phase 4 : Nettoyage
- [ ] Supprimer anciens fichiers
- [ ] Mettre à jour `orders.module.ts`
- [ ] Mettre à jour imports dans autres modules
- [ ] Tests de validation

---

## 📐 Règles Métier à Respecter

### Création de Commande
1. ✅ Validation panier non vide
2. ✅ Au moins une ligne de commande
3. ✅ Calcul automatique : total = Σ(lignes) + TVA + frais port
4. ✅ Statut initial = 'brouillon'
5. ✅ Génération ID unique

### Workflow Statuts
```
brouillon → confirmée → payée → expédiée → livrée
                ↓
             annulée (possible avant expédition)
```

### Facturation
1. ✅ Facture auto-générée au statut 'payée'
2. ✅ Stockage dans `backofficeplateform_facture`
3. ✅ Email avec PDF attaché

### Intégrité Données
- Une commande → 1 client (___xtr_customer)
- Une commande → N lignes (___XTR_ORDER_LINE)
- Une ligne → 1 produit + quantité + prix
- Un statut → historique dans ___XTR_ORDER_STATUS

---

## 🗃️ Tables Supabase

### Tables Principales
- `___XTR_ORDER` - Commandes
- `___XTR_ORDER_LINE` - Lignes commande
- `___XTR_ORDER_STATUS` - Historique statuts
- `___XTR_ORDER_LINE_STATUS` - Statuts lignes
- `___XTR_ORDER_LINE_EQUIV_TICKET` - Tickets SAV

### Tables Liées
- `___xtr_customer` - Clients
- `___XTR_SUPPLIER` - Fournisseurs
- `___XTR_MSG` - Messages/Notifications
- `___CONFIG_ADMIN` - Configuration

---

## ✅ Checklist de Validation

### Fonctionnalités à Tester
- [ ] Création commande depuis panier
- [ ] Calcul totaux (HT + TVA + port)
- [ ] Transitions statuts valides
- [ ] Génération facture au paiement
- [ ] Historique commandes client
- [ ] Recherche/filtres admin
- [ ] Archivage commandes anciennes
- [ ] Création tickets SAV

### Performance
- [ ] Pas de N+1 queries
- [ ] Index sur colonnes filtrées
- [ ] Cache pour calculs fréquents
- [ ] Pagination sur listes

### Qualité Code
- [ ] 0 erreurs TypeScript
- [ ] 0 imports inutilisés
- [ ] 0 code mort
- [ ] Documentation JSDoc
- [ ] Tests unitaires

---

## 📈 Résultat Attendu

**Avant** :
- 9 contrôleurs
- 8 services
- ~3000 lignes de code
- Architecture confuse

**Après** :
- 3 contrôleurs principaux
- 5 services spécialisés
- ~2000 lignes (estimé)
- Architecture claire et maintenable

**Gain** : -33% de fichiers, -30% de code, +100% lisibilité
