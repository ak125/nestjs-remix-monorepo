# Tri des ADR du governance-vault (lecture seule, 2026-11-16)

Source : `/opt/automecanik/governance-vault/ledger/decisions/adr/` à HEAD 501982d (= origin/main), 120 fichiers.
Le frontmatter (status, supersedes, superseded_by, amends, amended_by) a été lu sur les 120 fichiers.
Les mécanismes ont été vérifiés par `rg` borné dans `/opt/automecanik/app/.claude/worktrees/mandat-ar-governance-20261116` (hors node_modules, .git, dist et *.md).
Les numéros présents seulement en PR viennent de `gh pr list` sur ak125/governance-vault.
Décisions de référence : 72 = le monorepo devient la seule source ; 73 = le vault est archivé en lecture seule.
Ce tri ne tranche aucun conflit : il les signale.

## 1. Tableau des ADR

| ADR | titre court | statut frontmatter | verdict | remplacé par / amendé par | raison |
|---|---|---|---|---|---|
| 001 | Séparation des environnements | accepted | toujours valable | amendé par 075 | Accepted, non remplacé ; 075 en précise le vocabulaire (DEV/PREPROD/PROD). |
| 002 | Airlock zero-trust | accepted-revised | toujours valable | amendé par 102 | Le §2.1 (pipeline de bundles) est retiré par 102 ; le principe zero-trust et le §2.2 restent. |
| 003 | Gouvernance des RPC | accepted | toujours valable | — | RpcGateService est présent (62 fichiers de code). |
| 004 | Périmètre du module rm/ | accepted | toujours valable | — | Accepted, non remplacé ; présence réelle non vérifiée (le motif « rm/ » est ambigu, 51 fichiers). |
| 005 | Activation Airlock observe | superseded | remplacé | remplacé par 010 | 010 porte `supersedes: ADR-005`. |
| 006 | Architecture orchestrateur IA | superseded | remplacé | remplacé par 011 et 025 | superseded_by 011/025 ; LangGraph et MiniLo jamais construits (0 fichier). |
| 007 | Indépendance de localisation | accepted | toujours valable | amendé par 102 | Accepted, non remplacé. |
| 008 | Règles de placement des agents | accepted | toujours valable | amendé par 102, 118, 129 | Les lignes AI-COS et la zone `aicos_vps` sont sans objet (129 D4) ; le reste vaut. |
| 009 | Activation agents phase 1 | accepted-revised | toujours valable | amendé par 102, 118, 129 | Les agents AI-COS L1/L2 sont `disabled` (129 D2) ; le reste vaut. |
| 010 | Activation Airlock enforce | accepted | toujours valable | supersedes 005 ; amendé par 102 | Accepted, non remplacé ; Airlock réduit au RPC gate par 102. |
| 011 | Remplacement OpenClaw par Claude API | accepted | toujours valable | amendé par 102, 118, 129 | Machine et orchestrateur `ai-cos-system` sans objet (129 D4) ; agent-submissions = 0 fichier ; le remplacement d'OpenClaw reste. |
| 012 | Architecture VPS AI-COS | accepted | toujours valable | amendé par 102, 129 | Amendé en deux machines DEV et PROD (129 D1) ; la machine AI-COS est retirée. |
| 013 | Cycle de vie des agents | accepted | toujours valable | amendé par 102 | Accepted, non remplacé ; ses niveaux G1/G2 renvoient au circuit de PR du vault (en conflit avec décision 72 : lieu des changements de catalogue). |
| 014 | Retrait du callback-test Paybox | accepted | toujours valable | — | La suppression est effective (callback-test = 0 fichier de code). |
| 015 | Vault, source unique de vérité | accepted | toujours valable | amendé par 101, 129 | **En conflit avec décision 72** : pose le vault comme seule source et le CLAUDE.md comme pointeur ; **en conflit avec décision 73** sur ce même point. |
| 016 | Matview des pages véhicule | accepted | toujours valable | — | `__vehicle_page_cache` est présent (34 fichiers). |
| 017 | Nettoyage des casts RPC pieces | accepted | toujours valable | — | Accepted, non remplacé ; présence non vérifiée. |
| 018 | Consolidation des schémas double colonne | deferred | à trancher | — | Deferred, jamais tranché. |
| 019 | Escalade de l'AI content advisor | accepted | toujours valable | — | generateContentWithAdvisor est présent (2 fichiers). |
| 020 | Lint hebdomadaire du vault | accepted | toujours valable | — | Mécanisme interne au vault (vault-weekly-lint = 0 fichier dans le monorepo) ; **en conflit avec décision 73** : sans objet si le vault est archivé. |
| 021 | Durcissement RLS zero-trust | accepted | toujours valable | — | Accepted, non remplacé. |
| 022 | Plan de contrôle RAG R8 | superseded | remplacé | remplacé par 031 | 031 porte `supersedes: ADR-022`. |
| 023 | Défense par couche de hooks | accepted | toujours valable | — | Les hooks nommés (block-local-vault, guard-local-governance) = 0 fichier de code ; leur nom actuel n'est pas vérifié ; à relire avec la décision 73. |
| 024 | Matview des pages gamme R1 | accepted | toujours valable | — | `__gamme_page_cache` est présent (17 fichiers). |
| 025 | Architecture du département SEO | accepted | toujours valable | amendé par 037, 105 | Accepted, non remplacé. |
| 026 | Séparation des contenus | superseded | remplacé | remplacé par 031 | 031 porte `supersedes: ADR-026`. |
| 027 | Consolidation de R5 dans R3 | accepted | toujours valable | amendé par 112 | Accepted, non remplacé. |
| 028 | Isolation de Supabase PREPROD | accepted | toujours valable | — | Accepted (Option D, PREPROD en lecture seule). |
| 029 | Clôture du plan de contrôle RAG v2.1 | rejected | obsolète | amendé par 031 | Rejected. |
| 030 | npm --ignore-scripts (Alpine musl) | accepted | toujours valable | — | `--ignore-scripts` est présent (1 fichier). |
| 031 | Architecture de contenu à quatre couches | accepted | toujours valable | supersedes 022, 026 ; amende 029 ; amendé par 096, 119, 125 | RAW → WIKI → exports → consommateurs ; pas de conflit direct, mais la chaîne 031/119/125 est à condenser en une seule formule. |
| 032 | Unification diagnostic et maintenance | superseded | remplacé | remplacé par 112 | 112 porte `supersedes: ADR-032`. |
| 033 | Contrat des relations gamme-diagnostic WIKI | accepted | toujours valable | amendé par 083, 112, 113, 116 | Accepted, non remplacé. |
| 034 | Contrat d'exploitation AI-COS | accepted | toujours valable | amendé par 128, 129 | 129 D3 le garde comme contrat des routines (trois axes, un déclencheur unique) ; seule la machine disparaît. |
| 035 | Drapeau de confiance des sources diagnostic | accepted | toujours valable | amendé par 112, 115 | Accepted, non remplacé. |
| 036 | Couche d'exploitation marketing | accepted | toujours valable | amendé par 038 | OperatingMatrixService est présent (13 fichiers). |
| 037 | Nommage canonique des agents | accepted | toujours valable | amende 025 | Accepted, non remplacé. |
| 038 | Nommage des agents marketing | accepted | toujours valable | amende 036 | Accepted, non remplacé. |
| 039 | Frontmatter WIKI en Zod | accepted | toujours valable | — | Accepted, non remplacé. |
| 040 | Rôles SEO canon côté TS | accepted | toujours valable | amendé par 047 | Accepted, non remplacé. |
| 041 | R1 routeur pur | accepted | toujours valable | — | Accepted, non remplacé. |
| 042 | Générateur de squelettes de gamme WIKI | superseded | remplacé | remplacé par 031 | superseded_by 031 ; gamme-skeleton-generator = 0 fichier. |
| 043 | Plan F DevSecOps, phase 1 | accepted | toujours valable | — | Accepted, non remplacé. |
| 044 | Stratégie SEO 2026, priorité des rôles | rejected | obsolète | — | Rejected ; la PR #173 (proposition, renommage R3) est dormante. |
| 045 | Cron de monitoring SEO v0 | accepted | toujours valable | amendé par 063 | Accepted, non remplacé. |
| 046 | R-stack : générateur unique et couches | accepted | toujours valable | — | Un générateur par rôle ; règles métier seulement dans seo-role-contracts ; L3 RAG en lecture seule. |
| 047 | seo-role-contracts as code | accepted | toujours valable | amende 040 | seo-role-contracts est présent (49 fichiers). |
| 048 | Couverture de l'application du canon | accepted | toujours valable | — | Le registre REG-002 est tenu dans le vault (3 fichiers le citent dans le monorepo) ; **en conflit avec décision 72** : lieu du registre. |
| 049 | Application du canon à la gouvernance DB | accepted | toujours valable | — | Même registre REG-002 dans le vault ; **en conflit avec décision 72** : lieu du registre. |
| 050 | Historique qualité et détection de dérive | accepted | toujours valable | — | `__seo_quality_history` est présent (12 fichiers). |
| 053 | Système Planning Live | accepted | toujours valable | amendé par 104 | Writer retiré et MOC figé par 104 ; le MOC vit dans le vault (à relire avec la décision 73). |
| 055 | Architecture du mode shadow SEO | accepted | toujours valable | — | SeoShadowObservatory est présent (15 fichiers). |
| 056 | Achèvement du runtime R7 marque | accepted | toujours valable | — | ExecutionRouterService est présent (10 fichiers). |
| 057 | Modèle d'adoption de marketingskills | deferred | à trancher | (PR #421 amende) | Deferred ; la PR #421 (ADR-137, draft) l'amende. |
| 058 | Repository Control Plane | accepted | toujours valable | — | Accepted, non remplacé ; L1/L2 sont déjà dans le monorepo. |
| 059 | Projection runtime SEO | accepted | toujours valable | amendé par 090, 099 | Accepted, non remplacé. |
| 060 | Doctrine des rôles des dépôts | accepted | toujours valable | amendé par 119 | « Vault décide », canon écrit par PR signée G3, le monorepo n'écrit jamais dans le vault ; **en conflit avec décision 72** (rôle du vault) et **avec décision 73**. |
| 061 | Gouvernance des workspaces | accepted | toujours valable | — | Le §3 synchronise les canon-mirrors depuis le vault (3 miroirs, sync_canon_mirrors = 0 fichier) ; **en conflit avec décision 72** : sens de la source des miroirs. |
| 062 | Méta-modèle des contrats de dépôt | accepted | toujours valable | — | Accepted, non remplacé. |
| 063 | Monitoring CWV PROD par l'API CrUX | accepted | toujours valable | amende 045 | crux est présent (37 fichiers). |
| 064 | Plan de contrôle de la production SEO | accepted | toujours valable | — | Accepted, non remplacé. |
| 065 | Sécurité des migrations par squawk | accepted | toujours valable | — | squawk est présent (97 fichiers). |
| 066 | Composition de contenu R2 v2 | accepted | toujours valable | amendé par 067, 068, 070, 072, 095, 125 | catalog_signature (10 fichiers) et R2EligibilityService (11) sont présents. |
| 067 | R2 : pas de suppression automatique | accepted | toujours valable | amende 066 | Le statut SUPPRESSED automatique est interdit. |
| 068 | R2 : pas de désindexation automatique | accepted | toujours valable | amende 066 ; amendé par 070, 125 | Les 4 actions automatiques restent interdites. |
| 070 | R8/R1 d'abord, R2 ensuite | accepted | toujours valable | amende 066, 068 | Accepted, non remplacé. |
| 072 | R2 CQRS, DDD et snapshot | accepted | toujours valable | amende 066 | Accepted, non remplacé. |
| 073 | Fact graph L3/L4, extension d'ADR-070 | deferred | à trancher | — | Deferred. |
| 074 | Plan de décision d'indexabilité unifié | accepted | toujours valable | — | Accepted le 2026-11-10, borné à ce qui est livré (uidp : 10 fichiers). |
| 075 | Clarification de la topologie de déploiement | accepted | toujours valable | amende 001 | Six objets et six preuves de déploiement. |
| 076 | Stratégie soft-404 R2 | accepted | toujours valable | — | HTTP 200 + noindex,follow, ni 404 ni 410. |
| 077 | Gates de preuve du diagnostic CP v1 | accepted | toujours valable | — | Accepted, non remplacé. |
| 078 | Récupération pieces_media_img tier C | accepted | toujours valable | — | Accepted, non remplacé ; présence non vérifiée. |
| 079 | Plan de contrôle des médias produit | accepted | toujours valable | — | Accepted, non remplacé ; présence non vérifiée. |
| 080 | Doctrine de résolution d'intention v1 | accepted | toujours valable | amendé par 112 | Accepted, non remplacé. |
| 081 | Amendements d'agilité doctrinale | accepted | toujours valable | — | Clause d'expiration G9 et budget d'exploration G10, logés dans rules-governance-process du vault (à relire avec la décision 73). |
| 082 | Amélioration continue globale | accepted | toujours valable | — | Accepted, non remplacé ; règle advisory. |
| 083 | Promotion WIKI par paliers | accepted | toujours valable | amendé par 086, 088, 114, 119, 125 | Accepted, non remplacé ; chaîne d'amendements à condenser. |
| 085 | type_id séquentiel Massdoc | accepted | toujours valable | — | Accepted ; présence réelle non vérifiée (type_id_seq : 1 fichier, allocate_type_id : 0). |
| 086 | Contrat éditorial de l'encyclopédie | accepted | toujours valable | amendé par 088, 108, 111, 125 | R2 = R1 ⊕ R8. |
| 087 | Orchestration du Command Center | accepted | toujours valable | — | Accepted, non remplacé. |
| 088 | Score de substance de la gate de promotion | accepted | toujours valable | amende 083, 086 | Accepted, non remplacé. |
| 089 | Coverage-map de contenu canon | accepted | toujours valable | — | Accepted, non remplacé. |
| 090 | Forward writer de projection SEO | accepted | toujours valable | amendé par 099, 103, 111, 112 | Accepted, non remplacé. |
| 091 | Recalibrage du score WIKI | accepted | toujours valable | (seuil fixé par 125) | Seuil 0.85 fixé par 125. |
| 092 | Gate de contenu rank1 | accepted | toujours valable | — | Accepted, non remplacé. |
| 093 | Gate EARN de l'auto-review | accepted | toujours valable | — | Accepted, non remplacé. |
| 094 | Gate composite de qualité de page | accepted | toujours valable | — | Accepted, non remplacé. |
| 095 | Gate dure anti-duplication des balises | accepted | toujours valable | amende 066 | Gate sur indexable_effective. |
| 096 | Découverte de sources gouvernée | accepted | toujours valable | amende 031 | Accepted, non remplacé. |
| 099 | Placement runtime du writer et transport des exports | accepted | toujours valable | amende 059, 090 | Writer dans le conteneur PROD. |
| 101 | Le vault décide l'autorité du canon | accepted | toujours valable | amende 015 ; amendé par 121 | D1 : seuls les ADR accepted non remplacés sont normatifs ; règles modifiables par PR signée au vault ; **en conflit avec décision 72** et **avec décision 73**. |
| 102 | Airlock = RPC gate, canal de bundles retiré, G4 | accepted | toujours valable | amendé par 123 | Canal unique « branche + PR », « un agent ne fusionne jamais » ; G4 = PR signée au vault et fusion humaine ; **en conflit avec décision 72/73** sur G4 (lieu et forme des changements de règle). |
| 103 | Consolidation de R6 dans R3 | accepted | toujours valable | amende 090 | R6 retiré de l'index. |
| 104 | Retrait du writer Planning Live | accepted | toujours valable | amende 053 | Writer retiré, MOC figé. |
| 105 | Retrait de l'index GIN de __seo_event_log | accepted | toujours valable | amende 025 | Accepted, non remplacé. |
| 106 | Contrat de rendu de la projection R3 | accepted | toujours valable | — | Accepted, non remplacé. |
| 107 | Export WIKI des listes structurées et FAQ | accepted | toujours valable | — | Accepted, non remplacé. |
| 108 | Contrat de rendu de la projection R4 | accepted | toujours valable | amende 086 | Accepted, non remplacé. |
| 109 | Contrat éditorial et de rendu R7 | accepted | toujours valable | — | Accepted, non remplacé. |
| 110 | Contrat de rendu R8 véhicule-moteur | accepted | toujours valable | — | Accepted, non remplacé. |
| 111 | Re-sourcing WIKI de R1 | accepted | toujours valable | amende 086, 090 | Une autorité par champ ; les slots R1 ne sont jamais réécrits. |
| 112 | Base de connaissance diagnostic canon | accepted | toujours valable | supersedes 032 ; amende 027, 033, 035, 080, 090 | Base sourcée WIKI, une seule voie d'écriture. |
| 113 | Cible de couverture diagnostic | accepted | toujours valable | amende 033 | Accepted, non remplacé. |
| 114 | Safety Auto-Gate WIKI | accepted | toujours valable | amendé par 119 | Accepted, non remplacé. |
| 115 | La projection diagnostic exige une relecture | accepted | toujours valable | amende 035 | Seule une relation relue est projetée. |
| 116 | Règle de relecture des relations diagnostic | accepted | toujours valable | amendé par 117 | Accepted, non remplacé. |
| 117 | Révision canon du promoteur WIKI | accepted | toujours valable | amende 116 | Accepted, non remplacé. |
| 118 | Retrait de BMAD, Superpowers et Spec Kit | accepted | toujours valable | — | Accepted, non remplacé. |
| 119 | Auto-review sémantique WIKI à la place de la relecture humaine | accepted | toujours valable | amende 031, 060, 083, 114 | Aucune relecture humaine n'est une condition de promotion ; chaîne 031/119/125 à condenser. |
| 120 | DoD2, preuve de revue liée au SHA | accepted | toujours valable | amendé par 121, 123 | pr-dod-gate.mjs cite rules-engineering-definition-of-done du vault ; **en conflit avec décision 73** : la règle source est dans le vault archivé. |
| 121 | Mandat, revue, décision et fusion : actes distincts | accepted | toujours valable | amende 101, 120 ; amendé par 123 | D1 : le mandat couvre son exécution ; **en conflit avec décision 72** sur les niveaux G1/G4 des règles du vault. |
| 123 | Fusion automatique conditionnelle, périmètre adopté | accepted | toujours valable | amende 102, 120, 121 | Le périmètre adopté est une politique du vault ; **en conflit avec décision 72/73** : lieu du périmètre. |
| 124 | Premier périmètre de fusion automatique | accepted | toujours valable | — | scripts/ci/merge-perimeter-gate.mjs lit `ledger/policies/merge-perimeter.v1.json` sur `main` d'ak125/governance-vault ; **en conflit technique avec décision 73**. |
| 125 | Amendements ciblés de cohérence WIKI/SEO/autorité | accepted | toujours valable | amende 031, 066, 068, 083, 086, 091, rules-vault G1 | Amende la G1 de rules-vault (vault) ; chaîne 031/119/125 à condenser ; **en conflit avec décision 73** pour sa partie G1. |
| 126 | Obsidian, lecteur facultatif du vault | accepted | toujours valable | — | Ne vise que la lecture du vault ; **en conflit avec décision 73** : sans objet si le vault est archivé. |
| 127 | Identité des wikilinks par chemin (G2) | accepted | toujours valable | — | Ne vise que les liens du vault ; **en conflit avec décision 73** : sans objet si le vault est archivé. |
| 128 | Départements autonomes, file GitHub | accepted | toujours valable | amende 034 ; amendé par 130 | File unique = issues du monorepo (pilote-file : 4 fichiers). |
| 129 | Retrait de la machine AI-COS et du système d'agents | accepted | toujours valable | amende 008, 009, 011, 012, 015, 034 | AI-COS absent du code (airlock.sh, langgraph : 0 fichier). |
| 130 | Amendement d'ADR-128 (runner PROD, pilote) | accepted | toujours valable | amende 128 | Accepted, non remplacé. |

