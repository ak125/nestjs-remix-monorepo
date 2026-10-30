# Agent method patterns — pointers AutoMecanik-native

> `NON-CANON · ADVISORY · POINTER-ONLY · NO AUTHORITY · NO NEW CONTROL PLANE · NO EXTERNAL DEPENDENCY`
>
> Idées gstack traduites en **pointers** vers les mécanismes AutoMecanik **déjà existants**.
> Ce fichier n'autorise aucune action, ne remplace aucun gate et ne peut jamais assouplir un
> guard existant. La vérité reste **vault / registry / DB / RAW→WIKI**.

## 1. Phases — `DISCOVER → DECIDE → PLAN → PATCH → VERIFY → HANDOFF`

Vocabulaire de lecture/sortie, pas une séquence obligatoire : appliquer seulement les étapes utiles à la tâche.

| Phase | Mécanisme autoritaire (déjà là) |
|---|---|
| **DISCOVER** | [CLAUDE.md](../../CLAUDE.md) invariant 1 : fichiers connus/recherche ciblée ; registry filtré pour exploration transverse |
| **DECIDE** | Arbitrage valeur/risque/complexité identifié ou demandé : [continuous-improvement-global](../skills/continuous-improvement-global/SKILL.md) ; sinon appliquer le contrat commun |
| **PLAN** | Planifier les tâches complexes ; respecter le mandat et les règles d’isolation de [deployment.md](../rules/deployment.md) |
| **PATCH** | CLAUDE.md « périmètre minimal » |
| **VERIFY** | preuve proportionnée au changement ; runtime si le comportement servi est concerné |
| **HANDOFF** | [agent-exit-contract.md](../canon-mirrors/agent-exit-contract.md) (coverage manifest, anti-overclaim) |

## 2. Danger-zone — POINTE vers les guards (ne réécrit rien)

Sources autoritaires : [pretool-bash-guard.sh](../../scripts/claude-hooks/pretool-bash-guard.sh),
[pretool-supabase-guard.sh](../../scripts/claude-hooks/pretool-supabase-guard.sh),
[pretool-file-guard.sh](../../scripts/claude-hooks/pretool-file-guard.sh),
[.ast-grep/rules/](../../.ast-grep/rules/), [.husky/pre-commit](../../.husky/pre-commit).
Niveaux : **BLOCK** (refusé, guard local) · **WARN** (averti, autorisé) · **GATED (CI)** (branch protection GitHub).

