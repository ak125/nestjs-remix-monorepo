# SEO Vault Verify — Skill Design

- **Date** : 2026-04-24
- **Status** : Draft (design approved, implementation pending)
- **Owner** : automecanik.seo@gmail.com
- **Scope** : Créer un skill `.claude/skills/seo-vault-verify/` pour auditer un vault Obsidian SEO (ZIP ou dossier) et produire un rapport d'audit reproductible, audit-grade, sans auto-fix.

---

## 1. Contexte

L'utilisateur fournit un vault Obsidian SEO (`automecanik-seo-vault.zip`, 27 fichiers) contenant des artefacts régénérés autour d'ADR-002 (maillage interne first). Huit fichiers ont été mis à jour avec des changements spécifiques et 17/27 fichiers devraient référencer ADR-002.

Besoin : **vérifier que le vault livré correspond à ce qui est annoncé**, de façon robuste, reproductible, et réutilisable à chaque future itération du vault — sans bricolage, sans auto-fix, sans délégation au LLM de vérifications mécaniques.

## 2. Non-objectifs

- ❌ Rédiger / modifier du contenu dans le vault
- ❌ Committer le vault dans le monorepo
- ❌ Remplacer `content-audit` (audit routes Remix) ou `seo-gamme-audit` (audit site production)
- ❌ Appeler une API externe (Supabase, GitHub, GSC)
- ❌ Produire un verdict `COMPLETE` / `VALIDATED` (interdit par agent-exit-contract.md)

## 3. Architecture

### 3.1 Principe directeur

> 80 % déterministe (scripts) / 20 % LLM (1 subagent judgment unique).

Vérifier de façon binaire tout ce qui peut l'être (grep, YAML parsing, regex, comptages).
Réserver le LLM à la seule dimension qui requiert du jugement : cohérence stratégique SEO du doctrine maillage (primaire/secondaire, anti-sur-optimisation anchor text, KPIs crédibles).

### 3.2 Arborescence skill

```
.claude/skills/seo-vault-verify/
├── SKILL.md
├── references/
│   ├── expected-changes-v1.yaml        # manifeste canon machine-readable
│   ├── reviewer-seo-judgment.md        # prompt unique LLM
│   └── report-template.md
├── schemas/
│   ├── expected-changes.schema.json
│   ├── check-result.schema.json
│   └── final-report.schema.json
└── scripts/
    ├── vault_extract.py
    ├── check_content.py
    ├── check_crossref.py
    ├── check_obsidian.py
    ├── run_audit.py                    # orchestrator
    └── selftest.py
```

### 3.3 Chemins sortie

- Skill : `.claude/skills/seo-vault-verify/` (versionné monorepo)
- Vault extrait (éphémère) : `/tmp/seo-vault-audit-<sha256[:12]>/`
- Rapport : `.spec/reports/seo-vault-verify-YYYY-MM-DD.md` + `.json`

## 4. Manifeste canonique `expected-changes-v1.yaml`

Le cœur de la robustesse. Encode les 8 régénérations décrites par l'utilisateur en assertions machine-verifiables.

