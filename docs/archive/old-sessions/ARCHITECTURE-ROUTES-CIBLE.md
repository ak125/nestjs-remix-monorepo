# 🏗️ ARCHITECTURE ROUTES CIBLE

**Date**: 2025-10-13  
**Version**: 1.0  
**Status**: 📋 PROPOSITION (en attente validation)

---

## 🎯 OBJECTIFS

1. **Clarté**: Structure hiérarchique évidente par niveau utilisateur
2. **Cohérence**: Conventions de nommage uniformes
3. **Maintenabilité**: Facile d'ajouter nouvelles routes
4. **Performance**: Pas de doublons, chargement optimal
5. **UX**: Navigation intuitive, permissions claires

---

## 📐 PRINCIPES DE CONCEPTION

### 1. Hiérarchie par Niveau Utilisateur

```
PUBLIC (non-authentifié)
  ↓
CLIENT (level 1-2) - Utilisateur authentifié
  ↓
COMMERCIAL (level 3) - Équipe commerciale
  ↓
ADMIN (level 4+) - Administrateur système
```

### 2. Conventions de Nommage

**Fichiers**:
- `_index.tsx` → Page principale d'une section
- `$id.tsx` → Page détail dynamique
- `_layout.tsx` → Layout partagé (utiliser rarement, préférer `.tsx` parent)
- `new.tsx`, `edit.tsx` → Actions CRUD

**URLs**:
- **Pluriel**: `/orders` (pas `/order`)
- **Kebab-case**: `/reset-password` (pas `/resetPassword`)
- **Hiérarchie**: `/admin/users/:id/edit` (clair et explicite)
- **Pas de doublons linguistiques**: Choisir français OU anglais par contexte

**Layouts Remix**:
- `account.tsx` → Layout pour `/account/*`
- `admin.tsx` → Layout pour `/admin/*`
- `commercial.tsx` → Layout pour `/commercial/*`

### 3. Permissions & Access Control

**Guards dans loaders**:
```typescript
// Public - pas de guard
export async function loader() { ... }

// Client auth required
export async function loader({ context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  // ...
}

// Commercial (level >= 3)
export async function loader({ context }: LoaderFunctionArgs) {
  const user = await requireUser({ context });
  if (parseInt(user.level) < 3) {
    throw redirect('/unauthorized');
  }
  // ...
}

// Admin (level >= 4)
export async function loader({ context }: LoaderFunctionArgs) {
  const user = await requireAdmin({ context }); // Helper existant
  // ...
}
```

### 4. Redirections Legacy

**Pour SEO et bookmarks**:
```typescript
// Ancien: /commercial
export async function loader() {
  return redirect('/dashboard', 301); // Permanent redirect
}

// Ancien: /pro/*
export async function loader() {
  return redirect('/dashboard', 301);
}
```

---

## 🗂️ STRUCTURE CIBLE COMPLÈTE

### 🔵 NIVEAU 1: PUBLIC (Non-authentifié)

#### Landing & Marketing
```
/                              → Landing page principale
/home                          → [OPTIONNEL] Si différent de /
/business                      → [À DÉCIDER] Marketing B2B ou supprimer?
```

#### Auth & Registration
```
/login                         → Connexion
/register                      → Inscription
/logout                        → Déconnexion (action)
/forgot-password               → Mot de passe oublié
/reset-password/:token         → Reset password avec token
```

#### Catalog Public (Browse sans auth)
```
/products                      → Catalogue produits
/products/:id                  → Détail produit
/products/:category/:subcategory → Par catégorie
/products/catalog              → Vue catalogue (alternative)
/products/brands               → Marques

/pieces/*                      → Pièces auto (legacy URLs pour SEO)
/pieces/:slug
/pieces/:brand/:model/:type/:category

/vehicles                      → Véhicules
/vehicles/:brand/:model/:type

/manufacturers                 → Constructeurs
/manufacturers/:brandId
/manufacturers/:brandId/models/:modelId/types
```

#### Content
```
/blog                          → Blog principal
/blog/advice                   → Conseils
/blog/article/:slug            → Article détail
/blog/constructeurs            → Articles constructeurs

/blog-pieces-auto/*            → Blog pièces auto
/blog-pieces-auto/auto/:marque/:modele
/blog-pieces-auto/conseils/:pg_alias
/blog-pieces-auto/guide/:slug
```