### Numéros absents de `main`

| ADR | état | verdict | raison |
|---|---|---|---|
| 051 | PR #211 | à trancher — PR ouverte | Jamais fusionné dans `main`. |
| 052 | PR #241 et PR #214, concurrentes | à trancher — PR ouverte | Deux PR concurrentes pour un même numéro. |
| 054 | PR #242 | à trancher — PR ouverte | Jamais fusionné. |
| 069, 071 | réservés | — | Jamais rédigés. |
| 084 | PR #315 | à trancher — PR ouverte | 085 est déjà fusionné ; 084 reste en PR. |
| 097 | PR #344 | à trancher — PR ouverte | Jamais fusionné. |
| 098, 100 | introuvables | — | Absents de `main` et des PR. |
| 122 | PR #392 (draft) | à trancher — PR ouverte | Draft. |
| 131 | PR #413 | hors périmètre (PR #413) | — |
| 132 | PR #414 (draft) | à trancher — PR ouverte | Draft. |
| 133 | PR #416 | à trancher — PR ouverte | Ouverte. |
| 134 | PR #415 (draft) | à trancher — PR ouverte | Draft. |
| 135 | PR #417 (draft) | à trancher — PR ouverte | Présent seulement en PR. |
| 136 | PR #418 (draft) | à trancher — PR ouverte | Présent seulement en PR. |
| 137 | PR #421 (draft) | à trancher — PR ouverte | Présent seulement en PR ; amende 057. |

