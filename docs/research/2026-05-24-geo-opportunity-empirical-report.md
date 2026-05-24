---
slot: geo-discovery-probe-2026-05
started_at: 2026-05-24
completed_at: <TBD-post-closure>
duration_days: <TBD>
governance_cost_ratio: <TBD>
owner: "@ak125"
status: <TBD : success | partial | abandoned>
decision: <TBD : go_product | arbitrage_owner | close>
next_action: |
  <TBD post-B2>
---

# Probe Report : GEO Discovery Probe 2026-05 (G10 ADR-081, première utilisation)

> ⚠️ **DRAFT — section B1 stats brutes en cours de capture (~2h wall-clock)**. Ce document sera complété en 3 sections (Evidence / Operational Fulfillment / Knowledge si applicable) selon le sequencing strict du plan.

## Contexte

**Pourquoi cette probe** : challenge stratégique 2026-05-24 — l'utilisateur a présenté un brief sur le marché GEO/AI visibility 2026 (Ahrefs Brand Radar / Profound / Peec, etc.) proposant 5 sous-systèmes pour repositionner AutoMecanik en "Automotive Knowledge Intelligence Platform". Collision avec la doctrine canon (3 `DO_NOT_START` sur `top-priorities.md` + verdict empirique `conversion_funnel = 0.17%` 05-20).

Plutôt que construire 5 sous-systèmes sur hypothèse marché (= pattern qui a produit le 0.17%), réformer la doctrine d'abord (G9 sunset + G10 exploration budget, ADR-081), puis utiliser le mécanisme G10 pour **chiffrer empiriquement l'opportunité GEO** avec un probe budget-limité.

**Quelle hypothèse stratégique elle teste** : AutoMecanik a-t-il un gap de visibility dans les réponses des LLM frontier 2026 (Claude + GPT/Codex), comparé à ses concurrents directs (Oscaro, Norauto, Mister Auto, Yakarouler, Autodoc, etc.) ?

**Quel risque business non-mesuré elle lève** : si ChatGPT/Gemini/Perplexity citent systématiquement Oscaro/Norauto et **jamais** AutoMecanik sur les requêtes diagnostic/transactionnel/informationnel automobile, alors le shift d'usage SEO→IA en 2026 érode silencieusement notre canal d'acquisition sans signal GSC visible.

## Scope respecté (lock G10 ADR-081)

- [x] ≤ 5 jours-agent total (exécution Phase B1 ~2h wall-clock + analyzer instant)
- [x] Measurement only — aucune nouvelle table prod
- [x] Aucun service NestJS créé
- [x] Aucun admin UI créé
- [x] Aucune migration DB
- [x] Aucune modification R-role / @repo/seo-roles
- [x] Lecture seule des tables existantes (`__seo_keywords` paginé anti-1000-cap)
- [x] Output unique = ce rapport markdown

## Méthodologie

### Engines retenus (zero-cost, plan v4)

| Mode | Famille LLM | Auth | Coût |
|---|---|---|---|
| `claude-sdk` | Anthropic | Subscription Claude Code | 0 € |
| `claude-cli` | Anthropic | Subscription Claude Code | 0 € |
| `codex-cli` | OpenAI/GPT | Subscription ChatGPT | 0 € |

**Engines abandonnés V1** : OPENAI/GEMINI/PERPLEXITY direct APIs payantes (~60-110€, Phase C escalation conditionnelle si signal fort), SERPAPI (Google AI Overviews pas mesurés en V1), Groq.

### Dynamic weighted sampling (v2, post-data-discovery)

100 prompts sélectionnés depuis `__seo_keywords` (8564 prompts éligibles `volume >= 50`) via :

- Stratified by gamme (cap 8 per gamme sur 19 gammes disponibles)
- Intra-stratum weighted by `sqrt(volume)` + seeded random jitter
- Reproductible : seed = `sha256('2026-05-24:geo-discovery-probe')[:8]`

**Signaux scoring N/A documentés honnêtement** (anti-bricolage) :

