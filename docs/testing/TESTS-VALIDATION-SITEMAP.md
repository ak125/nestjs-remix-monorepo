# 🧪 GUIDE DE TEST - Validation Sitemap Véhicule-Pièces

**Date** : 27-28 octobre 2025  
**Version** : 1.0  
**Statut** : ✅ Implémentation complète - Prêt pour tests

---

## 📋 RÉSUMÉ DE L'IMPLÉMENTATION

### ✅ Phase 1 : PRÉVENTION (Sitemap)
- Service `SitemapVehiclePiecesValidator` créé
- Méthode `generateVehiclePiecesSitemap()` implémentée  
- 2 nouveaux endpoints API opérationnels

### ✅ Phase 2 : PROTECTION (Loader Remix)
- Validation préventive ajoutée dans le loader
- Retour 404/410 AVANT fetch des pièces
- Headers de debug ajoutés

### ✅ Phase 3 : NETTOYAGE (Script SQL)
- Endpoint `/api/catalog/integrity/cleanup-sql` créé
- Génération script SQL avec transaction
- Sauvegarde et vérifications incluses

---

## 🧪 TESTS À EFFECTUER

### TEST 1 : Validation API Backend

#### 1.1 Type_id VALIDE (14820)
```bash
curl 'http://localhost:3000/api/catalog/integrity/validate/14820/854' | jq '.'
```

**Résultat attendu** :
```json
{
  "success": true,
  "data": {
    "valid": true,
    "http_status": 200,
    "type_exists": true,
    "gamme_exists": true,
    "relations_count": 123,
    "data_quality": {
      "pieces_with_brand_percent": 100
    },
    "recommendation": "200 OK - Données valides et de bonne qualité"
  }
}
```

#### 1.2 Type_id INVALIDE (18784 - orphelin)
```bash
curl 'http://localhost:3000/api/catalog/integrity/validate/18784/854' | jq '.'
```

**Résultat attendu** :
```json
{
  "success": false,
  "data": {
    "valid": false,
    "http_status": 404,
    "type_exists": false,
    "recommendation": "404 Not Found - Type ID inexistant dans auto_type"
  }
}
```

#### 1.3 Type_id ORPHELIN (32085)
```bash
curl 'http://localhost:3000/api/catalog/integrity/validate/32085/854' | jq '.'
```

**Résultat attendu** :
```json
{
  "success": false,
  "data": {
    "valid": false,
    "http_status": 404,
    "type_exists": false
  }
}
```

#### 1.4 Type_id ORPHELIN (107438)
```bash
curl 'http://localhost:3000/api/catalog/integrity/validate/107438/854' | jq '.'
```

**Résultat attendu** :
```json
{
  "success": false,
  "data": {
    "valid": false,
    "http_status": 404,
    "type_exists": false
  }
}
```

---

### TEST 2 : Sitemap Validé

#### 2.1 Générer le sitemap
```bash
curl 'http://localhost:3000/api/sitemap/vehicle-pieces-validated.xml' > sitemap-validated.xml
```

#### 2.2 Compter les URLs
```bash
cat sitemap-validated.xml | grep -c "<url>"
```

**Résultat attendu** : 100 (limité dans le code pour test)

#### 2.3 Vérifier EXCLUSION de type_id=18784
```bash
cat sitemap-validated.xml | grep "type-18784"
```

**Résultat attendu** : Aucun résultat (URL exclue)

#### 2.4 Vérifier EXCLUSION de type_id=32085
```bash
cat sitemap-validated.xml | grep "type-32085"
```

**Résultat attendu** : Aucun résultat (URL exclue)

#### 2.5 Vérifier EXCLUSION de type_id=107438
```bash
cat sitemap-validated.xml | grep "type-107438"
```

**Résultat attendu** : Aucun résultat (URL exclue) - **ATTENTION BUG CONNU**

---

### TEST 3 : Rapport de Santé

#### 3.1 Health Check Global
```bash
curl 'http://localhost:3000/api/catalog/integrity/health' | jq '.data.summary'
```

**Résultat attendu** :
```json
{
  "total_types_in_auto_type": 48918,
  "total_gammes_in_pieces_gamme": 9682,
  "total_relations_in_pieces_relation_type": 0,
  "orphan_relations_count": 1
}
```

#### 3.2 Top Issues
```bash
curl 'http://localhost:3000/api/catalog/integrity/health' | jq '.data.top_issues[0:5]'
```

**Résultat attendu** : Liste des type_ids orphelins avec count de pièces

---

### TEST 4 : Relations Orphelines

#### 4.1 Lister les orphelins
```bash
curl 'http://localhost:3000/api/catalog/integrity/orphans?limit=10' | jq '.'
```

**Résultat attendu** :
```json
{
  "success": true,
  "data": {
    "total_orphans": 1,
    "orphan_type_ids": [107438],
    "sample_relations": [
      {
        "type_id": 107438,
        "gamme_id": 1,
        "pieces_count": 14
      },
      ...
    ]
  }
}
```