#### E-commerce
```
/cart                          → Panier
/checkout                      → Processus paiement
/checkout/payment              → Page paiement
/checkout/payment/return       → Retour paiement (success/cancel)
```

#### Search
```
/search                        → Recherche globale
/search/results                → Résultats recherche
/search/cnit                   → Recherche CNIT
/search/mine                   → Recherche mine
```

#### Support & Contact
```
/contact                       → Contact général
/support                       → Support client
/support/ai                    → Support IA
/support/contact               → Contact support

/aide                          → Page d'aide française
```

#### Legal & SEO
```
/legal                         → Index pages légales
/legal/:pageKey                → Page légale spécifique (CGV, mentions, etc.)

/robots.txt                    → Robots.txt
/sitemap.xml                   → Sitemap principal
/sitemap-blog.xml              → Sitemap blog
/sitemap-products.xml          → Sitemap produits
/sitemap-constructeurs.xml     → Sitemap constructeurs
```

#### Error Pages
```
/404                           → Page non trouvée
/unauthorized                  → Non autorisé (403)
/gone                          → Ressource supprimée (410)
/precondition-failed           → Erreur précondition (412)
```

---

### 🟢 NIVEAU 2: CLIENT AUTHENTIFIÉ (Level 1-2)

**Préfixe**: `/account/*`  
**Layout**: `account.tsx`  
**Guard**: `requireUser`

```
/account                       → Layout (redirect vers /account/dashboard)
/account/dashboard             → Dashboard client (ses stats, commandes récentes)

/account/profile               → Profil utilisateur
/account/profile/edit          → Éditer profil
/account/security              → Sécurité & mot de passe
/account/settings              → Paramètres utilisateur
/account/addresses             → Adresses de livraison

/account/orders                → SES commandes (historique)
/orders/:orderId               → Détail commande (route spéciale sans /account)
/orders/:orderId/invoice       → Facture PDF

/account/messages              → Messagerie avec support
/account/messages/:messageId   → Message détail
/account/messages/compose      → Composer message

/reviews                       → [Client peut créer avis]
/reviews/create

/tickets                       → Support tickets
/tickets/:ticketId
```

**Note**: `/orders/:orderId` sans préfixe `/account` pour URLs plus courtes (SEO, partage factures)

---

### 🟡 NIVEAU 3: COMMERCIAL (Level 3)

**Préfixe**: Routes directes `/dashboard`, `/orders`, `/products/admin`, OU `/commercial/*` pour features spécifiques  
**Layout**: `commercial.tsx` (partiel, certaines routes peuvent avoir layout global)  
**Guard**: `requireUser` + `level >= 3`

#### Dashboard Commercial
```
/dashboard                     → ✅ Dashboard commercial UNIFIÉ (remplace /commercial et /pro)
                                  KPIs: Commandes jour, CA mois, En préparation, Stock faible
                                  Sections: Categories, Recent orders, Low stock, Suppliers
```

#### Orders Management (Commercial Daily)
```
/orders                        → Liste TOUTES commandes (gestion commerciale)
/orders/:id                    → Détail commande (vue commerciale)
/orders/new                    → Créer nouvelle commande
/orders/:id/edit               → [SI BESOIN] Éditer commande
```

**Note**: `/orders` commercial ≠ `/account/orders` client
- Client: Voit SEULEMENT ses commandes
- Commercial: Voit TOUTES les commandes, peut modifier

#### Products Management
```
/products/admin                → ✅ Gestion produits commerciale
                                  Stats: Total produits, en stock, marques, stock faible
                                  Liste produits avec filtres, recherche
                                  
/products/ranges               → Gammes produits
/products/ranges/:rangeId      → Détail gamme
/products/ranges/advanced      → Vue avancée gammes

/products/gammes/:gammeId      → [Legacy] Détail gamme (rediriger vers /ranges?)
```

#### Vehicles Management
```
/commercial/vehicles           → Index véhicules
/commercial/vehicles/search    → Recherche véhicules
/commercial/vehicles/brands    → Marques véhicules
/commercial/vehicles/brands/:brandId/models → Modèles
/commercial/vehicles/models/:modelId/types  → Types
/commercial/vehicles/compatibility          → Compatibilité
/commercial/vehicles/advanced-search        → Recherche avancée
```