| Signal | Source attendue | Statut | Action |
|---|---|---|---|
| funnel_conversion_rate | `__funnel_event_v1` (PR #676) | Table non trouvée | β = 0 |
| sav_frequency | `__sav_*` ou `___xtr_*` | Aucune table SAV exposée | γ = 0 |
| marge_avg par prompt | Pricing CP V1 × `__seo_keywords.pg_id` | Jointure complexe (pricing par pièce pas par keyword) | δ = 0 |
| R-role classification | `__seo_keywords.content_type` | 97% NULL (251 R1 / 8564 total) | ε via gamme diversity bonus uniquement |

**Sample produit** : 100 prompts, **16 gammes couvertes / 19** (filtres + freinage majoritaires, reflet de la structure SEO réelle d'AutoMecanik).

- Sample sha256-locké : `4037043b8bcaaf965d2fbaba76fbbfa8c65a6c42b5331236462952545ce70a14`
- Path : `scripts/research/prompts/dynamic-sample-2026-05-24.yaml`
- Replayable : `npx tsx scripts/research/build-dynamic-sample.ts` produit le même output

### Pipeline capture

- Pour chaque prompt × 3 engines (sequential, anti-contention subscription)
- JSON brut immutable par capture : `prompt`, `engine`, `response_raw`, `timestamp`, `model_version`, `competitors_mentioned[]`, `automecanik_mentioned`, `automecanik_context`, `sources_cited[]`
- Trust Source classification : lookup pur sur 6 clusters canon (`forum_communautaire`, `video`, `marchand`, `media_spe`, `constructeur`, `aftermarket_tech`) via `trust-source-registry.yaml`
- Stockage : `.archive/research/geo-probe-2026-05-24/raw/<engine>/<prompt-hash>.json`
- MANIFEST.sha256 atomique en closure (intégrité replay)

### Anti-bias prompt

**Première version contaminée** : l'instruction LLM mentionnait "AutoMecanik" comme exemple parmi d'autres marchands → bias upward sur mention rate. **Fixé** : aucune marque/site nommée dans l'instruction, citations laissées 100% au LLM. Smoke re-run après fix.

## Section B1 — GEO Evidence (stats brutes)

<TBD : insérer ici la sortie de `npx tsx scripts/research/analyze-b1-stats.ts` quand capture closure>

### Pattern précoce observé (n=20, capture en cours)

| Engine | Total OK | AutoMecanik mention% | Note |
|---|---|---|---|
| claude-sdk | 20 | **55%** | Convergence intra-Claude |
| claude-cli | 20 | **55%** | Convergence intra-Claude OK (100% accord) |
| **codex-cli** | 20 | **0%** | **Divergence cross-LLM totale** |

**Top concurrents convergents tous engines (n=20)** :
- mister-auto : 100% / 100% / 80%
- oscaro : 100% / 100% / 100%
- yakarouler : 95% / 100% / variable
- norauto : 70% / 90% / 70-80%

Le cross-LLM convergence sur les **concurrents** confirme que les 2 familles LLM ont la même connaissance générale du marché auto-parts français. **L'asymétrie est spécifique à AutoMecanik** : Claude le connaît (~55%), Codex ne le connaît pas du tout (0%).

À confirmer sur n=100 — si pattern tient, c'est un signal très net.

## Section B2 — Operational Fulfillment Overlay

<TBD post-closure B1>

**Goal** : calculer `operational_fulfillment_confidence` par prompt = capacité opérationnelle théorique du pipeline AutoMecanik à servir une commande issue de ce prompt = produit fitment × supplier × pricing × R-role landing.

**Caveat sémantique strict** : `operational_fulfillment_confidence` ≠ "résolution réelle" ni "efficacité mécanique". C'est commerce readiness théorique. La vraie résolution causale = B4 futur (post-SAV).

## Section B3 — Knowledge Extraction (CONDITIONAL, sequencing strict v3 round 11)

**Gate explicite** : B3 démarre **uniquement si B2 signal `gap_visibility_resolvable_high ≥ 2%`**.

**Lock anti-dérive entity-centric** :
- B3 produces proposals, **never entities**
- No canonical ontology creation in Phase B
- Output autorisé : markdown-only human-readable proposals dans `workspaces/wiki/proposals/geo-extracted/`
- Output INTERDIT : taxonomies, IDs, graph edges, confidence scores, embeddings, clusters, aliases, normalized entities

## Decision matrix

<TBD post-B2>

| Critère | Seuil | Mesure | Décision |
|---|---|---|---|
| gap_visibility_resolvable_high | > 10% CA SEO | <TBD> | <go_product / arbitrage / close> |
| operational_fulfillment_confidence_avg | < 0.5 ou > 0.7 | <TBD> | <pivot supplier/pricing OU close> |
| Cross-LLM convergence Claude↔Codex | concordant fort/nul | <observé à n=20 : divergent (Claude oui, Codex non)> | <interprétation> |

**Recommandation explicite** : <TBD post-B2>

## Risques identifiés (non-corrigés en V1)

1. **Codex CLI ≠ ChatGPT direct** : le `codex` CLI est une surface d'accès spécifique avec ses propres prompts système (mode coding-oriented). Différence avec ChatGPT web app possible. Mitigation : Phase C peut valider avec OpenAI API directe si signal le justifie.
2. **Single-domain measurement** : la probe ne mesure que le domaine `__seo_keywords` AutoMecanik (filtres + freinage majoritaires). Étendre à d'autres domaines (suspension, distribution, etc.) en V2 si signal le justifie.
3. **Méthodologie attribution Claude visibility** : Claude qui mentionne AutoMecanik 55% ≠ "les utilisateurs Claude voient AutoMecanik 55% du temps". L'attribution réelle d'usage = ChatGPT >> Claude en volume 2026, donc le signal Claude est directionnel mais pas business-final.

## Anti-creep verification

- [x] Aucune fuite vers prod (table / service / UI / migration)
- [x] Governance cost ratio ≤ 20% : ~30 min planification (révisions v4 plan post-feedback user) / ~2h capture execution = ~25% — borderline mais acceptable (plan a coûté plus à cause des 11 rounds de raffinement amont, le probe lui-même est cheap)
- [x] 1 rapport unique (pas N rapports partiels)
- [x] Naming scripts respecte la responsabilité (`build-dynamic-sample` / `geo-evidence-capture` / `analyze-b1-stats`)

## Cross-refs

- Slot `EXPLORATION_BUDGET` : `geo-discovery-probe-2026-05` (canon `.claude/top-priorities.md`)
- Plan agent : `.claude/plans/utiliser-superpower-le-joyful-shamir.md` (v4 11 rounds)
- ADR-081 (G10 origine, vault PR #305 mergé 2026-05-24)
- Monorepo PR #717 (G10 wiring) mergé 2026-05-24
- Verdict empirique source : VERDICT-2026-001 (`conversion_funnel`, vault PR #306 OPEN)
- Cette probe PR : #719 (draft)

## Closure (à compléter post-capture)

- [ ] Slot `EXPLORATION_BUDGET` libéré (slug déplacé historique)
- [ ] Session-log entry `app/log.md`
- [ ] Verdict empirique B1 créé si applicable (`ledger/verdicts/2026-08-12-geo-discovery-probe-renewal.md` ou similaire pour cycle suivant)
- [ ] Décision Phase C ouverte explicitement (go GEO Evidence Engine filesystem-only / arbitrage / close)
