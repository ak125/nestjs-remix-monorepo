# 🎯 Meilleure Approche : A/B Testing Crawl Budget

## 📊 Votre Situation Actuelle

### ✅ Ce qui fonctionne déjà
- **Supabase** : Tables `crawl_budget_experiments` + `crawl_budget_metrics` créées
- **Backend API** : 10 endpoints REST opérationnels
- **Structure de données** :
  - `pieces_gamme` : 9813+ gammes (pg_id, pg_name, pg_alias)
  - `pieces` : 714K+ produits (piece_ga_id → lien vers gamme)
  - API `/api/products/gammes` fonctionnelle
- **Mock data** : Système teste avec données simulées

### ⚠️ Défis à résoudre
1. **Mapping gammes → familyCode** : `pg_id` numérique → code famille pour expériences
2. **Extraction URLs produits** : Besoin de générer URLs par gamme depuis `pieces`
3. **Prioritisation** : Quelles gammes exclure/inclure en priorité ?
4. **Mesure impact** : Google Search Console + GA4 pas encore configurés

---

## 🚀 Approche Recommandée : PROGRESSIVE

### Phase 1 : **Mapper votre catalogue** (URGENT - 30 min)

#### A. Identifier les gammes à fort impact

```sql
-- Trouver les gammes avec le plus de produits (candidats à réduction)
SELECT 
  pg.pg_id,
  pg.pg_name,
  pg.pg_alias,
  COUNT(p.piece_id) as nb_produits
FROM pieces_gamme pg
LEFT JOIN pieces p ON p.piece_ga_id = pg.pg_id
WHERE pg.pg_display = '1'
GROUP BY pg.pg_id
ORDER BY nb_produits DESC
LIMIT 20;
```

**Cas d'usage** : Si "Pneus anciens" = 10000 URLs → **Candidat parfait pour exclusion**

#### B. Créer une table de mapping (optionnel mais recommandé)

```sql
-- Dans Supabase
CREATE TABLE gamme_seo_config (
  pg_id INTEGER PRIMARY KEY REFERENCES pieces_gamme(pg_id),
  seo_priority TEXT CHECK (seo_priority IN ('high', 'medium', 'low', 'exclude')),
  estimated_urls INTEGER,
  last_crawl_rate DECIMAL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exemples de configuration
INSERT INTO gamme_seo_config (pg_id, seo_priority, estimated_urls, notes) VALUES
(1234, 'exclude', 12000, 'Pneus anciens - faible taux de conversion'),
(5678, 'high', 3000, 'Accessoires connectés - forte croissance'),
(9012, 'medium', 8000, 'Pièces moteur standard');
```

#### C. Script pour compter URLs par gamme

```typescript
// Dans SitemapGeneratorService
async countUrlsByGamme(gammeId: number): Promise<number> {
  const { count } = await this.supabase
    .from('pieces')
    .select('piece_id', { count: 'exact', head: true })
    .eq('piece_ga_id', gammeId)
    .eq('piece_display', true);
  
  return count || 0;
}

async getTopGammesBySize(): Promise<Array<{pg_id: number, pg_name: string, url_count: number}>> {
  // Requête optimisée pour identifier les "grosses" gammes
  const { data } = await this.supabase.rpc('count_urls_by_gamme');
  return data || [];
}
```

---

### Phase 2 : **Connecter votre catalogue réel** (1 heure)

#### Remplacer les mock data dans `SitemapGeneratorService`

**AVANT** (mock) :
```typescript
private async getAllProductUrls(): Promise<Array<{ url: string; familyCode: string }>> {
  return [
    { url: 'https://automecanik.com/products/piece-1', familyCode: 'PIECE_MOTEUR' },
    { url: 'https://automecanik.com/products/piece-2', familyCode: 'PNEU_VIEUX' },
  ];
}
```