#### Stock Management
```
/commercial/stock              → Gestion stock quotidienne
                                  Alertes stock faible
                                  Mouvements stock
                                  Inventaire
```

#### Shipping & Returns
```
/commercial/shipping           → Expéditions
/commercial/shipping/create    → Créer expédition
/commercial/shipping/tracking  → Suivi expéditions

/commercial/returns            → Gestion retours
```

#### Reports Commercial
```
/commercial/reports            → Rapports commerciaux
                                  Ventes par période
                                  Performance produits
                                  Clients top
```

---

### 🔴 NIVEAU 4: ADMIN SYSTÈME (Level 4+)

**Préfixe**: `/admin/*`  
**Layout**: `admin.tsx` + `admin._layout.tsx`  
**Guard**: `requireAdmin`

#### Dashboard Admin
```
/admin                         → Dashboard admin système (stats globales, santé système)
```

**Note**: Supprimer `/admin/dashboard` (doublon avec `/admin`)

#### System Configuration
```
/admin/system                  → Vue système général
/admin/system-overview         → Overview système
/admin/system-config           → Configuration système
/admin/config                  → [Fusionner avec system-config?]

/admin/debug                   → Debug système
/admin/optimization-summary    → Résumé optimisations
```

#### Users Management (Système)
```
/admin/users                   → Liste TOUS utilisateurs (clients + commerciaux + admins)
/admin/users/:id               → Détail utilisateur
/admin/users/:id/edit          → Éditer utilisateur (permissions, level, etc.)
/admin/users/new               → Créer utilisateur

/admin/staff                   → Personnel/équipe
                                  [À CLARIFIER: Différence avec /admin/users?]
```

#### Suppliers Management
```
/admin/suppliers               → Liste fournisseurs
/admin/suppliers/:id           → Détail fournisseur
/admin/suppliers/:id/edit      → Éditer fournisseur
/admin/suppliers/new           → Créer fournisseur
```

#### Payments Management
```
/admin/payments                → Redirect vers dashboard
/admin/payments/dashboard      → Dashboard paiements
                                  Stats: CA, taux paiement, méthodes
                                  Graphiques
/admin/payments/:paymentId     → Détail paiement
```

#### Orders Config (SI VRAIMENT NÉCESSAIRE)
```
/admin/orders                  → [À DÉCIDER] Config système commandes
                                  OU supprimer et tout mettre dans /orders
                                  
                                  SI GARDER: Configuration statuts, workflow, règles
                                  PAS gestion quotidienne (ça c'est /orders)
```

**Question critique**: `/admin/orders` nécessaire ou tout dans `/orders`?

**Proposition**: 
- **SUPPRIMER** `/admin/orders` 
- Tout dans `/orders` (commercial gère)
- Config workflow dans `/admin/system` si besoin

#### Products Config (SI VRAIMENT NÉCESSAIRE)
```
/admin/products                → [À DÉCIDER] Config système produits
                                  OU rediriger vers /products/admin
                                  
                                  SI GARDER: Configuration gammes, catégories, règles
                                  PAS gestion quotidienne (ça c'est /products/admin)
/admin/products/:productId     → Détail produit admin
/admin/products/gammes/:gammeId → Config gammes
```

**Question critique**: `/admin/products` nécessaire ou tout dans `/products/admin`?

**Proposition**: 
- **REDIRIGER** `/admin/products` → `/products/admin`
- Une seule interface produits (permissions gérées par level)

#### Stock Config
```
/admin/stock                   → [À DÉCIDER] Config stock
                                  OU rediriger vers /commercial/stock
                                  
                                  SI GARDER: Configuration seuils, alertes, règles
```

**Proposition**: **REDIRIGER** vers `/commercial/stock` (pas besoin séparé)

#### Content Management
```
/admin/blog                    → Gestion blog
/admin/articles                → Gestion articles
/admin/seo                     → SEO management
/admin/menu                    → Gestion menus navigation
```

#### Reports Admin
```
/admin/reports                 → Rapports admin système
                                  Analytics globales
                                  Performance système
                                  Logs
```

