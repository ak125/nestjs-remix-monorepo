# Procedure SEO Pipeline V4

> Fichier de reference pour le workflow SEO. Ouvrir ce fichier au debut de chaque session Claude Code.

---

## Workflow en 5 etapes

### Etape 1 — Triage (5 min)

Lancer le rapport pour voir ou concentrer l'effort :

```
keyword-planner report 10
```

Lire le TOP 10 par ROI. Choisir 1-3 gammes a traiter.

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

### Etape 3 — Keyword Research (10 min/gamme)

Chercher les requetes listees dans la fiche sur Google/Semrush :
- Noter les volumes de recherche
- Capturer les PAA (People Also Ask) : 4-8 par requete principale
- Injecter dans `__seo_research_brief` via le research-agent

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

---

## Commandes rapides

| Commande | Usage |
|----------|-------|
| `keyword-planner report 10` | Triage global top 10 |
| `keyword-planner report {slug}` | Fiche detaillee 1 gamme |
| `keyword-planner report all` | Audit 221 gammes |
| `keyword-planner audit-only {slug}` | Audit P0 seul (SQL, 0 LLM) |
| `keyword-planner targeted {slug}` | Pipeline complet cible |
| `keyword-planner section-fix {slug} S3 S6` | Corriger sections specifiques |
| `conseil-batch {slug}` | Generation sections conseil |

---

## Fichiers cles

| Fichier | Role |
|---------|------|
| `rag/knowledge/gammes/{slug}.md` | Source de verite RAG par gamme |
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
- **sgc_sources obligatoire** : chaque section doit citer sa source RAG
- **Score guard** : jamais ecraser un contenu avec un score inferieur
- **Sections bloquees** : si RAG insuffisant, ne PAS generer (enrichir d'abord)
- **Max 2 images in-article** : budget valide par G7_MEDIA_BUDGET
