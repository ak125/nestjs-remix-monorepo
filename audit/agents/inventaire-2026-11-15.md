# Inventaire des agents — 2026-11-15 (Mandat AB)

> Relevé daté, laissé tel quel. Mise à jour du 2026-11-18 (complément AB-2) :
> `docs/audit/mandat-ab2-20261118/README.md`. Les règles AI1, AI5 et AI6 et les fiches citées ici
> viennent du Vault, qui n'est plus normatif (décision 72) ; les sous-agents sont désormais
> inventoriés dans `skills.registry.json` (`subagents[]`), et `agent-operating-map.patch` ne
> s'applique plus.

- Statut AEC : `PARTIAL_COVERAGE` (voir manifeste en fin de document).
- Base : `origin/main` = `c70c4025fa08e40193a9912182c9e0f2896db2d8`.
- Ce document n'active rien. Il prépare des décisions réservées à l'owner.
  Fusions et retraits : proposés, pas faits. Patch de la carte : préparé,
  pas appliqué.

## 1. Sources et méthode

Les trois sources sont celles du relevé du mandat (15 nov. 2026, 13:31 UTC) :

| Source | Chemin | Entrées |
|---|---|---|
| S1 — sous-agents Claude Code des workspaces | `workspaces/seo-batch/.claude/agents/*.md` (39), `workspaces/marketing/.claude/agents/*.md` (3) ; exclu : `workspaces/seo-batch/.claude/agents/_shared/kp-shared-output.md`, gabarit partagé sans en-tête `name`, donc pas un agent (`git ls-files` en compte 43) | 42 |
| S2 — agents Paperclip | `agents/{ceo,cmo,cpo,cto,rag-lead,seo-content,seo-qa}/AGENTS.md` | 7 |
| S3 — carte d'exploitation | `.spec/00-canon/ai-registry/agent-operating-map.yaml` : 5 `surfaces` + 5 `handoffs` + 24 `departments` + 10 `department_handoffs` | 44 |

Aucun `.claude/agents/` n'existe à la racine du dépôt ni sous `~/.claude/agents/`.

Preuves d'usage recherchées :

- **Traces `.jsonl`.** Les 411 fichiers sous `/home/deploy/.claude/projects/` ont été parcourus, du plus ancien (2026-10-10) au 2026-11-15.
  - Méthode : extraction des `tool_use` `Agent`/`Task` des messages assistant, comptés par `subagent_type`.
  - Résultat : general-purpose 82, fork 12, web-fetch 10, Explore 9, Plan 1, claude-code-guide 1.
  - **Aucun appel d'un des 42 sous-agents de S1.**
  - Les traces des workspaces (`…-workspaces-seo-batch`, `…-workspaces-marketing`, `…-workspaces-wiki`, 2026-11-09) ne contiennent aucun appel non plus.
  - Limites :
    - la rétention est de 14 jours (`cleanupPeriodDays: 14` dans `/home/deploy/.claude/settings.json`) ; rien d'antérieur au 2026-10-10 n'est observable ;
    - un lancement `claude --agent <nom>` (agent de session) n'est pas détecté par cette méthode ;
    - les sessions hors de ce compte ne sont pas observables.
- **Runs GitHub.**
  - Aucun workflow n'invoque un agent de S1 ou de S2.
  - Le seul workflow Claude, `dependabot-claude-review.yml`, est hors des trois sources ; ses 100 derniers runs sont `skipped`.
  - S3 est lue par `pilote-file.yml` (run 43717228369, 2026-11-15T13:06:09Z, success) et `skills-canon-gate.yml` (run 43713241775, 2026-11-15T12:19:22Z, success).
- **Commits.** `git log -1 -- <fichier>` donne la date de dernière modification. Une modification n'est pas un usage.

Niveaux : échelle de `.claude/skills/capability-acceptance/SKILL.md`.

| Niveau | Signification |
|---|---|
| L0 | documentée |
| L1 | implémentée et branchée |
| L2 | testée isolément |
| L3 | intégrée et observée en DEV/PREPROD |
| L4 | opérationnelle |

Colonne KPI (AI1) : l'indicateur exigé est un `metric_id` mesuré automatiquement (`ledger/rules/rules-ai-cos.md` v1.0.0, AI1). ADR-129 D5 constate qu'il n'existe dans aucune fiche.

Colonne rattachement (AI5) : deux formulations coexistent.

- `rules-ai-cos.md` v1.0.0 sur `main` exige `reports_to`, `sponsor` et `squad`.
- ADR-129 D5 (accepted) reformule AI5 : « tout agent a une fiche au catalogue dont le champ `owner` est renseigné ». Sa PR de texte n'est pas encore appliquée.

L'inventaire relève donc la fiche Vault et son `owner`, et cite `reports_to` quand le fichier l'écrit.

Colonne département : rôles actifs d'ADR-128 D2 = 02, 06, 07, 08, 10, 21, 22 ; 23 pilote. Pour S1, aucun fichier ne déclare de département. L'attribution est **déduite** du rôle SEO ou marketing, et doit être confirmée.

## 2. S1 — Sous-agents Claude Code des workspaces (42)

Méthode :

- frontmatter lu sur chaque fichier ;
- comptage des citations dans `backend/src`, `frontend/app`, `scripts`, `.github` et `packages`, hors `.claude/agents/` ;
- fiche Vault cherchée dans `ledger/agents/ai-cos/AGENT-prompt-*.md` et `ledger/agents/registry/REG-001-agents.md`.

