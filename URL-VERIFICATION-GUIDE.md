# 🔍 Guide de Vérification Compatibilité URLs

## 📋 Objectif

Vérifier que les URLs générées par la **nouvelle application** sont **100% identiques** à l'ancien format nginx/PHP pour assurer une transition SEO sans rupture.

---

## 🎯 Format URLs Attendu (Ancien Sitemap)

### 1. Gammes de Pièces
```
Format : /pieces/{pg_alias}-{pg_id}.html

Exemples :
- /pieces/plaquette-de-frein-402.html
- /pieces/disque-de-frein-403.html
- /pieces/filtre-a-huile-125.html
```

**Source nginx :**
```nginx
rewrite ^/pieces/[^?/]*-([0-9]+).html$ /v7.products.gamme.php?pg_id=$1 last;
```

### 2. Constructeurs (Marques)
```
Format : /constructeurs/{marque_alias}-{marque_id}.html

Exemples :
- /constructeurs/renault-13.html
- /constructeurs/peugeot-17.html
- /constructeurs/citroen-19.html
```

**Source nginx :**
```nginx
rewrite ^/constructeurs/[^?/]*-([0-9]+).html$ /v7.constructeurs.marque.php?marque_id=$1 last;
```

### 3. Modèles de Véhicules
```
Format : /constructeurs/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}.html

Exemples :
- /constructeurs/renault-13/clio-iii-13044.html
- /constructeurs/peugeot-17/208-14523.html
```

### 4. Gammes + Véhicule (URLs Filtrées)
```
Format : /pieces/{pg_alias}-{pg_id}/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}/{type_alias}-{type_id}.html

Exemple :
- /pieces/plaquette-de-frein-402/renault-13/clio-iii-13044/1-5-dci-33300.html
```

---

## 🚀 Méthode 1 : Script Bash (Rapide)

### Installation

Le script est déjà créé : `scripts/verify-url-compatibility.sh`

```bash
# Rendre le script exécutable
chmod +x scripts/verify-url-compatibility.sh
```

### Usage Basique

```bash
# Vérifier 50 gammes (par défaut)
bash scripts/verify-url-compatibility.sh

# Vérifier 100 gammes
bash scripts/verify-url-compatibility.sh --sample 100

# Tester une gamme spécifique
bash scripts/verify-url-compatibility.sh --gamme-id 402

# Utiliser une API différente
bash scripts/verify-url-compatibility.sh --api http://localhost:3001
```

### Sortie Attendue

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 VÉRIFICATION COMPATIBILITÉ URLs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Étape 1/4 : Récupération des gammes depuis Supabase
✅ 50 gammes récupérées

📊 Étape 2/4 : Génération des URLs (ancien format)
✅ URLs générées : 50

📊 Étape 3/4 : Analyse des différences
📊 Résultats :
  Total URLs testées        : 50
  ✅ Correspondance exacte  : 48 (96.00%)
  ❌ Différences détectées  : 2
  ⚠️  Alias manquants        : 2

📊 Étape 4/4 : Exemples de comparaison
🔍 Premières URLs testées :
✅ MATCH | PG_ID: 402 | Expected: /pieces/plaquette-de-frein-402.html | Actual: /pieces/plaquette-de-frein-402.html
✅ MATCH | PG_ID: 403 | Expected: /pieces/disque-de-frein-403.html | Actual: /pieces/disque-de-frein-403.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 FICHIERS GÉNÉRÉS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Rapport texte : /tmp/url-compatibility-report-20251027_143025.txt
  Données JSON  : /tmp/url-compatibility-20251027_143025.json
```

---

## 🌐 Méthode 2 : API REST (Intégration)

### Endpoints Disponibles

#### 1. Rapport Complet de Compatibilité

```bash
curl http://localhost:3000/api/seo/url-compatibility/report | jq
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-10-27T14:30:25.123Z",
    "gammes": {
      "total": 9813,
      "with_alias": 9500,
      "without_alias": 313,
      "sample_urls": [
        "/pieces/plaquette-de-frein-402.html",
        "/pieces/disque-de-frein-403.html",
        "/pieces/filtre-a-huile-125.html"
      ]
    },
    "constructeurs": {
      "total": 117,
      "sample_urls": [
        "/constructeurs/renault-13.html",
        "/constructeurs/peugeot-17.html"
      ]
    },
    "modeles": {
      "total": 15234,
      "sample_urls": [
        "/constructeurs/renault-13/clio-iii-13044.html",
        "/constructeurs/peugeot-17/208-14523.html"
      ]
    },
    "recommendations": [
      "⚠️ 313 gammes n'ont pas d'alias défini - Générer automatiquement",
      "💡 Catalogue volumineux - Utiliser pagination pour génération sitemap",
      "✅ URLs conformes au format ancien sitemap nginx"
    ]
  }
}
```

#### 2. Vérification Détaillée

```bash
# Vérifier 100 gammes
curl "http://localhost:3000/api/seo/url-compatibility/verify?type=gammes&sampleSize=100" | jq