#### Invoices
```
/admin/invoices                → Gestion factures système
```

#### Messages Admin
```
/admin/messages                → Messages admin (support, équipe)
```

---

### ⚫ NIVEAU 5: API ROUTES

**Préfixe**: `/api/*`  
**Type**: Resource routes (retournent JSON, pas HTML)

```
/api/cart/add                  → Ajouter au panier
/api/errors/suggestions        → Suggestions d'erreurs
/api/notifications             → Notifications
/api/notifications/count       → Compteur notifications
/api/notifications/actions     → Actions notifications
/api/redirects/check           → Vérifier redirections
/api/search/global             → Recherche globale API
```

---

### 🗄️ NIVEAU 6: ARCHIVED & LEGACY

**Préfixe**: `_archive/*`  
**Status**: Conservés pour historique, pas accessibles

```
_archive/constructeurs.*       → Anciennes routes constructeurs
```

---

## 🔄 REDIRECTIONS REQUISES

### Obsolètes → Nouvelles Routes

```typescript
// Routes pro (ERREUR, supprimer)
/pro                          → 301 /dashboard
/pro/orders                   → 301 /orders
/pro/analytics                → 301 /dashboard
/pro/customers                → 301 /commercial/customers [SI EXISTE] ou 404

// Dashboard commercial ancien
/commercial                   → 301 /dashboard
/commercial/orders            → 301 /orders

// Doublons potentiels
/admin/products               → 301 /products/admin [SI DOUBLON]
/admin/orders                 → 301 /orders [SI PAS NÉCESSAIRE]
/admin/stock                  → 301 /commercial/stock [SI DOUBLON]
/order (singulier)            → 404 (supprimer, incohérent)
/orders/modern                → 301 /orders [SI DOUBLON]

// Nommage
/search-demo                  → 301 /search/demo [STANDARDISER]
```

---

## 📋 DÉCISIONS À PRENDRE

### 🔴 CRITIQUES (Bloquer migration)

#### 1. Orders Architecture

**Question**: `/orders` vs `/admin/orders` - Quelle différence?

**Option A - Fusion (RECOMMANDÉ)**:
```
/orders              → Gestion commerciale quotidienne (level >= 3)
/admin               → PAS de section orders (supprimer)
```
**Avantages**: Simplicité, pas de confusion, une seule source de vérité  
**Inconvénients**: Mélange config et daily si besoin séparation

**Option B - Séparation**:
```
/orders              → Gestion commerciale quotidienne (level >= 3)
/admin/orders        → Config système commandes (level >= 4)
                        - Workflow statuts
                        - Règles automatiques
                        - Intégrations
```
**Avantages**: Séparation claire config vs utilisation  
**Inconvénients**: Complexité, liens à maintenir, risque confusion

**RECOMMANDATION**: **Option A** sauf si vraiment besoin config séparée

---

#### 2. Products Architecture

**Question**: `/products/admin` vs `/admin/products` - Doublon ou différents?

**À faire**: Comparer contenu des 2 fichiers
```bash
diff frontend/app/routes/products.admin.tsx frontend/app/routes/admin.products._index.tsx
```

**Option A - Fusion (RECOMMANDÉ)**:
```
/products/admin      → Gestion produits unique (permissions par level)
/admin               → Redirection produits supprimée
```

**Option B - Séparation**:
```
/products/admin      → Gestion quotidienne produits (commercial, level >= 3)
/admin/products      → Config système produits (admin, level >= 4)
                        - Gammes
                        - Catégories
                        - Règles métier
```

**RECOMMANDATION**: **Option A** sauf si vraiment usages différents

---

#### 3. Dashboard Admin

**Question**: `/admin` vs `/admin/dashboard` - Pourquoi 2?

**À faire**: Vérifier contenu `admin.dashboard.tsx`
```bash
cat frontend/app/routes/admin.dashboard.tsx | head -50
```

**Décision**:
- Si vide ou simple redirect: **Supprimer** `admin.dashboard.tsx`
- Si contenu différent: **Documenter** différence clairement
- **Garder** `admin._index.tsx` comme seul dashboard admin

---

### 🟠 IMPORTANTES (Avant cleanup final)

#### 4. Stock Routes

**Question**: `/commercial/stock` vs `/admin/stock` - Fusionner?

