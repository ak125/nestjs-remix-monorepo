# 🔍 Diagnostic Routes - État Actuel

## 📊 Dashboards (4 routes)

| Route fichier | URL | Pour qui ? | Taille | Statut |
|--------------|-----|-----------|--------|--------|
| `admin._index.tsx` | `/admin` | Admin/Super Admin (level 7+) | 62K | ✅ Principal |
| `dashboard.tsx` | `/dashboard` | Commercial (level 3-6) | 20K | ✅ Nouveau unifié |
| `account.dashboard.tsx` | `/account/dashboard` | Client (level 1-2) | 10K | ✅ Personnel |
| `admin.payments.dashboard.tsx` | `/admin/payments/dashboard` | Admin - Paiements | 20K | ✅ Spécialisé |

## 📦 Orders - Liste (3 routes actives)

| Route fichier | URL | Pour qui ? | Taille | Statut |
|--------------|-----|-----------|--------|--------|
| `orders._index.tsx` | `/orders` | Commercial/Admin (level 3+) | 85K | ✅ **Route unifiée principale** |
| `admin.orders._index.tsx` | `/admin/orders` | Admin (level 7+) | 75K | ⚠️ **DOUBLON - À supprimer ?** |
| `commercial.orders._index.tsx` | `/commercial/orders` | Commercial (level 3) | 16K | ⚠️ **OBSOLÈTE - À supprimer ?** |

## 🔍 Orders - Détail (1 route)

| Route fichier | URL | Pour qui ? | Taille | Statut |
|--------------|-----|-----------|--------|--------|
| `orders.$id.tsx` | `/orders/$id` | Commercial/Admin (level 3+) | 26K | ✅ **Route unifiée complète** |

---

## 🚨 CONFUSION DÉTECTÉE

### Problème 1: **3 routes liste commandes**
Actuellement vous avez **3 fichiers différents** pour lister les commandes :
- `/orders` (85K) - Route principale unifiée
- `/admin/orders` (75K) - Doublon admin
- `/commercial/orders` (16K) - Ancienne route obsolète

**Solution recommandée**: Supprimer `/admin/orders` et `/commercial/orders`

### Problème 2: **Liens incohérents**
Certains liens pointent encore vers les anciennes routes :
- Sidebar admin → `/orders` ✅
- Mais le fichier `admin.orders._index.tsx` existe encore ❌

---

## ✅ Architecture cible (simplifiée)

```
DASHBOARDS:
  /admin                  → admin._index.tsx (Dashboard système)
  /dashboard              → dashboard.tsx (Dashboard commercial)
  /account/dashboard      → account.dashboard.tsx (Dashboard client)

ORDERS:
  /orders                 → orders._index.tsx (Liste unifiée level 3+)
  /orders/$id             → orders.$id.tsx (Détail unifié level 3+)
  
  /account/orders         → account.orders.tsx (Liste client, SES commandes)
  /account/orders/$id     → account.orders.$id.tsx (Détail client)
```

---

## 🎯 Actions recommandées

1. **Supprimer doublons orders** (2 fichiers) :
   ```bash
   git rm frontend/app/routes/admin.orders._index.tsx
   git rm frontend/app/routes/commercial.orders._index.tsx
   ```

2. **Vérifier liens sidebar/menus** :
   - AdminSidebar → "Commandes" doit pointer vers `/orders` ✅
   - Tous les Link doivent utiliser `/orders` pas `/admin/orders`

3. **Tests à faire** :
   - Login Admin → Clic "Commandes" sidebar → Doit aller sur `/orders`
   - Clic sur une commande → Doit aller sur `/orders/$id`
   - Vérifier permissions (level 3+ peut accéder)

