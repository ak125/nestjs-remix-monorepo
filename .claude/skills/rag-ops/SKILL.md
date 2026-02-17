---
name: rag-ops
description: "RAG operations: diagnose, ingest, monitor, test, optimize. Circuit breaker, intent routing, corpus management."
argument-hint: "[diagnose|ingest|monitor|test|audit]"
allowed-tools: Read, Grep, Glob, Bash, mcp__supabase__execute_sql
version: "1.2"
---

# RAG Operations Skill — v1.2

Skill opérationnel pour le système RAG AutoMecanik. Gère le debug, l'ingestion de contenu, le monitoring du corpus, les tests d'endpoints et l'audit de couverture.

**Architecture modulaire :**
- Ce fichier = logique + workflows + sous-commandes
- `references/intent-patterns.md` = 9 intents, regex, keywords, mappings
- `references/truth-levels.md` = L1-L4 criteres, exemples, provenance
- `references/sql-templates.md` = requetes MCP Supabase pretes a executer
- `scripts/rag_audit.py` = audit automatise du corpus + score /5

---

## Architecture

```
┌─────────────────┐     SSE/HTTP     ┌──────────────────────┐     HTTP      ┌──────────────┐
│   ChatWidget    │ ───────────────→ │  NestJS rag-proxy    │ ──────────→  │  FastAPI RAG  │
│   (frontend)    │                  │  - Circuit breaker   │              │  (externe)    │
│                 │ ←─────────────── │  - Intent classify   │ ←────────── │  - Embeddings │
└─────────────────┘   metadata →     │  - Ingestion orch.   │   response   │  - Vector DB  │
                      chunk →        └──────────┬───────────┘              │  - Guardrails │
                      sources →                 │                          └──────────────┘
                      done                      │ docker exec
                                                ▼
                                    ┌──────────────────────┐
                                    │  Knowledge Corpus     │
                                    │  /opt/automecanik/    │
                                    │  rag/knowledge/       │
                                    │  (280+ markdown)      │
                                    └──────────────────────┘
```

**Composants :**
| Couche | Fichiers | Responsabilite |
|--------|----------|----------------|
| Frontend Chat | `components/rag/ChatWidget.tsx`, `ChatMessage.tsx` | SSE streaming, vehicle context, UI |
| Frontend Admin | `routes/admin.rag*.tsx` (6 routes) | Dashboard, documents, ingestion, jobs |
| Frontend Utils | `utils/chat-intent.utils.ts` | Classification intent cote client |
| Backend Proxy | `modules/rag-proxy/` (controller, service, DTOs) | Circuit breaker, intent, ingestion |
| External RAG | FastAPI sur serveur separe | Embeddings, vector search, LLM, guardrails |
| Knowledge | `/opt/automecanik/rag/knowledge/` | 280+ .md, L1-L4, 7 domaines scores |
| Database | `__rag_knowledge`, `kg_rag_*` tables | FTS, mappings KG, sync audit |

---

## Sous-commandes

| Commande | Usage | Workflow |
|----------|-------|----------|
| `/rag-ops diagnose` | Service down, reponses fausses, low confidence | Auto-sequentiel : Health → CB → Intent → Corpus → Sync → Score |
| `/rag-ops ingest` | Ajouter un PDF ou URL au corpus | Staging → Truth level → Trigger → Monitor → Verify |
| `/rag-ops monitor` | Verifier l'etat du corpus et des metriques | Stats → Coverage → Intents → Sync errors |
| `/rag-ops test` | Tester les endpoints RAG | curl templates pour tous les endpoints |
| `/rag-ops audit` | Audit complet du corpus + score | Script Python : gaps, fichiers vides, frontmatter, score /5 |

---

## Score de Sante RAG /5

Systeme de scoring automatise. Chaque critere vaut 1 point (BON), 0.5 (ACCEPTABLE), 0 (INSUFFISANT).

| # | Critere | BON (1 pt) | ACCEPTABLE (0.5 pt) | INSUFFISANT (0 pt) |
|---|---------|------------|---------------------|-------------------|
| 1 | **Service** — health OK + CB closed | UP + closed | UP + half-open | DOWN ou open |
| 2 | **Qualite** — ratio L1+L2 dans le corpus | > 70% | 50-70% | < 50% |
| 3 | **Couverture** — domaines >= 5 .md (hors SKIP_DIRS) | >= 80% OK | 60-79% OK | < 60% OK |
| 4 | **Sync** — erreurs non resolues | 0 erreurs | 1-5 erreurs | > 5 erreurs |
| 5 | **Intents** — 9/9 avec confidence > 0.5 | 9/9 | 7-8/9 | < 7/9 |