**Proposition**: 
- Garder `/commercial/stock` (gestion quotidienne)
- Supprimer `/admin/stock` si doublon
- Config stock dans `/admin/system` si besoin

---

#### 5. Staff Routes

**Question**: `/staff` vs `/admin/staff` - Pourquoi 2?

**Proposition**:
- Garder `/admin/staff` (gestion équipe, permissions admin)
- Supprimer `/staff` (redondant)

---

#### 6. Business Section

**Question**: `/business/*` (6 routes) - Quel usage?

**Options**:
- **Marketing/Sales**: Garder, améliorer contenu
- **Obsolète**: Supprimer complètement
- **Mal placé**: Migrer ailleurs

**À faire**: Demander à l'équipe l'objectif initial

---

### 🟡 MINEURES (Polish)

#### 7. Catalog Standardization

**Question**: `catalog` (anglais) vs `catalogue` (français) - Standardiser?

**Proposition**:
- Public: `/catalogue` (français, pour clients français)
- Admin: `/catalog` (anglais, pour cohérence code)
- OU tout en français si public français uniquement

---

#### 8. Search Demos

**Question**: `/search-demo` vs `/search/demo` - Garder quel format?

**Proposition**: **Supprimer** `/search-demo`, garder `/search/demo` (cohérent)

---

#### 9. Orders Modern

**Question**: `/orders/modern` - C'est quoi? Garder?

**À faire**: Vérifier contenu
```bash
cat frontend/app/routes/orders.modern.tsx | head -30
```

**Proposition**: Si expérience UI, documenter ou fusionner. Sinon supprimer.

---

## 📐 CONVENTIONS FINALES

### Nommage Fichiers

```
✅ DO:
routes/account.dashboard.tsx        → /account/dashboard
routes/orders.$id.tsx                → /orders/:id
routes/products._index.tsx           → /products
routes/admin.users.$id.edit.tsx      → /admin/users/:id/edit

❌ DON'T:
routes/order.tsx                     → /order (singulier incohérent)
routes/orderDetails.tsx              → /orderDetails (camelCase)
routes/admin-users.tsx               → /admin-users (pas de kebab dans filename)
```

### Structure Dossiers

```
frontend/app/routes/
├── _public+/                 # Routes publiques (layout séparé)
├── _archive/                 # Routes archivées
├── account.*                 # Client authentifié
├── commercial.*              # Commercial features
├── admin.*                   # Admin système
├── api.*                     # API routes
├── dashboard.tsx             # Dashboard commercial (root level)
├── orders.*                  # Orders management
├── products.*                # Products (public + admin)
└── *.tsx                     # Autres routes publiques
```

### Permissions Guards

```typescript
// Template standard
export async function loader({ request, context }: LoaderFunctionArgs) {
  // 1. Auth check
  const user = await requireUser({ context }); // ou getOptionalUser si public
  
  // 2. Level check (si nécessaire)
  const userLevel = parseInt(user.level?.toString() || '0', 10);
  if (userLevel < 3) { // Commercial: >= 3, Admin: >= 4
    throw redirect('/unauthorized');
  }
  
  // 3. Fetch data
  const data = await fetchData();
  
  // 4. Return
  return json({ user, data });
}
```

### Layouts Hierarchy

```
Root (root.tsx)
├── App Layout (app.tsx) - Global layout
│   ├── Public Routes
│   │   └── _public+/_layout.tsx - Public specific layout
│   │
│   ├── Client Routes
│   │   └── account.tsx - Account layout
│   │       ├── account.dashboard.tsx
│   │       ├── account.profile.tsx
│   │       └── ...
│   │
│   ├── Commercial Routes
│   │   ├── dashboard.tsx (standalone)
│   │   ├── orders.* (standalone)
│   │   ├── products.admin.tsx (standalone)
│   │   └── commercial.tsx - Commercial layout
│   │       ├── commercial.vehicles.*
│   │       ├── commercial.stock.*
│   │       └── ...
│   │
│   └── Admin Routes
│       └── admin.tsx - Admin layout
│           ├── admin._layout.tsx - Admin sidebar/nav
│           ├── admin._index.tsx (dashboard)
│           ├── admin.users.*
│           └── ...
```

