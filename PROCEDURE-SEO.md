# Procedure SEO Pipeline V4

> Fichier de reference pour le workflow SEO. Ouvrir ce fichier au debut de chaque session Claude Code.

---

## Workflow en 7 etapes

### Etape 1 — Triage (5 min)

Lancer le rapport pour voir ou concentrer l'effort :

```
keyword-planner report 10
```

Lire le TOP 10 par ROI. Choisir 1-3 gammes a traiter.

**Alternative rapide (SQL sans agent) :**
```sql
-- Copier scripts/seo/batch-audit.sql dans MCP Supabase
```

### Etape 1.5 — Verifier la suffisance RAG (2 min/gamme)

Avant de chercher des mots-cles, verifier que le RAG est suffisant :

```bash
python scripts/seo/rag-check.py {slug}
# ou pour toutes les gammes :
python scripts/seo/rag-check.py --missing-only
```

Si des blocs sont manquants → passer a l'etape 2 d'abord.
Si tout est OK → passer directement a l'etape 3.

### Etape 2 — Enrichir le RAG (15-30 min/gamme)

Pour chaque gamme bloquee, ouvrir le fichier RAG et completer les blocs manquants :

```
Fichier : /opt/automecanik/rag/knowledge/gammes/{slug}.md
```

Blocs a completer (voir fiche gamme, section "RAG A ENRICHIR") :

| Section | Bloc RAG requis | Min items |
|---------|----------------|-----------|
| S1 | `domain.role` | 1 (non-vide) |
| S2 | `maintenance.interval` + `wear_signs` | 1 champ |
| S2_DIAG | `diagnostic.symptoms` + `quick_checks` | 2 symptoms |
| S3 | `selection.criteria` | 3 criteres |
| S4_DEPOSE | `diagnostic.causes` | 3 items |
| S5 | `selection.anti_mistakes` | 3 items |
| S6 | `maintenance.good_practices` | 2 items |
| S8 | `rendering.faq` | 3 Q/A |

**Ou trouver la documentation par section :**

| Section | Type de doc | Ou chercher |
|---------|------------|-------------|
| S1 | Fiche produit constructeur | Bosch, Valeo, SKF, TRW — pages produit |
| S2 | Guide maintenance constructeur | Manuel constructeur, Bosch Service, Mopar |
| S2_DIAG | Guide diagnostic atelier | Bosch Diagnostics, forums mecanique pro |
| S3 | Catalogue equipementier | Catalogue Bosch/Valeo, fiches techniques |
| S4_DEPOSE | Tuto montage / RTA | RTA, YouTube pro, guides atelier |
| S5 | Retours SAV / forums | Forums auto, retours clients, FAQ concurrents |
| S6 | Guide entretien constructeur | Guide Bosch, guide Mopar, notice constructeur |
| S8 | Google PAA + FAQ | Google PAA, forums, FAQ concurrents |

**Ajouter aussi dans le RAG** (si absent) :
- `seo_cluster.primary_keyword` — mot-cle principal (ex: "balais d'essuie-glace")
- `seo_cluster.keyword_variants` — 3-5 variantes
- `priority_signals.monthly_searches` — volume mensuel (depuis Google Keyword Planner ou pytrends)

### Etape 3 — Keyword Research (10-15 min/gamme)

#### 3a. Generer les requetes a chercher

```bash
python scripts/seo/seo-queries.py {slug}
```

Le script genere automatiquement les requetes groupees par intention depuis le RAG.

#### 3b. Requetes par intention (template)

Si pas de RAG ou pour reference manuelle :

**Transactionnelles (R1 — reference)** :
- `{gamme} pas cher`
- `prix {gamme}`
- `acheter {gamme} en ligne`

**Informationnelles (R3 conseil)** :
- `quand changer {gamme}`
- `comment changer {gamme}`
- `symptome {gamme} use`
- `{gamme} duree de vie`

**Guide-achat (R3 selection — cible S3)** :
- `comment choisir {gamme}`
- `meilleur {gamme}`
- `{gamme} comparatif`

**Diagnostic (R5)** :
- `bruit {gamme}`
- `voyant {gamme}`
- `panne {gamme} symptome`

**PAA a capturer** :
- Chercher `{gamme}` sur Google → noter 4-8 PAA
- Chercher `quand changer {gamme}` → noter PAA
- Chercher `comment choisir {gamme}` → noter PAA

#### 3c. Capturer les PAA sur Google

Pour chaque requete ci-dessus, ouvrir Google.fr et noter les questions "People Also Ask".

**Priorite** : les PAA recurrentes (apparaissant sur 3+ SERP) sont les plus importantes.