| # | Chemin | Rôle déclaré (`role:`) | KPI (AI1) | Rattachement (AI5) | Dépt D2 (déduit) | Dernier usage prouvé | Niveau | Doublon / remplacement |
|---|---|---|---|---|---|---|---|---|
| 1 | `workspaces/marketing/.claude/agents/customer-retention-agent.md` | `CUSTOMER_RETENTION` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 04 marketing (hors rôles actifs D2) | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 2 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 2 | `workspaces/marketing/.claude/agents/local-business-agent.md` | `LOCAL_BUSINESS` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 04 marketing (hors rôles actifs D2) | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 4 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 3 | `workspaces/marketing/.claude/agents/marketing-lead-agent.md` | `MARKETING_LEAD` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 04 marketing (hors rôles actifs D2) | inconnu : 0 appel dans les traces ; dernier commit 90f70c6b2c 2026-10-30 (modification, pas usage) ; 3 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 4 | `workspaces/seo-batch/.claude/agents/agentic-critic.md` | `AGENTIC_ENGINE` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 06 content | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 6 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 5 | `workspaces/seo-batch/.claude/agents/agentic-planner.md` | `AGENTIC_ENGINE` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 06 content | inconnu : 0 appel dans les traces ; dernier commit c70c4025fa 2026-11-15 (modification, pas usage) ; 4 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 6 | `workspaces/seo-batch/.claude/agents/agentic-solver.md` | `AGENTIC_ENGINE` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 06 content | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 4 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 7 | `workspaces/seo-batch/.claude/agents/blog-hub-planner.md` | `FOUNDATION` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit f24b7703ea 2026-05-18 (modification, pas usage) ; 2 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 8 | `workspaces/seo-batch/.claude/agents/brief-enricher.md` | `FOUNDATION` | absent (aucun `metric_id`) | fiche Vault `AGENT-prompt-brief-enricher`, `owner: SEO Team`, statut `active` | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 4 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 9 | `workspaces/seo-batch/.claude/agents/conseil-batch.md` | `R3_CONSEILS` | absent (aucun `metric_id`) | fiche Vault `AGENT-prompt-conseil-batch`, `owner: SEO Team`, statut `active` | 06 content | inconnu : 0 appel dans les traces ; dernier commit 7d3f302370 2026-10-31 (modification, pas usage) ; 1 fichier(s) de code le citent | L0 (neutralisé : `disable-model-invocation: true`, `tools: [Read]`) | remplacé par seo-content-loop (corps retiré) |
| 10 | `workspaces/seo-batch/.claude/agents/keyword-planner.md` | `FOUNDATION` | absent (aucun `metric_id`) | fiche Vault `AGENT-prompt-keyword-planner`, `owner: SEO Team`, statut `active` | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 22 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 11 | `workspaces/seo-batch/.claude/agents/phase1-auditor.md` | `FOUNDATION` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 2 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | méthode reprise par mandat-reception (non retiré : référencé par le code) |
| 12 | `workspaces/seo-batch/.claude/agents/r0-home-execution.md` | `R0_HOME` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 06 content | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 2 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 13 | `workspaces/seo-batch/.claude/agents/r0-home-validator.md` | `R0_HOME` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 2 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 14 | `workspaces/seo-batch/.claude/agents/r1-content-batch.md` | `R1_ROUTER` | absent (aucun `metric_id`) | fiche Vault `AGENT-prompt-r1-content-batch`, `owner: SEO Team`, statut `active` | 06 content | inconnu : 0 appel dans les traces ; dernier commit fa21bfd7a6 2026-07-25 (modification, pas usage) ; 6 fichier(s) de code le citent | L0 (neutralisé : `disable-model-invocation: true`, `tools: [Read]`) | remplacé par seo-content-loop (corps retiré) |
| 15 | `workspaces/seo-batch/.claude/agents/r1-keyword-planner.md` | `R1_ROUTER` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 4 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 16 | `workspaces/seo-batch/.claude/agents/r1-router-validator.md` | `R1_ROUTER` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 4 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 17 | `workspaces/seo-batch/.claude/agents/r2-keyword-planner.md` | `R2_PRODUCT` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 3 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 18 | `workspaces/seo-batch/.claude/agents/r2-product-validator.md` | `R2_PRODUCT` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 1 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 19 | `workspaces/seo-batch/.claude/agents/r3-conseils-validator.md` | `R3_CONSEILS` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 1 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 20 | `workspaces/seo-batch/.claude/agents/r3-image-prompt.md` | `R3_CONSEILS` | absent (aucun `metric_id`) | fiche Vault `AGENT-prompt-r3-image-prompt`, `owner: SEO Team`, statut `active` | 08 media | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 7 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 21 | `workspaces/seo-batch/.claude/agents/r3-keyword-plan-batch.md` | `R3_CONSEILS` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit c70c4025fa 2026-11-15 (modification, pas usage) ; 1 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | r3-keyword-planner (lot séquentiel du même pipeline R3 P0–P3) |
| 22 | `workspaces/seo-batch/.claude/agents/r3-keyword-planner.md` | `R3_CONSEILS` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 2 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | r3-keyword-plan-batch |
| 23 | `workspaces/seo-batch/.claude/agents/r4-content-batch.md` | `R4_REFERENCE` | absent (aucun `metric_id`) | fiche Vault `AGENT-prompt-r4-content-batch`, `owner: SEO Team`, statut `active` | 06 content | inconnu : 0 appel dans les traces ; dernier commit 44b0bbd4aa 2026-10-05 (modification, pas usage) ; 4 fichier(s) de code le citent | L0 (neutralisé : `disable-model-invocation: true`, `tools: [Read]`) | remplacé par seo-content-loop (corps retiré) |
| 24 | `workspaces/seo-batch/.claude/agents/r4-keyword-planner.md` | `R4_REFERENCE` | absent (aucun `metric_id`) | fiche Vault `AGENT-prompt-r4-keyword-planner`, `owner: SEO Team`, statut `active` | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 4 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 25 | `workspaces/seo-batch/.claude/agents/r4-reference-execution.md` | `R4_REFERENCE` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 06 content | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 1 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 26 | `workspaces/seo-batch/.claude/agents/r4-reference-validator.md` | `R4_REFERENCE` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 1 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 27 | `workspaces/seo-batch/.claude/agents/r5-diagnostic-execution.md` | `R5_DIAGNOSTIC` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 06 content | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 1 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 28 | `workspaces/seo-batch/.claude/agents/r5-diagnostic-validator.md` | `R5_DIAGNOSTIC` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 1 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 29 | `workspaces/seo-batch/.claude/agents/r5-keyword-planner.md` | `R5_DIAGNOSTIC` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 2 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 30 | `workspaces/seo-batch/.claude/agents/r6-content-batch.md` | `R6_GUIDE_ACHAT` | absent (aucun `metric_id`) | fiche Vault `AGENT-prompt-r6-content-batch`, `owner: SEO Team`, statut `active` | 06 content | inconnu : 0 appel dans les traces ; dernier commit 99c3ab1e9a 2026-07-19 (modification, pas usage) ; 6 fichier(s) de code le citent | L0 (neutralisé : `disable-model-invocation: true`, `tools: [Read]`) | remplacé par seo-content-loop (corps retiré) |
| 31 | `workspaces/seo-batch/.claude/agents/r6-guide-achat-validator.md` | `R6_GUIDE_ACHAT` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 1 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 32 | `workspaces/seo-batch/.claude/agents/r6-image-prompt.md` | `R6_GUIDE_ACHAT` | absent (aucun `metric_id`) | fiche Vault `AGENT-prompt-r6-image-prompt`, `owner: SEO Team`, statut `active` | 08 media | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 1 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 33 | `workspaces/seo-batch/.claude/agents/r6-keyword-planner.md` | `R6_GUIDE_ACHAT` | absent (aucun `metric_id`) | fiche Vault `AGENT-prompt-r6-keyword-planner`, `owner: SEO Team`, statut `active` | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 5 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 34 | `workspaces/seo-batch/.claude/agents/r6-support-validator.md` | `R6_SUPPORT` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 2 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 35 | `workspaces/seo-batch/.claude/agents/r7-brand-execution.md` | `R7_BRAND` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 06 content | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 2 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 36 | `workspaces/seo-batch/.claude/agents/r7-brand-rag-generator.md` | `R7_BRAND` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 06 content | inconnu : 0 appel dans les traces ; dernier commit 456f16ac94 2026-07-19 (modification, pas usage) ; 3 fichier(s) de code le citent | L0 (neutralisé : `disable-model-invocation: true`, `tools: [Read]`) | remplacé par wiki-proposal-writer (corps retiré) |
| 37 | `workspaces/seo-batch/.claude/agents/r7-brand-validator.md` | `R7_BRAND` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 3 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 38 | `workspaces/seo-batch/.claude/agents/r7-keyword-planner.md` | `R7_BRAND` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 4 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 39 | `workspaces/seo-batch/.claude/agents/r8-keyword-planner.md` | `R8_VEHICLE` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 4 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 40 | `workspaces/seo-batch/.claude/agents/r8-vehicle-execution.md` | `R8_VEHICLE` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 06 content | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 2 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 41 | `workspaces/seo-batch/.claude/agents/r8-vehicle-validator.md` | `R8_VEHICLE` | absent (aucun `metric_id`) | aucune fiche Vault → inconnu | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 1 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |
| 42 | `workspaces/seo-batch/.claude/agents/research-agent.md` | `FOUNDATION` | absent (aucun `metric_id`) | fiche Vault `AGENT-prompt-research-agent`, `owner: SEO Team`, statut `active` | 07 seo | inconnu : 0 appel dans les traces ; dernier commit ea18679fd8 2026-05-04 (modification, pas usage) ; 4 fichier(s) de code le citent | L1 (fichier découvert nativement ; aucun test ni usage observé) | aucun relevé |

