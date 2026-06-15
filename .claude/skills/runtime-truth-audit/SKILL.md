---
name: runtime-truth-audit
description: Use when auditing runtime drift vs spec/registry (dead services, RPC drift, STABLE functions that write, partitions without rotation, attribution columns never written, orphan feature flags, PGRST203 overload ambiguity). Triggers — "audit runtime drift", "detect dead service", "check partition rotation", "verify attribution write path", "audit feature flags", "detect ambiguous RPC overloads". 7 atomic checks, each tied to a real PR incident or MEMORY reference. Informational only (autofixable=false strict V1).
type: technique
status: experimental
owners: ['@ak125']
domain: D15
runtime_class: read-only
llm_safe: true
last_verified: '2026-05-23'
license: Internal - Automecanik
compatibility: Claude Code in the AutoMecanik monorepo. Reads audit/registry/canonical.json + pg_proc via supabase MCP. No mutations.
allowed-tools: Read Grep Glob Bash
tags: [audit, runtime, governance, adr-058, prevention]
metadata:
  version: "0.1"
  argument-hint: "[check-name or 'all']"
  spec: agentskills.io/specification v1
---

# Runtime Truth Audit

Audite les **dérives runtime vs spec/registry** : ce qui est déclaré dans
`audit/registry/canonical.json` + `.spec/00-canon/` mais qui ne se comporte
pas comme attendu en runtime, ou inversement.

**Origine** : 6 PRs PROD récentes (#693/#695/#696/#697 + cas préventifs
documentés MEMORY) ont révélé des dérives silencieuses entre la spec et
le runtime. Chaque check de ce skill correspond à un pattern d'incident
réel ou un risque documenté.

## Quand proposer ce skill

- Triggers utilisateur : "audit runtime", "détecte dead code",
  "vérifie attribution", "check partition rotation", "audit feature flags"
- Après un incident PROD inattendu (5xx silencieux, attribution manquante,
  service non instancié)
- Avant une release majeure (`v*` tag) pour scanner les dérives non détectées

## Périmètre

Ce skill **ne fait que lire**. Il **ne modifie aucun fichier**, **ne crée
aucune PR**, **n'écrit en DB que via supabase MCP read-only**. Output =
rapport markdown structuré listant les findings par check.

## Architecture atomique (7 checks)

```
.claude/skills/runtime-truth-audit/
  SKILL.md                          # ce fichier (orchestration)
  checks/
    nest-dead-services.md           # @Injectable jamais résolus DI (#696)
    rpc-registry-drift.md           # registry L2 RPC ↔ pg_proc divergence
    pg-stable-write.md              # STABLE/IMMUTABLE qui écrivent (#693)
    partition-cron-gap.md           # partitions sans cron.job (#697, #698)
    attribution-write-gap.md        # colonnes attribution sans writer (#695)
    orphan-runtime-flags.md         # feature flags morts (préventif)
    rpc-overload-ambiguity.md       # overloads PostgREST ambigus → PGRST203 (#993)
```

**Un check = une responsabilité** (≤ 100 lignes). Pas de check "mega"
qui regroupe plusieurs patterns. Si un check tente de couvrir 2 patterns
distincts, le scinder.

## Sources de vérité

Chaque check lit des sources **canoniques**, jamais des grep markdown
spéculatifs :

| Source | Usage |
|---|---|
| `audit/registry/canonical.json` | files / RPC declared / db_tables |
| `.spec/00-canon/repository-registry/*.yaml` | ownership, domains, glob |
| `pg_proc` via supabase MCP | volatility, prosrc, écritures réelles |
| `pg_partitioned_table` + `cron.job` via supabase MCP | partition rotation |
| `__feature_flags` table + `.env.example` via supabase MCP | flags actifs |
| Grep AST ciblé (backend/src + frontend/app) | uniquement pour confirmer écriture |