#### 3d. Injecter les PAA dans la DB

Sauvegarder les PAA dans un fichier puis injecter :

```bash
# Creer le fichier (1 question par ligne)
mkdir -p data/paa
nano data/paa/{slug}.txt

# Injecter dans __seo_research_brief
python scripts/seo/paa-inject.py {slug}

# Ou en dry-run d'abord
python scripts/seo/paa-inject.py {slug} --dry-run
```

#### 3e. Enrichir le RAG avec les meilleures PAA

Ajouter les 3-5 PAA les plus pertinentes dans `rendering.faq` du fichier RAG :

```yaml
rendering:
  faq:
    - question: "Comment savoir quel balai d'essuie-glace pour ma voiture ?"
      answer: "..."
    - question: "Quelle est la duree de vie d'un balai d'essuie-glace ?"
      answer: "..."
```

**Aussi ajouter dans `domain.must_be_true`** les termes techniques recurrents dans les PAA.

### Etape 4 — Generer le contenu (automatique)

Lancer la generation ciblee :

```
keyword-planner targeted {pg_alias}    (P0 > P0.5 > P1 > P2-P9 > P10 > P11)
conseil-batch {pg_alias}               (sections conseil avec sources)
```

### Etape 5 — Verifier (2 min)

Relancer le rapport pour verifier :

```
keyword-planner report {pg_alias}
```

Verifier :
- Les scores ont augmente
- sgc_sources n'est plus null
- Pas de sections bloquees

**Logique auto-decision pour chaque section FAIBLE/BLOQUE/MANQUANTE :**

| Etat | RAG suffisant ? | Action |
|------|----------------|--------|
| FAIBLE (score < 70) | Oui | **REGENERER** : relancer `conseil-batch {slug}` (automatique) |
| FAIBLE (score < 70) | Non | **DOC REQUISE** : fournir la doc (voir DOCUMENTATION A FOURNIR) |
| MANQUANTE | Oui | **REGENERER** : creer via `conseil-batch {slug}` |
| MANQUANTE | Non | **DOC REQUISE** : enrichir le RAG d'abord (retour etape 2) |
| BLOQUE (RAG insuffisant) | Non | **DOC REQUISE** : enrichir le RAG d'abord (retour etape 2) |

Le rapport `keyword-planner report` affiche directement l'action a cote de chaque section problematique.

### Etape 5.5 — Tracer les sources E-E-A-T (2 min/gamme)

Les `sgc_sources` sont des **metadonnees internes de tracabilite**. Elles ne sont **JAMAIS affichees au public** sur le site. Elles servent uniquement a l'audit qualite.

Pour chaque section dont `sgc_sources` est NULL, injecter la reference :

```sql
-- Template SQL (remplacer les valeurs)
UPDATE __seo_gamme_conseil
SET sgc_sources = '[{"ref":"Bosch - Guide maintenance 2024","field":"maintenance.interval"}]'::jsonb
WHERE sgc_pg_id = '{pg_id}' AND sgc_section_type = '{section}'
  AND sgc_sources IS NULL;
```

**Format JSON sgc_sources :**
```json
[{"ref": "Titre du document source", "field": "bloc_rag.utilise"}]
```

**Rappel** : le contenu public (`sgc_content`) ne mentionne PAS les references sources. C'est du contenu editorial pur.

---

## Commandes rapides

### Agents Claude

| Commande | Usage |
|----------|-------|
| `keyword-planner report 10` | Triage global top 10 |
| `keyword-planner report {slug}` | Fiche detaillee 1 gamme |
| `keyword-planner report all` | Audit 221 gammes |
| `keyword-planner audit-only {slug}` | Audit P0 seul (SQL, 0 LLM) |
| `keyword-planner targeted {slug}` | Pipeline complet cible |
| `keyword-planner section-fix {slug} S3 S6` | Corriger sections specifiques |
| `conseil-batch {slug}` | Generation sections conseil |

### Scripts helper

| Commande | Usage | Temps |
|----------|-------|-------|
| `python scripts/seo/seo-queries.py {slug}` | Generer requetes keyword depuis RAG | 1s |
| `python scripts/seo/seo-queries.py --batch 10` | Requetes pour 10 gammes | 2s |
| `python scripts/seo/rag-check.py {slug}` | Verifier suffisance RAG 1 gamme | 1s |
| `python scripts/seo/rag-check.py --all` | Audit RAG 221 gammes | 5s |
| `python scripts/seo/rag-check.py --missing-only` | Gammes avec blocs manquants | 5s |
| `python scripts/seo/paa-inject.py {slug}` | Injecter PAA dans DB | 2s |
| `python scripts/seo/paa-inject.py {slug} --dry-run` | Simulation injection | 1s |
| `python scripts/seo/import_csv_google.py {csv} {pg_id}` | Import CSV Google KW Planner | 5s |
| `python backend/get_search_volumes.py` | Volumes via pytrends (indices) | 5min |