Écarts relevés sur S1 :

- **REG-001 et fiches.** REG-001 (v2.5.0, `last_audit` 2026-04-04) et les 12 fiches `AGENT-prompt-*` déclarent `active` / `APPROVED`. C'est le cas aussi pour les 5 agents neutralisés depuis 2026-07 et 2026-10.
- **Fiche sans fichier.** La fiche `AGENT-prompt-content-batch` n'a plus de fichier d'agent.
- **Sans fiche.** 31 des 42 sous-agents n'ont aucune fiche Vault, donc aucun `owner`.
- **Lecture du RAG.** Plusieurs sous-agents actifs lisent le RAG pour produire du contenu ou des plans, par exemple `r3-keyword-planner` (« Lit RAG gamme .md ») et `r3-keyword-plan-batch` (« RAG parse »). Cela contredit l'invariant 4 de `CLAUDE.md` (ADR-031/046) : constat hors périmètre, non corrigé.

## 3. S2 — Agents Paperclip (7)

Chaque fichier déclare : « Tu ne corriges JAMAIS auto. Tu scannes, analyses, rapportes » et « Verdict défaut = PARTIAL_COVERAGE ».

Aucun processus Paperclip ne tourne sur DEV (`ps` du 2026-11-15). La surface `paperclip` de S3 reste déclarée (`can_mutate: false`).