**APRÈS** (vraies données) :
```typescript
private async getAllProductUrls(gammeIds?: number[]): Promise<Array<{ url: string; familyCode: string; priority: number }>> {
  let query = this.supabase
    .from('pieces')
    .select(`
      piece_id,
      piece_alias,
      piece_ref,
      piece_ga_id,
      pieces_gamme!inner(pg_id, pg_alias, pg_name)
    `)
    .eq('piece_display', true);

  if (gammeIds && gammeIds.length > 0) {
    query = query.in('piece_ga_id', gammeIds);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data.map(piece => ({
    url: `https://automecanik.com/pieces/${piece.pieces_gamme.pg_alias}-${piece.piece_id}.html`,
    familyCode: `GAMME_${piece.piece_ga_id}`, // Ex: GAMME_1234
    priority: this.calculatePriority(piece), // Basé sur popularité, stock, etc.
  }));
}

private calculatePriority(piece: any): number {
  // Logique de priorité basée sur :
  // - piece_top (produits vedettes) → 1.0
  // - piece_has_img (avec image) → 0.8
  // - piece_year (année récente) → 0.7
  // - défaut → 0.5
  if (piece.piece_top) return 1.0;
  if (piece.piece_has_img) return 0.8;
  if (piece.piece_year && piece.piece_year > 2020) return 0.7;
  return 0.5;
}
```

#### Format des `targetFamilies` dans les expériences

**Option 1 : Utiliser pg_id directement** (RECOMMANDÉ)
```json
{
  "name": "Exclusion pneus anciens",
  "action": "exclude",
  "targetFamilies": ["1234", "5678"], // pg_id des gammes
  "durationDays": 30
}
```

**Option 2 : Utiliser pg_alias**
```json
{
  "targetFamilies": ["pneus-anciens", "pieces-occasion"]
}
```

**Pourquoi pg_id ?** Plus fiable, pas de conflits avec caractères spéciaux.

---

### Phase 3 : **Stratégie d'expérimentation** (Progressive)

#### Semaine 1-2 : **Test sur 1 petite gamme** (Low Risk)

```bash
# Créer expérience test avec ~500 URLs
curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test exclusion gamme X (500 URLs)",
    "action": "exclude",
    "targetFamilies": ["9999"], # Une gamme peu stratégique
    "durationDays": 14
  }'
```

**Métriques à surveiller** :
- Crawl rate global (doit augmenter légèrement)
- Indexation sur autres gammes (doit rester stable ou augmenter)
- Trafic organique (ne doit PAS chuter > 5%)

#### Semaine 3-4 : **Test sur grosse gamme** (Medium Risk)

```bash
# Exclure 10K URLs d'une gamme à faible conversion
curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments \
  -d '{
    "name": "Exclusion pneus anciens (10K URLs)",
    "action": "exclude",
    "targetFamilies": ["1234"],
    "durationDays": 30
  }'
```

**Attendu** :
- ✅ Crawl rate : +15% sur gammes stratégiques
- ✅ Indexation : +10% sur nouvelles gammes
- ⚠️ Trafic : -2% acceptable sur gamme exclue

#### Mois 2 : **Test d'inclusion** (Growth Strategy)

```bash
# N'inclure QUE les gammes stratégiques (accessoires connectés)
curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments \
  -d '{
    "name": "Focus accessoires connectés (3K URLs)",
    "action": "include",
    "targetFamilies": ["5678"],
    "durationDays": 30
  }'
```

**Objectif** : Maximiser l'indexation des produits à forte marge.

---

### Phase 4 : **Automatisation** (Après validation manuelle)

#### A. Collection quotidienne automatique

```typescript
// Dans SeoAuditSchedulerService
private async setupCrawlBudgetJobs() {
  // Collecte métriques quotidiennes (2:00 AM)
  await this.auditQueue.add('collect-daily-metrics', {
    task: 'collect-all-experiments',
  }, {
    repeat: { 
      pattern: '0 2 * * *', 
      tz: 'Europe/Paris' 
    }
  });
}

