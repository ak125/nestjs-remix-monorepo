# `.claude/skills/` — AutoMecanik Skill canon

> Cette page est le **guide de création / modification** d'un Claude Code skill dans le monorepo AutoMecanik. Le contrat technique vit dans [`.spec/00-canon/ai-registry/skill.schema.json`](../../.spec/00-canon/ai-registry/skill.schema.json) (SoT JSON Schema). Si une règle prose diverge du schema, **le schema gagne**.

## TL;DR

1. Crée un répertoire `.claude/skills/<kebab-case-name>/`
2. Ajoute un `SKILL.md` avec le **frontmatter canonique** (voir template ci-dessous)
3. Lance `node scripts/governance/validate-skills-frontmatter.js --skill <name>` → doit retourner `ok`
4. Lance `node scripts/governance/build-skills-registry.js` → doit incrémenter `totalSkills` dans `.spec/00-canon/ai-registry/skills.registry.json`
5. Le glob `.claude/skills/**` est déjà couvert par `ownership.yaml` — pas de glob à rajouter pour un nouveau skill
6. CI : le job `Skills canon gate` validera automatiquement (warn-only en Phase 0, hard-fail dès PR-V2.5)

## Frontmatter canonique (template)

```yaml
---
# === REQUIS (agentskills.io v1) ===
name: <kebab-case>                        # doit matcher dirname
description: >                            # contient OBLIGATOIREMENT "Use when"
  Use when <triggers concrets>. <Ce que le skill produit>. Triggers — "X", "Y", "Z".

# === REQUIS (gouvernance AutoMecanik) ===
type: technique                           # technique | reference | discipline
status: experimental                      # experimental | stable | deprecated
owners: ['@your-handle']                  # min 1, doit matcher ownership.yaml
domain: D15                               # D1..D15 per domains.yaml
runtime_class: read-only                  # read-only | mutating | privileged
llm_safe: true                            # false si génère faits métier hallucinables

# === RECOMMANDÉ ===
last_verified: '2026-MM-DD'               # touch on modification
license: Internal - Automecanik
compatibility: Designed for Claude Code in AutoMecanik monorepo. Stack — …
allowed-tools: Read Grep Glob             # space-separated, agentskills.io v1 experimental
tags: [scope, role, stack, ...]

# === METADATA libre ===
metadata:
  version: "1.0"
  argument-hint: "[args]"
  spec: agentskills.io/specification v1
---
```

## Champs canon — sémantique

### `type` (taxonomy writing-skills)

| Valeur | Sens | Exemples |
|---|---|---|
| `technique` | Méthode avec étapes à suivre | `frontend-design`, `responsive-audit`, `code-review` |
| `reference` | Documentation / lookup | `ui-ux-pro-max` |
| `discipline` | Enforcement d'une règle | `db-migration`, `governance-vault-ops` |

### `runtime_class` (profil d'effets de bord)

| Valeur | Effets | Exemple |
|---|---|---|
| `read-only` | Inspection / audit, zéro mutation | `responsive-audit`, `code-review` |
| `mutating` | Édite fichiers locaux, ouvre PR, run npm | `frontend-design`, `session-log` |
| `privileged` | Touche secrets, infra, deploys, DDL | `db-migration`, `governance-vault-ops` |

### `llm_safe`