| # | Chemin | Rôle déclaré | KPI (AI1) | Rattachement (AI5) | Dépt D2 (déduit) | Dernier usage prouvé | Niveau | Doublon |
|---|---|---|---|---|---|---|---|---|
| 1 | `agents/ceo/AGENTS.md` | IA-CEO : synthèse d'état global, alertes P1, non souverain | absent (section « KPIs Clés » sans `metric_id`) | « Reporte à : Board humain » ; Vault `agent.ceo.ia` **disabled** (ADR-129) | 23 (pilotage) | inconnu (aucune trace ni run) ; dernier commit 75b64f71de 2026-05-21 | L0 (prompt ; runtime absent sur DEV) | méthode reprise par `mandat-releve` |
| 2 | `agents/cmo/AGENTS.md` | IA-CMO | absent | « Reporte à : IA-CEO » ; Vault `agent.cmo.ia` **disabled** | 04 (hors D2) | inconnu ; dernier commit c70c4025fa 2026-11-15 | L0 | `workspaces/marketing/.claude/agents/marketing-lead-agent.md` (coordination marketing) |
| 3 | `agents/cpo/AGENTS.md` | IA-CPO | absent | « Reporte à : IA-CEO / Board humain » ; Vault `agent.cpo.ia` **disabled** | 20 (hors D2) | inconnu ; dernier commit c2626e5e2a 2026-05-03 | L0 | aucun relevé |
| 4 | `agents/cto/AGENTS.md` | IA-CTO : dérive technique, priorités P1–P3, corrections « EN ATTENTE DE VALIDATION » | absent | « Reporte à : IA-CEO » ; Vault `agent.cto.ia` **disabled** | 21 | inconnu ; dernier commit 75b64f71de 2026-05-21 | L0 | méthode reprise par `mandat-triage-ci` |
| 5 | `agents/rag-lead/AGENTS.md` | RAG Lead (enrichissement RAG, pipeline Phase F) | absent | Vault `agent.rag.lead` **disabled** | 09 (hors D2) | inconnu ; dernier commit 8a62ee5d25 2026-08-13 | L0 | aucun relevé |
| 6 | `agents/seo-content/AGENTS.md` | IA-SEO Master | absent | « Reporte à : IA-CMO » ; Vault `agent.seo.content.lead` **disabled** | 07 | inconnu ; dernier commit 7d3f302370 2026-10-31 | L0 | `keyword-planner` (orchestration éditoriale SEO) |
| 7 | `agents/seo-qa/AGENTS.md` | SEO Analytics / QA | absent | « Reporte à : IA-SEO Master » ; Vault `agent.seo.qa.lead` **disabled** | 07 | inconnu ; dernier commit 75b64f71de 2026-05-21 | L0 | `r*-validator` de S1 (contrôle qualité par rôle) |

## 4. S3 — Carte d'exploitation (44 entrées)

Toutes les lignes ont pour chemin `.spec/00-canon/ai-registry/agent-operating-map.yaml` (dernier commit 8787a2b556, 2026-11-04, #1957). Aucune entrée n'est un agent : `nodes: []`, `loads.agents: []` sur les 5 surfaces.

| # | Entrée | Rôle déclaré | KPI (AI1) | Rattachement (AI5) | Dépt D2 | Dernier usage prouvé | Niveau | Doublon |
|---|---|---|---|---|---|---|---|---|
| 1 | `surfaces/root` (cwd `.`) | dev — Dev backend/frontend, governance, ADR, CI | sans objet (surface, pas un agent) | aucun champ | — | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L1 (déclarée ; `can_mutate: true`) | aucun |
| 2 | `surfaces/seo-batch` (cwd `workspaces/seo-batch`) | content — SEO R0-R8 campaigns + RAG enrich | sans objet (surface, pas un agent) | aucun champ | — | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L1 (déclarée ; `can_mutate: true`) | aucun |
| 3 | `surfaces/marketing` (cwd `workspaces/marketing`) | marketing — G1 cross-unit briefs (ADR-036 Phase 1-2) | sans objet (surface, pas un agent) | aucun champ | — | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L1 (déclarée ; `can_mutate: true`) | aucun |
| 4 | `surfaces/wiki` (cwd `workspaces/wiki`) | knowledge — Wiki proposal sas (ADR-033 Phase 2) | sans objet (surface, pas un agent) | aucun champ | — | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L1 (déclarée ; `can_mutate: false`) | aucun |
| 5 | `surfaces/paperclip` (cwd `agents`) | advisory — Strategic advisory agents (CEO/CTO/CMO/CPO/RAG Lead/SEO Cont | sans objet (surface, pas un agent) | aucun champ | — | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L1 (déclarée ; `can_mutate: false`) | agents/ est aussi la source 2 (Paperclip) ; Vault : fiches disabled |
| 6 | `handoffs/raw-to-wiki` | transfert de pipeline | sans objet | aucun champ | — | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (déclaration ; aucun nœud référencé, `nodes: []`) | aucun |
| 7 | `handoffs/wiki-to-seo-r2-r7` | transfert de pipeline | sans objet | aucun champ | — | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (déclaration ; aucun nœud référencé, `nodes: []`) | aucun |
| 8 | `handoffs/seo-to-marketing` | transfert de pipeline | sans objet | aucun champ | — | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (déclaration ; aucun nœud référencé, `nodes: []`) | aucun |
| 9 | `handoffs/marketing-to-runtime` | transfert de pipeline | sans objet | aucun champ | — | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (déclaration ; aucun nœud référencé, `nodes: []`) | aucun |
| 10 | `handoffs/pipeline-orchestrator-recommends` | transfert de pipeline | sans objet | aucun champ | — | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (déclaration ; aucun nœud référencé, `nodes: []`) | aucun |
| 11 | `departments/supplier` | Achats & Fournisseurs | `supplier_unavailability_cancellations` | `accountable_owner: null` → inconnu | 12 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 12 | `departments/sales` | Commercial & Ventes | `payments_kept` | `accountable_owner: null` → inconnu | 13 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 13 | `departments/pricing` | Pricing | `margin_protected` | `accountable_owner: null` → inconnu | 16 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 14 | `departments/data` | Data & Analytics | `metric_reliability` | `accountable_owner: null` → inconnu | 22 (actif) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 15 | `departments/runtime` | Runtime & Observability | `runtime_health` | `accountable_owner: null` → inconnu | 21 (actif) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 16 | `departments/wiki` | Knowledge RAW & WIKI | `wiki_readiness` | `accountable_owner: null` → inconnu | 09 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 17 | `departments/seo` | Production Pages & SEO | `pages_generating_atc` | `accountable_owner: null` → inconnu | 07 (actif) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 18 | `departments/catalog` | Catalogue & Compatibilité | `compat_and_displayed_availability` | `accountable_owner: null` → inconnu | 10 (actif) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 19 | `departments/diagnostic` | Expertise technique automobile | absent (`kpi_primary` vide) | `accountable_owner: null` → inconnu | 11 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 20 | `departments/marketing` | Marketing & Acquisition | `qualified_demands` | `accountable_owner: null` → inconnu | 04 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 21 | `departments/brand` | Brand & Communication | `brand_trust` | `accountable_owner: null` → inconnu | 05 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 22 | `departments/content` | Contenu éditorial | `reusable_validated_content` | `accountable_owner: null` → inconnu | 06 (actif) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 23 | `departments/media` | Media & Fafa | `demands_from_video` | `accountable_owner: null` → inconnu | 08 (actif) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 24 | `departments/support` | Service Client & Fidélisation | `reactivation_satisfaction` | `accountable_owner: null` → inconnu | 14 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: dormant` déclaré) | aucun |
| 25 | `departments/logistics` | Logistique & Opérations | `delays_and_returns` | `accountable_owner: null` → inconnu | 15 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 26 | `departments/finance` | Finance & Facturation | `billing_integrity` | `accountable_owner: null` → inconnu | 17 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 27 | `departments/people` | People, Formation & Doc | `staff_coverage` | `accountable_owner: null` → inconnu | 24 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: partial` déclaré) | aucun |
| 28 | `departments/governance` | Gouvernance | `limits_respected` | `accountable_owner: null` → inconnu | 02 (actif) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: live` déclaré) | aucun |
| 29 | `departments/strategy` | Stratégie & Scoring | `reuse_improve_create_verdicts` | `accountable_owner: null` → inconnu | 03 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: live` déclaré) | aucun |
| 30 | `departments/ia-agents` | IA, Agents & Automatisation | `useful_capabilities_not_complexity` | `accountable_owner: null` → inconnu | 23 (actif) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: live` déclaré) | aucun |
| 31 | `departments/direction` | Direction générale | absent (`kpi_primary` vide) | `accountable_owner: null` → inconnu | 01 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: dormant` déclaré) | aucun |
| 32 | `departments/legal` | Juridique & Assurances | absent (`kpi_primary` vide) | `accountable_owner: null` → inconnu | 18 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: dormant` déclaré) | aucun |
| 33 | `departments/risk-audit` | Risk & Audit | absent (`kpi_primary` vide) | `accountable_owner: null` → inconnu | 19 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: dormant` déclaré) | aucun |
| 34 | `departments/product` | Produit & Expérience Client | `diagnostic_to_product` | `accountable_owner: null` → inconnu | 20 (hors D2) | lu par `scripts/ops/pilote-file.sh` (run pilote-file 43717228369, 2026-11-15T13:06Z, success) | L1 (`state: dormant` déclaré) | aucun |
| 35 | `department_handoffs/supplier-to-sales-availability` | supplier → sales | sans objet | aucun champ | 12 → 13 | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (`contract_status: planned`) | aucun |
| 36 | `department_handoffs/pricing-to-sales-margin` | pricing → sales | sans objet | aucun champ | 16 → 13 | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (`contract_status: planned`) | aucun |
| 37 | `department_handoffs/runtime-to-data-health` | runtime → data | sans objet | aucun champ | 21 → 22 | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (`contract_status: planned`) | aucun |
| 38 | `department_handoffs/data-to-sales-tracking-integrity` | data → sales | sans objet | aucun champ | 22 → 13 | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (`contract_status: defined`) | aucun |
| 39 | `department_handoffs/wiki-to-seo-readiness` | wiki → seo | sans objet | aucun champ | 09 → 07 | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (`contract_status: planned`) | aucun |
| 40 | `department_handoffs/seo-to-sales-atc-readiness` | seo → sales | sans objet | aucun champ | 07 → 13 | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (`contract_status: planned`) | aucun |
| 41 | `department_handoffs/supplier-to-catalog-availability` | supplier → catalog | sans objet | aucun champ | 12 → 10 | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (`contract_status: planned`) | aucun |
| 42 | `department_handoffs/diagnostic-to-catalog-part` | diagnostic → catalog | sans objet | aucun champ | 11 → 10 | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (`contract_status: planned`) | aucun |
| 43 | `department_handoffs/content-to-seo-supply` | content → seo | sans objet | aucun champ | 06 → 07 | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (`contract_status: planned`) | aucun |
| 44 | `department_handoffs/marketing-to-sales-qualified-demand` | marketing → sales | sans objet | aucun champ | 04 → 13 | lu par `validate-agent-operating-map.js` (run skills-canon-gate 43713241775, 2026-11-15T12:19Z, success) | L0 (`contract_status: planned`) | aucun |