# Vérifier constructeurs
curl "http://localhost:3000/api/seo/url-compatibility/verify?type=constructeurs&sampleSize=50" | jq

# Vérifier tout
curl "http://localhost:3000/api/seo/url-compatibility/verify?type=all&sampleSize=200" | jq
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 100,
      "exact_match": 98,
      "alias_missing": 2,
      "match_rate": 98.0
    },
    "details": [
      {
        "id": 402,
        "name": "Plaquette de frein",
        "expected_url": "/pieces/plaquette-de-frein-402.html",
        "actual_url": "/pieces/plaquette-de-frein-402.html",
        "match": true
      },
      {
        "id": 1234,
        "name": "Accessoires Tuning",
        "expected_url": "/pieces/accessoires-tuning-1234.html",
        "actual_url": "/pieces/accessoires-tuning-1234.html",
        "match": true,
        "issue": "Alias manquant (généré automatiquement)"
      }
    ]
  }
}
```

#### 3. Lister URLs par Type

```bash
# Gammes (pagination)
curl "http://localhost:3000/api/seo/url-compatibility/gammes?limit=10&offset=0" | jq

# Constructeurs
curl "http://localhost:3000/api/seo/url-compatibility/constructeurs?limit=10" | jq

# Modèles d'une marque
curl "http://localhost:3000/api/seo/url-compatibility/modeles?marqueId=13&limit=20" | jq
```

**Réponse (gammes) :**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "pg_id": 402,
      "pg_name": "Plaquette de frein",
      "pg_alias": "plaquette-de-frein",
      "url": "/pieces/plaquette-de-frein-402.html",
      "has_alias": true
    },
    {
      "pg_id": 403,
      "pg_name": "Disque de frein",
      "pg_alias": "disque-de-frein",
      "url": "/pieces/disque-de-frein-403.html",
      "has_alias": true
    }
  ]
}
```

---

## 📊 Interpréter les Résultats

### Taux de Matching

| Taux | État | Signification | Action |
|------|------|---------------|--------|
| 100% | ✅ Parfait | Toutes les URLs identiques | Procéder aux tests SEO |
| 95-99% | ✅ Excellent | Quelques alias manquants | Générer alias automatiquement |
| 80-94% | ⚠️ Bon | Différences mineures | Vérifier et corriger |
| < 80% | 🚨 Critique | Problème majeur | Analyser et corriger URGENT |

### Alias Manquants

**Problème :**
Certaines gammes dans `pieces_gamme` n'ont pas de colonne `pg_alias` définie.

**Solution :**
Le service génère automatiquement un alias avec la fonction `slugify()` :

```typescript
// Exemple : "Plaquette de frein" → "plaquette-de-frein"
const alias = this.slugify(pg_name);
```

**Recommandation :**
Mettre à jour la base de données pour ajouter les alias manquants :

```sql
-- Générer alias pour gammes sans alias
UPDATE pieces_gamme 
SET pg_alias = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(pg_name, '[^a-zA-Z0-9]+', '-', 'g'),
    '^-|-$', '', 'g'
  )
)
WHERE pg_alias IS NULL AND pg_display = '1';
```

---

## 🔍 Cas d'Usage : Audit Avant Migration

### Scénario : E-commerce avec 10K gammes

**Étape 1 : Rapport global**
```bash
curl http://localhost:3000/api/seo/url-compatibility/report | jq > audit-urls-global.json
```

**Étape 2 : Vérification échantillon**
```bash
bash scripts/verify-url-compatibility.sh --sample 500
```

**Étape 3 : Analyser alias manquants**
```bash
cat /tmp/url-compatibility-*.json | jq '.results[] | select(.issue != null)'
```

**Étape 4 : Corriger en base**
```sql
-- Identifier gammes sans alias
SELECT pg_id, pg_name, pg_alias 
FROM pieces_gamme 
WHERE pg_alias IS NULL AND pg_display = '1'
LIMIT 10;

-- Générer alias manquants
UPDATE pieces_gamme SET pg_alias = ... WHERE pg_alias IS NULL;
```

**Étape 5 : Re-vérifier**
```bash
bash scripts/verify-url-compatibility.sh --sample 500
# Attendu : 100% match
```

---

## 🎯 Intégration avec Crawl Budget

Une fois les URLs vérifiées comme identiques, vous pouvez :

### 1. Générer Sitemap Conforme

```bash
# Utiliser le service sitemap avec URLs vérifiées
curl http://localhost:3000/api/sitemap/products.xml > sitemap-products-verified.xml

# Vérifier format
grep -c "<url>" sitemap-products-verified.xml
head -20 sitemap-products-verified.xml
```

### 2. Lancer Audit Crawl Budget

```bash
# Audit complet avec URLs vérifiées
bash scripts/audit-crawl-budget.sh --sample 1000

# Résultat attendu : > 80% matching avec GSC
```