- `true` si les outputs sont dérivés déterministiquement de fichiers + tools (pas d'invention LLM de faits métier)
- `false` si le skill génère du contenu métier potentiellement hallucinable (slug, prix, compatibilité véhicule) → DOIT s'appuyer sur RAG + vault (voir `feedback_rag_vault_always_first`)

### `domain`

- Skills d'AI Governance Control Plane → **D15** Security & Governance
- Domain de la donnée touchée disponible dans le frontmatter via `tags:` pour la recherche

## Description = trigger CSO (critique)

La `description` est le seul champ que Claude lit pour décider de charger le skill. Doctrine canon :

1. **Commencer par `Use when …`**
2. Lister 2-4 triggers concrets entre guillemets : `"build a [component]"`, `"audit responsive"`, etc.
3. **Pas de résumé de workflow** (« generates X », « produces Y ») — ça crée le workflow-summary trap où Claude suit la description et zappe le body
4. Multilingue OK (FR + EN) — cohérent avec le contenu

Cf. mémoire [`feedback_skill_sot_drift_audit_pattern`](../../../home/deploy/.claude/projects/-opt-automecanik-app/memory/feedback_skill_sot_drift_audit_pattern.md) pour le pattern audit.

## Validation locale (avant de commit)

```bash
# 1. Schema + cross-refs ownership + domains
node scripts/governance/validate-skills-frontmatter.js --skill <name>

# 2. JSON output pour debug
node scripts/governance/validate-skills-frontmatter.js --json | jq

# 3. Régénérer le registry projection (committed)
node scripts/governance/build-skills-registry.js

# 4. Vérifier registry up-to-date (sans modifier)
node scripts/governance/build-skills-registry.js --check
```

## CI ratchet (enforcement progressif)

| Phase | PR | Comportement | Critère de sortie |
|---|---|---|---|
| **Phase 0** | PR-V2 (this) | warn-only (`continue-on-error: true`), summary visible | observation 7 jours sans régression |
| **Phase 1** | PR-V2.5 | hard-fail sur **new skills** uniquement | 7+ jours stable |
| **Phase 2** | PR-V3 | hard-fail sur **tous skills** + required check branch protection | promote ADR vault |

Modèle de séquençage : ADR-058 PR-G (Repository Control Plane). Validé empiriquement, non spéculatif.

## Skills existants

| Skill | Type | Status | Runtime | LLM-safe | Domain |
|---|---|---|---|---|---|
| `code-review` | technique | stable | read-only | ✓ | D15 |
| `db-migration` | discipline | stable | privileged | ✗ | D15 |
| `frontend-design` | technique | stable | mutating | ✓ | D15 |
| `governance-vault-ops` | discipline | stable | privileged | ✗ | D15 |
| `responsive-audit` | technique | stable | read-only | ✓ | D15 |
| `session-log` | technique | stable | mutating | ✓ | D15 |
| `ui-ux-pro-max` | reference | stable | read-only | ✓ | D15 |
| `vehicle-ops` | technique | stable | mutating | ✗ | D15 |

Source-of-truth machine-readable : [`.spec/00-canon/ai-registry/skills.registry.json`](../../.spec/00-canon/ai-registry/skills.registry.json) (généré).

## Anti-patterns à éviter

- ❌ Frontmatter au top-level pour `version` / `argument-hint` → mettre sous `metadata:`
- ❌ Description sans « Use when » → CSO trigger manquant, skill jamais invoqué
- ❌ Description qui résume le workflow → workflow-summary trap
- ❌ Body sans frontmatter du tout → spec broken silently (cf. `governance-vault-ops` pré-PR-V2)
- ❌ Hex couleur / nom de font hardcodés sans référence au SoT → drift quasi-certain dans 6 mois (cf. `feedback_skill_sot_drift_audit_pattern`)
- ❌ Phrases motivationnelles (« Don't hold back », « Claude is capable of … ») → non-actionnable, encourage over-engineering

## Liens canon

- Spec normative : <https://agentskills.io/specification>
- TDD doctrine pour skills : `superpowers:writing-skills` (RED/GREEN/REFACTOR + CSO + bulletproofing)
- Schema : [`.spec/00-canon/ai-registry/skill.schema.json`](../../.spec/00-canon/ai-registry/skill.schema.json)
- Validator : [`scripts/governance/validate-skills-frontmatter.js`](../../scripts/governance/validate-skills-frontmatter.js)
- Registry projection : [`scripts/governance/build-skills-registry.js`](../../scripts/governance/build-skills-registry.js)
- CI gate : [`.github/workflows/skills-canon-gate.yml`](../../.github/workflows/skills-canon-gate.yml)