// Worker
async processCollectMetrics(job: Job) {
  const runningExperiments = await this.supabaseService.listExperiments({
    status: 'running'
  });

  for (const exp of runningExperiments) {
    await this.orchestrator.collectDailyMetrics(exp.id);
  }
}
```

#### B. Alertes automatiques

```typescript
// Après collecte, vérifier recommandations
async checkRecommendations(experimentId: string) {
  const reco = await this.orchestrator.getRecommendations(experimentId);
  
  if (reco[0].confidence > 0.8) {
    // Envoyer notification Slack/Email
    await this.notificationService.send({
      channel: '#seo-alerts',
      message: `🚨 Expérience ${experimentId} : ${reco[0].action}`,
      reason: reco[0].reason,
      impact: reco[0].metrics,
    });
  }
}
```

---

## 🎯 Plan d'Action Immédiat

### AUJOURD'HUI (30 min)

1. **Identifier vos 5 gammes critiques**
   ```sql
   -- Exécuter dans Supabase SQL Editor
   SELECT 
     pg.pg_id,
     pg.pg_name,
     pg.pg_alias,
     COUNT(p.piece_id) as nb_urls
   FROM pieces_gamme pg
   LEFT JOIN pieces p ON p.piece_ga_id = pg.pg_id
   WHERE pg.pg_display = '1'
   GROUP BY pg.pg_id
   ORDER BY nb_urls DESC
   LIMIT 5;
   ```

2. **Créer première expérience manuelle**
   ```bash
   # Utiliser les pg_id trouvés ci-dessus
   curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test exclusion gamme <NOM> (<NB> URLs)",
       "action": "exclude",
       "targetFamilies": ["<PG_ID>"],
       "durationDays": 7
     }'
   ```

3. **Télécharger sitemap filtré**
   ```bash
   # Récupérer l'ID de l'expérience créée, puis :
   curl http://localhost:3000/seo-logs/crawl-budget/experiments/<ID>/sitemap.xml > sitemap-test.xml
   
   # Vérifier contenu
   grep -c "<url>" sitemap-test.xml  # Compter URLs
   ```

### CETTE SEMAINE (2 heures)

1. **Connecter vraies données produits**
   - Modifier `SitemapGeneratorService.getAllProductUrls()`
   - Tester génération sitemap avec vraies URLs
   - Vérifier performance (temps de génération)

2. **Configurer Google Search Console** (optionnel)
   - Créer Service Account (guide: `SEO-SETUP-COMPLETE-GUIDE.md`)
   - Soumettre sitemap de test
   - Monitorer crawl stats dans GSC

3. **Dashboard de suivi**
   - Grafana simple avec graphiques :
     * Évolution crawl rate par expérience
     * Indexation rate avant/après
     * Trafic organique (sessions)

### CE MOIS-CI

1. **3 expériences en parallèle** :
   - Exclusion : 1 grosse gamme (10K URLs)
   - Inclusion : 1 gamme stratégique (3K URLs)
   - Réduction : 1 gamme moyenne (50% des URLs)

2. **Analyse comparative**
   - Comparer baseline vs metrics actuelles
   - Identifier patterns : quelles actions fonctionnent ?
   - Documenter ROI (temps crawl économisé vs trafic perdu)

3. **Automatisation BullMQ**
   - Job quotidien : collecte métriques
   - Job hebdomadaire : génération rapport
   - Alertes : recommandations à haute confiance

---

## 💡 Cas d'Usage Concrets

### Scénario 1 : E-commerce avec 100K URLs
**Problème** : Google crawle seulement 1000 URLs/jour → 100 jours pour tout indexer

**Solution A/B** :
1. **Exclure** : 30K URLs produits en rupture permanente
2. **Réduire 50%** : 20K URLs pièces anciennes (garder top 50% par trafic)
3. **Inclure prioritaire** : 5K URLs nouveaux produits

**Résultat attendu** :
- Crawl budget : 50K URLs actives (au lieu de 100K)
- Temps d'indexation : 50 jours (2x plus rapide)
- Trafic : -3% sur anciennes URLs, +25% sur nouveaux produits

### Scénario 2 : Migration de site
**Problème** : Nouvelles URLs pas encore indexées après 3 mois

**Solution A/B** :
1. **Exclure temporairement** : Toutes anciennes URLs (redirections 301)
2. **Inclure uniquement** : Nouvelles URLs post-migration
3. **Durée** : 60 jours

**Résultat** :
- 100% du crawl budget sur nouvelles URLs
- Indexation complète en 2 mois (au lieu de 6)
- Restauration progressive des anciennes URLs ensuite

---

## 📊 Métriques de Succès

### KPIs à suivre (dashboard Grafana)

1. **Crawl Efficiency**
   ```
   Crawl Rate = Crawled URLs / Total URLs in Sitemap
   Target: > 80% après expérience
   ```

2. **Indexation Impact**
   ```
   Indexation Delta = (Indexed After - Indexed Before) / Indexed Before * 100
   Target: +10% sur gammes prioritaires
   ```

3. **Traffic ROI**
   ```
   Traffic Delta = (Sessions After - Sessions Before) / Sessions Before * 100
   Acceptable: > -5% (trade-off acceptable)
   ```

4. **Crawl Budget Saved**
   ```
   Saved Budget = Excluded URLs * Avg Crawl Rate
   Ex: 10K URLs exclus * 1.5 crawls/jour = 15K crawls économisés
   ```

---

## 🔄 Itération Continue

### Cycle d'amélioration

```
1. HYPOTHÈSE
   "Exclure gamme X va augmenter crawl rate de 15%"
   