```yaml
version: 1
source_zip_sha256: <auto-rempli à extract>
adr_reference: ADR-002
files:
  - path: 00-Meta/README.md
    must_contain:
      - pattern: "ADR-002"
      - pattern: "Kickoff-Week1"
      - pattern: "pilier/maillage"
      - pattern: "primaire"
        near: "maillage"
        window: 200
    cross_ref_targets:
      - ADR-002-maillage-interne-first
      - Kickoff-Week1

  - path: 00-Meta/Conventions.md
    tags_required:
      - "#pilier/maillage"   # doit être marqué primaire
      - "#pilier/autorite"   # doit être marqué secondaire

  - path: 00-Meta/Glossary.md
    sections_required:
      - title: "Maillage interne"
        min_terms: 11
      - title: "Crawl & indexation"
        min_terms: 6

  - path: 00-Meta/Dataview-queries.md
    sections_required:
      - title: "Maillage interne"
      - title: "Autorité externe opportuniste"
      - title: "Activité récente"

  - path: 02-ADR/ADR-001-entity-architecture.md
    must_contain:
      - pattern: "corollaire maillage"
      - pattern: "ADR-002"
    tags_required:
      - "#pilier/maillage"

  - path: 03-Entities/Gammes/_template-gamme.md
    frontmatter_keys_required:
      - inbound-count
      - outbound-count
      - pr-interne
      - depth-from-home
      - orpheline
    section_required: "Maillage interne"

  - path: 05-Content/_template-gamme-brief.md
    sections_required:
      - title: "Maillage interne associé"
    must_contain:
      - pattern: "10 liens internes entrants"
      - pattern: "J+30"

  - path: 07-Authority/_template-linkable-asset.md
    must_contain:
      - pattern: "opportuniste"
      - pattern: "Intégration au maillage interne"

  - path: 08-Monitoring/_template-gsc-report.md
    sections_required:
      - title: "Performance par pilier"

cross_ref_aggregate:
  adr_002_min_files_referencing: 17
  adr_002_max_files_referencing: 27
```

## 5. Couches d'exécution

| # | Composant | Techno | Rôle | Type |
|---|-----------|--------|------|------|
| 1 | `vault_extract.py` | Python stdlib | Unzip sandboxé `/tmp/seo-vault-audit-<hash>/`, SHA256 du ZIP + chaque fichier, emit manifest JSON des inputs | Déterministe |
| 2 | `check_content.py` | Python stdlib + re | Pour chaque `must_contain` du manifeste : présence de pattern, context window optionnel | Déterministe |
| 3 | `check_crossref.py` | Python stdlib + re | Parse `[[wikilinks]]` + `](file.md)`, résolution cibles, agrégation `adr_002_files_referencing` | Déterministe |
| 4 | `check_obsidian.py` | Python + `pyyaml` | `yaml.safe_load` sur frontmatter (--- ... ---), regex Dataview `` ```dataview\n...\n``` `` | Déterministe |
| 5 | Subagent LLM `reviewer-seo-judgment` | general-purpose agent | Jugement : stratégie maillage primaire/secondaire cohérente ? anti-sur-opt anchor text crédible ? KPIs réalistes ? Sortie schema-enforced JSON | LLM, output schema-constrained |
| 6 | `run_audit.py` | Python stdlib + jsonschema | Orchestrator : enchaîne 1-5, valide JSON schemas inter-couches, agrège → rapport final | Déterministe |

## 6. Safety nets

1. **Input sandbox** — extraction dans `/tmp/seo-vault-audit-<hash>/`, lecture seule
2. **JSON Schema validation** sur chaque sortie inter-couche via `jsonschema` — refus si non-conforme
3. **Selftest embarqué** — `python scripts/selftest.py` exécute sur ZIP de référence ; verdict attendu encodé ; run obligatoire post-install
4. **Evidence immutability** — SHA256 du ZIP archivé dans rapport ; si ZIP modifié à posteriori, détectable
5. **Idempotent** — mêmes inputs → même rapport (modulo timestamp)
6. **Exit contract obligatoire** — rapport structuré en 5 sections : `scan` / `analysis` / `correction-proposed` / `validation` / `verdict` + coverage manifest
7. **Zero auto-fix** — skill ne modifie jamais le vault
8. **Zero side-effect monorepo** — extraction `/tmp`, rapport `.spec/reports/`
9. **Zero network** — 100 % local, aucun appel API

## 7. Exit contract (agent-exit-contract.md)

Statuts autorisés pour verdict final :

- `SCOPE_SCANNED` — si toutes les assertions manifeste passent + cross-ref OK + judgment LLM satisfaisant
- `PARTIAL_COVERAGE` — par défaut (exit-contract rule)
- `REVIEW_REQUIRED` — si assertions passent mais judgment LLM lève des drapeaux
- `INSUFFICIENT_EVIDENCE` — si extraction échoue, fichiers manquants, schemas invalides

Coverage manifest présent dans chaque rapport :

```
scope_requested / scope_actually_scanned / files_read_count
excluded_paths / unscanned_zones
corrections_proposed (liste) / validation_executed (bool)
remaining_unknowns (liste) / final_status
```