**Interdit** : grep aveugle de markdown, regex sur tout le repo, inférence
LLM sur la spec. Si une donnée canonique n'est pas accessible (registry
stale, MCP indisponible), le check **fail explicitement** — jamais skip.

## Métadonnées par check

Chaque `checks/*.md` porte un frontmatter conforme au schéma local du
skill (vérifié par convention review humaine, pas par schema CI) :

```yaml
---
check: nest-dead-services
severity: high                       # critical | high | medium | low
confidence: medium                   # high | medium | low
expected_false_positive_rate: 0.20   # 0.0-1.0 cohérent avec confidence
autofixable: false                   # TOUJOURS false en V1 — informational only
sources:
  - audit/registry/canonical.json
  - backend/src/**/*.ts (grep ciblé)
incidents_proven:
  - "#696 (2026-05-22, OrderStatusService doublon mort retiré)"
# OU risk_documented: pour préventifs sans incident PROD encore
---
```

### Taxonomie severity (anti-dérive)

- `critical` : prod corruption | silent data loss | GSC 5xx | SEO deindex risk
- `high` : attribution broken | runtime drift vs registry | queue inconsistency
- `medium` : stale config | orphan flag | unused feature
- `low` : cleanup | advisory | naming inconsistency

### confidence × FPR

- `high` ⇒ `expected_false_positive_rate ≤ 0.10`
- `medium` ⇒ `0.10 < FPR ≤ 0.30`
- `low` ⇒ `FPR > 0.30` (à reviewer ou retirer)

### autofixable = false (strict V1)

**Pas d'auto-remediation Claude.** Informational only. Réévaluation
conditionnée à 6 mois de mesure + `FPR < 0.01` + autofix trivial.

## Procédure (orchestrateur)

1. Si l'utilisateur demande "audit runtime drift" sans préciser :
   exécuter les 6 checks dans l'ordre listé ci-dessus, agréger les findings.
2. Si l'utilisateur cite un check spécifique (ex: "check partition rotation") :
   exécuter uniquement ce check.
3. Format de sortie attendu :
   ```markdown
   # Runtime Truth Audit Report
   Date : YYYY-MM-DD
   Checks exécutés : N/6

   ## Findings par severity
   - critical : X
   - high     : Y
   - medium   : Z
   - low      : W

   ## Détail par check
   ### {check-name} (severity, confidence, FPR)
   - finding 1 (source, ligne, contexte)
   - finding 2 ...
   ```
4. **Ne pas auto-créer de PR**. Le rapport est lu par l'humain qui décide
   des actions à prendre.

## Garde-fous (anti-AST-universe)

Les checks ne doivent PAS dériver vers :
- Un linter maison (eslint/ts-prune/knip/madge couvrent déjà)
- Un static analyzer généraliste (CodeQL existe)
- Une analyse exhaustive "tant qu'on y est" du repo

Si un check tente de devenir mega-analyzer, **le retirer ou le scinder**
en checks atomiques nouveaux. Croissance organique interdite.

## Règle d'admission d'un nouveau check

Un check `checks/<new-name>.md` n'est mergé que si :

1. `incidents_proven:` (préféré) OU `risk_documented:` est renseigné
2. `severity:` cite un critère de la taxonomie ci-dessus
3. `expected_false_positive_rate:` cohérent avec `confidence:`
4. `autofixable: false` (V1 stricte)
5. Logique ≤ 100 lignes, 1 responsabilité, sortie JSON structuré
6. Pas de duplication avec un outil existant (`ts-prune`, `knip`,
   `madge`, `eslint`, `CodeQL`)

## Mémoires liées

- `feedback_no_silent_fallback.md` — fail explicite, pas de skip
- `feedback_verify_existing_first.md` — réutiliser sources canoniques
- `reference_postgrest_stable_function_write_readonly.md` — pattern #693
- `feedback_audit_needs_runtime_wiring_and_db_truth.md` — runtime+DB, pas
  file-vs-file
- `feedback_v1_first_dont_build_ultimate_engine_too_early.md` — STOP at V1