2. EXPÉRIENCE (14-30 jours)
   Créer A/B test avec action "exclude"
   
3. MESURE
   Collecter métriques GSC + GA4 quotidiennement
   
4. ANALYSE
   Comparer baseline vs metrics actuelles
   
5. DÉCISION
   - KEEP si indexation +10% ET trafic > -5%
   - REVERT si trafic < -10%
   - ADJUST si résultats mitigés
   
6. DOCUMENTATION
   Ajouter dans knowledge base SEO
```

### A/B Testing Matrix (planification)

| Mois | Gamme | Action | URLs | Attendu | Risque |
|------|-------|--------|------|---------|--------|
| 1 | Pneus anciens | Exclude | 10K | +15% crawl | Low |
| 1 | Accessoires connectés | Include | 3K | +25% indexation | Medium |
| 2 | Pièces occasion | Reduce 50% | 8K → 4K | +10% crawl | Low |
| 2 | Nouveaux produits | Include | 5K | +30% indexation | High |
| 3 | Pièces moteur | Reduce 30% | 15K → 10K | +8% crawl | Medium |

---

## 🔍 ÉTAPE 0 : Audit URLs (AVANT de lancer les expériences)

### ⚠️ IMPORTANT : Vérifier cohérence .com vs .fr

Avant de créer des expériences A/B, **auditez** vos URLs pour détecter les incohérences entre :
- URLs générées par l'app (ex: `automecanik.fr`)
- URLs indexées dans Google Search Console (ex: `www.automecanik.com`)
- URLs trackées dans Google Analytics 4

### 🎯 Commande d'audit

```bash
# Audit complet (1000 URLs sur domaine .fr)
bash scripts/audit-crawl-budget.sh

# Audit gammes spécifiques
bash scripts/audit-crawl-budget.sh --gammes "1234,5678" --domain fr

# Audit large (5000 URLs) pour analyse complète
bash scripts/audit-crawl-budget.sh --sample 5000 --domain com
```

### 📊 Résultat de l'audit

Le script génère 2 fichiers dans `/tmp` :
- **JSON complet** : `/tmp/audit-<timestamp>.json`
- **Rapport texte** : `/tmp/audit-report-<timestamp>.txt`

**Exemple de sortie** :
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 RAPPORT D'AUDIT CRAWL BUDGET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 STATISTIQUES
URLs générées par l'app:     3
URLs crawlées par GSC:       5
Top pages GA4:               4

🔀 COMPARAISON CROISÉE
✅ Perfect match (app + GSC + GA4):  1 URLs
📤 Uniquement dans app:              1 URLs
📥 Uniquement dans GSC:              3 URLs
⚠️  Mauvais domaine (.com vs .fr):   0 URLs

Taux de matching: 33.3%

💡 RECOMMANDATIONS
🚨 CRITIQUE : Moins de 50% des URLs app sont crawlées par Google
📤 ACTION : 1 URLs générées mais jamais crawlées
```

### 🔧 Normalisation automatique

Le système normalise automatiquement :
- **Domaine** : `.fr` ↔ `.com` (selon paramètre `--domain`)
- **Sous-domaine** : `www.automecanik.fr` → `automecanik.fr` (uniforme)
- **Protocole** : `http://` → `https://` (forcer HTTPS)