Deux PR dormantes portent sur des ADR déjà présents : #196 (ratification de 047 et 050) et #173 (proposition 044).

### Comptes (120 fichiers de `main`)

- toujours valable : 109. Parmi eux, 19 ont un conflit ou un point à relire signalé avec la décision 72 ou 73 : 013, 015, 020, 023, 048, 049, 053, 060, 061, 081, 101, 102, 120, 121, 123, 124, 125, 126, 127. Les chaînes 031/083/119/125 sont seulement à condenser.
- remplacé : 6 (005, 006, 022, 026, 032, 042).
- obsolète : 2 (029, 044, tous deux rejected).
- à trancher : 3 (018, 057, 073, deferred).
- Hors `main` : 13 « à trancher — PR ouverte » (051, 052, 054, 084, 097, 122, 132 à 137) et 1 hors périmètre (131).

## 2. Principes encore valables

Chaque principe vient d'un ADR classé « toujours valable ». Quand un ADR est en conflit avec la décision 72/73, la formule ne garde que la partie hors conflit.

1. DEV, PREPROD et PROD restent séparés. Un déploiement se décrit par six objets et six preuves (ADR-001, ADR-075).
2. Aucun agent n'accède directement à la PROD (zero-trust) (ADR-002 §2.2).
3. Les écritures sensibles en base passent par le RPC gate ; Airlock désigne ce gate (ADR-003, ADR-102).
4. Toute table exposée est protégée par RLS (ADR-021).
5. Aucun endpoint de test de paiement n'existe en PROD (ADR-014).
6. La base PREPROD est en lecture seule (ADR-028).
7. Les images installent leurs dépendances npm avec `--ignore-scripts` (ADR-030).
8. Toute migration passe squawk avant d'être appliquée (ADR-065).
9. Le contenu suit RAW → WIKI → exports → consommateurs, et aucun consommateur ne lit RAW (ADR-031).
10. Le RAG est un consommateur en lecture seule. Il n'a aucune autorité de production de contenu (ADR-046, ADR-031).
11. Chaque rôle SEO a un seul générateur. Les règles métier vivent seulement dans seo-role-contracts (ADR-046, ADR-047).
12. Une promotion WIKI se fait sur preuve, par auto-review sémantique. Aucune relecture humaine n'en est une condition (ADR-119, ADR-125).
13. Le seuil de score de promotion WIKI est 0.85 (ADR-091, ADR-125).
14. Quatre actions sont interdites en automatique : supprimer, désindexer, pointer le canonical vers une page sœur, exclure du sitemap (ADR-067, ADR-068).
15. Une page sans contenu valable répond HTTP 200 avec noindex,follow, jamais 404 ni 410 (ADR-076).
16. R2 se compose de R1 ⊕ R8 et préserve `catalog_signature` (ADR-066, ADR-086).
17. Une gate dure bloque les balises dupliquées sur les pages `indexable_effective` (ADR-095).
18. Chaque champ a une seule autorité, et les slots R1 ne sont jamais réécrits (ADR-111).
19. La base de diagnostic est sourcée WIKI et n'a qu'une voie d'écriture (ADR-112).
20. Seule une relation diagnostic relue est projetée (ADR-115).
21. `type_id` est une séquence globale monotone, jamais réutilisée. KTYPNR est une clé source, jamais un id (ADR-085).
22. Les projections SEO servies sont des snapshots CQRS (ADR-072).
23. Un changement passe par une branche et une PR. Un agent ne fusionne pas hors d'un périmètre de fusion adopté (ADR-102, ADR-123).
24. Mandat, revue, décision et fusion sont des actes distincts, et le mandat couvre son exécution (ADR-121).
25. La preuve de revue est liée au SHA de tête de la PR (DoD2) (ADR-120).
26. Avant de créer, on cherche l'existant, sans quota (ADR-123 D9).
27. La file de travail unique est faite des issues du monorepo : une issue = un mandat (ADR-128).
28. Chaque routine a un déclencheur unique et un contrat Trigger / Execution / Evidence. Aucun orchestrateur maison n'est ajouté (ADR-034, ADR-129).
29. Les méthodes tierces retirées (BMAD, Superpowers, Spec Kit) ne reviennent pas sans décision (ADR-118).
30. L'amélioration continue est advisory, jamais une gate bloquante (ADR-082).
31. Seule une décision acceptée et non remplacée est normative (ADR-101 D1).
32. Toute dérogation porte une clause d'expiration, et l'exploration a un budget borné (ADR-081).

