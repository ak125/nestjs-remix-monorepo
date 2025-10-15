# 🧹 Plan de Nettoyage - Préparation GitHub Runner

## 📋 Fichiers à Supprimer

### 1. Fichiers de Documentation Redondants (Root)
Ces fichiers sont des récapitulatifs de phases de développement déjà complétées :
- [ ] `AMELIORATIONS-DESIGN-PANIER.md` (ancien)
- [ ] `CORRECTION-FAILED-TO-FETCH-CART.md` (ancien)
- [ ] `CORRECTIONS-FINALES-CART-SIDEBAR.md` (ancien)
- [ ] `GUIDE-TEST-FRONTEND.md` (obsolète)
- [ ] `GUIDE-TEST-SYNCHRONISATION-PANIER.md` (obsolète)
- [ ] `NAVBAR-CORRECTIONS-FINALES.md` (remplacé par NAVBAR-REFONTE-RESUME.md)
- [ ] `NAVBAR-REFONTE-AUDIT.md` (développement terminé)
- [ ] `PHASE1-POC-CARTSIDEBAR-COMPLETE.md` (phase terminée)
- [ ] `PHASE2-NAVBAR-MOBILE-COMPLETE.md` (phase terminée)
- [ ] `PHASE3-TOPBAR-COMPLETE.md` (phase terminée)
- [ ] `PHASE4-HOTFIX-BACKEND-CONSIGNES.md` (hotfix appliqué)
- [ ] `PHASE7-NAVBAR-CLEANUP-COMPLETE.md` (phase terminée)
- [ ] `PHASE8-BACKEND-API-CONSIGNES-COMPLETE.md` (phase terminée)
- [ ] `PHASE9-PRODUCTSEARCH-COMPLETE.md` (phase terminée)
- [ ] `PHASE9-RECAP.md` (redondant avec RECAP-COMPLET)
- [ ] `RECAP-PHASES-1-8.md` (remplacé par RECAP-COMPLET-PHASES-1-9.md)
- [ ] `RECAPITULATIF-FINAL-PANIER.md` (ancien)
- [ ] `SESSION-COMPLETE-2025-10-14.md` (session de dev terminée)
- [ ] `SYNCHRONISATION-AFFICHAGE-PANIER.md` (ancien)
- [ ] `TEST-CART-CONSIGNES.md` (tests en dur)

**À GARDER** :
- ✅ `AMELIORATIONS-HOMEPAGE-COMPLETE.md` (documentation actuelle)
- ✅ `README.md` (principal)
- ✅ `README-NAVBAR.md` (doc navbar)
- ✅ `NAVBAR-REFONTE-RESUME.md` (résumé utile)
- ✅ `PHASE10-RESUME-EXECUTIF.md` (phase actuelle)
- ✅ `PHASE10-TESTS-COMPLETE.md` (tests actuels)
- ✅ `RECAP-COMPLET-PHASES-1-9.md` (récap complet)
- ✅ `QUICKSTART-DEV-NAVBAR.md` (guide dev)
- ✅ `SPEC-NAVBAR-V2-TABLES-EXISTANTES.md` (specs)
- ✅ `SPEC-PRODUCTS-ADMIN-COMPLETE.md` (specs)
- ✅ `SPRINT1-PRODUCTS-COMPLETE.md` (référence)
- ✅ `STATUS-BADGE.md` (utile)
- ✅ `STATUT-PROJET-FINAL.md` (état actuel)

### 2. Scripts de Test Obsolètes (Root)
- [ ] `test-checkout-phase5.sh` (phase terminée)
- [ ] `test-complete-flow-phase7.sh` (phase terminée)
- [ ] `test-payment-phase6.sh` (phase terminée)
- [ ] `test-phase4-consignes.sh` (phase terminée)

**À GARDER** :
- ✅ `test-e2e-complete.sh` (tests E2E actuels)

### 3. Fichiers Temporaires
- [ ] `cookies.txt` (fichier temporaire)

### 4. Routes Dupliquées/Obsolètes (Frontend)
Routes en double ou versions de test :
- [ ] `frontend/app/routes/_index.v3.tsx` (version test, garder _index.tsx)
- [ ] `frontend/app/routes/homepage-v3.tsx` (doublon)
- [ ] `frontend/app/routes/homepage.v3.tsx` (doublon)
- [ ] `frontend/app/routes/checkout-payment-return.tsx` (doublon de checkout.payment.tsx)
- [ ] `frontend/app/routes/checkout-payment.tsx` (doublon)
- [ ] `frontend/app/routes/admin.users.$id.tsx.v1` (ancienne version)

Routes de test/debug :
- [ ] `frontend/app/routes/test-route.tsx`
- [ ] `frontend/app/routes/test-simple.tsx`
- [ ] `frontend/app/routes/navigation-debug.tsx`
- [ ] `frontend/app/routes/search-demo.tsx`
- [ ] `frontend/app/routes/search.demo.tsx`
- [ ] `frontend/app/routes/demo-images.tsx`
- [ ] `frontend/app/routes/v5-ultimate-demo.tsx`

### 5. Fichiers HTML Statiques (Frontend Public)
- [ ] `frontend/public/index.html` (non utilisé dans Remix)
- [ ] `frontend/public/index-v2.html` (non utilisé)

**À GARDER** :
- ✅ `frontend/public/offline.html` (PWA)
- ✅ `frontend/public/debug-vehicle-selector.js` (debug utile)

### 6. Scripts de Test Backend Obsolètes
- [ ] `backend/test-phase8-consignes-api.ts` (phase terminée)
- [ ] `backend/test-phase8-simple.ts` (phase terminée)

**À GARDER tous les autres tests** :
- ✅ `backend/test-cart-*.sh`
- ✅ `backend/test-admin-*.sh`
- ✅ `backend/test-orders-*.sh`
- ✅ Etc. (tests fonctionnels)

### 7. Composants Inutilisés (À vérifier)
Vérifier si ces composants homepage-v3 sont utilisés ou juste des brouillons :
- À analyser : `frontend/app/components/homepage-v3/*` (garder seulement ceux utilisés)
- À analyser : `frontend/app/components/homepage/*` (sections part2, part3, part4)

## 📊 Résumé

### Fichiers à Supprimer : ~35 fichiers
- Documentation obsolète : ~20 fichiers
- Scripts de test de phases : 4 fichiers
- Routes dupliquées/test : ~8 fichiers
- HTML statiques : 2 fichiers
- Fichier temporaire : 1 fichier

### Espace libéré estimé : ~5-10 MB

### Fichiers à Garder : Essentiels
- Documentation actuelle et specs
- Tests E2E fonctionnels
- Routes de production
- Composants actifs
- Assets nécessaires

## ✅ Actions Recommandées

1. **Priorité HAUTE** : Supprimer documentation redondante et obsolète
2. **Priorité HAUTE** : Supprimer routes de test/debug
3. **Priorité MOYENNE** : Supprimer scripts de test de phases terminées
4. **Priorité BASSE** : Nettoyer composants inutilisés (vérifier avant)

## 🔒 À NE PAS TOUCHER

- `.git/` - Historique Git
- `.github/` - Workflows GitHub Actions
- `node_modules/` - Dépendances (dans .gitignore)
- `.env` - Variables d'environnement (dans .gitignore)
- `cache/` - Cache Turbo
- Tous les fichiers de configuration (tsconfig, package.json, etc.)
- Routes de production actives
- Composants utilisés dans la production