### 3. Créer Expérience A/B

```bash
# Maintenant que les URLs sont vérifiées, on peut créer des expériences
curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test exclusion - URLs vérifiées",
    "action": "exclude",
    "targetFamilies": ["1234"],
    "durationDays": 7
  }'
```

---

## 🛠️ Dépannage

### Problème 1 : API backend non accessible

**Symptôme :**
```
❌ Erreur : Impossible de récupérer les gammes depuis l'API
```

**Solution :**
```bash
# Vérifier que le backend est démarré
curl http://localhost:3000/health
curl http://localhost:3000/api/supabase/query

# Relancer le backend si nécessaire
cd backend
npm run start:dev
```

### Problème 2 : Alias avec caractères spéciaux

**Symptôme :**
```
❌ DIFF | PG_ID: 1234 | Expected: /pieces/accessoires-tuning-1234.html | Actual: /pieces/accessoires-©-tuning-1234.html
```

**Solution :**
Vérifier la fonction `slugify()` dans `url-compatibility.service.ts` :

```typescript
private slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // ✅ Décompose les accents
    .replace(/[\u0300-\u036f]/g, '') // ✅ Supprime les accents
    .replace(/[^a-z0-9]+/g, '-') // ✅ Remplace caractères spéciaux
    .replace(/^-+|-+$/g, ''); // ✅ Nettoie début/fin
}
```

### Problème 3 : Taux matching < 50%

**Symptôme :**
Trop de différences détectées

**Diagnostic :**
```bash
# Analyser les différences
cat /tmp/url-compatibility-*.json | jq '.results[] | select(.match == false)'

# Vérifier quelques gammes
curl "http://localhost:3000/api/seo/url-compatibility/gammes?limit=5" | jq
```

**Actions possibles :**
1. Vérifier logique de génération d'URLs
2. Comparer avec ancien nginx
3. Mettre à jour les alias en base
4. Re-tester après corrections

---

## 📈 Métriques de Succès

### Objectifs

| Métrique | Cible | Critique |
|----------|-------|----------|
| Taux matching URLs | > 95% | > 80% |
| Alias manquants | < 5% | < 20% |
| Temps vérification | < 5 min | < 15 min |
| GSC crawl rate après migration | > 80% | > 50% |

### Dashboard de Suivi

```bash
# Script pour monitoring continu
watch -n 300 'curl -s http://localhost:3000/api/seo/url-compatibility/report | jq ".data.recommendations"'
```

---

## ✅ Checklist Finale

Avant de lancer la migration SEO complète :

- [ ] **Vérification URLs gammes** : Taux > 95%
- [ ] **Vérification URLs constructeurs** : Taux > 95%
- [ ] **Vérification URLs modèles** : Taux > 95%
- [ ] **Alias manquants corrigés** : < 5%
- [ ] **Script bash testé** : Fonctionne sur 500 URLs
- [ ] **API endpoints testés** : Tous retournent 200 OK
- [ ] **Rapport audit généré** : Fichier JSON complet
- [ ] **Sitemap généré** : Format conforme Google
- [ ] **GSC audit lancé** : Taux matching > 50%
- [ ] **Documentation complète** : Ce guide rempli

---

## 🚀 Prochaines Étapes

Une fois les URLs 100% vérifiées :

1. **Phase 1 : Sitemap**
   ```bash
   # Générer sitemap final avec URLs vérifiées
   curl http://localhost:3000/api/sitemap/products.xml > public/sitemap.xml
   ```

2. **Phase 2 : Audit GSC**
   ```bash
   # Comparer avec Google Search Console
   bash scripts/audit-crawl-budget.sh --sample 1000
   ```

3. **Phase 3 : Expériences A/B**
   ```bash
   # Lancer tests crawl budget
   curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments \
     -d '{"name": "Test initial", "action": "exclude", ...}'
   ```

4. **Phase 4 : Monitoring**
   ```bash
   # Dashboard Grafana + alertes
   # Suivi quotidien des métriques SEO
   ```

---

## 📚 Ressources

- **Guide complet crawl budget** : `SEO-CRAWL-BUDGET-BEST-APPROACH.md`
- **Analyse URLs nginx** : `NGINX-URL-ANALYSIS.md`
- **Architecture sitemap** : `SITEMAP-ARCHITECTURE-SCALABLE.md`
- **Service TypeScript** : `backend/src/modules/seo/services/url-compatibility.service.ts`
- **Script bash** : `scripts/verify-url-compatibility.sh`

---

## 💬 Support

En cas de problème, vérifiez :
1. Les logs backend : `backend/logs/`
2. Les fichiers générés : `/tmp/url-compatibility-*.{json,txt}`
3. La connexion Supabase : `curl http://localhost:3000/health`

**Commande de diagnostic rapide :**
```bash
bash scripts/verify-url-compatibility.sh --gamme-id 402 && \
curl http://localhost:3000/api/seo/url-compatibility/report | jq '.data.recommendations'
```
