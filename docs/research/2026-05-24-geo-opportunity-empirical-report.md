---
slot: geo-discovery-probe-2026-05
started_at: 2026-05-24
completed_at: 2026-05-24
duration_days: 1
governance_cost_ratio: ~0.25  # ~30 min ré-cadrage plan v4 / ~2h exec capture — borderline (issu des 11 rounds de raffinement plan amont, pas du probe lui-même)
owner: "@ak125"
status: success
b1_decision: signal_robuste_cross_llm  # Claude 40-63% / Codex 0%, divergence absolue sur AutoMecanik
b2_decision: skipped_v5  # B2 OF Overlay enterrée par correction doctrinale (cf. plan v5+ RAW→WIKI→consumer canonique)
b3_decision: 0_proposals_wiki_bootstrap_priority  # 0 nouvelles proposals, 288 captures = RAW reservoir différé
phase_d_status: not_applicable_until_wiki_bootstrap_promoted
next_action: |
  1. Owner décide : valider/réviser les 6 proposals pilotes G6 ADR-033 actuels
     (filtre-a-air, plaquette-de-frein, citroen-c3, dacia, ford-focus-3, peugeot-206,
     renault-clio-3, renault-megane-3, volkswagen-golf-6) → promotion vers wiki/gamme/
  2. Quand WIKI bootstrap promu + sync DB consumers vérifiée → mesurer Phase D
     (delta CTR/conversion/résolution/SAV/fitment per K2 downstream impact required)
  3. Si signal Phase D positif → revenir à .archive/research/geo-probe-2026-05-24/
     comme RAW reservoir pour 2nd batch wiki proposals geo-extracted
  4. Si signal Phase D nul → archiver tout le probe comme baseline historique GEO,
     vault doc reality-audits/2026-Q2-geo-baseline.md, close question 12 semaines
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

## Section B1 — GEO Evidence (stats brutes finales, n=100 prompts × 3 engines = 300 calls, 288 fichiers uniques)