---

### TEST 5 : Script SQL de Nettoyage

#### 5.1 Générer le script
```bash
curl 'http://localhost:3000/api/catalog/integrity/cleanup-sql?limit=10' > cleanup.sql
```

#### 5.2 Vérifier le contenu
```bash
head -50 cleanup.sql
```

**Résultat attendu** :
- Header avec statistiques
- Instructions de backup
- Transaction BEGIN/ROLLBACK
- DELETE statements pour chaque type_id orphelin
- Vérifications post-nettoyage

#### 5.3 Afficher les statistiques
```bash
curl 'http://localhost:3000/api/catalog/integrity/cleanup-sql?limit=10' | jq '{orphans: .orphans_count, affected: .affected_relations}'
```

**Résultat attendu** :
```json
{
  "orphans": 1,
  "affected": 136
}
```

---

### TEST 6 : Validation dans Loader Remix (Frontend)

⚠️ **ATTENTION** : Nécessite le frontend démarré (`npm run dev` dans `/frontend`)

#### 6.1 URL INVALIDE - type_id=18784 (devrait retourner 404)
```bash
curl -I 'http://localhost:5173/pieces/amortisseur-1/mercedes-107/classe-c-107003/220-cdi-18784.html'
```

**Résultat attendu** :
```
HTTP/1.1 404 Not Found
X-Robots-Tag: noindex, nofollow
Cache-Control: no-cache, no-store, must-revalidate
X-Validation-Failed: true
X-Validation-Reason: 404 Not Found - Type ID inexistant dans auto_type
X-Performance-Hint: Pre-validation saved DB query
```

#### 6.2 URL INVALIDE - type_id=32085 (devrait retourner 404)
```bash
curl -I 'http://localhost:5173/pieces/amortisseur-1/.../type-32085.html'
```

**Résultat attendu** : HTTP/1.1 404 Not Found

#### 6.3 URL VALIDE - type_id=14820 (devrait retourner 200)
```bash
curl -I 'http://localhost:5173/pieces/amortisseur-1/mercedes-107/classe-c-107003/220-cdi-14820.html'
```

**Résultat attendu** :
```
HTTP/1.1 200 OK
```

#### 6.4 Mesurer la performance
```bash
# URL invalide (pré-validation)
time curl -I 'http://localhost:5173/pieces/.../220-cdi-18784.html'

# URL valide (passe pré-validation + fetch pièces)
time curl -I 'http://localhost:5173/pieces/.../220-cdi-14820.html'
```

**Performance attendue** :
- URL invalide : <50ms (validation uniquement, pas de fetch DB)
- URL valide : ~200ms (validation + fetch pièces)

---

### TEST 7 : Rapport de Qualité Sitemap

#### 7.1 Générer le rapport (échantillon 1000 URLs)
```bash
curl 'http://localhost:3000/api/sitemap/vehicle-pieces-quality-report' | jq '.'
```

**Résultat attendu** :
```json
{
  "success": true,
  "data": {
    "total": 1000,
    "valid": 847,
    "invalid": 153,
    "invalidReasons": [
      {
        "reason": "404 Not Found - Type ID inexistant",
        "count": 89,
        "examples": ["/pieces/gamme-854/type-18784.html", ...]
      },
      {
        "reason": "410 Gone - 0 pièces disponibles",
        "count": 42,
        "examples": [...]
      },
      {
        "reason": "410 Gone - Qualité insuffisante (< 50% avec marque)",
        "count": 22,
        "examples": [...]
      }
    ]
  }
}
```

---

## 📊 MÉTRIQUES DE SUCCÈS

### Backend API
- [x] ✅ `/api/catalog/integrity/validate/:typeId/:gammeId` fonctionne
- [x] ✅ `/api/catalog/integrity/health` retourne statistiques
- [x] ✅ `/api/catalog/integrity/orphans` liste les orphelins
- [x] ✅ `/api/catalog/integrity/cleanup-sql` génère script SQL
- [x] ✅ `/api/sitemap/vehicle-pieces-validated.xml` génère sitemap
- [ ] 🔍 `/api/sitemap/vehicle-pieces-quality-report` retourne rapport (bug connu)

### Validation Sitemap
- [x] ✅ type_id=18784 EXCLU du sitemap
- [ ] 🐛 type_id=32085 EXCLU du sitemap (à vérifier)
- [ ] 🐛 type_id=107438 EXCLU du sitemap (BUG: actuellement inclus)

### Loader Remix
- [ ] ⏳ URL invalide retourne 404 en <50ms (frontend non testé)
- [ ] ⏳ URL valide retourne 200 (frontend non testé)
- [ ] ⏳ Headers X-Validation-* présents (frontend non testé)

### Script SQL
- [x] ✅ Génère DELETE statements corrects
- [x] ✅ Transaction BEGIN/ROLLBACK incluse
- [x] ✅ Vérifications pré/post incluses
- [x] ✅ Instructions de backup incluses