**Domaines exclus du scoring (`SKIP_DIRS`) :** `_trash`, `_raw`, `seo-data`, `media`, `structured`
Ces dossiers ne sont pas des domaines de connaissance et sont marques `*` dans les rapports.

**Normalisation :** Score = `(somme criteres evalues / nb evalues) * 5`. Les criteres N/A (Sync sans MCP, Intents sans trafic) sont ignores du calcul.

**Seuils :**
- **5/5** — Corpus sain, aucune action requise
- **3-4/5** — Acceptable, surveiller les criteres faibles
- **< 3/5** — Action immediate requise

**Calcul automatise :**
```bash
python3 .claude/skills/rag-ops/scripts/rag_audit.py --score
python3 .claude/skills/rag-ops/scripts/rag_audit.py --score --verbose  # details domaines faibles
```

---

## Workflow: Diagnose

> Utiliser quand : le chat repond mal, service down, circuit breaker ouvert, reponses off-topic.

**Workflow auto-sequentiel :** Executer les etapes dans l'ordre. Si une etape echoue → STOP et traiter le probleme avant de continuer.

### Etape 1 — Health Check (CRITIQUE si echoue)

```bash
curl -s http://localhost:3000/api/rag/health | jq
```

**Decision :**
- `status: "ok/healthy"` + `circuitBreaker: "closed"` → continuer etape 2
- `circuitBreaker: "open"` → **STOP** : service RAG externe down, attendre 30s ou redemarrer
- Pas de reponse → **STOP** : backend NestJS down, vérifier `npm run dev`

**Etats du circuit breaker :**
| Etat | Signification | Action | Severite |
|------|---------------|--------|----------|
| `closed` | Normal | Continuer | — |
| `open` | 5+ echecs, requetes rejetees | Verifier le service RAG externe, attendre 30s | CRITIQUE |
| `half-open` | Test de recovery en cours | Surveiller | HAUTE |
| `unknown` | API ne fournit pas le champ CB | Infere "closed" si status=ok/healthy | — |

**Seuils :** `CB_THRESHOLD = 5` echecs, `CB_RESET_MS = 30_000` (30s)

**Note :** L'API externe ne retourne pas toujours le champ `circuitBreaker`. Le script infere "closed" si le status est ok/healthy. Les champs intent varient selon la version API (`userIntent`/`averageConfidence`/`volume`) — geres automatiquement.

### Etape 2 — Intent Stats (HAUTE si anomalie)

```bash
curl -s http://localhost:3000/api/rag/intents/stats | jq
```

**Decision :**
- Tous les intents avec avg confidence > 0.5 → continuer etape 3
- Intent(s) avec confidence < 0.5 → noter les intents concernes, investiguer le corpus pour ce domaine

> Ref complete des 9 intents : `references/intent-patterns.md`

### Etape 3 — Corpus Stats (HAUTE si anomalie)

Via MCP Supabase (project: `cxpojprgwgubzjyqzmoq`) :
```sql
SELECT truth_level, COUNT(*) AS total,
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) AS pct
FROM __rag_knowledge
GROUP BY truth_level
ORDER BY truth_level;
```

**Decision :**
- L1+L2 > 70% → continuer
- L1+L2 entre 50-70% → noter, planifier ingestion L2
- L1+L2 < 50% → **HAUTE** : trop de contenu non vérifié

**Note script :** Le `--score` prefere les donnees API health (`services.corpus.by_truth_level`) avec fallback scan local. La source est indiquee `[API]` ou `[local]` dans le rapport.

### Etape 4 — Sync Errors (MOYENNE si anomalie)

```sql
SELECT rag_file_path, rag_category, errors_count, errors_detail, synced_at
FROM kg_rag_sync_log
WHERE errors_count > 0
ORDER BY synced_at DESC
LIMIT 10;
```

**Decision :**
- 0 erreurs → continuer
- 1-5 erreurs → noter, resoudre apres
- > 5 erreurs → **HAUTE** : mapping KG defaillant

