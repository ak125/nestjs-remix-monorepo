# scripts/research/ — Exploration probes (G10 EXPLORATION_BUDGET, ADR-081)

Slot AM-2 actif : **`geo-discovery-probe-2026-05`** (canon `.claude/top-priorities.md`).

## Scope strict (lint `validate-exploration-probe.sh` au PR final)

- Measurement only
- Pas de nouvelle table production
- Pas de service NestJS
- Pas d'admin UI
- Pas de migration DB
- Pas de modification R-role / `@repo/seo-roles`
- Output unique = 1 rapport markdown final

## Engines (zero-cost via subscriptions, révision v4 plan)

| Mode | Auth | Binary / Lib |
|---|---|---|
| `claude-sdk` | Subscription Claude Code | `@anthropic-ai/claude-agent-sdk@^0.3.150` |
| `claude-cli` | Subscription Claude Code | `find /home/deploy/.vscode-server -name claude -path '*native-binary*' \| head -1` |
| `codex-cli` | Subscription ChatGPT | `npm install -g @openai/codex@^0.133.0` + `codex login` interactive one-shot |

Coût externe : **0 €**. Aucune clé API à provisionner (`ANTHROPIC_API_KEY` + `OPENAI_API_KEY` restent absents/commentés).

## Fichiers

| Fichier | Rôle |
|---|---|
| `sampling-weights.yaml` | Pondérations versionnées + signaux N/A documentés honnêtement |
| `trust-source-registry.yaml` | Classification canon des sources citées par cluster autorité |
| `build-dynamic-sample.ts` | Génère `prompts/dynamic-sample-2026-05-24.yaml` (sha256-locké, replayable) depuis `__seo_keywords` |
| `geo-evidence-capture.ts` | Capture 3 engines × N prompts, output `.archive/research/geo-probe-2026-05-24/raw/<engine>/*.json` + MANIFEST.sha256 |
| `prompts/dynamic-sample-2026-05-24.yaml` | Sample 100 prompts (sha256-locké) — stratified by gamme, sqrt(volume), seeded random |

## Usage

```bash
cd scripts/research/
npm install                                    # deps locales isolées
npx tsx build-dynamic-sample.ts                # régénère le sample (déterministe via seed)
npx tsx geo-evidence-capture.ts --smoke        # 1 prompt × 3 engines (~70s)
npx tsx geo-evidence-capture.ts --limit=10     # 10 prompts × 3 engines (~12 min)
npx tsx geo-evidence-capture.ts                # full run 100 prompts × 3 engines (~2h wall-clock)
npx tsx geo-evidence-capture.ts --engines=claude-sdk,claude-cli  # subset engines
```

Le script est **idempotent** : il skip les `<prompt-hash>.json` déjà capturés. Permet retry safe en cas d'interruption.

## Caveat méthodologique gravé (à reporter dans le rapport final)

- **2-LLM-families measurement** : visibility mesurée sur Claude (Anthropic) + GPT/Codex (OpenAI). Couvre les 2 familles dominantes 2026. ChatGPT direct, Gemini, Perplexity restent non-mesurés (Phase C escalation conditionnelle).
- **Cross-LLM convergence interprétation** :
  - Claude ET Codex convergent (gap ou pas) → signal fort
  - Claude SDK ↔ Claude CLI divergent → instabilité de mesure (debug avant interprétation)
  - Claude ↔ Codex divergent → résultat model-specific, investigation ciblée
- **Signaux scoring N/A documentés** dans `sampling-weights.yaml` (funnel conversion, SAV frequency, marge par prompt, R-role classification) — la décision est de NE PAS prétendre les avoir.

## Anti-creep (lock plan v3 round 11)

- B3 produces proposals, never entities
- No canonical ontology creation in Phase B
- Output autorisé en B3 = markdown-only human-readable proposals
- Output INTERDIT en B3 : taxonomies, IDs, graph edges, confidence scores, embeddings, clusters, aliases, normalized entities

## Sequencing strict

```
B1 (capture) → B2 (Operational Fulfillment overlay) → DÉCISION → B3 (wiki extraction, CONDITIONAL si signal ≥ 2%)
```

B3 ne démarre PAS systématiquement. Gate explicite documenté dans `2026-05-24-geo-opportunity-empirical-report.md`.

## Canon refs

- ADR-081 G9 + G10 (vault, mergé via #305)
- `.claude/canon-mirrors/exploration-budget.md` (hash-locked mirror)
- `scripts/governance/validate-exploration-probe.sh` (lint single check au PR final)
- `governance-vault/ledger/policies/exploration-budget.md` (exec contract détaillé)