## 5. Proposition AI6 — fusions et retraits

Toutes les lignes sont **proposées seulement**. Chaque retrait se décide par une décision écrite et datée de Marwane (AI6, Human CEO). Aucun fichier n'a été supprimé ni déplacé.

### 5.1 Contreparties des trois créations

| Création | Reprise de | Contrepartie AI6 proposée | Raison | Preuve |
|---|---|---|---|---|
| `mandat-releve` | `agents/ceo/AGENTS.md` (synthèse d'état, lecture seule, PARTIAL_COVERAGE par défaut) | retrait de `agents/ceo/` | méthode transférée ; runtime absent ; fiche Vault déjà `disabled` | REG-001 ligne `agent.ceo.ia` ; S2 ligne 1 ; 0 trace |
| `mandat-reception` | méthode d'auditeur strict de `workspaces/seo-batch/.claude/agents/phase1-auditor.md` (verdict sur preuve, jamais de correction) | retrait de `workspaces/seo-batch/.claude/agents/conseil-batch.md`, sa fiche Vault passant à `disabled` | neutralisé depuis 2026-07-19, corps retiré, remplacé par seo-content-loop ; une seule citation (`scripts/seo/inject-agent-role.ts`) | S1 ligne conseil-batch ; `git log` 7d3f302370 |
| `mandat-triage-ci` | `agents/cto/AGENTS.md` (dérive technique, P1–P3, corrections proposées en attente) | retrait de `agents/cto/` | méthode transférée ; fiche Vault `disabled` ; le fichier contient des adresses réseau dans un dépôt public | REG-001 `agent.cto.ia` ; S2 ligne 4 |

`phase1-auditor` n'est pas retiré, car `backend/src/config/agentic.constants.ts` le cite (`rag_quality_check`).

Faiblesse à arbitrer par l'owner : les trois contreparties retirent des agents **déjà inactifs**. Le nombre de fichiers ne bouge pas (+3 / −3), mais le nombre d'agents réellement actifs augmente de 3. Si l'owner lit AI6 comme « 1 création = 1 retrait d'un agent actif », aucune contrepartie active n'est disponible : 0 usage observé pour les 42. Dans ce cas, la décision lui revient.

### 5.2 Autres propositions, hors contrepartie

| Proposition | Raison | Preuve | Coût |
|---|---|---|---|
| Retirer `r1-content-batch`, `r4-content-batch`, `r6-content-batch`, `r7-brand-rag-generator` | neutralisés (corps retiré, `disable-model-invocation: true`) ; remplaçants désignés dans leur description | S1 ; derniers commits fa21bfd7a6, 44b0bbd4aa, 99c3ab1e9a, 456f16ac94 | modifications de code : citations dans `backend/src` (constantes et tests) |
| Fusionner `r3-keyword-plan-batch` dans `r3-keyword-planner` | le premier est un lot séquentiel du même pipeline R3 P0–P3 | descriptions des deux fichiers | 1 citation (`scripts/seo/inject-agent-role.ts`) |
| Retirer `agents/cmo`, `cpo`, `rag-lead`, `seo-content`, `seo-qa` et la surface `paperclip` de la carte | fiches Vault `disabled` (ADR-129) ; aucun runtime sur DEV | REG-001 ; S2 | à décider avec ADR-129 ; la surface est sous `.spec/00-canon/**` (owner) |
| Mettre à jour REG-001 et les 12 fiches `AGENT-prompt-*` | statut `active` faux pour 5 agents neutralisés ; `content-batch` sans fichier | § 2 | PR Vault séparée (hors mandat) |

## 6. Jeu fermé de sous-agents de mandat (3)

### Format natif vérifié

Source : documentation officielle Claude Code, <https://code.claude.com/docs/en/sub-agents> (et <https://code.claude.com/docs/en/permissions>). Les pages ont été consultées le 2026-11-15 (HTTP 200) ; elles n'affichent pas de date de publication. Version de Claude Code sur DEV : 2.1.325.

- **Frontmatter.** `name` et `description` sont obligatoires. Champs optionnels utilisés ici : `tools`, `disallowedTools`, `model`. Un champ inconnu est ignoré.
- **Découverte.** Les sous-agents de projet se trouvent sous `.claude/agents/`. Claude Code les cherche récursivement : le sous-dossier `mandat/` n'entre pas dans l'identifiant.
- **Permissions.** Le sous-agent hérite des règles de permission de la session parente. `tools` n'accepte que des noms d'outil : la doc ne prévoit pas de restriction par commande Bash dans le frontmatter (elle passe par `permissions` des réglages, qui s'appliquent à toutes les sessions). Aucun réglage n'a donc été ajouté.
- **Appel.** Par l'outil `Agent` (`subagent_type`) ou en langage naturel. Les traces vont dans `~/.claude/projects/<projet>/<session>/subagents/agent-<id>.jsonl`.

### Placement

Les fichiers sont placés sous `.claude/agents/mandat/` et non à la racine de `.claude/agents/`, pour une raison concrète : ADR-037.

- `OperatingMatrixService.scanAllAgents()` (`backend/src/config/operating-matrix.service.ts`) lit `.claude/agents` sans récursion.
- Il exige un `role:` SEO valide (`agent-frontmatter.schema.ts`).
- Les sous-agents de mandat ne sont pas des agents SEO.
- Preuve : `tsx scripts/seo/dump-agent-matrix.ts` lancé sur une copie de l'arbre contenant `.claude/agents/mandat/` produit `audit-reports/seo-agent-matrix.json` identique octet pour octet (`cmp` : aucun écart).
- Limite : si ce scanner devient récursif, ces trois fichiers seront signalés sans `role:`.

### Fiches

| Sous-agent | Besoin | Outils | Modèle | metric_id (AI1) | Rattachement (AI5) | Dépt | Contrepartie AI6 |
|---|---|---|---|---|---|---|---|
| `.claude/agents/mandat/mandat-releve.md` | a. relevé d'état en lecture seule | `Read, Grep, Glob, Bash` ; `disallowedTools: Write, Edit, NotebookEdit` | haiku | `mandat_releve_mutation_free_rate` : part des appels sans aucune mutation, cible 100 %, critique < 100 % | `reports_to: ia-agents-lead` (rôle 23) ; `sponsor: @ak125` ; `squad: sessions-mandat` ; fiche Vault à créer après ratification (ADR-129 D5) | 23 (KPI `useful_capabilities_not_complexity`) | retrait `agents/ceo/` |
| `.claude/agents/mandat/mandat-reception.md` | b. réception d'un livrable contre l'AEC | idem | sonnet | `mandat_reception_verdict_agreement_rate` : part des verdicts non contredits à la réception owner, cible ≥ 90 %, alerte < 90 %, critique < 70 % | idem | 23 ; contribue à 02 (`limits_respected`) | retrait `conseil-batch` |
| `.claude/agents/mandat/mandat-triage-ci.md` | c. tri des PR et de la CI | idem | sonnet | `mandat_triage_cause_cited_rate` : part des checks en échec avec ligne de log citée et classe ≠ inconnu, cible ≥ 80 %, alerte < 80 %, critique < 50 % | idem | 23 ; contribue à 21 (`runtime_health`) | retrait `agents/cto/` |

Le producteur de ces trois `metric_id` est **absent**.

- On peut les mesurer à la main depuis les traces (`subagents/agent-*.jsonl`) et les résultats `gh`, mais aucun script du dépôt ne les produit.
- Conséquence d'ADR-128 D2 et d'AI1 : la capacité est déclarée `dormant` dans le patch de carte. Elle ne doit pas être comptée comme active tant qu'un producteur n'existe pas.

Le refus d'écriture repose sur deux couches :

- une couche structurelle : `Write`, `Edit` et `NotebookEdit` sont retirés ;
- une couche de consigne : Bash, avec une liste de commandes autorisées et interdites.

La doc ne permet pas de restreindre Bash commande par commande dans le frontmatter. La seconde couche dépend donc du modèle et des permissions de la session parente : c'est une limite assumée.

## 7. Patch de la carte (préparé, non appliqué)

- **Fichier.** `audit/agents/agent-operating-map.patch` (59 lignes), à appliquer par l'owner avec `git apply audit/agents/agent-operating-map.patch`.
- **Pourquoi non appliqué.** Le chemin `.spec/00-canon/**` est réservé à l'owner (`ownership.yaml`, glob `.spec/00-canon/ai-registry/**`, owner `@ak125`, risque élevé). La règle du mandat dit : « préparer le patch sans l'appliquer ».
- **Contenu :**
  - trois `nodes` de `type: agent`, `owner: "@ak125"`, `domain: D15` ;
  - `surfaces/root.loads.agents` ;
  - une capacité `mandat-subagents` (`owner: ia-agents`, `status: dormant`), ajoutée aux `capabilities` du département `ia-agents`.
- **Champs hors schéma.** `metric_id`, `reports_to`, `sponsor` et `squad` sont portés en **commentaires YAML**. Le schéma (`agent-operating-map.schema.json`, `node` avec `additionalProperties: false`) les refuse comme champs. Le schéma est sous `.spec/00-canon/**` et n'a pas été modifié.
- **Validation sur une copie de l'arbre** (`git archive HEAD` + les 3 fichiers + le patch) :

| Contrôle | Résultat |
|---|---|
| `node scripts/governance/validate-agent-operating-map.js --strict` | `0 errors, 0 warnings`, sortie 0 |
| `--self-test` | `PASS` (schéma et handoffs) |
| contre-épreuve : `mandat-releve.md` retiré | `[ERROR] NODE_PATH_MISSING` (les contrôles croisés sont bien actifs dès que `nodes` n'est plus vide) |
| `git apply --check` sur le worktree | OK |

## 8. Règles lues

Monorepo (worktree `/home/deploy/worktrees/claude-mandat-ab-app-20261115`) :

- `AGENTS.md`, `CLAUDE.md` ;
- `.claude/rules/agent-doc-search.md`, `.claude/rules/payments.md`, `.claude/rules/context7.md`, `.claude/rules/security-hooks.md` ;
- `.claude/canon-mirrors/agent-exit-contract.md` (v1.2.0) ;
- `.claude/skills/capability-acceptance/SKILL.md` ;
- `.spec/00-canon/ai-registry/agent-operating-map.yaml` et `.schema.json` ;
- `scripts/governance/validate-agent-operating-map.js`, `scripts/registry/check-new-files.js` ;
- `backend/src/config/operating-matrix.service.ts`, `backend/src/config/agent-frontmatter.schema.ts` ;
- les 42 fichiers de S1 et les 7 de S2.

Non lus : `.claude/rules/backend.md`, `frontend.md`, `deployment.md` et `guardrails.md`, sans objet pour un changement sans code, sans déploiement et sans garde.

Vault (worktree `/home/deploy/worktrees/claude-mandat-ab-vault-20261115`) :

- `AGENTS.md`, `CLAUDE.md` ;
- `ledger/rules/rules-ai-cos.md` (v1.0.0), `ledger/rules/rules-vault.md` (G1–G4) ;
- `ledger/decisions/adr/ADR-128-*.md`, `ADR-129-*.md`, `ADR-130-*.md`, `ADR-037-*.md` ;
- `_templates/adr-template.md` ;
- `ledger/agents/registry/REG-001-agents.md` ;
- `ledger/agents/ai-cos/AGENT-prompt-*.md`.

## 9. Distinctions exigées

| État | Ce qui en relève |
|---|---|
| Corrigé dans le candidat | les 3 sous-agents et ce rapport, sur la branche de la PR |
| Testé | validation du patch de carte sur copie ; matrice SEO inchangée ; démonstration § 10 (4 sessions, traces .jsonl) |
| Proposé seulement | le patch de carte ; toutes les lignes AI6 ; les `metric_id` et leurs seuils ; l'ownership Block-new ; l'ADR Vault |
| Intégré | rien : aucune fusion |
| Activé | rien : les sous-agents ne deviennent visibles des sessions qu'à la fusion par l'owner |

## 10. Démonstration

Exécutée le 2026-11-15 entre 14:07 et 14:11 UTC, dans le worktree de la PR
(`/home/deploy/worktrees/claude-mandat-ab-app-20261115`, HEAD `0f8010de6d404b407421a50c79f46eb209a1d5a1`),
par quatre sessions `claude -p` distinctes. Chaque session appelle un seul
sous-agent par l'outil `Agent` (`subagent_type` = nom du sous-agent), sur un cas
réel en lecture seule : la PR #2081 elle-même.

Traces, sous `~/.claude/projects/-home-deploy-worktrees-claude-mandat-ab-app-20261115/` :

| Cas | Session (`<id>.jsonl`) | Trace du sous-agent (`<id>/subagents/`) | `agentType` (`.meta.json`) | Modèle observé | Début |
|---|---|---|---|---|---|
| a. relevé | `670cfb51-c31e-489b-ba3e-ed6fa65f89c7` | `agent-acd555951f6dc2f06.jsonl` | `mandat-releve` | `claude-haiku-5-5` | 14:07:27Z |
| a. refus d'écriture | `2ecf0bc4-7ebd-4332-b693-84d682d75131` | `agent-a3be024195de082bb.jsonl` | `mandat-releve` | `claude-haiku-5-5` | 14:08:24Z |
| b. réception | `eb5342a4-c423-4784-b14f-2738768420ab` | `agent-a1061c6ac932598d4.jsonl` | `mandat-reception` | `claude-sonnet-5-5` | 14:09:02Z |
| c. triage CI | `1f4731cf-81c2-4afb-9292-50cb437ffa8d` | `agent-a18dbac6d39428c6b.jsonl` | `mandat-triage-ci` | `claude-sonnet-5-5` | 14:10:00Z |

Les traces restent hors du dépôt (rétention locale de 14 jours, § 11 point 5).
Les sous-agents ont été chargés depuis le worktree de la branche : la démonstration
prouve le format, pas une activation. Rien n'est visible des sessions lancées
depuis `/opt/automecanik/app` avant la fusion.

**a. Relevé.** 5 appels Bash, tous en lecture : `git rev-parse` (branche, HEAD),
`git status --porcelain=v1 -b`, `git rev-list --left-right --count origin/main...HEAD`,
`gh pr view 2081 --json …`, `gh pr checks 2081`. Aucun `Write`, `Edit` ni
`NotebookEdit`. Sortie : branche, HEAD de 40 caractères, écart `0 1` avec
`origin/main`, PR #2081 en brouillon, checks listés, manifeste `PARTIAL_COVERAGE`.

**a. Refus d'écriture.** Demande : créer `demo-ecriture.txt` à la racine du
worktree. La trace du sous-agent ne contient **aucun** `tool_use`. Sa réponse
contient `refus : sous-agent en lecture seule`. Contre-épreuve après la
session : `ls demo-ecriture.txt` renvoie `No such file or directory` et
`git status --short` est vide. Limite : `Write`, `Edit` et `NotebookEdit` sont
retirés par `disallowedTools`, mais Bash reste disponible. Le refus d'une écriture
par Bash tient à la consigne du prompt, pas à une permission (§ 6).

**b. Réception.** Contrôles de la PR #2081 (`gh pr view --json …`, `rg` des
statuts, lecture des §§ 9–12) contre les affirmations fournies : SHA de tête,
5 fichiers, SHA-256 du diff et statut AEC sont confirmés. Verdict **partiel**,
avec trois écarts : 2 checks rouges (Block-new et DoD) et 9 en attente ; § 10
absent à cet instant ; aucune trace citée pour les tests du § 7. Les deux
premiers écarts sont traités par ce commit et par l'acte owner Block-new ; le
troisième est complété ci-dessous.

**c. Triage CI.** `gh pr view` et `gh pr checks`, puis `gh run view <run> --log-failed | tail -n 80`
sur les deux runs rouges :

| Check | Run | Cause citée | Classe | Priorité | Acteur proposé |
|---|---|---|---|---|---|
| Block-new (ownership) | 43722575220 | fichiers nouveaux sans entrée d'ownership | gate-fichier-réservé | P1 | owner |
| DoD self-evaluation | 43722575171 | `[pr-dod-gate] mode=checklist pass=false reasons=2 advisory=1` | configuration (corps de PR) | P1 | session du mandat |

La lecture des checks requis (`gh api …/required_status_checks`, GET) renvoie
403 : l'état « requis » est inconnu depuis le jeton de session. Aucun run n'a
été relancé.

**Tests du § 7, commandes exécutées** (copie de l'arbre dans le scratchpad de
session, hors dépôt) : `git archive HEAD | tar -x`, `git apply audit/agents/agent-operating-map.patch`,
`node scripts/governance/validate-agent-operating-map.js --strict` (sortie 0,
`0 errors, 0 warnings`), `--self-test` (`PASS`), puis la même commande après
retrait de `.claude/agents/mandat/mandat-releve.md` (`[ERROR] NODE_PATH_MISSING`).
Matrice ADR-037 : `tsx scripts/seo/dump-agent-matrix.ts` avant et après l'ajout
du dossier `mandat/`, sorties identiques (`cmp`).

## 11. Constats hors périmètre (signalés, non corrigés)

1. `agents/cto/AGENTS.md` contient des adresses réseau dans un dépôt public.
2. Le texte d'ADR-129 D5 n'est pas appliqué : `rules-ai-cos.md` reste en v1.0.0, avec `reports_to`, `sponsor` et `squad`.
3. Le schéma de la carte ne peut porter ni `metric_id` ni le rattachement AI5.
4. `nodes: []` n'a jamais été rempli : la « PR#2 » annoncée en commentaire n'a pas eu lieu.
5. La rétention des traces est de 14 jours, ce qui rend la preuve d'usage AI1 courte.
6. REG-001 est en dérive : 5 agents neutralisés y restent `active`, et la fiche `content-batch` n'a pas de fichier.
7. 31 des 42 sous-agents de S1 n'ont pas de fiche Vault.
8. Des sous-agents actifs de S1 lisent le RAG pour produire (invariant 4 de `CLAUDE.md`).
9. ADR-037 vise `.claude/agents/*.md`, alors que le commentaire du schéma Zod parle de `**`. Le scanner n'est pas récursif.
10. Agents Paperclip : `agents/` décrit encore 7 agents dont les fiches Vault sont `disabled`.

## 12. Manifeste AEC

```
scope_requested: inventaire S1+S2+S3 ; 3 sous-agents ; patch de carte ; démonstration
scope_actually_scanned: 42 fichiers S1, 7 fichiers S2, 44 entrées S3, 411 traces .jsonl, runs pilote-file et skills-canon-gate
files_read_count: 42 + 7 + 1 carte + 1 schéma + 12 fiches Vault + REG-001 + règles du § 8
excluded_paths: .claude/rules/{backend,frontend,deployment,guardrails}.md (sans objet)
unscanned_zones: traces antérieures au 2026-10-10 ; agents de session lancés par --agent ; runtime Paperclip hors DEV
corrections_proposed: patch de carte ; 3 contreparties AI6 ; 4 propositions AI6 complémentaires
corrections_applied: 0 hors candidat (3 sous-agents + rapport + patch ajoutés dans la PR)
validation_executed: validate-agent-operating-map --strict / --self-test sur copie ; dump-agent-matrix sur copie ; git apply --check ; démonstration § 10 (4 traces)
remaining_unknowns: usage réel des 49 agents avant 2026-10-10 ; producteur des metric_id ; lecture AI6 retenue par l'owner
final_status: PARTIAL_COVERAGE
```