## 3. Rules et policies du vault : qui les lit encore

Comptage `rg -l -F <nom>` dans le worktree du monorepo, /opt/automecanik/automecanik-wiki et /opt/automecanik/automecanik-raw (.git exclu). « Lu » veut dire « cité par nom de fichier » : un code qui lit la règle sans la nommer n'est pas compté.

| fichier | monorepo | wiki | raw | lecteur concret |
|---|---|---|---|---|
| ledger/rules/rules-agent-exit-contract.md | 2 | 2 | 2 | scripts/ci/check-aec-hash.sh + workflow agent-exit-contract-hash.yml ; canon-mirror `.claude/canon-mirrors/agent-exit-contract.md` |
| ledger/rules/rules-ai-antipatterns.md | 1 | 2 | 1 | Commentaire dans backend (google-credentials.service.ts) ; mentions dans wiki et raw |
| ledger/rules/rules-ai-cos.md | 2 | 0 | 0 | README de workspaces/marketing seulement ; règle sans objet depuis ADR-129 |
| ledger/rules/rules-deployment-workflow.md | 0 | 0 | 0 | Aucune citation par nom ; le contenu est relayé par `.claude/rules/deployment.md` (non vérifié ligne à ligne) |
| ledger/rules/rules-engineering-definition-of-done.md | 1 | 0 | 0 | scripts/ci/pr-dod-gate.mjs (workflow pr-dod-gate.yml) |
| ledger/rules/rules-engineering-quality.md | 0 | 1 | 1 | Mentions dans wiki et raw seulement |
| ledger/rules/rules-governance-process.md | 0 | 1 | 1 | Mentions dans wiki et raw seulement (porte G9/G10 d'ADR-081) |
| ledger/rules/rules-marketing-voice.md | 4 | 0 | 0 | scripts/ci/check-marketing-voice-hash.sh + workflow marketing-voice-hash.yml ; workspaces/marketing/AGENTS.md ; canon-mirror `marketing-voice.md` |
| ledger/rules/rules-seo-kw-import.md | 0 | 0 | 0 | Aucun lecteur trouvé |
| ledger/rules/rules-seo-pagerole.md | 2 | 0 | 0 | scripts/seo/check-url-immutability.mjs (workflow seo-url-immutability.yml) |
| ledger/rules/rules-seo-vlevel.md | 2 | 2 | 0 | packages/seo-roles/src/vlevel-invariants.ts ; mentions dans wiki |
| ledger/rules/rules-technical.md | 0 | 0 | 0 | Aucun lecteur trouvé |
| ledger/rules/rules-vault.md | 0 | 0 | 0 | Aucun lecteur trouvé (règle interne au vault, G1 amendée par ADR-125) |
| ledger/policies/exploration-budget.md | 1 | 0 | 0 | scripts/governance/validate-exploration-probe.sh ; canon-mirror `exploration-budget.md` |
| ledger/policies/merge-perimeter.v1.json | 4 | 0 | 0 | scripts/ci/merge-perimeter-gate.mjs lit ce fichier sur `main` du vault (dépendance réseau directe) |
| ledger/policies/PROCESS-G1-design.md | 0 | 0 | 0 | Aucun lecteur trouvé |
| ledger/policies/SOURCE-SCORE-WEIGHTS-SPEC.md | 0 | 0 | 0 | Aucun lecteur trouvé |
| ledger/policies/source-score-weights.v1.json | 0 | 0 | 0 | Aucun lecteur trouvé |
| policies/seo-content/r2-content-write.rego | 6 | 0 | 0 | backend r2-opa-evaluator.service.ts, r2-v2-contract.schema.ts, migration 20260515_seo_r2_v2_foundation.sql |
| policies/seo-content/r2-cluster-health.rego | 1 | 0 | 0 | backend r2-opa-evaluator.service.ts |
| policies/seo-content/r2-runtime-read.rego | 1 | 0 | 0 | Migration 20260516_seo_r2_v2_cqrs_snapshot.sql (commentaire) |
| policies/seo-content/h1-write.rego | 0 | 0 | 0 | Aucun lecteur trouvé |
| policies/seo-content/*_test.rego (4) | 0 | 0 | 0 | Aucun lecteur trouvé (tests OPA internes) |
| policies/seo-content/README.md | n. s. | n. s. | n. s. | Nom trop générique pour être compté |

Workflows du monorepo qui dépendent du vault : canon-sync.yml, vault-canon-exists.yml, agent-exit-contract-hash.yml, marketing-voice-hash.yml, pr-dod-gate.yml, plus la porte merge-perimeter-gate.mjs. Avec la décision 73, chacun garde une source figée ; aucun n'a été testé contre un vault archivé.

## 4. Non vérifié

- Le runtime DEV, PREPROD et PROD : aucune route, aucune base, aucun cron n'a été interrogé.
- La présence réelle des mécanismes de 004, 017, 078, 079 et 085, ainsi que le nom actuel des hooks d'ADR-023.
- Le comportement des workflows du monorepo qui dépendent du vault une fois celui-ci archivé (lecture seule GitHub = lecture encore possible, mais non testée).
- Le contenu des PR ouvertes 051, 052, 054, 084, 097, 122 et 132 à 137 : seuls leur numéro et leur état ont été relevés.
