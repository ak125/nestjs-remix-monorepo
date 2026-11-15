# Triage de la file des issues (ADR-128 D1 et D6)

Proposition de classement des issues ouvertes de `ak125/nestjs-remix-monorepo`, une ligne par
issue : un département, une confiance, une raison et une suite proposée. Le pilote propose,
l'owner décide (ADR-128 D6).

- **Appliqué** : les 11 labels `dept:` des lignes forte et garder, posés par l'owner le
  2026-11-15 à 13:08 UTC avec son compte (événements `labeled` relus par l'API). Aucune issue
  fermée, commentée ou modifiée d'autre façon.

- **Relevé** : 2026-11-15T12:10:47Z, `gh issue list --state open` et `gh pr list --state open`,
  lecture seule avec le `gh` du shell DEV (`automecanik-agents[bot]`).
- **File** : 181 issues ouvertes au relevé. Le récapitulatif pilote-file de 12:09:58Z en compte
  180, parce que `pilote-file.constats.jq` exclut sa propre issue de récapitulatif (#2073), qui
  figure ici.
- **Issue de sécurité** : aucune issue de sécurité ouverte au relevé.
- **Application** : `scripts/ops/triage-file-apply.sh` lit ce fichier et ne retient que les
  lignes de confiance `forte` marquées `garder`. Elle n'ajoute que le label `dept:` de la ligne
  (`gh issue edit --add-label`). Elle ne ferme rien et ne retire aucun label. Par défaut, elle
  tourne à blanc.

## Méthode

- **Digests générés** (158 issues). Les séries `Morning health digest` (workflow
  `morning-health-digest.yml`) et `Weekly PR hygiene` (`weekly-pr-hygiene.yml`) ouvrent une
  issue à chaque exécution et ne ferment jamais la précédente. Chaque issue est un instantané
  daté que le suivant remplace. Dans chaque série, le plus récent est gardé (#2036 du 2026-11-13,
  dernier jour ouvré avant le relevé ; #1975, semaine W46) et les plus anciens sont proposés à
  la fermeture.
  - Digest du matin → `dept:21-runtime`, confiance forte : il relève la fraîcheur du sitemap, les
    déploiements de `main` et les PR en échec.
  - Bilan hebdomadaire des PR → `dept:23-ia-agents`, confiance moyenne : l'hygiène de la file
    relève du pilote (rôle 23), mais le 02 gouvernance est plausible.
- **Autres issues** (23). J'ai lu le titre, le corps et les PR liées (événements
  `CrossReferenced`), puis contrôlé le code au commit `b40181b3e` ou l'état servi. La preuve est
  citée dans la colonne « Preuve de la suite ».
- **Départements** : ceux de `.spec/00-canon/ai-registry/agent-operating-map.yaml`, au format des
  labels de `docs/plans/2026-11-15-adr128-labels-d1.md`.
- **Confiance** :
  - forte : le titre ou le corps désigne sans ambiguïté le domaine d'un seul département ;
  - moyenne : deux départements sont plausibles, ou la preuve de la suite est partielle ;
  - faible : la raison repose sur une lecture du contexte.

## Décompte

| Département | Issues | forte | moyenne | faible |
|---|---|---|---|---|
| `dept:07-seo` | 11 | 10 | 1 | 0 |
| `dept:11-diagnostic` | 1 | 1 | 0 | 0 |
| `dept:21-runtime` | 137 | 134 | 2 | 1 |
| `dept:23-ia-agents` | 32 | 2 | 30 | 0 |
| **Total** | **181** | **147** | **33** | **1** |

| Suite proposée | Issues |
|---|---|
| garder | 15 |
| fermer comme obsolète | 166 : 156 instantanés de digest remplacés, plus #203, #439, #582, #650, #744, #745, #1037, #1063, #1113 et #1916 |
| fusionner avec une autre | 0 |

#1037, #1063 et #1113 sont trois rapports de la même routine de suivi des prérequis du PR-2 du
control plane, bloquée sur la lecture du statut d'ADR-058. Ce statut est désormais `accepted`, et
la routine n'a rien publié depuis le 2026-06-23. Aucune des trois ne reste ouverte comme cible :
#1037 et #1063 se ferment comme doublons de #1113, qui se ferme aussi. Si le PR-2 du control plane
reste à faire, il vaut mieux l'ouvrir dans une issue neuve que garder un rapport de routine
périmé.

Le script retient 11 lignes (forte et garder), appliquées le 2026-11-15 : #264, #411, #412, #413, #414, #430, #432,
#593, #1947, #2036 et #2073. Les 4 lignes à garder de confiance moyenne (#226, #431, #788 et
#1975) restent à classer à la main.

## Issues ouvertes au relevé

| Issue | Créée | Titre | Département | Confiance | Raison | Suite | Preuve de la suite |
|---|---|---|---|---|---|---|---|
| #203 | 2026-04-28 | Soak report PR #190 alias TS — verdict YELLOW (J+1) | `dept:21-runtime` | forte | rapport de soak DEV de la PR #190 (alias TS du backend) avant promotion PROD | fermer | PR #190 fusionnée le 2026-04-27 (852dda55e8) ; fenêtre de soak J+1 du 2026-04-28 close depuis |
| #226 | 2026-04-30 | perf-gates: calibrate budgets to CI runner reality + add /health/ready warmer… | `dept:21-runtime` | moyenne | budgets du gate CI perf-gates (Lighthouse) et gate de fin de warm-up /health/ready | garder | budgets revus par #235 (resserrés) et #509 (temps seuls) ; aucun gate /health/ready dans perf-gates.yml : reste ouvert pour cette partie |
| #264 | 2026-05-02 | [INC-2026-013] Probabilités non sourcées dans __diag_symptom_cause_link — 4 P… | `dept:11-diagnostic` | forte | incident INC-2026-013 : scores de causes non sourcés du moteur de diagnostic | garder | atténuation en base non vérifiée (base hors périmètre) ; aucune PR liée fusionnée relevée |
| #411 | 2026-05-09 | SEO shadow: activer R7/R8/RM en preprod et valider les signaux reels | `dept:07-seo` | forte | activation des modes shadow SEO R7/R8/RM en PREPROD (ADR-055) | garder | flags injectés par #415 (fusionnée le 2026-05-09) ; preuves terrain demandées (boot, Sentry, __seo_event_log) jamais rapportées |
| #412 | 2026-05-09 | ADR-055: retrofitter gamme-rest sur le canon LIVE | `dept:07-seo` | forte | retrofit du module gamme-rest sur le canon ADR-055 | garder | aucune référence ADR-055 ni SeoShadowObservatory dans backend/src/modules/gamme-rest au relevé |
| #413 | 2026-05-09 | R8: supprimer l'angle mort redirect/canonical de policy_divergence | `dept:07-seo` | forte | angle mort redirect/canonical de policy_divergence pour R8 | garder | skip `r8_frontend_redirect_logic_not_reproduced` toujours présent dans seo-shadow-diff-engine.service.ts |
| #414 | 2026-05-09 | SEO shadow: planifier et executer le bilan SQL J+7 | `dept:07-seo` | forte | bilan SQL J+7 du mode shadow SEO avant tout passage en mode on | garder | dépend de #411, dont les preuves terrain manquent |
| #430 | 2026-05-10 | tech-debt(seo-v9): extract parseNumericTargetId + skip resolvePgAlias for num… | `dept:07-seo` | forte | dette ExecutionRouter : resolvePgAlias appelé pour les rôles à cible numérique (R7, R8) | garder | resolvePgAlias toujours appelé avant le switch de rôle dans dispatchSingle (execution-router.service.ts:245) |
| #431 | 2026-05-10 | tech-debt(pipeline): rename __pipeline_chain_queue.pcq_pg_id to a generic pcq… | `dept:07-seo` | moyenne | renommage de la colonne pcq_pg_id de la file du pipeline SEO (cible multi-rôle) | garder | pcq_pg_id toujours utilisé par execution-router.service.ts ; renommage = migration de base, zone owner |
| #432 | 2026-05-10 | bug(seo-v9): ExecutionRouter.executeWithConcurrency does not preserve targetI… | `dept:07-seo` | forte | bug ExecutionRouter : ordre des résultats de executeWithConcurrency | garder | results.push dans l'ordre d'achèvement toujours présent (execution-router.service.ts:531-533) |
| #439 | 2026-05-11 | ADR-024 promotion blocked at J+14 — données de mesure indisponibles (tooling… | `dept:07-seo` | forte | promotion d'ADR-024 (cache matview de la page gamme R1) bloquée faute de mesure | fermer | ADR-024 porte `status: accepted` dans le vault (copie DEV, commit 156b143 du 2026-11-15) : le blocage de promotion n'a plus d'objet |
| #582 | 2026-05-17 | Closure 2026-05-17 — 4 PRs sitemap/auth/PR-9a MERGED + 13 stales closed (T+0… | `dept:21-runtime` | faible | récapitulatif de fermeture du 2026-05-17 (PR sitemap, auth, PR-9a) | fermer | rapport daté sans reste à faire : les 4 PR citées sont fusionnées depuis le 2026-05-17 |
| #587 | 2026-05-18 | Morning health digest — 2026-05-18 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-05-18 remplacé par #2036 |
| #588 | 2026-05-18 | Weekly PR hygiene W21 — 2026-05-18 (🔀 Rebase cascade (oldest stack first)) | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W21 remplacé par #1975 |
| #593 | 2026-05-18 | sitemap-regen: operations hardening — silent-failure findings from PR #591 mu… | `dept:07-seo` | forte | durcissement de la régénération du sitemap : échecs silencieux du processor | garder | le catch de sitemap-regenerate.processor.ts renvoie toujours `success: false` sans relancer l'erreur |
| #619 | 2026-05-19 | Morning health digest — 2026-05-19 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-05-19 remplacé par #2036 |
| #650 | 2026-05-19 | Closure 2026-05-17 — T+48h SLO digest (verdict: HOLD) | `dept:21-runtime` | moyenne | digest SLO T+48h de la fermeture du 2026-05-17 (verdict HOLD) | fermer | instantané du 2026-05-19 ; seul digest de cette série ; déploiements main revus depuis par le digest #2036 |
| #651 | 2026-05-20 | Morning health digest — 2026-05-20 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-05-20 remplacé par #2036 |
| #666 | 2026-05-21 | Morning health digest — 2026-05-21 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-05-21 remplacé par #2036 |
| #688 | 2026-05-22 | Morning health digest — 2026-05-22 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-05-22 remplacé par #2036 |
| #742 | 2026-05-25 | Morning health digest — 2026-05-25 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-05-25 remplacé par #2036 |
| #743 | 2026-05-25 | Weekly PR hygiene W22 — 2026-05-25 (🔀 Rebase cascade (oldest stack first)) | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W22 remplacé par #1975 |
| #744 | 2026-05-25 | fix(edge): Caddy >Cache-Control replace mode (PROD duplicate header) | `dept:21-runtime` | forte | en-tête Cache-Control doublé par Caddy en PROD | fermer | corrigé par #1272 (Cache-Control à propriétaire unique, `header ?Cache-Control` dans @public_cached) ; un seul Cache-Control sur la page d'accueil PROD au relevé |
| #745 | 2026-05-25 | fix(seo): sitemap-$.tsx flat-routes naming + ___xtr_msg REDIRECT_RULE cleanup | `dept:07-seo` | forte | routes /sitemap-*.xml cassées (nommage flat-routes) et règle de redirection en base | fermer | route supprimée par #1074 (sitemaps servis par SitemapStaticMiddleware) ; /sitemap-racine.xml répond 200 application/xml en DEV et en PROD au relevé ; partie « règle en base » non vérifiée (base hors périmètre) |
| #760 | 2026-05-26 | Morning health digest — 2026-05-26 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-05-26 remplacé par #2036 |
| #767 | 2026-05-27 | Morning health digest — 2026-05-27 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-05-27 remplacé par #2036 |
| #777 | 2026-05-28 | Morning health digest — 2026-05-28 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-05-28 remplacé par #2036 |
| #788 | 2026-05-28 | Decision pending: v5-guardian replacement claim not wired downstream | `dept:23-ia-agents` | moyenne | décision sur les skills seo-batch : v5-guardian déclaré remplaçant non raccordé | garder | 5 SKILL.md de workspaces/seo-batch citent encore pollution-scanner ; décision toujours en attente |
| #790 | 2026-05-29 | Morning health digest — 2026-05-29 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-05-29 remplacé par #2036 |
| #807 | 2026-06-01 | Morning health digest — 2026-06-01 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-01 remplacé par #2036 |
| #808 | 2026-06-01 | Weekly PR hygiene W23 — 2026-06-01 (🧪 PR-8b-2 cleanup (≤ 5 files)) | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W23 remplacé par #1975 |
| #818 | 2026-06-02 | Morning health digest — 2026-06-02 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-02 remplacé par #2036 |
| #829 | 2026-06-03 | Morning health digest — 2026-06-03 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-03 remplacé par #2036 |
| #843 | 2026-06-04 | Morning health digest — 2026-06-04 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-04 remplacé par #2036 |
| #859 | 2026-06-05 | Morning health digest — 2026-06-05 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-05 remplacé par #2036 |
| #894 | 2026-06-08 | Morning health digest — 2026-06-08 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-08 remplacé par #2036 |
| #895 | 2026-06-08 | Weekly PR hygiene W24 — 2026-06-08 (🔀 Rebase cascade (oldest stack first)) | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W24 remplacé par #1975 |
| #912 | 2026-06-09 | Morning health digest — 2026-06-09 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-09 remplacé par #2036 |
| #914 | 2026-06-10 | Morning health digest — 2026-06-10 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-10 remplacé par #2036 |
| #933 | 2026-06-11 | Morning health digest — 2026-06-11 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-11 remplacé par #2036 |
| #944 | 2026-06-12 | Morning health digest — 2026-06-12 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-12 remplacé par #2036 |
| #985 | 2026-06-15 | Morning health digest — 2026-06-15 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-15 remplacé par #2036 |
| #986 | 2026-06-15 | Weekly PR hygiene W25 — 2026-06-15 (🔀 Rebase cascade (oldest stack first)) | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W25 remplacé par #1975 |
| #999 | 2026-06-16 | Morning health digest — 2026-06-16 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-16 remplacé par #2036 |
| #1011 | 2026-06-17 | Morning health digest — 2026-06-17 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-17 remplacé par #2036 |
| #1023 | 2026-06-18 | Morning health digest — 2026-06-18 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-18 remplacé par #2036 |
| #1027 | 2026-06-19 | Morning health digest — 2026-06-19 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-19 remplacé par #2036 |
| #1037 | 2026-06-20 | PR-2 prereqs monitor — Gate 1 bloqué (vault hors scope session) | `dept:23-ia-agents` | moyenne | routine de suivi des prérequis du PR-2 du control plane (ADR-058), bloquée | fermer | doublon de #1113 (même routine, même blocage d'accès au vault), rapport du 2026-06-20 ; #1113 étant elle-même proposée à la fermeture, aucune cible ne reste ouverte |
| #1063 | 2026-06-21 | PR-2 daily monitor: GATE 1 bloquée — governance-vault hors scope session | `dept:23-ia-agents` | moyenne | routine de suivi des prérequis du PR-2 du control plane (ADR-058), bloquée | fermer | doublon de #1113 (même routine, même blocage d'accès au vault), rapport du 2026-06-21 ; #1113 étant elle-même proposée à la fermeture, aucune cible ne reste ouverte |
| #1095 | 2026-06-22 | Morning health digest — 2026-06-22 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-22 remplacé par #2036 |
| #1099 | 2026-06-22 | Weekly PR hygiene W26 — 2026-06-22 (🔀 Rebase cascade (oldest stack first)) | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W26 remplacé par #1975 |
| #1112 | 2026-06-23 | Morning health digest — 2026-06-23 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-23 remplacé par #2036 |
| #1113 | 2026-06-23 | PR-2 monitor BLOCKED — governance-vault not in session scope (GATE 1 unverifi… | `dept:23-ia-agents` | moyenne | routine de suivi des prérequis du PR-2 du control plane (ADR-058), bloquée | fermer | ADR-058 porte `status: accepted` dans le vault (copie DEV, commit 156b143) ; la routine n'a rien publié depuis le 2026-06-23 |
| #1127 | 2026-06-24 | Morning health digest — 2026-06-24 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-24 remplacé par #2036 |
| #1137 | 2026-06-25 | Morning health digest — 2026-06-25 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-25 remplacé par #2036 |
| #1155 | 2026-06-26 | Morning health digest — 2026-06-26 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-26 remplacé par #2036 |
| #1191 | 2026-06-29 | Morning health digest — 2026-06-29 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-29 remplacé par #2036 |
| #1192 | 2026-06-29 | Weekly PR hygiene W27 — 2026-06-29 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W27 remplacé par #1975 |
| #1193 | 2026-06-30 | Morning health digest — 2026-06-30 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-06-30 remplacé par #2036 |
| #1194 | 2026-07-01 | Morning health digest — 2026-07-01 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-01 remplacé par #2036 |
| #1204 | 2026-07-02 | Morning health digest — 2026-07-02 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-02 remplacé par #2036 |
| #1210 | 2026-07-03 | Morning health digest — 2026-07-03 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-03 remplacé par #2036 |
| #1235 | 2026-07-06 | Morning health digest — 2026-07-06 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-06 remplacé par #2036 |
| #1236 | 2026-07-06 | Weekly PR hygiene W28 — 2026-07-06 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W28 remplacé par #1975 |
| #1239 | 2026-07-07 | Morning health digest — 2026-07-07 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-07 remplacé par #2036 |
| #1241 | 2026-07-08 | Morning health digest — 2026-07-08 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-08 remplacé par #2036 |
| #1245 | 2026-07-09 | Morning health digest — 2026-07-09 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-09 remplacé par #2036 |
| #1246 | 2026-07-10 | Morning health digest — 2026-07-10 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-10 remplacé par #2036 |
| #1247 | 2026-07-13 | Morning health digest — 2026-07-13 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-13 remplacé par #2036 |
| #1248 | 2026-07-13 | Weekly PR hygiene W29 — 2026-07-13 (🔀 Rebase cascade (oldest stack first)) | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W29 remplacé par #1975 |
| #1262 | 2026-07-14 | Morning health digest — 2026-07-14 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-14 remplacé par #2036 |
| #1279 | 2026-07-15 | Morning health digest — 2026-07-15 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-15 remplacé par #2036 |
| #1287 | 2026-07-16 | Morning health digest — 2026-07-16 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-16 remplacé par #2036 |
| #1291 | 2026-07-17 | Morning health digest — 2026-07-17 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-17 remplacé par #2036 |
| #1310 | 2026-07-20 | Morning health digest — 2026-07-20 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-20 remplacé par #2036 |
| #1311 | 2026-07-20 | Weekly PR hygiene W30 — 2026-07-20 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W30 remplacé par #1975 |
| #1312 | 2026-07-21 | Morning health digest — 2026-07-21 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-21 remplacé par #2036 |
| #1313 | 2026-07-22 | Morning health digest — 2026-07-22 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-22 remplacé par #2036 |
| #1314 | 2026-07-23 | Morning health digest — 2026-07-23 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-23 remplacé par #2036 |
| #1315 | 2026-07-24 | Morning health digest — 2026-07-24 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-24 remplacé par #2036 |
| #1320 | 2026-07-27 | Morning health digest — 2026-07-27 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-27 remplacé par #2036 |
| #1321 | 2026-07-27 | Weekly PR hygiene W31 — 2026-07-27 (🧹 Hygiene week — batch-close stale PRs) | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W31 remplacé par #1975 |
| #1322 | 2026-07-28 | Morning health digest — 2026-07-28 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-28 remplacé par #2036 |
| #1323 | 2026-07-29 | Morning health digest — 2026-07-29 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-29 remplacé par #2036 |
| #1325 | 2026-07-30 | Morning health digest — 2026-07-30 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-30 remplacé par #2036 |
| #1326 | 2026-07-31 | Morning health digest — 2026-07-31 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-07-31 remplacé par #2036 |
| #1330 | 2026-08-03 | Morning health digest — 2026-08-03 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-03 remplacé par #2036 |
| #1331 | 2026-08-03 | Weekly PR hygiene W32 — 2026-08-03 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W32 remplacé par #1975 |
| #1333 | 2026-08-04 | Morning health digest — 2026-08-04 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-04 remplacé par #2036 |
| #1334 | 2026-08-05 | Morning health digest — 2026-08-05 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-05 remplacé par #2036 |
| #1336 | 2026-08-06 | Morning health digest — 2026-08-06 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-06 remplacé par #2036 |
| #1337 | 2026-08-07 | Morning health digest — 2026-08-07 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-07 remplacé par #2036 |
| #1340 | 2026-08-10 | Morning health digest — 2026-08-10 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-10 remplacé par #2036 |
| #1341 | 2026-08-10 | Weekly PR hygiene W33 — 2026-08-10 (🧹 Hygiene week — batch-close stale PRs) | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W33 remplacé par #1975 |
| #1343 | 2026-08-11 | Morning health digest — 2026-08-11 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-11 remplacé par #2036 |
| #1345 | 2026-08-12 | Morning health digest — 2026-08-12 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-12 remplacé par #2036 |
| #1346 | 2026-08-13 | Morning health digest — 2026-08-13 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-13 remplacé par #2036 |
| #1351 | 2026-08-14 | Morning health digest — 2026-08-14 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-14 remplacé par #2036 |
| #1356 | 2026-08-17 | Morning health digest — 2026-08-17 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-17 remplacé par #2036 |
| #1357 | 2026-08-17 | Weekly PR hygiene W34 — 2026-08-17 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W34 remplacé par #1975 |
| #1359 | 2026-08-18 | Morning health digest — 2026-08-18 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-18 remplacé par #2036 |
| #1360 | 2026-08-19 | Morning health digest — 2026-08-19 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-19 remplacé par #2036 |
| #1361 | 2026-08-20 | Morning health digest — 2026-08-20 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-20 remplacé par #2036 |
| #1362 | 2026-08-21 | Morning health digest — 2026-08-21 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-21 remplacé par #2036 |
| #1363 | 2026-08-24 | Morning health digest — 2026-08-24 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-24 remplacé par #2036 |
| #1364 | 2026-08-24 | Weekly PR hygiene W35 — 2026-08-24 (🧹 Hygiene week — batch-close stale PRs) | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W35 remplacé par #1975 |
| #1365 | 2026-08-25 | Morning health digest — 2026-08-25 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-25 remplacé par #2036 |
| #1366 | 2026-08-26 | Morning health digest — 2026-08-26 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-26 remplacé par #2036 |
| #1367 | 2026-08-27 | Morning health digest — 2026-08-27 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-27 remplacé par #2036 |
| #1368 | 2026-08-28 | Morning health digest — 2026-08-28 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-28 remplacé par #2036 |
| #1369 | 2026-08-31 | Morning health digest — 2026-08-31 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-08-31 remplacé par #2036 |
| #1370 | 2026-08-31 | Weekly PR hygiene W36 — 2026-08-31 (🧹 Hygiene week — batch-close stale PRs) | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W36 remplacé par #1975 |
| #1372 | 2026-09-01 | Morning health digest — 2026-09-01 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-01 remplacé par #2036 |
| #1381 | 2026-09-02 | Morning health digest — 2026-09-02 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-02 remplacé par #2036 |
| #1386 | 2026-09-03 | Morning health digest — 2026-09-03 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-03 remplacé par #2036 |
| #1394 | 2026-09-04 | Morning health digest — 2026-09-04 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-04 remplacé par #2036 |
| #1402 | 2026-09-07 | Morning health digest — 2026-09-07 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-07 remplacé par #2036 |
| #1403 | 2026-09-07 | Weekly PR hygiene W37 — 2026-09-07 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W37 remplacé par #1975 |
| #1415 | 2026-09-08 | Morning health digest — 2026-09-08 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-08 remplacé par #2036 |
| #1420 | 2026-09-09 | Morning health digest — 2026-09-09 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-09 remplacé par #2036 |
| #1435 | 2026-09-10 | Morning health digest — 2026-09-10 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-10 remplacé par #2036 |
| #1449 | 2026-09-11 | Morning health digest — 2026-09-11 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-11 remplacé par #2036 |
| #1487 | 2026-09-14 | Morning health digest — 2026-09-14 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-14 remplacé par #2036 |
| #1488 | 2026-09-14 | Weekly PR hygiene W38 — 2026-09-14 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W38 remplacé par #1975 |
| #1489 | 2026-09-15 | Morning health digest — 2026-09-15 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-15 remplacé par #2036 |
| #1490 | 2026-09-16 | Morning health digest — 2026-09-16 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-16 remplacé par #2036 |
| #1501 | 2026-09-17 | Morning health digest — 2026-09-17 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-17 remplacé par #2036 |
| #1517 | 2026-09-18 | Morning health digest — 2026-09-18 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-18 remplacé par #2036 |
| #1525 | 2026-09-21 | Morning health digest — 2026-09-21 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-21 remplacé par #2036 |
| #1526 | 2026-09-21 | Weekly PR hygiene W39 — 2026-09-21 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W39 remplacé par #1975 |
| #1527 | 2026-09-22 | Morning health digest — 2026-09-22 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-22 remplacé par #2036 |
| #1528 | 2026-09-23 | Morning health digest — 2026-09-23 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-23 remplacé par #2036 |
| #1558 | 2026-09-24 | Morning health digest — 2026-09-24 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-24 remplacé par #2036 |
| #1579 | 2026-09-25 | Morning health digest — 2026-09-25 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-25 remplacé par #2036 |
| #1583 | 2026-09-28 | Morning health digest — 2026-09-28 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-28 remplacé par #2036 |
| #1585 | 2026-09-28 | Weekly PR hygiene W40 — 2026-09-28 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W40 remplacé par #1975 |
| #1594 | 2026-09-29 | Morning health digest — 2026-09-29 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-29 remplacé par #2036 |
| #1621 | 2026-09-30 | Morning health digest — 2026-09-30 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-09-30 remplacé par #2036 |
| #1653 | 2026-10-01 | Morning health digest — 2026-10-01 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-01 remplacé par #2036 |
| #1693 | 2026-10-02 | Morning health digest — 2026-10-02 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-02 remplacé par #2036 |
| #1734 | 2026-10-05 | Morning health digest — 2026-10-05 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-05 remplacé par #2036 |
| #1736 | 2026-10-05 | Weekly PR hygiene W41 — 2026-10-05 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W41 remplacé par #1975 |
| #1739 | 2026-10-06 | Morning health digest — 2026-10-06 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-06 remplacé par #2036 |
| #1740 | 2026-10-07 | Morning health digest — 2026-10-07 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-07 remplacé par #2036 |
| #1744 | 2026-10-08 | Morning health digest — 2026-10-08 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-08 remplacé par #2036 |
| #1746 | 2026-10-09 | Morning health digest — 2026-10-09 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-09 remplacé par #2036 |
| #1765 | 2026-10-12 | Morning health digest — 2026-10-12 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-12 remplacé par #2036 |
| #1766 | 2026-10-12 | Weekly PR hygiene W42 — 2026-10-12 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W42 remplacé par #1975 |
| #1772 | 2026-10-13 | Morning health digest — 2026-10-13 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-13 remplacé par #2036 |
| #1781 | 2026-10-14 | Morning health digest — 2026-10-14 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-14 remplacé par #2036 |
| #1799 | 2026-10-15 | Morning health digest — 2026-10-15 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-15 remplacé par #2036 |
| #1810 | 2026-10-16 | Morning health digest — 2026-10-16 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-16 remplacé par #2036 |
| #1836 | 2026-10-19 | Morning health digest — 2026-10-19 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-19 remplacé par #2036 |
| #1843 | 2026-10-19 | Weekly PR hygiene W43 — 2026-10-19 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W43 remplacé par #1975 |
| #1851 | 2026-10-20 | Morning health digest — 2026-10-20 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-20 remplacé par #2036 |
| #1853 | 2026-10-21 | Morning health digest — 2026-10-21 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-21 remplacé par #2036 |
| #1864 | 2026-10-22 | Morning health digest — 2026-10-22 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-22 remplacé par #2036 |
| #1872 | 2026-10-23 | Morning health digest — 2026-10-23 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-23 remplacé par #2036 |
| #1890 | 2026-10-26 | Morning health digest — 2026-10-26 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-26 remplacé par #2036 |
| #1894 | 2026-10-26 | Weekly PR hygiene W44 — 2026-10-26 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W44 remplacé par #1975 |
| #1903 | 2026-10-27 | Morning health digest — 2026-10-27 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-27 remplacé par #2036 |
| #1907 | 2026-10-28 | Morning health digest — 2026-10-28 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-28 remplacé par #2036 |
| #1916 | 2026-10-29 | Sitemap regen failed - 2026-10-29 | `dept:07-seo` | forte | échec de la régénération quotidienne du sitemap le 2026-10-29 | fermer | sitemap-daily-regen en succès chaque jour du 2026-11-11 au 2026-11-15 ; producteur unique depuis #2027 |
| #1917 | 2026-10-29 | Morning health digest — 2026-10-29 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-29 remplacé par #2036 |
| #1923 | 2026-10-30 | Morning health digest — 2026-10-30 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-10-30 remplacé par #2036 |
| #1947 | 2026-10-31 | Passation ChatGPT Space → Claude Code CLI (code) + Codex (revue) — retrait me… | `dept:23-ia-agents` | forte | passation du code vers Claude Code CLI et de la revue vers Codex | garder | PR liées #1924, #1938 et #1944 encore ouvertes |
| #1951 | 2026-11-02 | Morning health digest — 2026-11-02 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-11-02 remplacé par #2036 |
| #1952 | 2026-11-02 | Weekly PR hygiene W45 — 2026-11-02 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | fermer | instantané W45 remplacé par #1975 |
| #1953 | 2026-11-03 | Morning health digest — 2026-11-03 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-11-03 remplacé par #2036 |
| #1955 | 2026-11-04 | Morning health digest — 2026-11-04 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-11-04 remplacé par #2036 |
| #1959 | 2026-11-05 | Morning health digest — 2026-11-05 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-11-05 remplacé par #2036 |
| #1962 | 2026-11-06 | Morning health digest — 2026-11-06 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-11-06 remplacé par #2036 |
| #1971 | 2026-11-09 | Morning health digest — 2026-11-09 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-11-09 remplacé par #2036 |
| #1975 | 2026-11-09 | Weekly PR hygiene W46 — 2026-11-09 (📦 PR-9b first batch upgrade (scope ≤ 3 pa… | `dept:23-ia-agents` | moyenne | bilan hebdomadaire de la file des PR (stale, conflits, Dependabot) | garder | bilan le plus récent de la série (W46, 2026-11-09) |
| #1985 | 2026-11-10 | Morning health digest — 2026-11-10 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-11-10 remplacé par #2036 ; trois digests le 2026-11-10 (#1985, #2001, #2002) |
| #2001 | 2026-11-10 | Morning health digest — 2026-11-10 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-11-10 remplacé par #2036 ; trois digests le 2026-11-10 (#1985, #2001, #2002) |
| #2002 | 2026-11-10 | Morning health digest — 2026-11-10 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-11-10 remplacé par #2036 ; trois digests le 2026-11-10 (#1985, #2001, #2002) |
| #2005 | 2026-11-11 | Morning health digest — 2026-11-11 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-11-11 remplacé par #2036 |
| #2034 | 2026-11-12 | Morning health digest — 2026-11-12 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | fermer | instantané du 2026-11-12 remplacé par #2036 |
| #2036 | 2026-11-13 | Morning health digest — 2026-11-13 | `dept:21-runtime` | forte | digest de santé du matin (fraîcheur sitemap, déploiements main, PR en échec) | garder | digest le plus récent de la série (2026-11-13) |
| #2073 | 2026-11-15 | Pilotage de la file (pilote-file, ADR-128 D6) | `dept:23-ia-agents` | forte | issue de récapitulatif de la routine pilote-file (ADR-128 D6) | garder | tenue par la routine à chaque exécution |

## PR ouvertes sans issue liée

Le mandat en annonçait 38, chiffre de l'exécution à blanc de pilote-file du 2026-11-14T23:31Z
(39 PR ouvertes alors). Au relevé, 36 PR ouvertes sur 37 n'ont aucun `Refs`/`Closes`/`Fixes`
vers une issue : c'est le motif de `prs_sans_issue` dans `scripts/ops/pilote-file.constats.jq`. Le
récapitulatif de 12:09:58Z compte aussi 36. Pour chacune, la colonne « Issue à citer » donne
l'issue ouverte qui la couvre, ou `aucune`.

| PR | Brouillon | Titre | Issue à citer | Confiance | Fondement |
|---|---|---|---|---|---|
| #824 | oui | feat(merchant-center): GMC price-competitiveness benchmark (inbound, OBSERVE-… | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #897 | non | chore(deps-dev): bump eslint-import-resolver-typescript from 3.10.1 to 4.4.5 | aucune | forte | mise à jour Dependabot ; aucune issue ouverte ne la couvre |
| #966 | oui | feat(catalog): PR1 — vérité canonique de vendabilité (rollup type×gamme) | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1025 | oui | feat(seo-observability): boucle OBSERVE — attribution + mesure + restitution… | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1225 | oui | fix(registry): atomic occurrences[] + independent semantic-fidelity gate (dep… | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1253 | non | chore(deps-dev): bump @commitlint/config-conventional from 20.5.3 to 21.2.0 | aucune | forte | mise à jour Dependabot ; aucune issue ouverte ne la couvre |
| #1576 | non | chore(deps): bump meilisearch from 0.52.0 to 0.62.0 | aucune | forte | mise à jour Dependabot ; aucune issue ouverte ne la couvre |
| #1577 | non | chore(deps): bump nodemailer from 8.0.11 to 10.1.7 | aucune | forte | mise à jour Dependabot ; aucune issue ouverte ne la couvre |
| #1584 | oui | fix(seo): protéger les tâches de maintenance du tracking | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1672 | oui | fix(edge): répondre 404 sur /api/observability/* à l'edge, vérifié à chaque d… | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1690 | oui | fix(marketing): enforce brief approval guards and actor provenance | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1718 | oui | feat(cron): décision de promotion WIKI rejouée chaque jour en dry-run (ADR-083) | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1817 | non | chore(deps-dev): bump the dev-dependencies group across 1 directory with 31 u… | aucune | forte | aucune issue ouverte ne la couvre ; les numéros #1449, #1962, #788, #807, #808 du corps renvoient aux notes de version du paquet amont, pas à ce dépôt |
| #1826 | oui | fix(media-factory): qualifier les résultats d’exécution vidéo (L10) | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1829 | oui | fix(media-factory): qualifier les rendus et refuser les preuves absentes | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1839 | oui | fix(media-factory): lier les sources du rendu et aligner la revue humaine | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1863 | non | fix(orders): annuler en base une commande payée dont le paiement est annulé a… | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1924 | oui | fix(agents): raccorder les skills des workspaces et conserver Claude CLI prin… | #1947 | forte | le corps de la PR cite #1947 (passation Claude Code CLI / Codex) |
| #1926 | non | fix(diagnostic): conserver la motorisation (type_id) jusqu'aux liens catalogue | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1938 | oui | docs(editorial): brief commun du programme, dossier pilote filtre à huile | #1947 | forte | PR référencée par #1947 (même passation) |
| #1940 | oui | docs(editorial): filtre à huile, révision 5 — déclinaisons sociales et médias… | #1947 | moyenne | même programme éditorial filtre à huile que #1938, sans renvoi direct |
| #1943 | non | fix(r1): sélecteur de véhicule avant l'image du hero sur mobile [visual-change] | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1944 | oui | feat(seo): lot de publication filtre à huile pg 7 — migrations a et c, h2 et… | #1947 | forte | PR référencée par #1947 (même passation) |
| #1945 | oui | fix(media-factory): capturer le schéma des 6 tables vidéo, créées hors du dépôt | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1950 | oui | ci(dod-gate): DoD2 vérifie l'enregistrement de revue d'ADR-120 | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1958 | oui | docs(design-system,marketing): polices de secours et préparations éditoriales… | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1968 | oui | ci(audit): exécuter les Deterministic gates sur chaque PR, verdict fail-close… | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1980 | oui | test(invoices): couvrir InvoicesService (liste paginée, détail, compteur) | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1994 | non | fix(claude-hooks): qualifier la cible des commandes Docker au lieu d'un motif… | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #1995 | non | fix(claude-hooks): hook Stop en suggestion seule, tampon SessionStart par inv… | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #2057 | non | chore(ci): retirer les étapes Slack jamais exécutées (patch .github/ owner) | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #2062 | oui | docs(knowledge): l'index renvoie aux règles de recherche, sans liens morts | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #2063 | oui | docs(ai-cos): marquer comme historiques les mentions du prototype ai-agents-p… | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #2070 | oui | fix(seo): retire les renvois vivants vers content-gen et conseil-batch | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #2072 | non | fix(claude-hooks): refuser npm ci/install à travers un node_modules en lien s… | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |
| #2074 | non | fix(ops): la synchro DEV arrête automecanik-dev pendant son npm ci | aucune | forte | aucune issue ouverte ne la couvre au relevé (titre et corps comparés à la file) |

## Limites

- **La cause de l'accumulation n'est pas traitée.** Fermer les 156 digests ne suffit pas :
  `morning-health-digest.yml` et `weekly-pr-hygiene.yml` en rouvriront un à chaque exécution.
  Pour s'arrêter, un workflow devrait fermer ou mettre à jour l'instantané précédent. Toute
  modification sous `.github/workflows/` est hors de ce mandat (ADR-130 D3.4).
- **Recouvrement possible.** #1975 (bilan hebdomadaire des PR) et #2073 (récapitulatif
  pilote-file) relèvent tous deux l'état de la file des PR. Garder les deux, ou n'en garder
  qu'un, est une décision de l'owner.
- **Base non lue.** Les preuves de #264 (scores du moteur de diagnostic) et de la partie « règle
  en base » de #745 ne sont pas vérifiées en base, qui est hors périmètre.
- **Preuve servie ponctuelle.** Pour #744 et #745, l'état servi a été lu une fois au relevé, sur
  une seule page. Ce n'est pas une mesure continue.
- **Fermetures.** Les propositions s'appuient sur une preuve citée, mais la décision revient à
  l'owner. Les commandes, non exécutées, sont dans
  `docs/plans/2026-11-15-adr128-triage-file-fermetures.md`.
- **Instantané daté.** Une issue ouverte ou fermée après 2026-11-15T12:10:47Z n'est pas dans
  ce tableau. Le script ignore une issue fermée entre-temps, ou qui porte déjà un label `dept:`.

## Commandes (owner)

Les labels `dept:` doivent exister (`docs/plans/2026-11-15-adr128-labels-d1.md`), sinon
`gh issue edit` échoue sur la ligne concernée et le script passe à la suivante.

```bash
bash scripts/ops/triage-file-apply.sh            # à blanc : affiche les 11 commandes, aucun appel gh
bash scripts/ops/triage-file-apply.sh --apply    # avec le compte de l'owner : fait le 2026-11-15 à 13:08 UTC
```

Retour arrière d'une ligne : `gh issue edit <n> --repo ak125/nestjs-remix-monorepo --remove-label "<dept:…>"`.