### Etape 5 — Generer le rapport

Produire le rapport au format defini dans "Format de sortie".

### Root Cause (aide au diagnostic)

| Symptome | Cause probable | Fix | Severite |
|----------|---------------|-----|----------|
| Toutes requetes 503 | Circuit breaker open | Redemarrer le service RAG externe | CRITIQUE |
| Confidence < 0.5 système | Corpus insuffisant pour le domaine | Ajouter des docs L1/L2 via `/rag-ops ingest` | HAUTE |
| Intent mal classifie | Regex manquant ou trop generique | Modifier patterns dans `rag-proxy.service.ts` + `chat-intent.utils.ts` | HAUTE |
| Reponse >5s | RAG service lent | Verifier charge serveur, taille des embeddings | MOYENNE |
| Sources vides | Pas de documents pertinents | Verifier le domaine du corpus, ajouter du contenu | HAUTE |
| Off-topic reponse | Guardrails bypasses ou mal configures | Verifier `queryType` et `passedGuardrails` dans la reponse | HAUTE |
| SSE stream coupe | Timeout cote proxy ou client | Verifier `Connection: keep-alive` headers | MOYENNE |
| Ingestion job stuck | Container Docker inaccessible | `docker ps | grep rag-api-prod`, vérifier staging dir | MOYENNE |

---

## Workflow: Ingest

> Utiliser quand : ajouter un nouveau document au corpus RAG.

### Ingestion PDF

**Pre-requis :** Le fichier PDF doit etre accessible sur le serveur.

```bash
# 1. Verifier que le fichier existe
ls -la /opt/automecanik/rag/pdfs/inbox/mon-document.pdf

# 2. Declencher l'ingestion (admin auth requise)
curl -X POST http://localhost:3000/api/rag/admin/ingest/pdf/single \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{
    "pdfPath": "/opt/automecanik/rag/pdfs/inbox/mon-document.pdf",
    "truthLevel": "L2",
    "maxRetries": 1,
    "timeoutSeconds": 1800
  }'

# 3. Suivre le job
curl -s http://localhost:3000/api/rag/admin/ingest/pdf/jobs/{jobId} | jq
```

**Pipeline d'ingestion :**
1. PDF copie dans `/opt/automecanik/rag/pdfs/_single/{runId}/`
2. `docker exec rag-api-prod python scripts/ingest_pdfs.py --input {dir} --truth-level {L1-L4}`
3. Knowledge files generes dans `/tmp/knowledge-import/{runId}/` (container)
4. `docker cp` vers `/opt/automecanik/rag/knowledge/`
5. Nettoyage des dirs temporaires

### Ingestion Web

```bash
curl -X POST http://localhost:3000/api/rag/admin/ingest/web/single \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{
    "url": "https://www.brembo.com/fr/voitures/disques-frein",
    "truthLevel": "L3"
  }'
```

### Regles Truth Level

| Level | Default pour | Quand l'utiliser |
|-------|-------------|-----------------|
| L1 | Jamais par défaut | Normes ECE, manuels OEM avec provenance vérifiée |
| L2 | PDF ingestion | Guides techniques Bosch, ATE, Brembo, docs internes vérifiés |
| L3 | Web ingestion | Articles web, FAQ communaute, sources curees |
| L4 | Jamais recommande | Forums non vérifiés, contenus bruts |

> Guide detaille : `references/truth-levels.md`

### Verification post-ingestion

```bash
# Verifier que le document apparait dans le corpus
curl -s "http://localhost:3000/api/rag/admin/knowledge?prefix=gammes" | jq '.[0:3]'

# Tester une recherche avec le contenu ingere
curl -s -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "contenu du document ingere", "limit": 5}'
```

---

## Workflow: Monitor

> Utiliser quand : vérifier la santé du corpus, la couverture, les métriques.

### Dashboard Admin

Accessible a : `http://localhost:3000/admin/rag`

### Metriques cles (via MCP Supabase)

> Toutes les requetes dans `references/sql-templates.md`

**Corpus overview :**
```sql
SELECT truth_level, COUNT(*) AS total
FROM __rag_knowledge
GROUP BY truth_level
ORDER BY truth_level;
```

**Coverage par domaine :**
```sql
SELECT domain, truth_level, COUNT(*) AS total
FROM __rag_knowledge
GROUP BY domain, truth_level
ORDER BY domain, truth_level;
```

