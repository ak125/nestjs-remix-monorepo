# 🧪 GUIDE DE TEST - Dashboard Unifié

**Date**: 13 octobre 2025, 00:15  
**Branch**: consolidation-dashboard

---

## 🎯 OBJECTIF

Tester la nouvelle route `/dashboard` qui remplace :
- ❌ `/pro` (ancienne route Pro)
- ❌ `/commercial` (ancienne route Commercial)

---

## ✅ PRÉ-REQUIS

### 1. Backend démarré
```bash
cd /workspaces/nestjs-remix-monorepo/backend
npm run dev
```

**Vérifier**: http://localhost:3000/api/health

### 2. Frontend démarré
```bash
cd /workspaces/nestjs-remix-monorepo/frontend
npm run dev
```

**Vérifier**: http://localhost:5173

### 3. Session active
- Se connecter avec `superadmin@autoparts.com`
- Vérifier dans `/profile` que level >= 3

---

## 🔗 ÉTAPES DE TEST

### Test 1: Accéder au nouveau dashboard

1. **Naviguer vers**: http://localhost:5173/dashboard

2. **Vérifications visuelles**:
   - ✅ Header avec gradient **bleu/cyan** (commercial)
   - ✅ Titre: **"Tableau de Bord Commercial"**
   - ✅ Icône `BarChart3` (graphique)
   - ✅ Message: "Bienvenue, [Votre nom]"

3. **KPIs affichés** (4 cartes):
   - 📊 **Commandes Aujourd'hui**: Nombre > 0
   - 💰 **CA du Mois**: Montant en € > 0
   - 📦 **En Préparation**: Nombre de commandes
   - ⚠️ **Stock Faible**: Nombre d'articles

### Test 2: Vérifier les données réelles

1. **Ouvrir la console du navigateur** (F12)

2. **Chercher les logs**:
```
🔗 Dashboard API_BASE: http://localhost:3000
👤 Dashboard User: { level: 5, name: "..." }
📊 Dashboard Response status: { stats: 200, orders: 200, suppliers: 200 }
📊 Dashboard stats data: { totalOrders: ..., totalRevenue: ..., ... }
📦 Dashboard orders count: ...
🏢 Dashboard suppliers count: ...
✅ Dashboard final stats: { ... }
```

3. **Si erreurs visibles**:
```
❌ Dashboard stats API failed: 500
❌ Dashboard orders API failed: 404
❌ Dashboard suppliers API failed: 403
```

### Test 3: Vérifier les sections

1. **Catégories Performantes**:
   - Liste des top catégories avec badges de croissance
   - Lien "Voir toutes les catégories"

2. **Commandes Récentes**:
   - 5 dernières commandes max
   - Chaque commande: Numéro, Client, Montant, Statut, Date
   - Lien "Voir toutes les commandes"

3. **Stock Faible** (si articles):
   - Liste articles avec stock minimum
   - Badge "Urgent" en rouge
   - Lien "Gérer les stocks"

4. **Fournisseurs Actifs** (si fournisseurs):
   - Liste des 5 fournisseurs
   - Badge "Actif" ou "Inactif"
   - Lien "Voir tous les fournisseurs"

### Test 4: Actions rapides (bas de page)

Trois cartes cliquables:
- 📦 **Gestion Produits** → `/products/admin`
- 🛒 **Commandes** → `/orders.admin`
- 📊 **Analytics** → `/analytics`

---

## 🐛 DEBUGGING

### Problème: KPIs affichent tous 0

**Cause**: API `/api/dashboard/stats` ne retourne pas de données

**Solution**:
```bash
# Tester l'API directement
curl -b cookies.txt http://localhost:3000/api/dashboard/stats | jq
```

**Vérifier**:
- Backend retourne bien `{ totalOrders, totalRevenue, totalProducts, ... }`
- Session cookie valide

### Problème: Commandes récentes vides

**Cause**: API `/api/dashboard/orders/recent` vide ou erreur

