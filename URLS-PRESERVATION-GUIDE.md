# 🔒 URLs Préservées - Documentation Stricte

**Fichier**: Route pièces `pieces.$gamme.$marque.$modele.$type[.]html.tsx`  
**Objectif**: Refactorisation SANS modification des URLs existantes  
**Date**: 19 octobre 2025

---

## ⚠️ URLS STRICTEMENT PRÉSERVÉES

### 1. **Structure URL Route Frontend**
```
/pieces/{gamme}/{marque}/{modele}/{type}.html
```

**Exemples réels**:
- `/pieces/freinage/renault/clio/1-5-dci.html`
- `/pieces/filtres-a-huile-402/renault-23/clio-456/1-5-dci-55593.html` (avec IDs)
- `/pieces/plaquettes-de-frein/peugeot/308/1-6-hdi.html`

**Format paramètres**:
- `{gamme}`: slug ou `slug-{id}` 
- `{marque}`: slug ou `slug-{id}`
- `{modele}`: slug ou `slug-{id}`
- `{type}`: slug ou `slug-{id}`

**⚠️ NE PAS MODIFIER** - Utilisé par:
- SEO (URLs indexées Google)
- Liens internes du site
- Emails clients
- Sitemaps
- Redirections

---

## 🔗 URLs API Backend Préservées

### 2. **API Pièces - PHP Logic**
```typescript
http://localhost:3000/api/catalog/pieces/php-logic/{typeId}/{gammeId}
```

**Exemples**:
- `http://localhost:3000/api/catalog/pieces/php-logic/55593/402`
- `http://localhost:3000/api/catalog/pieces/php-logic/128049/75`

**Utilisé dans**:
- `pieces.service.ts` (ligne 51)
- `pieces-route.service.ts` (ré-export)

**⚠️ NE PAS MODIFIER** - Endpoint critique production

---

### 3. **API Cross-Selling**
```typescript
http://localhost:3000/api/cross-selling/v5/{typeId}/{gammeId}
```

**Exemples**:
- `http://localhost:3000/api/cross-selling/v5/55593/402`

**Utilisé dans**:
- `pieces-route.service.ts` (ligne 23)

**⚠️ NE PAS MODIFIER** - Format consolidé Phase 3

---

### 4. **API Blog - Multiple Endpoints**

#### 4a. Recherche par gamme
```typescript
http://localhost:3000/api/blog/search?q={gamme}&limit=1
```

#### 4b. Articles populaires
```typescript
http://localhost:3000/api/blog/popular?limit=1&category=entretien
```

#### 4c. Page d'accueil blog
```typescript
http://localhost:3000/api/blog/homepage
```

**Utilisé dans**:
- `pieces-route.service.ts` (lignes 90, 118, 141)

**⚠️ NE PAS MODIFIER** - Stratégie fallback multi-endpoints

---

### 5. **API Véhicules - Résolution IDs**

#### 5a. Recherche marques
```typescript
http://localhost:3000/api/vehicles/brands?search={marque}&limit=1
```

#### 5b. Modèles par marque
```typescript
http://localhost:3000/api/vehicles/brands/{marqueId}/models
```

**Utilisé dans**:
- `pieces-route.utils.ts` (lignes 212, 218)

**⚠️ NE PAS MODIFIER** - Résolution dynamique IDs

---

## 📍 URLs de Navigation Internes

### 6. **Liens Cross-Selling (vers autres gammes)**
```typescript
/pieces/{pgAlias}/{marque}/{modele}/{type}.html
```

**Construction**:
```typescript
const crossSellingUrl = `/pieces/${thisPgAlias}/${vehicle.marque.toLowerCase()}/${vehicle.modele.toLowerCase().replace(/ /g, '-')}/${vehicle.type.toLowerCase().replace(/ /g, '-')}.html`;
```

**Exemple**:
```
/pieces/disques-de-frein/renault/clio/1-5-dci.html
```

**⚠️ NE PAS MODIFIER** - Format exact attendu par le routeur Remix

---

### 7. **Liens Blog**
```typescript
/blog/{slug}
```

**Exemples**:
- `/blog/entretien-filtres-a-huile-renault-clio`
- `/blog/guide-entretien-automobile`

**⚠️ NE PAS MODIFIER** - Structure blog existante

---

### 8. **Liens Breadcrumb**
```typescript
/ → /pieces → /pieces/{gamme} → [current]
```

**⚠️ NE PAS MODIFIER** - Navigation cohérente

---

## ✅ Validations Automatiques

### Checklist avant commit:
- [ ] Aucune modification dans les templates d'URL
- [ ] Tous les `fetch()` utilisent les URLs exactes documentées
- [ ] Aucun changement dans les chemins de route Remix
- [ ] Cross-selling génère les URLs au bon format
- [ ] Breadcrumbs utilisent les chemins corrects
- [ ] Tests de navigation fonctionnent

---

## 🔍 Comment Vérifier

### Test 1: URLs Frontend
```bash
# Vérifier que la route Remix n'a pas changé
grep "pieces\.\$gamme" frontend/app/routes/*.tsx
```

### Test 2: URLs API
```bash
# Vérifier les appels API
grep -r "api/catalog/pieces" frontend/
grep -r "api/cross-selling" frontend/
grep -r "api/blog" frontend/
```

### Test 3: Génération URLs Navigation
```bash
# Vérifier construction URLs cross-selling
grep "crossSellingUrl" frontend/app/components/**/*.tsx
```

---

## 📊 Impact Changements URLs

| Zone | Impact | Gravité | Action |
|------|--------|---------|--------|
| **Route frontend** | SEO catastrophique | 🔴 CRITIQUE | ❌ INTERDIT |
| **API backend** | Erreurs 404 prod | 🔴 CRITIQUE | ❌ INTERDIT |
| **Navigation interne** | Liens cassés | 🟠 ÉLEVÉ | ❌ INTERDIT |
| **Breadcrumbs** | UX dégradée | 🟡 MOYEN | ⚠️ Éviter |

---

## 📝 Modifications Autorisées

### ✅ AUTORISÉ:
- Refactorisation des composants React
- Extraction de logique dans hooks/utils
- Amélioration du style CSS
- Optimisation des performances
- Ajout de composants internes

### ❌ INTERDIT:
- Modification structure URL route (`pieces.$gamme...`)
- Changement endpoints API (`api/catalog/pieces/...`)
- Modification format paramètres URL
- Changement construction URLs cross-selling
- Altération chemins breadcrumb

---

**Version**: 1.0  
**Mainteneur**: AI Agent Refactoring  
**Dernière révision**: 19 octobre 2025