**Intent distribution (via API) :**
```bash
curl -s http://localhost:3000/api/rag/intents/stats | jq '.intents | sort_by(-.volume)'
```

### Alertes a surveiller

| Alerte | Seuil | Severite |
|--------|-------|----------|
| Docs L4 > 10% du corpus total | > 10% | MOYENNE |
| Intent avec confidence moyenne < 0.5 | < 0.5 | HAUTE |
| Jobs "running" depuis > 30min | > 30 min | MOYENNE |
| Sync errors non resolues > 10 | > 10 | HAUTE |
| Domaines avec < 5 .md (hors SKIP_DIRS) | < 5 .md | HAUTE |

---

## Workflow: Test

> Templates curl pour tous les endpoints RAG.

### Endpoints Publics

```bash
# Health check
curl -s http://localhost:3000/api/rag/health | jq

# Chat (bloquant)
curl -s -X POST http://localhost:3000/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Comment choisir des disques de frein pour Renault Clio 3?",
    "context": {
      "marque": "Renault",
      "modele": "Clio",
      "motorisation": "1.5 dCi"
    }
  }' | jq

# Chat SSE (streaming)
curl -N -X POST http://localhost:3000/api/rag/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Symptomes disques de frein uses?"}'

# Recherche semantique
curl -s -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "plaquettes de frein ceramique", "limit": 5}' | jq

# Recherche par section
curl -s "http://localhost:3000/api/rag/section/diagnostic?q=bruit+freinage&limit=5" | jq
curl -s "http://localhost:3000/api/rag/section/guide-achat?q=disque+frein&limit=5" | jq
curl -s "http://localhost:3000/api/rag/section/reference?q=plaquettes&limit=5" | jq
curl -s "http://localhost:3000/api/rag/section/entretien?q=courroie+distribution&limit=5" | jq

# Intent stats
curl -s http://localhost:3000/api/rag/intents/stats | jq
```

### Endpoints Admin (auth requise)

```bash
# Lister les documents knowledge
curl -s http://localhost:3000/api/rag/admin/knowledge | jq '| length'

# Document par ID
curl -s http://localhost:3000/api/rag/admin/knowledge/doc/{docId} | jq

# Corpus stats
curl -s http://localhost:3000/api/rag/admin/corpus/stats | jq

# Lister les jobs d'ingestion
curl -s http://localhost:3000/api/rag/admin/ingest/pdf/jobs | jq

# Status d'un job
curl -s http://localhost:3000/api/rag/admin/ingest/pdf/jobs/{jobId} | jq
```

### Validation des reponses

```bash
# Verifier le HTTP status code
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/rag/health

# Verifier le temps de reponse
curl -s -o /dev/null -w "%{time_total}" -X POST http://localhost:3000/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Verifier la structure de reponse chat
curl -s -X POST http://localhost:3000/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}' | jq 'keys'
# Attendu: ["answer","citations","clarifyQuestions","confidence","needsClarification",
#           "passedGuardrails","queryType","refusalReason","responseMode","sessionId",
#           "sources","sourcesCitation","truthMetadata"]
```

---

## Workflow: Audit

> Audit automatise du corpus avec le script Python.

```bash
# Score de santé /5 (résumé rapide)
python3 .claude/skills/rag-ops/scripts/rag_audit.py --score

# Audit du corpus (fichiers, taille, frontmatter)
python3 .claude/skills/rag-ops/scripts/rag_audit.py --corpus

# Couverture gammes (compare DB vs knowledge)
python3 .claude/skills/rag-ops/scripts/rag_audit.py --coverage

# Health check RAG service
python3 .claude/skills/rag-ops/scripts/rag_audit.py --health

# Intent stats formatees
python3 .claude/skills/rag-ops/scripts/rag_audit.py --intents

# Score verbose (details domaines faibles)
python3 .claude/skills/rag-ops/scripts/rag_audit.py --score --verbose

# Corpus verbose (20 issues au lieu de 10)
python3 .claude/skills/rag-ops/scripts/rag_audit.py --corpus --verbose

# Tout (corpus + health + intents + coverage)
# Note: --score est exclusif (retourne immediatement, ne lance pas --all)
python3 .claude/skills/rag-ops/scripts/rag_audit.py --all

# Sortie JSON (pour integration)
python3 .claude/skills/rag-ops/scripts/rag_audit.py --score --format json
```