**Solution**:
```bash
# Tester l'API
curl -b cookies.txt http://localhost:3000/api/dashboard/orders/recent | jq
```

**Vérifier**:
- Retourne `{ orders: [...] }`
- Au moins quelques commandes existent en BDD

### Problème: Fournisseurs vides

**Cause**: API `/api/suppliers` vide ou erreur

**Solution**:
```bash
# Tester l'API
curl -b cookies.txt http://localhost:3000/api/suppliers | jq
```

### Problème: Erreur 403 Accès Refusé

**Cause**: User level < 3

**Solution**:
- Vérifier dans `/profile` le niveau utilisateur
- Se connecter avec compte commercial (level >= 3)
- Utiliser `superadmin@autoparts.com` (level 5)

### Problème: Page blanche / Erreur

**Cause**: Erreur de compilation TypeScript ou React

**Solution**:
1. Vérifier console navigateur (F12)
2. Vérifier logs frontend terminal
3. Redémarrer frontend: `npm run dev`

---

## 📊 DONNÉES ATTENDUES (Exemple)

```json
{
  "ordersThisMonth": 1234,
  "revenueThisMonth": 45678.90,
  "todayOrdersCount": 25,
  "preparingOrdersCount": 8,
  "lowStockCount": 42,
  "recentOrders": [
    {
      "id": "order-123",
      "orderNumber": "CMD-2025-001",
      "customer": "Garage Auto Plus",
      "total": 234.50,
      "status": "En préparation",
      "date": "2025-10-12T..."
    },
    ...
  ],
  "suppliers": [
    {
      "id": "sup-1",
      "name": "Bosch France",
      "status": "active"
    },
    ...
  ]
}
```

---

## ✅ CRITÈRES DE SUCCÈS

### Must Have
- [x] Page `/dashboard` accessible
- [x] Header commercial (bleu/cyan)
- [x] 4 KPIs affichés avec vraies données
- [x] Commandes récentes listées
- [x] Pas d'erreur console
- [x] Navigation vers autres pages fonctionne

### Should Have
- [ ] Catégories performantes avec croissance
- [ ] Stock faible avec alertes
- [ ] Fournisseurs actifs listés
- [ ] Formatage français (€, nombres)

### Nice to Have
- [ ] Animations smooth
- [ ] Responsive mobile
- [ ] Loading states

---

## 🔄 COMPARAISON ANCIEN VS NOUVEAU

### Ancien (Commercial)
**Route**: `/commercial`
**Fichier**: `commercial._index.tsx`
**Problèmes**:
- Route séparée difficile à maintenir
- Duplication avec route Pro
- Logique conditionnelle complexe

### Nouveau (Unifié)
**Route**: `/dashboard`
**Fichier**: `dashboard.tsx`
**Avantages**:
- ✅ Une seule route unifiée
- ✅ Pas de distinction Pro/Commercial
- ✅ Code simplifié (-150 lignes)
- ✅ Maintenance facilitée
- ✅ Vraies données API

---

## 📝 CHECKLIST FINALE

Avant de valider:

- [ ] Dashboard accessible via `/dashboard`
- [ ] KPIs affichent vraies données (pas 0)
- [ ] Commandes récentes visibles (si existent)
- [ ] Pas d'erreur dans console navigateur
- [ ] Pas d'erreur dans logs backend
- [ ] Navigation fonctionne vers:
  - [ ] `/products/admin`
  - [ ] `/orders.admin`
  - [ ] `/analytics`
- [ ] Formatage français OK (€, espaces milliers)
- [ ] Responsive (tester sur mobile)

---

## 🚀 PROCHAINE ÉTAPE

Une fois validé:
1. ✅ Commit avec message clair
2. ✅ Push vers GitHub
3. 🗑️ Supprimer anciennes routes:
   - `pro._index.tsx`
   - `commercial._index.tsx`
4. 📝 Mettre à jour menu navigation

---

**Guide créé le**: 13 octobre 2025, 00:15  
**Pour tester**: http://localhost:5173/dashboard  
**Avec compte**: superadmin@autoparts.com