### SQL rapide (MCP Supabase)

```sql
-- Dashboard global (copier scripts/seo/batch-audit.sql)
-- Detail 1 gamme :
SELECT sgc_section_type, sgc_quality_score, LENGTH(sgc_content), sgc_sources IS NOT NULL
FROM __seo_gamme_conseil WHERE sgc_pg_id = '{pg_id}' ORDER BY sgc_order;
```

---

## Ou vont les donnees ?

| Donnee | Table DB | Fichier RAG | Pourquoi les deux |
|--------|----------|-------------|-------------------|
| PAA collectees | `__seo_research_brief.real_faqs` | `rendering.faq` (top 3-5) | DB = exhaustif, RAG = source generation |
| Volumes recherche | `__seo_keyword_cluster` | `priority_signals.monthly_searches` | RAG = triage ROI |
| Keyword principal | `__seo_keyword_cluster` | `seo_cluster.primary_keyword` | RAG = reference agents |
| Variantes keywords | `__seo_keyword_cluster` | `seo_cluster.keyword_variants` | RAG = reference agents |
| Termes recurrents | — | `domain.must_be_true` | Ex: "syndrome essuie-glace" |

---

## Fichiers cles

| Fichier | Role |
|---------|------|
| `rag/knowledge/gammes/{slug}.md` | Source de verite RAG par gamme |
| `scripts/seo/seo-queries.py` | Generateur requetes keyword depuis RAG |
| `scripts/seo/rag-check.py` | Verificateur suffisance RAG |
| `scripts/seo/paa-inject.py` | Injecteur PAA dans DB |
| `scripts/seo/batch-audit.sql` | Dashboard SQL rapide |
| `scripts/seo/import_csv_google.py` | Import CSV Google Keyword Planner |
| `backend/get_search_volumes.py` | Volumes pytrends (indices relatifs) |
| `backend/src/config/keyword-plan.constants.ts` | Constantes pipeline (gates, thresholds, MediaSlot) |
| `backend/src/config/conseil-pack.constants.ts` | Packs (standard/pro/eeat), scoring, phrases generiques |
| `.claude/agents/keyword-planner.md` | Agent keyword-planner V4 |
| `.claude/agents/conseil-batch.md` | Agent conseil-batch (generation contenu) |
| `.claude/agents/research-agent.md` | Agent research (briefs + clusters) |
| `backend/src/modules/admin/services/keyword-plan-gates.service.ts` | Gates G1-G7 + audit GA1-GA6 |

---

## Tables Supabase (projet: cxpojprgwgubzjyqzmoq)

| Table | Contenu |
|-------|---------|
| `__seo_r3_keyword_plan` | Plans keywords + audit results (skp_audit_result JSONB) |
| `__seo_gamme_conseil` | Sections conseil S1-S8 (sgc_content, sgc_sources, sgc_quality_score) |
| `__seo_research_brief` | Briefs recherche (keyword_gaps, real_faqs, content_gaps) |
| `__seo_keyword_cluster` | Clusters keywords par gamme |
| `__seo_gamme_purchase_guide` | 221 gammes actives (source de verite) |

---

## Pipeline V4 — Phases

```
P0   AUDIT        SQL only, 0 LLM   → audit GA1-GA6, priority_score
P0.5 RAG CHECKS   Read RAG files     → sufficiency, stale, keyword queries
P1   TARGETED     LLM               → intent, boundaries, heading plan
P2-P9 IMPROVER    LLM par section   → terms, phrases, media slots
P10  META         LLM               → meta title/desc, anchors
P11  ASSEMBLER    SQL + scoring     → score guard, G1-G7, validation
```

---

## Regles importantes

- **RAG = source de verite** : le LLM ne doit RIEN inventer au-dela du RAG
- **sgc_sources obligatoire** : chaque section doit tracer sa source RAG (metadata interne, JAMAIS affichee au public)
- **Score guard** : jamais ecraser un contenu avec un score inferieur
- **Sections bloquees** : si RAG insuffisant, ne PAS generer (enrichir d'abord)
- **Max 2 images in-article** : budget valide par G7_MEDIA_BUDGET
- **PAA → double ecriture** : DB (exhaustif) + RAG (top 3-5 pour generation)
- **Keywords → RAG** : toujours enrichir `seo_cluster` dans le RAG apres recherche
