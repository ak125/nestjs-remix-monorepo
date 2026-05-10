---
name: seo-vault-verify
description: "Audit reproductible vault Obsidian SEO (ZIP ou dir) : 8 fichiers regen + SHA256 non-régression + cross-refs ADR. Use when user mentions vérifier vault, audit vault SEO, valider livrable Obsidian, ADR-002 maillage."
argument-hint: "<path-zip-or-dir> [--manifest <path.yaml>]"
allowed-tools: Read, Bash, Glob, Grep, Agent
version: "1.0"
---

# SEO Vault Verify — v1.0

Audit reproductible audit-grade d'un vault Obsidian SEO. 80 % déterministe (scripts Python) / 20 % LLM (1 subagent judgment unique).

## Quand utiliser

| Contexte | Commande |
|----------|----------|
| Vault SEO livré en ZIP | `/seo-vault-verify path/to/vault.zip` |
| Vault déjà extrait | `/seo-vault-verify path/to/vault-dir/` |
| Manifeste custom | `/seo-vault-verify path/vault.zip --manifest references/expected-changes-v2.yaml` |

## Workflow

1. **Extract** — `scripts/vault_extract.py` dézippe dans `/tmp/seo-vault-audit-<sha256[:12]>/`, calcule SHA256 du ZIP + chaque fichier
2. **Content checks** — `scripts/check_content.py` applique les assertions `must_contain`, `sections_required`, `tags_required`, `frontmatter_keys_required` du manifeste (Unicode NFC, case-insensitive défaut)
3. **Cross-ref checks** — `scripts/check_crossref.py` parse `[[wikilinks]]` + `](file.md)`, résout cibles, agrège `adr_002_files_referencing`
4. **Obsidian integrity** — `scripts/check_obsidian.py` valide frontmatter YAML + Dataview code blocks
5. **SEO judgment** — 1 subagent `general-purpose` reçoit `references/reviewer-seo-judgment.md` et produit JSON entre `<output>...</output>`. Parsed + validé par orchestrator, 1 retry si échec
6. **Consolidate** — `scripts/run_audit.py` agrège tout en rapport markdown + JSON selon `references/report-template.md`

## Manifeste

`references/expected-changes-v1.yaml` = source de vérité des assertions. Toute modification passe en v2 (`expected-changes-v2.yaml`), historique préservé.

## Exit contract

Verdicts autorisés : `SCOPE_SCANNED`, `PARTIAL_COVERAGE`, `REVIEW_REQUIRED`, `INSUFFICIENT_EVIDENCE`. Jamais `COMPLETE` / `VALIDATED`. Rapport avec 5 sections (scan/analysis/correction-proposed/validation/verdict) + coverage manifest obligatoire.

## Safety

- Zero auto-fix sur le vault
- Extraction sandboxée `/tmp/`
- Zero network / zero API externe
- Zero side-effect monorepo (rapport dans `.spec/reports/` uniquement)

## Selftest

`python scripts/selftest.py [--zip <path-zip>]` exécute 6 cas d'acceptance (happy-path + fail-detection). ZIP optionnel : cas 2-3 et fixtures 4-6 générées in-memory. Cas 1 skip si ZIP absent.

## Références

- `references/expected-changes-v1.yaml` — manifeste canon
- `references/reviewer-seo-judgment.md` — prompt subagent
- `references/report-template.md` — structure rapport
- `schemas/*.schema.md` — structures documentées (stdlib-only, pas JSON Schema lib)
- Spec : `docs/superpowers/specs/2026-04-24-seo-vault-verify-design.md`
- Plan : `docs/superpowers/plans/2026-04-24-seo-vault-verify.md`