| Trigger | Niveau | Mécanisme |
|---|---|---|
| `git push origin main` / `--force` / `reset --hard` / `npm install` | **BLOCK** | bash-guard G1/G3/G4/G5 |
| `docker down/stop/rm` (prod) | **BLOCK** | bash-guard G2 |
| `DROP` / `TRUNCATE` / `DISABLE RLS` | **BLOCK** | supabase-guard G1-G3 |
| `.env` / `.github` / docker / lock / build config | **BLOCK** | file-guard G1-G4 |
| `backend/src/modules/rm/` | **BLOCK** | file-guard G5 |
| `supabase.rpc` direct (commerce) / order-cart status writes | **BLOCK** *(code)* | ast-grep `commerce-*` |
| `ALTER TABLE DROP COLUMN` / `CREATE TABLE` sans RLS | **WARN** | supabase-guard G4-G5 |
| `payments/` edits | **WARN** | file-guard G3 + [payments.md](../rules/payments.md) |
| `gh pr merge` → main | **GATED (CI)** | branch protection : checks stricts + `enforce_admins` (merge = PREPROD ; PROD tag-gated) |
| `git tag v*` / `push --tags` / deploy-prod | **BLOCK** | bash-guard G6 (#879) — tag = décision opérateur ([deployment.md](../rules/deployment.md)) |
| `UPDATE`/`DELETE` `pieces` / `pieces_price` / `__seo_*` via execute_sql | **BLOCK** | supabase-guard G6 (#879) — passer par module/RPC gouverné |

> #879 = durcissement owner-gated — **renforcer, jamais affaiblir** un guard.

## 3. Périmètre autorisé

Définir les chemins concernés et préserver les changements préexistants selon le
contrat commun et [ownership.yaml](../../.spec/00-canon/repository-registry/ownership.yaml).
Signaler les constats hors périmètre sans les corriger ; aucun formulaire supplémentaire n'est requis.

## 4. QA = report-only par défaut

Une demande d'audit seul reste en lecture seule. Si le mandat inclut les corrections,
les appliquer dans ce périmètre sans redemander le même accord. Les zones STOP,
permissions et approbations imposées restent applicables.
Autorité = code runtime + [prod-smoke-tests.yml](../../.github/workflows/prod-smoke-tests.yml) +
[Playwright E2E](../../frontend/playwright.config.ts) + Lighthouse CI + skills `responsive-audit` /
`web-vitals-audit` / `runtime-truth-audit`.

Invariants commerce *(aide-mémoire — autorité = code runtime, pas cette liste)* : sélecteur
véhicule visible (R1) · lien R3 → R1 présent · bouton panier masqué si `can_sell=false` · prix
affiché seulement si `price_exists` · PREORDER vendable si `pri_dispo=3` · `noindex` sur 404/410
+ canonical propre · pas de contenu générique dupliqué visible.

Non-couvert par un test existant → **candidat signalé**, pas de nouveau skill (V1-first).

## 5. Second avis = advisory only

Un second avis répond à une demande ou à un risque restant identifié ; il n'est pas
systématique. [code-review](../skills/code-review/SKILL.md), CodeRabbit *si disponible*
ou avis multi-modèle restent consultatifs. Questions utiles :
architecture parallèle inventée ? hors scope touché ? rollback oublié ? invariant métier
cassé ? `DONE` sur-déclaré alors que `PARTIAL` ?

## 6. Mémoire & routing — pointers

- Mémoire = aide au rappel, **jamais** source de vérité — couches `MEMORY.md` / `CLAUDE.md` /
  vault / WIKI / DB / RAG : voir [agent-doc-search.md](../rules/agent-doc-search.md).
- L'[agent-operating-map.yaml](../../.spec/00-canon/ai-registry/agent-operating-map.yaml)
  est une carte de référence non normative, pas un orchestrateur ni une preuve de capacités.
  [role-matrix.md](../../.spec/00-canon/role-matrix.md) décrit les rôles SEO ;
  [departments-map](../../audit/automecanik-departments-map.md) décrit les responsabilités.
  Leurs périmètres ne se confondent pas avec les outils et permissions réellement disponibles.

## 7. Refusés (de gstack)

`/ship` / `/land-and-deploy` auto (PROD owner-gated, tag `v*` = opérateur) · team-required mode ·
mémoire externe comme canon · browser agent mutant sans garde-fou · continuous checkpoint push
(le push est une action gouvernée).

## 8. Boucle d'amélioration mesurée (keep/revert gouverné)

Pour une amélioration **pilotée par une métrique** (taille de bundle, temps de build/typecheck,
vitesse des tests). **PAS** un runner autonome, **PAS** un nouveau gate, **PAS** de `score-runner`
maison — réutilise l'existant. Décision = [continuous-improvement-global](../skills/continuous-improvement-global/SKILL.md) (§DECIDE).

| Étape | Mécanisme (déjà là) |
|---|---|
| Cible + métrique | 1 surface où la mesure est **rapide + déterministe + difficile à tricher** ; sinon → *advisory* |
| Juge = gate existant | [.size-limit.json](../../frontend/.size-limit.json) · `tsc` · ratchets [audit-compare-baseline.js](../../scripts/cleanup/audit-compare-baseline.js) / `*-ratchet.yml` |
| Isolation | worktree dédié ([deployment.md](../rules/deployment.md)) — jamais éditer `main` ni un chemin servi par DEV:3000 |
| Mesure | baseline → change → re-mesure (métrique bruitée → médiane de N + delta minimum) |
| Verdict | Improvement Check du skill déjà utilisé + [agent-exit-contract.md](../canon-mirrors/agent-exit-contract.md) ; le [schéma historique](../../.spec/00-canon/improvement-report.schema.json) ne sert qu’aux anciens rapports |
| Promotion | **PR owner-gated** (branch protection §2) — **jamais d'auto-merge d'une boucle** |

**Garde-fou n°1 — anti-faux-vert : holdout LARGE + contrôle baseline.** Un test étroit vert ne
prouve RIEN. Rejouer l'ensemble pertinent **et** comparer à un run *baseline* (avant-change) sur le
**même** ensemble ; ne garder que si métrique↑ **ET** 0 régression vs baseline. *(2026-06-20 : un
holdout 8-fichiers vert aurait livré 73 tests cassés — détail dans `audit/karpathy-loop-pilot-*.verdict.json`.)*

**Règle d'autonomie (par qualité de métrique) :**

- **Auto** uniquement si métrique rapide + déterministe + intriquable : perf / build / typecheck / tests.
- **Advisory** (propose, ne publie jamais) : contenu R2/R8, SEO — métrique lente/triable → surapprentissage
  → contenu générique (interdit par CLAUDE.md « filler SEO générique » + invariant rank #1).
- **Owner GO** obligatoire : prix · panier/commande/paiement · auth/RLS · migration · publication/indexation
  SEO · promotion WIKI canon (cf. danger-zone §2).

> La boucle **garde** le gain réel et sûr, **rejette** le reste : améliorer le chiffre en cassant
> autre chose (SEO, tests, DI) = surapprentissage, refusé. Le « keep » exige score↑ **et** holdout vert.

## 9. Preuve runtime — choisir le vérificateur existant

Appliquer les invariants 7 à 9 de [CLAUDE.md](../../CLAUDE.md) : preuve adaptée au
risque, distinction entre code, CI et comportement servi, respect du mandat et des
zones STOP. Une observation runtime exige d'exécuter le flux concerné et d'en observer
le résultat dans un environnement autorisé ; une CI verte ne la remplace pas.

**Routage — surface du diff → vérificateur (déjà là) → ce qu'on observe :**

| Surface | Piloter avec (existant) | Observer |
|---|---|---|
| frontend | [Playwright E2E](../../frontend/playwright.config.ts) · [responsive-audit](../skills/responsive-audit/SKILL.md) · [web-vitals-audit](../skills/web-vitals-audit/SKILL.md) *(INP/LCP/CLS uniquement)* | navigation, hydratation, console, réseau, responsive 375/768/1024/1440, CWV (INP/LCP/CLS) |
| backend | vraie requête HTTP (`curl http://localhost:3000/...`) · [prod-smoke-tests.yml](../../.github/workflows/prod-smoke-tests.yml) | status, corps, effet de bord observable |
| seo | `curl` de la page servie (`http://localhost:3000/<page>`) + extraction du champ HTML servi (`grep -oP`) | status, canonical, robots, meta, H1, JSON-LD, duplication (HTML servi) |
| projection | [runtime-truth-audit](../skills/runtime-truth-audit/SKILL.md) — flags OFF/ON, allowlist, fallback, provenance | sortie servie selon l'état du flag |
| edge | `curl -I` **read-only** de l'URL servie · [config/caddy/Caddyfile](../../config/caddy/Caddyfile) · invariant `Cache-Control` single-owner (arbitre `entry.server`) | cache, confidentialité, `Cache-Control` des headers servis |
| pipeline | trace `RAW → WIKI → projection → consommateur` (jamais de writer RAG) — gates du contrat d'export WIKI (`quality-gates` / AEC-hash / slug-uniqueness) | lignage & provenance de la source |
| commerce | **sandbox + owner GO** — [payments.md](../rules/payments.md) pour le paiement | flux réel en env sûr ; jamais de mutation PROD live |

Conserver l'environnement, le commit ou l'image vérifié, la commande ou le parcours,
le résultat observé et les limites dans la PR, `audit/` ou les artefacts existants.
Une preuve DEV/PREPROD ne vaut pas preuve PROD. Si la cible n'est pas accessible dans
le mandat, signaler ce qui reste non observé sans déclencher de déploiement ni de
mutation pour compléter le rapport. Les interventions PROD restent manuelles par Marwane
([deployment.md](../rules/deployment.md)).

Le [contrat de sortie](../canon-mirrors/agent-exit-contract.md) porte la restitution ;
ce guide n'ajoute ni verdict concurrent, ni gate issu d'une mémoire, ni revue ou boucle
obligatoire. Réutiliser les preuves pertinentes inchangées ; reprendre une vérification
seulement pour un changement, un échec ou un risque restant identifié.

Ne pas stocker de preuve dans `.local/governance-vault/` (déprécié). Les procédures des
skills cités ne s'appliquent que lorsque le skill pertinent est effectivement utilisé.

---

_Non-canon. Pour toute règle qui fait foi, voir la source pointée (vault · `.spec/00-canon/` ·
guards · skills). Ce fichier ne crée aucune autorité._