---

## 🎨 UI/UX Guidelines

### Breadcrumbs

```typescript
// Exemple structure
Admin > Utilisateurs > Jean Dupont > Éditer
/admin  /users       /users/123    /users/123/edit

Commercial > Commandes > CMD-2025-001
/dashboard   /orders     /orders/CMD-2025-001

Mon Compte > Commandes > CMD-2025-001
/account     /account/orders  /orders/CMD-2025-001
```

### Navigation Menus

**Client**:
```
🏠 Dashboard        /account/dashboard
📦 Mes Commandes    /account/orders
👤 Mon Profil       /account/profile
💬 Messages         /account/messages
⚙️  Paramètres      /account/settings
```

**Commercial**:
```
📊 Dashboard        /dashboard
📋 Commandes        /orders
📦 Produits         /products/admin
🚗 Véhicules        /commercial/vehicles
📊 Stock            /commercial/stock
🚚 Expéditions      /commercial/shipping
📈 Rapports         /commercial/reports
```

**Admin**:
```
🏠 Dashboard        /admin
👥 Utilisateurs     /admin/users
🏢 Fournisseurs     /admin/suppliers
💳 Paiements        /admin/payments/dashboard
📦 Produits         /products/admin [OU /admin/products]
📋 Commandes        /orders [OU /admin/orders]
📝 Blog             /admin/blog
⚙️  Système         /admin/system
```

---

## ✅ VALIDATION CHECKLIST

Avant d'approuver cette architecture:

### Décisions Critiques
- [ ] **Orders**: Option A (fusion) ou B (séparation)?
- [ ] **Products**: Garder `/products/admin` unique ou séparer `/admin/products`?
- [ ] **Admin Dashboard**: Confirmer suppression `/admin/dashboard`

### Clarifications
- [ ] **Stock**: Fusionner `/admin/stock` → `/commercial/stock`?
- [ ] **Staff**: Supprimer `/staff`, garder uniquement `/admin/staff`?
- [ ] **Business**: Quel est l'objectif de la section `/business`?
- [ ] **Catalog**: Standardiser orthographe (catalog vs catalogue)
- [ ] **Orders Modern**: Garder ou supprimer `/orders/modern`?

### Technique
- [ ] Vérifier que tous les guards permissions sont corrects
- [ ] Valider structure layouts
- [ ] Confirmer conventions nommage
- [ ] Approuver liste redirections

### UX
- [ ] Navigation menus proposés OK?
- [ ] Breadcrumbs logiques?
- [ ] URLs SEO-friendly?

---

## 📊 IMPACT ESTIMATION

### Routes Affectées

| Catégorie | Avant | Après | Supprimés | Redirections |
|-----------|-------|-------|-----------|--------------|
| Public | 60 | 60 | 0 | 0 |
| Client Auth | 20 | 20 | 0 | 0 |
| Commercial | 40 | 35 | 5 (pro.*) | 3 |
| Admin | 30 | 25 | 5 | 3 |
| API | 7 | 7 | 0 | 0 |
| Archive/Demo | 15 | 5 | 10 | 0 |
| **TOTAL** | **172** | **152** | **20** | **6** |

### Liens à Mettre à Jour

| Type | Nombre |
|------|--------|
| Dashboard commercial | 6 liens |
| Orders commercial | 2 liens |
| Products | 11 liens |
| Navigation globale | ~20 liens |
| **TOTAL** | **~40 liens** |

### Temps de Migration

| Phase | Durée | Complexité |
|-------|-------|------------|
| Suppressions | 1h | 🟢 Facile |
| Redirections | 1h | 🟢 Facile |
| Mise à jour liens | 2h | 🟡 Moyenne |
| Tests | 2h | 🟡 Moyenne |
| **TOTAL** | **6h** | **~1 jour** |

---

## 🚀 NEXT STEPS

1. **Valider cette architecture** avec équipe
2. **Répondre aux 9 questions** critiques/importantes
3. **Créer plan de migration** détaillé
4. **Exécuter migration** par phases
5. **Tester** chaque niveau utilisateur
6. **Documenter** architecture finale

---

**Status**: 📋 PROPOSITION  
**Prêt pour**: Validation équipe  
**Après validation**: Migration peut commencer immédiatement