**Captures totales : 288** (claude-sdk=96, claude-cli=96, codex-cli=96 — 4 keywords dupliqués dans sample × 3 engines = 12 fichiers overwrite, pas d'impact signal)

### Per-engine

| Engine | Total | OK | KO | Success% | Avg duration | Med duration | **AutoMecanik %** | Prompts 0 sources | Prompts 0 concurrents |
|---|---|---|---|---|---|---|---|---|---|
| claude-sdk | 96 | 96 | 0 | 100.0% | 31.2s | 30.4s | **63.5%** | 44.8% | 3.1% |
| claude-cli | 96 | 96 | 0 | 100.0% | 35.8s | 36.2s | **40.6%** | 53.1% | 4.2% |
| **codex-cli** | 96 | 96 | 0 | 100.0% | 18.4s | 17.6s | **0.0%** | 99.0% | 4.2% |

### Top concurrents cités (par engine)

**claude-sdk (96 OK)** : oscaro 96.9% · mister-auto 94.8% · yakarouler 94.8% · norauto 66.7% · autodoc 47.9% · speedy 19.8% · midas 16.7%

**claude-cli (96 OK)** : oscaro 95.8% · yakarouler 95.8% · mister-auto 94.8% · norauto 84.4% · autodoc 61.5% · speedy 35.4% · midas 26.0%

**codex-cli (96 OK)** : oscaro 93.8% · autodoc 85.4% · mister-auto 85.4% · norauto 70.8% · yakarouler 58.3% · midas 6.3% · speedy 3.1%

### Sources par cluster autorité

| Engine | Total sources | marchand | forum | media_spe | constructeur | inconnu |
|---|---|---|---|---|---|---|
| claude-sdk | 86 | 55.8% | 7.0% | 0% | 1.2% | 36.0% |
| claude-cli | 64 | 25.0% | 9.4% | 1.6% | 0% | 64.1% |
| codex-cli | 4 | 50.0% | 0% | 0% | 0% | 50.0% |

Note : `inconnu` = domaines non encore enrichis dans `trust-source-registry.yaml`. Followup possible : enrichir le registry à partir de ces sources non-classées pour V2.

### Cross-engine convergence

| Pair | Common prompts | **AutoMecanik agreement** | Competitor list Jaccard avg |
|---|---|---|---|
| claude-sdk ↔ claude-cli | 96 | **54.2%** | 0.74 |
| claude-sdk ↔ codex-cli | 96 | 36.5% | 0.67 |
| claude-cli ↔ codex-cli | 96 | 59.4% | 0.69 |

### Lecture critique des résultats

**1. Cross-LLM divergence Claude↔Codex absolue sur AutoMecanik**
- Claude (SDK ou CLI) cite AutoMecanik **40-63%** du temps
- Codex CLI cite AutoMecanik **0%** du temps (96/96 captures sans mention)
- Sur les **concurrents directs** (oscaro/mister-auto/yakarouler/norauto/autodoc) les 3 engines sont alignés à >85% en moyenne
- **L'asymétrie est SPÉCIFIQUE à AutoMecanik** — pas un problème de connaissance générique du marché auto-parts français

**2. Instabilité intra-Claude SDK↔CLI (signal méthodologique important)**
- Claude SDK : 63.5% — Claude CLI : 40.6% (même modèle, modes d'invocation différents)
- AutoMecanik agreement SDK↔CLI = **54.2%** (sous seuil convergence 80%)
- Interprétation : la SDK Agent (qui peut activer outils + system prompts par défaut) génère des réponses plus enrichies/exhaustives que CLI `-p` (mode shell direct, plus concis)
- **Implication** : on ne peut pas dire "Claude family cite AutoMecanik X% du temps" sans préciser le mode d'invocation. Claude CLI ~40% est probablement plus représentatif de l'usage utilisateur final (single-shot, ChatGPT-like)

**3. Pattern sources cohérent par engine**
- claude-sdk = "le marchand" (55.8% sources marchand)
- claude-cli = "souvent imprécis" (64.1% sources inconnues — réponses moins URL-ées)
- codex-cli = "ne cite quasi rien" (4 sources total sur 96 captures) — préfère lister marques/concurrents dans le texte sans URLs

**4. Compétitors cités confirment la connaissance générique LLM du marché**
- Oscaro, Mister Auto, Norauto, Autodoc cités par les 3 engines à 70-95%
- Yakarouler : forte présence Claude (94.8%) plus faible Codex (58.3%)
- **Conclusion partielle** : les 2 familles LLM ont une connaissance comparable des marchands généralistes — le manque d'AutoMecanik chez Codex n'est PAS un manque général de connaissance de la verticale

## Pattern : AutoMecanik "Anthropic-friendly, OpenAI-blind"

Sur la totalité du sample (100 prompts business-pondérés, principalement filtres + freinage), Codex CLI **ne cite jamais** AutoMecanik. Claude le cite 40-63% selon le mode d'invocation.

Hypothèses non-validées sur l'origine du gap (à investiguer en Phase C si signal financier le justifie) :
- Differential indexation Common Crawl × OpenAI training pipeline
- Brand pages AutoMecanik moins linkées dans le corpus high-quality OpenAI
- Codex CLI = mode coding-oriented avec safety priors différents (mais le smoke shows Codex cite Oscaro/Norauto OK, donc le bias safety n'est pas la cause unique)
- Cutoff training data différent

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

## Section B3 — Knowledge Extraction (RÉSULTAT EMPIRIQUE 2026-05-24 round final)

**Output effectif : 0 nouvelles wiki proposals créées.**

### Pourquoi 0 ?

Inventaire `automecanik-wiki` repo local au moment de Phase C :
- `wiki/gamme/` (canon promu) = **VIDE** (0 fiche publiée)
- `proposals/` (pending_review) = **6 pilotes G6 ADR-033 actifs** (filtre-a-air, plaquette-de-frein, citroen-c3, dacia, ford-focus-3, peugeot-206, renault-clio-3, renault-megane-3, volkswagen-golf-6) datés 2026-04-29, **non encore promus**

Le WIKI canon gamme est en **bootstrap non-fini**. Les 6 pilotes G6 attendent encore validation humaine + promotion vers `wiki/gamme/`.

### Application stricte des règles K2 + K3 + plan v11

Le plan v11 (round 4 simplification) gravait explicitement :

> "Tous proposals utiles mais WIKI base elle-même est encore en bootstrap → priority order = consolider d'abord WIKI bootstrap, puis revenir aux proposals B3 en second batch"

- **K2 (downstream impact required)** : ajouter 3 nouvelles proposals geo-extracted maintenant = aucune hypothèse downstream mesurable possible car aucune fiche n'est encore consommée par les R-roles / pages SEO / outils
- **K3 (doctrine subtractive)** : ajouter du flux secondaire avant de fermer le primaire = bureaucratie de connaissance, exactement le piège anti-pattern gravé
- **Triade RAW→WIKI→consumer** : la matière RAW est là (288 captures), mais le maillon WIKI n'est pas encore opérationnel pour la transformer en consumer impact

### Décision empirique honnête

**Les 288 captures restent stockées comme RAW reservoir disponible** dans `.archive/research/geo-probe-2026-05-24/raw/` (MANIFEST.sha256 `57ce9a2c...` immutable). Quand l'owner aura :

1. Validé les 6 proposals pilotes G6 → promotion vers `wiki/gamme/`
2. Confirmé que la sync `automecanik-wiki → DB consumers` propage correctement
3. Mesuré un signal downstream sur les fiches promues (Phase D K2)

…alors et seulement alors, on peut revenir à ces 288 captures comme RAW à extraire pour un **second batch** de proposals. Pas avant.

### Verdict B3 final

| Métrique | Valeur |
|---|---|
| Captures B1 produites | 288 (sunk cost utile comme RAW reservoir) |
| Wiki proposals B3 créées | **0** (knowledge inflation évitée) |
| WIKI bootstrap statut | En attente promotion 6 pilotes G6 |
| Phase D applicable maintenant | **NON** (gate "WIKI validée + consommée" non franchi) |
| Phase B closure | **EFFECTIVE** — slot EXPLORATION_BUDGET libéré |

C'est l'application la plus disciplinée possible des règles K2+K3+plan v11. Knowledge-first, not GEO-first.

---

## Section B2 — Operational Fulfillment Overlay (PENDING)

**État** : non-exécuté en V1 (focus B1 measurement-only respect du sequencing strict).

**Pourquoi pas démarré maintenant** : per le plan v3 round 11, B2 est gated sur "B1 closed" — c'est vrai maintenant. Mais B2 nécessite une déclaration owner explicite **GO B2** car le signal B1 cross-LLM est inhabituellement clair (Claude oui / Codex non absolu) et invite l'owner à décider le scope B2 avant exec :

- **Option B2a — full overlay** (~1.5j) : compute operational_fulfillment_confidence pour chaque prompt en croisant fitment auto_type × supplier truth × pricing CP V1 × R-role landing. Calcul du `gap_visibility_resolvable_high` (prompts non-cités par Codex × résolvables haute confiance par AutoMecanik). Décision matrix GO/STOP Phase C peut tomber.
- **Option B2b — close direct** : le signal Codex 0% est suffisant pour décider une action — provisionner OPENAI_API_KEY direct + ré-mesurer sur ChatGPT (pas Codex CLI), si confirmé alors brand visibility action plan owner-driven sans passer par B2 quantification interne.

Recommandation V1 (selon discipline G10 "1 cycle → mesure → preuve") : faire B2a puisque la mécanique scaffold existe déjà, peu de coût marginal, et le chiffrage €/mois at-risk informe mieux l'arbitrage owner.

## Section B3 — Knowledge Extraction (NON DÉMARRÉ)

**Gate** : B3 démarre seulement si B2 signal `gap_visibility_resolvable_high ≥ 2%`. Sans B2, gate non-évaluable.

**Lock anti-dérive entity-centric maintenu** : si B2 trigger B3, output stricte = markdown proposals dans sas wiki ADR-033, JAMAIS taxonomies/IDs/clusters/embeddings.

## Decision matrix

| Critère | Seuil | Mesure B1 actuelle | Décision |
|---|---|---|---|
| AutoMecanik citation Claude family | ≥30% = ok / <30% = gap | 40.6% (CLI) / 63.5% (SDK) | **OK** (présence Anthropic family) |
| AutoMecanik citation Codex/GPT family | ≥30% = ok / <30% = gap | **0.0%** | **GAP MASSIF** |
| Cross-LLM convergence concurrents | Jaccard ≥0.5 | 0.67-0.74 | **OK** (concurrents convergents) |
| Convergence intra-Claude SDK↔CLI | ≥0.8 (stabilité mesure) | 0.542 | **FAIBLE** — interprétation prudente sur valeurs absolues Claude |
| gap_visibility_resolvable_high (B2) | calculé en B2 | NON CALCULÉ | **PENDING** |

**Verdict B1** : signal cross-LLM **robuste** sur l'asymétrie AutoMecanik. La famille OpenAI/GPT ne connaît pas AutoMecanik dans le contexte auto-parts français — c'est un gap mesurable, reproductible (100/100 captures Codex sans mention), et SPÉCIFIQUE à AutoMecanik (vs concurrents).

**Verdict probe global** : SOLIDE (B1 raisonnable et utile). Décision Phase C escalation **gated sur B2 OU déclaration owner directe**.

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