---

## Format de sortie

Le workflow Diagnose et l'audit `--score` produisent un rapport structure :

```markdown
## RAG Health Report — [date]

### Score /5
| # | Critere | Status | Detail |
|---|---------|--------|--------|
| 1 | Service disponible | [+] BON | UP + CB closed |
| 2 | Qualite corpus (L1+L2) | [+] BON | 96% (275/286) [API] |
| 3 | Couverture domaines | [~] ACCEPTABLE | 5 faibles (71%) |
| 4 | Sync (0 erreurs) | [?] N/A | Requires MCP SQL |
| 5 | Intents (conf > 0.5) | [?] N/A | 9/9 registered, 0 traffic |
| **TOTAL** | | | **X/5** (N criteres evalues) |

**Marqueurs :** `[+]` BON, `[~]` ACCEPTABLE, `[-]` INSUFFISANT, `[?]` N/A

### Issues par sévérité

#### CRITIQUES (X)
| Issue | Detail | Fix |
|-------|--------|-----|

#### HAUTES (X)
| Issue | Detail | Fix |
|-------|--------|-----|

#### MOYENNES (X)
| Issue | Detail | Fix |
|-------|--------|-----|

### Recommandations prioritaires
1. [action #1 — impact le plus fort]
2. [action #2]
3. [action #3]
```

---

## Severites

| Niveau | Definition | Exemples | Action |
|--------|-----------|----------|--------|
| **CRITIQUE** | Service inaccessible ou donnees corrompues | Service down, CB open, 0 docs L1/L2 | Corriger immediatement |
| **HAUTE** | Qualite degradee, impact sur les reponses | Confidence < 0.5, domaine < 5 docs, sync errors > 5 | Corriger dans la session |
| **MOYENNE** | Amelioration non urgente | L4 > 10%, jobs stuck, intents sous-representes | Planifier |
| **BASSE** | Dette technique mineure | Frontmatter manquant, fichiers volumineux, doublons | Backlog |

---

## Anti-Patterns (BLOCK)

1. **JAMAIS modifier le service FastAPI RAG depuis ce repo**
   - Le service externe est gere separement
   - Seul le proxy NestJS (`rag-proxy`) est dans ce repo

2. **JAMAIS hardcoder `RAG_SERVICE_URL` dans le code**
   - Toujours `process.env.RAG_SERVICE_URL` via ConfigService
   - Config dans `.env` uniquement

3. **JAMAIS bypass le circuit breaker**
   - Il protege contre les cascading failures
   - Si open → corriger le service RAG externe, pas le contourner

4. **JAMAIS assigner L1 sans vérification OEM**
   - L1 = normes officielles avec provenance tracable
   - Requiert audit trail dans metadata

5. **JAMAIS ingerer sans truth level explicite**
   - Défaut PDF: L2, défaut Web: L3
   - Toujours specifier explicitement dans la requete

6. **JAMAIS utiliser `psql` via Bash pour interroger Supabase**
   - Toujours MCP: `mcp__supabase__execute_sql` (project: `cxpojprgwgubzjyqzmoq`)
   - Pour DDL: `mcp__supabase__apply_migration`

7. **JAMAIS modifier `content_tsv` manuellement**
   - Genere automatiquement par trigger: `to_tsvector('french', content)`
   - Modifier `content` uniquement

8. **JAMAIS supprimer des docs knowledge sans backup**
   - Deplacer vers `_trash/` plutot que supprimer
   - Garder la tracabilite dans `kg_rag_sync_log`

9. **JAMAIS ignorer les reponses low confidence**
   - Confidence < 0.5 = gap de connaissances OU probleme de retrieval
   - Investiguer avant de re-run

10. **JAMAIS modifier les intent patterns sans synchroniser frontend ET backend**
    - Backend: `rag-proxy.service.ts` (classifyIntent)
    - Frontend: `chat-intent.utils.ts` (classifyChatIntent)
    - Les deux DOIVENT rester en miroir

---

## Key Files