**Exemple** :
```
URL app:  https://automecanik.fr/pieces/filtre-1234.html
URL GSC:  https://www.automecanik.com/pieces/filtre-1234.html
         ↓ Normalisation
Match: ✅ https://automecanik.com/pieces/filtre-1234.html
```

### 📋 Interpréter les résultats

| Taux matching | État | Action recommandée |
|--------------|------|-------------------|
| > 80% | ✅ Excellent | Lancer expériences A/B |
| 50-80% | ⚠️ À améliorer | Vérifier sitemap, corriger redirections |
| < 50% | 🚨 Critique | Soumettre sitemap à GSC, résoudre problèmes d'indexation |

**URLs app_only** (non crawlées) :
- Candidates idéales pour **exclusion** (économiser crawl budget)
- Ou besoin de **soumettre sitemap** si URLs stratégiques

**URLs GSC_only** (orphelines) :
- Anciennes URLs, erreurs 404
- Redirections manquantes
- Besoin de nettoyer sitemap

### 🎯 Utiliser l'audit pour prioriser

```bash
# 1. Analyser URLs non crawlées
cat /tmp/audit-<timestamp>.json | jq '.data.comparison.app_only'

# 2. Identifier gammes problématiques
cat /tmp/audit-<timestamp>.json | jq '.data.app_urls.by_gamme'

# 3. Audit d'une gamme spécifique
curl http://localhost:3000/seo-logs/crawl-budget/audit/gamme/1234 | jq .

# Résultat:
{
  "gamme_id": 1234,
  "app_urls_count": 8500,
  "gsc_crawled_count": 1200,  # Seulement 14% crawlées !
  "ga4_sessions": 50,
  "crawl_rate": 14.1,
  "recommendations": [
    "🚨 Gamme 1234 : Seulement 14.1% des URLs crawlées. CANDIDAT IDÉAL pour exclusion temporaire."
  ]
}
```

### ✅ Checklist avant expérimentation

- [ ] **Lancer audit complet** : `bash scripts/audit-crawl-budget.sh`
- [ ] **Vérifier taux matching** : > 50% minimum
- [ ] **Identifier 3 gammes** : 1 à exclure, 1 à inclure, 1 à réduire
- [ ] **Analyser URLs orphelines** : Nettoyer si > 1000 URLs
- [ ] **Corriger redirections** : Si domain_mismatch > 100 URLs

---

## ✅ Checklist de Démarrage

- [ ] **Analyser catalogue** : Requête SQL top 20 gammes par nb URLs
- [ ] **Identifier cibles** : 3 gammes candidates (exclude/include/reduce)
- [ ] **Créer 1ère expérience** : Test sur petite gamme (< 1000 URLs)
- [ ] **Générer sitemap** : Télécharger XML filtré
- [ ] **Soumettre à GSC** : Uploader sitemap de test
- [ ] **Monitorer 7 jours** : Observer crawl stats manuellement
- [ ] **Connecter vraies URLs** : Modifier `getAllProductUrls()`
- [ ] **Configurer Google Cloud** : Service Account + APIs (optionnel)
- [ ] **Setup Grafana** : Dashboard 4 métriques clés
- [ ] **Automatiser BullMQ** : Job quotidien collecte métriques

---

## 🚀 Commande pour Démarrer MAINTENANT

```bash
# 1. Identifier vos gammes critiques
curl -X POST http://localhost:3000/api/supabase/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT pg.pg_id, pg.pg_name, COUNT(p.piece_id) as nb_urls FROM pieces_gamme pg LEFT JOIN pieces p ON p.piece_ga_id = pg.pg_id WHERE pg.pg_display = '\''1'\'' GROUP BY pg.pg_id ORDER BY nb_urls DESC LIMIT 10"
  }'

# 2. Créer votre première expérience (remplacer <PG_ID>)
curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test exclusion - Ma première expérience",
    "action": "exclude",
    "targetFamilies": ["<PG_ID>"],
    "durationDays": 7
  }'

# 3. Suivre le guide : SEO-SETUP-COMPLETE-GUIDE.md
```

Voulez-vous que je vous aide à exécuter la requête SQL pour identifier vos gammes critiques ? 🎯