## 8. Test cases

Pas de formal eval loop skill-creator (iteration-1/benchmark viewer, etc.) — YAGNI pour un skill d'audit qui sera raffiné à l'usage. Les test cases servent d'acceptance tests avant release :

| ID | Prompt | Expected |
|----|--------|----------|
| 1 | `/seo-vault-verify /opt/automecanik/app/.claude/prompts/R1_ROUTER/automecanik-seo-vault.zip` | Rapport produit ; toutes assertions manifeste vérifiées ; cross-refs ADR-002 comptés ; verdict `SCOPE_SCANNED` ou `REVIEW_REQUIRED` |
| 2 | `/seo-vault-verify` (sans arg) | Erreur claire : "ZIP ou dossier requis" ; code retour ≠ 0 ; pas de rapport produit |
| 3 | `/seo-vault-verify /tmp/fake.zip` (ZIP corrompu) | Échec gracieux ; verdict `INSUFFICIENT_EVIDENCE` ; pas de crash |

`selftest.py` encode le cas 1 et vérifie le verdict attendu.

## 9. Dépendances

- Python 3 (stdlib : `zipfile`, `hashlib`, `re`, `json`, `pathlib`, `subprocess`)
- `pyyaml` (parse frontmatter Obsidian)
- `jsonschema` (validation inter-couche)
- `general-purpose` subagent (1 invocation pour judgment SEO)
- Aucune dépendance network / externe

## 10. Livrables exécution one-shot (cette session)

1. Skill opérationnel committé monorepo branche dédiée depuis `main`
2. `expected-changes-v1.yaml` rempli à partir de la description utilisateur
3. Selftest vert sur le ZIP fourni
4. Rapport `.spec/reports/seo-vault-verify-2026-04-24.md` + `.json` avec verdict honnête
5. PR monorepo dédiée (ne pas hériter de `feat/r8-enricher-motorisation-specific-queries`)

## 11. Références

- `.claude/rules/agent-exit-contract.md` — contrat de sortie obligatoire, anti-overclaim
- `CLAUDE.md` — governance vault vs monorepo (pas de gouvernance dans monorepo)
- `.claude/skills/governance-vault-ops/SKILL.md` — pattern d'opération vault (référence, pas overlap)
- `.claude/skills/seo-gamme-audit/SKILL.md` — pattern de skill audit SEO
- Superpowers `brainstorming` + `skill-creator` skills — méthode de création

## 12. Ce qui reste ouvert

- Versioning du manifeste : `expected-changes-v1.yaml` → v2 lors du prochain vault refresh (garder historique)
- Hook CI éventuel : si le ZIP vault devient artefact de release, ajouter étape CI qui run `/seo-vault-verify` et échoue si verdict ≠ `SCOPE_SCANNED` (hors scope cette session)

## 13. Coverage Manifest (meta de ce spec)

```
scope_requested : design spec skill seo-vault-verify
scope_actually_scanned : existing skills (4 relevant), ZIP vault (27 files listed)
files_read_count : ~5 (CLAUDE.md, exit-contract, governance-vault-ops SKILL.md, content-audit SKILL.md, seo-content-architect SKILL.md)
excluded_paths : .claude/plugins/, docs/ non-specs, node_modules
unscanned_zones : implémentation scripts Python (pending writing-plans phase)
corrections_proposed : aucune (design phase, pas de code écrit)
validation_executed : false
remaining_unknowns : comportement réel subagent LLM sur reviewer-seo-judgment (sera validé via selftest)
final_status : PARTIAL_COVERAGE (design seulement, implémentation et tests pending)
```

## 14. Exit Conditions

- [ ] Design validé par l'utilisateur (ce document)
- [ ] Plan d'implémentation écrit (writing-plans skill, next step)
- [ ] Branche dédiée créée depuis `main` (pas héritée)
- [ ] Skill implémenté (SKILL.md, references/, schemas/, scripts/)
- [ ] Selftest vert
- [ ] Rapport one-shot produit avec verdict honnête
- [ ] PR monorepo créée