### Backend (NestJS Proxy)
- `backend/src/modules/rag-proxy/rag-proxy.controller.ts` — 195 lignes, tous les endpoints REST
- `backend/src/modules/rag-proxy/rag-proxy.service.ts` — 1271 lignes, circuit breaker, intent, ingestion
- `backend/src/modules/rag-proxy/rag-proxy.module.ts` — Module registration
- `backend/src/modules/rag-proxy/dto/chat.dto.ts` — Zod: ChatRequest (message 1-2000, sessionId?, context?)
- `backend/src/modules/rag-proxy/dto/search.dto.ts` — Zod: SearchRequest (query 1-500, limit 1-50, filters?)
- `backend/src/modules/rag-proxy/dto/pdf-ingest.dto.ts` — Zod: pdfPath, truthLevel L1-L4 (défaut L2)
- `backend/src/modules/rag-proxy/dto/web-ingest.dto.ts` — Zod: url, truthLevel L1-L4 (défaut L3)
- `backend/tests/unit/rag-proxy.service.test.ts` — 10 tests (chat, search, stream, health)

### Frontend (Remix)
- `frontend/app/routes/admin.rag.tsx` — Layout admin RAG
- `frontend/app/routes/admin.rag._index.tsx` — Dashboard: KPIs, truth levels, families, intents, jobs
- `frontend/app/routes/admin.rag.documents.tsx` — Browser documents avec filtres
- `frontend/app/routes/admin.rag.documents.$docId.tsx` — Detail document (Preview, Source, Metadata)
- `frontend/app/routes/admin.rag.ingest.tsx` — Formulaires ingestion PDF + Web
- `frontend/app/routes/admin.rag.ingest.$jobId.tsx` — Logs job (terminal-style, auto-refresh)
- `frontend/app/components/rag/ChatWidget.tsx` — Widget flottant, SSE streaming, vehicle context
- `frontend/app/components/rag/ChatMessage.tsx` — Bulles messages, confidence bar, sources
- `frontend/app/utils/chat-intent.utils.ts` — 9 intents, regex patterns, fallback: choose
- `frontend/app/utils/page-role.types.ts` — Types: UserIntent, IntentFamily, PageIntent, mappings

### Knowledge Corpus
- `/opt/automecanik/rag/knowledge/canonical/` — 3 .md — Docs officiels (L1)
- `/opt/automecanik/rag/knowledge/diagnostic/` — 16 .md — Guides depannage (L2)
- `/opt/automecanik/rag/knowledge/gammes/` — 221 .md — Pieces auto (L2)
- `/opt/automecanik/rag/knowledge/guides/` — 11 .md — Guides techniques
- `/opt/automecanik/rag/knowledge/policies/` — 3 .md — Politiques boutique
- `/opt/automecanik/rag/knowledge/vehicle/` — 6 .md — Specs vehicules
- `/opt/automecanik/rag/knowledge/web/` — 1 .md — Contenu web ingere (L3)
- `/opt/automecanik/rag/knowledge/_trash/` — Docs deprecies (excluded from scoring)

### Database (Supabase)
- `__rag_knowledge` — Documents: id, title, content, content_tsv, truth_level, domain, category
- `kg_rag_mapping` — RAG doc → Knowledge Graph node
- `kg_rag_sync_log` — Audit des syncs (duration, errors, mutations)
- `kg_rag_sync_errors` — Erreurs de sync non resolues
- `kg_rag_sync_stats` — Stats agregees par categorie

### Configuration
- `backend/.env` — `RAG_SERVICE_URL`, `RAG_API_KEY`, `RAG_CONTAINER_NAME`, `RAG_PDF_DROP_HOST_ROOT`
- Container Docker: `rag-api-prod` (défaut)
- Staging PDF: `/opt/automecanik/rag/pdfs/_single/{runId}/`

---

## Interaction avec Autres Skills

| Skill | Relation avec rag-ops |
|-------|----------------------|
| `content-audit` | Vérifie B8 (Preuves & confiance) — si preuves faibles → `/rag-ops ingest` pour enrichir le corpus |
| `seo-content-architect` | Consomme le corpus RAG (Phase 1b vérification) — rag-ops alimente le contenu vérifié |
| `backend-test` | Tests curl generiques — rag-ops fournit les templates RAG specifiques |
| `db-migration` | Modifications schema `__rag_knowledge` — rag-ops reference les tables |

**Flux :** `content-audit` detecte un manque de preuves → `/rag-ops ingest` enrichit le corpus → `seo-content-architect` produit le contenu vérifié.

Ne jamais fusionner les roles.