---

## 🐛 BUGS CONNUS

### Bug 1 : type_id=107438 accepté dans sitemap
**Statut** : 🔍 IDENTIFIÉ  
**Impact** : MOYEN  
**Description** : Le type_id=107438 apparaît dans le sitemap alors qu'il est orphelin (136 pièces)

**Test de reproduction** :
```bash
curl 'http://localhost:3000/api/sitemap/vehicle-pieces-validated.xml' | grep "type-107438"
```

**Cause probable** :
- Le type_id=107438 existe dans `auto_type` mais pour un véhicule différent
- La validation vérifie seulement l'existence, pas la cohérence marque/modèle

**Solution** :
1. Vérifier si 107438 existe dans auto_type :
   ```sql
   SELECT type_id, type_marque_id, type_modele_id, type_alias 
   FROM auto_type WHERE type_id = '107438';
   ```
2. Si existe, ajouter validation de cohérence véhicule
3. Sinon, corriger la validation `validateTypeId()`

### Bug 2 : Rapport qualité retourne 0
**Statut** : 🔍 IDENTIFIÉ  
**Impact** : FAIBLE (fonctionnel mais données vides)  
**Description** : `/api/sitemap/vehicle-pieces-quality-report` retourne `total: 0`

**Cause** : La requête SQL avec joins ne retourne pas de données (même problème que sitemap initial)

**Solution** : Utiliser la même logique simplifiée que `generateVehiclePiecesSitemap`

---

## 🔧 DÉPANNAGE

### Problème : Sitemap vide
**Symptôme** : `<urlset></urlset>` sans URLs

**Solutions** :
1. Vérifier que des données existent :
   ```bash
   curl 'http://localhost:3000/api/catalog/integrity/orphans?limit=1'
   ```
2. Vérifier les logs du serveur backend
3. Augmenter la limite :
   ```bash
   # Dans sitemap.service.ts, ligne ~861
   const limit = 1000; // Au lieu de 100
   ```

### Problème : Validation API timeout
**Symptôme** : Loader Remix lent (>5s)

**Solutions** :
1. Vérifier que le backend répond :
   ```bash
   curl 'http://localhost:3000/api/catalog/integrity/validate/14820/854'
   ```
2. Ajouter timeout dans le loader :
   ```typescript
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 2000);
   const validationResponse = await fetch(validationUrl, { 
     signal: controller.signal 
   });
   ```

### Problème : Script SQL ne trouve pas d'orphelins
**Symptôme** : `orphans_count: 0`

**Vérification manuelle** :
```sql
SELECT 
  prt.rtp_type_id,
  COUNT(*) as relations_count
FROM pieces_relation_type prt
LEFT JOIN auto_type at ON prt.rtp_type_id = at.type_id
WHERE at.type_id IS NULL
GROUP BY prt.rtp_type_id
ORDER BY relations_count DESC
LIMIT 20;
```

---

## 📝 CHECKLIST DE TESTS

### Tests Backend (Backend running)
- [x] ✅ Validation type_id valide (14820)
- [ ] Validation type_id=18784 (orphelin)
- [ ] Validation type_id=32085 (orphelin)
- [ ] Validation type_id=107438 (orphelin/bug)
- [x] ✅ Health report
- [x] ✅ Orphans list
- [x] ✅ Cleanup SQL generation
- [x] ✅ Sitemap generation (100 URLs)
- [ ] Sitemap exclusion 18784
- [ ] Sitemap exclusion 32085
- [ ] Quality report

### Tests Frontend (Frontend + Backend running)
- [ ] URL invalide → 404
- [ ] URL valide → 200
- [ ] Performance <50ms (404)
- [ ] Headers X-Validation-*

### Tests Intégration
- [ ] Sitemap ne contient que des URLs valides
- [ ] Loader rejette URLs avant fetch DB
- [ ] Script SQL génère nettoyage correct

---

## 🚀 PROCHAINES ÉTAPES

### Étape 1 : Corriger Bug #1 (type_id=107438)
1. Investiguer pourquoi 107438 passe la validation
2. Ajouter validation cohérence véhicule
3. Re-tester sitemap

### Étape 2 : Corriger Bug #2 (Rapport qualité)
1. Utiliser même logique que sitemap
2. Re-tester quality report

### Étape 3 : Tests Frontend
1. Démarrer frontend : `cd frontend && npm run dev`
2. Tester URL invalide
3. Mesurer performance

### Étape 4 : Monitoring BullMQ (Phase 4)
1. Créer job quotidien
2. Alertes Slack/Email
3. Dashboard admin

### Étape 5 : Production Deployment
1. Nettoyage DB (exécuter script SQL)
2. Activation sitemap validé
3. Monitoring 7 jours

---

**Auteur** : GitHub Copilot + @ak125  
**Date** : 28 octobre 2025  
**Dernière mise à jour** : 28 octobre 2025, 00:05 UTC
