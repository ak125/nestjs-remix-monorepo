# Mandat BD — contradictions, constat de sécurité, règles absentes du journal

Relevé sur `main` `0e2d0e7ed`, le 2026-11-16 entre 22:43 et 23:00 UTC. « J:n » = ligne n de
`.claude/governance/journal-des-principes.md` avant correction. Chaque entrée donne les deux
textes, la preuve et la résolution proposée. « Tranché » = corrigé dans la PR, parce que le code
ou une décision de l'owner le permet. « Question » = renvoyé au `README.md` §5.

## C1. Constat de sécurité, hors correction possible ici

Le dépôt est public (ADR-128 D1, point 4) : ce fichier ne donne ni chemin de route ni mode
d'appel. Le détail (fichier, lignes, réponse relevée, heure UTC) est remis à l'owner dans le
rapport de session du mandat BD.

- Constat : le module des commandes porte sur `main` des routes de test qui n'ont ni garde
  d'accès ni garde d'environnement. Une lecture sans session a été relevée sur le DEV le
  2026-11-16 à 22:52:53Z. Les routes d'écriture n'ont pas été appelées (zone commande).
- Le module de paiement porte une route de test sous gardes d'administrateur, sans garde
  d'environnement : c'est l'écart direct avec P8 (ligne A7).
- La règle `.ast-grep/rules/no-test-routes-without-env-guard.yml` ne couvre que les routes
  `__test*` du frontend.
- PROD : non vérifiée (hors périmètre). Le même code part en PROD à chaque tag `v*`.
- Lien avec le chantier des contrôleurs sans garde du 2026-11-10 : non établi.

Correction : modification du code applicatif, hors périmètre du mandat. À ouvrir en mandat
séparé (zone commande et paiement : accord nominatif de l'owner). Question Q3.

## A. Principe contre fait ou code en service

| N° | Texte du journal | Ce que montre la preuve | Résolution |
|---|---|---|---|
| A1 | J:7-8 : PR du vault #422 « ouverte, non fusionnée au 2026-11-16 ». | Fusionnée le 2026-11-16 à 20:52:02Z ; le `main` du vault est `b2e7127`. ADR-015 porte `status: superseded`, `superseded_by: ["ADR-138"]`. | Tranché : en-tête corrigé. |
| A2 | J:80 : « Statut au 2026-11-16 : proposé, non activé. Tant que l'owner n'a pas appliqué le workflow… ». | `merge-circuits.yml` est sur `main` (#2093, #2107, #2110). PR #2109 fusionnée par `app/automecanik-actions` à 22:21:34Z, auto-fusion armée par l'App (exécution 43968032404 : calcul du circuit, circuit et armement en succès). | Tranché pour les faits : statut remplacé par l'état relevé. La déclaration « activé » reste une question (Q1). |
| A3 | J:82-88, constat AR-5 : la revue s'authentifie par `ANTHROPIC_API_KEY`, absent. | `merge-circuits.yml:141` : `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` (#2107). | Tranché : constat retiré, remplacé par la règle de la décision 105. |
| A4 | J:89-93, constat AR-6 : l'App n'a jamais été créée ; trois workflows attendent chacun la leur. | L'App a fusionné #2109. Les noms `MERGE_CIRCUIT_APP_*`, `SELF_HEAL_APP_*`, `MANDAT_APP_*` n'existent plus dans `.github/workflows` ; les workflows lisent `ACTIONS_APP_ID` dans l'environnement `app-actions`. | Tranché : constat retiré, remplacé par le fait. |
| A5 | J:74 : circuit élevé = « approbation de l'owner sur la tête ». | #2110 (fusionnée à 22:02:52Z, touche `.github/workflows/`) et #2111 (22:32:56Z) : fusion par `ak125`, auto-fusion armée par `ak125`, check `🚦 Circuit de fusion` en échec sur la tête, `reviews: []`. Les 14 checks requis de `main` ne contiennent pas `🚦`. | Question Q2. Le texte du circuit n'est pas modifié ; l'écart est écrit sous P20. |
| A6 | J:72 : circuit moyen = verdict GO de la revue Claude. | Le job de revue est sauté dans les 21 exécutions lues du workflow. Aucun verdict n'a jamais été rendu en service. | Écrit sous P20 : « jamais observé ». |
| A7 | J:40, P8 : aucun endpoint de test de paiement en PROD. | Une route de test du module de paiement existe sur `main`, sous gardes d'administrateur, sans garde d'environnement (voir C1). | Le principe est gardé tel quel : un code non conforme n'accorde pas de dérogation de sécurité (`CLAUDE.md`, §Gouvernance). L'écart est écrit sous P8. Question Q3. |
| A8 | J:41, P9 : les images installent avec `--ignore-scripts`. | `Dockerfile.worker:32` : `RUN npm ci`. | Principe gardé, écart écrit sous P9. Question Q4. |
| A9 | J:49, P11 : le RAG n'a aucune autorité de production de contenu. | 12 fichiers hors module RAG lisent `RAG_KNOWLEDGE_PATH` pour produire du contenu ; la règle de lecture est en avertissement. | Principe gardé (invariant 4 de `CLAUDE.md` : ces producteurs sont à retirer). Écart écrit sous P11. |
| A10 | J:55, P14 : « jamais 404 ni 410 ». | `pieces-vehicle.loader.server.ts:207` (404), `:255` (410), `seo.controller.ts:411-413` (410), `constructeurs.$brand.$model.$type.tsx:154-198` (410). ADR-125 D4 l.105-110 : « Les codes 404 et 410 restent ceux des raisons 1 à 3 ». | Tranché par le code et l'ADR : P14 ramené à la branche `noProducts` de R2. |
| A11 | J:58, P16 : « une gate dure bloque ». | Drapeau `SEO_CHAIN_DUPLICATE_GATE_MODE` à `off` par défaut, posé dans aucun fichier compose (`r8-vehicle-enricher.service.ts:644-668`). | Principe gardé, état « implémenté, non activé » écrit. Question Q5. |
| A12 | J:98, P24 : la file unique est faite des issues, « une issue = un mandat ». | 0 mandat parmi les 150 dernières issues ; les mandats AR à BD sont transmis en session. ADR-128 l.33-34 : « N'active rien ». | Principe gardé, pratique écrite. Question Q6. |
| A13 | J:34, P6 : « toute migration passe squawk avant d'être appliquée ». | squawk ne lit que les migrations modifiées par la PR ; l'application manuelle ne le relance pas ; l'existant n'est pas relinté (ADR-065 l.121-128). | Tranché par le code : P6 dit la voie PR. |
| A14 | J:28, P3 : « la base PREPROD ». | Aucune base PREPROD : `docker-compose.preprod.yml:12-16` lit la base de production par passerelle en lecture seule. | Tranché par le code. |
| A15 | J:32, P4 : « les écritures sensibles ». | Le gate classe des appels RPC par niveau ; 12 fichiers appellent `.rpc(` en direct sous liste de tolérance du check requis. | Tranché par le code ; les contournements sont écrits. |

## B. Principe contre principe

| N° | Textes | Preuve | Résolution |
|---|---|---|---|
| B1 | J:14 « Il n'existe pas d'autre statut (pas de `proposed` ni `accepted`) » contre J:80 « Statut … proposé, non activé ». | Lecture du fichier. | Tranché : le statut de P20 est retiré (A2). |
| B2 | P13 (quatre actions interdites, dont désindexer) contre P14 (`noindex` automatique). | ADR-068 l.44 : l'interdiction vaut « sur une page valide (`productCount ≥ 2` ET compatibilité réelle) » ; l.74 : `REJECT` automatique pour une page invalide. | Tranché par l'ADR et le code : la condition « page valide » est remise dans P13. |
| B3 | P1 « restent séparés » contre P3 (PREPROD lit la base de production). | ADR-075 l.69-72, 106-111 ; `docker-compose.preprod.yml`. | Tranché : P1 dit ce qui est partagé. |
| B4 | P31 « toujours indépendante du producteur » contre P20 circuit faible (CI verte, aucun relecteur) et P10 (auto-review). | Lecture ; la formule vient d'ADR-129 l.195. | Question Q7. |
| B5 | P10 (aucune relecture humaine) contre P19 (relation « relue », acte humain d'ADR-033). | ADR-119 D7 l.285-296 : le flip `diagnostic_safe` et `reviewed`, les règles de sécurité du diagnostic, la plage chiffrée par famille et l'autorité d'une source inconnue restent régis par leurs ADR. | Tranché par l'ADR : P10 nomme ces actes ; P31 renvoie aussi à P19. |
| B6 | P20 « un agent n'arme jamais l'auto-fusion » contre J:80-81 « la porte ADR-124 reste celle qui s'applique ». | ADR-124 l.107-108 : « Acte qui arme : le lancement de la porte … par la session Claude CLI titulaire du mandat ». `scripts/ci/merge-perimeter-gate.mjs` n'est appelé par aucun workflow (test seul, `audit.yml:158`). | Question Q1 : la réponse proposée clôt la porte. |

## C. Principe contre sa source

| N° | Texte du journal | Texte de la source | Résolution |
|---|---|---|---|
| S1 | P2, source « ADR-002 §2.2 ». | ADR-002 §2.2 = tableau des modes d'Airlock. La règle : ADR-012 l.23, ADR-129 D1 l.85-87. | Tranché : source corrigée. |
| S2 | P10, seuil 0.85, source ADR-091. | ADR-125 D2 l.92-97 fixe 0.85 ; ADR-091 l.54 et ADR-083 l.53 disent 0.80. | Tranché : source corrigée. |
| S3 | P8, source ADR-014. | ADR-014 retire un seul endpoint, dans tous les environnements. | Tranché : les deux sources sont nommées. |
| S4 | P15. | Voir tableau, ligne P15. | Tranché : sources nommées par phrase. |
| S5 | P17 « chaque champ ». | ADR-111 D1 : « Une seule autorité par champ R1 … sur une gamme basculée ». | Tranché : portée de l'ADR remise. |
| S6 | P20 « remplacent ADR-102, ADR-123, ADR-124 ». | ADR-138 l.125, 128, 129 : amendés ; ADR-123 et 124 cèdent « une fois activés ». | Tranché : « amendent ». |
| S7 | P29 « remplace ADR-101 D1 ». | ADR-138 l.124 : amendé ; D1 « pour lire l'archive ». | Tranché. |
| S8 | P28 « toute dérogation ». | ADR-081 l.72 (verdict empirique, 12 semaines), l.100 (budget). La phrase vient d'ADR-138 l.123. | Tranché : G9 et G10 sont remis avec leurs chiffres, comme ADR-138 l'annonce. |
| S9 | P25 « aucun orchestrateur maison n'est ajouté ». | ADR-034 l.84-91 : « interdit par défaut (override = ouvrir un ADR explicite) », six composants. | Les six composants sont remis dans P25. L'interdit reste sans réserve : question Q8. |
| S10 | P27 « jamais ». | ADR-082 A1 l.121-126 : « JAMAIS … par défaut », avec une voie de promotion (A2) par amendement du vault, fermée depuis la décision 72. | Question Q8 : le texte de P27 n'est pas modifié. |
| S11 | P31 `content_approved`. | Absent d'ADR-129 ; vient de `workspaces/marketing/fafa-media-factory/README.md:50,58`. | Tranché : origine nommée, cas d'ADR-129 remis. |
| S12 | P21 « le mandat couvre son exécution ». | ADR-121 D1 l.152-161 : dans ses limites ; « ne lève aucune permission technique, aucune validation spécifique et aucune restriction de fusion ». | Tranché : limites remises. |
| S13 | P23. | ADR-123 l.173-181 : équivalents et consommateurs, sans quota, un résultat nul ne prouve pas l'absence. | Tranché : remis. |

## D. Doublons

| Doublon | Traitement |
|---|---|
| Règle de vigueur (J:10-21) et P29 : même règle, deux textes ; `CLAUDE.md` §Gouvernance en porte un troisième, avec deux sources normatives au lieu de trois. | Fusionnés dans la règle de vigueur. Le numéro P29 reste comme renvoi. `CLAUDE.md` n'est pas modifié ici (hors du journal) : écart signalé. |
| P1 et P3 (séparation, lecture seule). | Renvoi croisé, textes distincts gardés. |
| P13, P14, P16 (indexation). | Renvoi croisé ; B2 et A10 tranchés. |
| P20 et P21 ; `.claude/rules/deployment.md:187-188` cite « (P20, P21) » pour « un agent ne lance jamais de fusion », que P21 ne dit pas. | P21 renvoie à P20. `deployment.md` non modifié : écart signalé. |
| P23 et l'invariant 2 de `CLAUDE.md` (plus riche). | Aucun changement ; signalé. |
| P24 et P25 (ADR-128 D3 : une routine, un déclencheur). | Source ADR-128 ajoutée à P25. |

## E. Écarts entre ADR, non tranchés

Le mandat porte sur le journal ; ces écarts entre archives sont signalés, pas résolus.

- ADR-001 (« données anonymisées », mode observe) contre ADR-075 et ADR-028 (base partagée, enforce P1).
- ADR-012 et ADR-129 contre ADR-130 (runner sur l'hôte PROD).
- ADR-070 (R2, quatre entrées) contre ADR-086 (R1 ⊕ R8).
- ADR-031 (RAW = dépôt `automecanik-raw`) contre ADR-046 l.60 (RAW = dossier du vault).
- ADR-086 l.233 (« <1 vendable ») contre ADR-068 l.82 (`productCount < 2`).
- ADR-004 l.43-45 (`rm/` jamais importé en PROD) contre le code : `app.module.ts:75,204` importe
  `RmModule`, `ci.yml:387,408-410` l'autorise ; `scripts/claude-hooks/pretool-file-guard.sh:50-54`
  dit encore le module « banni de production ». Le garde et la CI se contredisent.
- ADR-046 l.73-76 exige encore `review_status === 'accepted'` pour passer de L1 à L2 ; non amendé
  par ADR-119. ADR-096 l.143, ADR-093 l.59, ADR-083 l.58, ADR-091 l.54-57 disent encore « humain ».
- ADR-088 : titre « PROPOSÉ » sous un frontmatter `accepted`.
- `.claude/canon-mirrors/exploration-budget.md:1-4,21-23` nomme canonique la règle G10 du vault,
  alors qu'ADR-138 l.123 la place dans le journal.
- `.claude/rules/security-hooks.md:14-16` nomme canonique la règle vault
  `rules-engineering-definition-of-done`, contre P29.

## F. Règles en service dans le code, absentes du journal

« Bloquant » = le job échoue. « Requis » = dans les 14 checks requis de `main`.

| Règle | Mécanisme | Force |
|---|---|---|
| Comparaison de signature de paiement par `timingSafeEqual` | `.ast-grep/rules/payments-no-raw-equality.yml` ; `audit.yml:60` ; `.husky/pre-commit:184-194` | Bloquant (CI sur chemins filtrés, pre-commit) |
| Autorités commerce : prix de pièce écrit par la seule voie gouvernée, statut de commande et de ligne par leurs services, RPC commerce réservées, pas de relecture du panier dans `createOrder` | 8 règles ast-grep `commerce-*` (erreur) ; `.spec/00-canon/commerce-runtime/authority-graph.yaml` ; `commerce-runtime-canon-gate.yml` | Bloquant |
| Jamais vendre à perte (vente HT ≥ achat HT) | `backend/src/modules/pricing/services/pricing-invariants.service.ts:97-101` (`VENTE_BELOW_ACHAT`) ; `orders/services/orders.service.ts:1088` (`ConflictException`) | Chemin de code ; ni contrainte ni trigger en base |
| URL immuables | `.github/workflows/seo-url-immutability.yml`, `scripts/seo/check-url-immutability.mjs` ; dérogation par label `r-seo-09-override` | Bloquant sur PR |
| PROD seulement depuis un tag `v*`, avec preuve PREPROD et point de retour | `release-prod.yml:12,92,100` ; `pretool-bash-guard.sh` garde 6 ; `.husky/pre-push` | Workflow et garde d'agent |
| Surface `SECURITY DEFINER` fermée à `anon`/`authenticated` sauf liste motivée | `scripts/lint/check-definer-anon-surface.sh` ; `ci.yml:777-781` | Bloquant |
| Détection de secrets | gitleaks (`🔐 Secrets Detection`), `codeql.yml` | Requis |
| Appel RPC par `callRpc` seulement | `ci.yml:469-512` (`🛡️ RPC Safety Gate`) | Requis |
| Modules DEV interdits dans `app.module.ts` | `ci.yml:384-394` | Bloquant |
| Application d'une migration : manuelle, `confirm=APPLY`, dérive de checksum = échec | `apply-supabase-migrations.yml` | Workflow manuel |
| `@Cron` exige `ScheduleModule` | `cron-schedulemodule-guard.yml` | Bloquant |
| Routes de test du frontend sous garde d'environnement | `no-test-routes-without-env-guard.yml` | Bloquant (frontend seulement) |
| Observatoire SEO en shadow jamais `on` | `seo-shadow-flag-guard.yml`, ast-grep `seo-shadow-no-await` | Bloquant |
| Un contenu meilleur n'est jamais écrasé par un moins bon | `wouldRegress`, `backend/src/modules/seo-projection/seo-projection-writer.service.ts` | Chemin de code |
| Tout nouveau fichier a un propriétaire et un domaine | `registry-new-file-gate.yml` | Bloquant |
| Gardes d'agent : pas de push sur `main`, pas de push forcé, pas de `reset --hard`, pas d'`npm install` sur `node_modules` lié, pas d'édition des fichiers système, des lockfiles ni de `modules/rm/` | `scripts/claude-hooks/pretool-bash-guard.sh` (gardes 1 à 7), `pretool-file-guard.sh` (gardes 1 à 5) | Hook local |
| Zones STOP (paiement, prix et stock, commande, RLS, base destructive, SEO indexé, PROD) | `CLAUDE.md` invariant 9 ; gardes partielles ci-dessus | Texte, garde partielle |
| Redirections 301 de consolidation (R5 vers R3 en service, R6 vers R3 sous drapeau) | `frontend/app/routes/diagnostic-auto.$slug.tsx:215-225` ; `feature-flags.service.ts:142` | Chemin de code |
| Pas de mot-clé ni d'URL inventés ; meta, title et H1 optimisés non modifiés | `CLAUDE.md` invariants 5 et 6 | Texte seul, aucune garde trouvée |

Ajouter l'une de ces règles au journal crée un principe : c'est la question Q9.

## G. ADR classés valables dont le mécanisme annoncé n'existe pas

| ADR | Mécanisme annoncé | Constat |
|---|---|---|
| 021 | Contrôle RLS, `-- APPROVED:` sur tout `DROP POLICY` | Aucun contrôle dans le dépôt ; `.squawk.toml` laisse `DROP POLICY` passer. |
| 023 | `scripts/governance/block-local-vault.sh`, workflow `guard-local-governance.yml` | Absents ; seul un bloc de `.husky/pre-commit` existe. |
| 030 | Contrôle CI des `postinstall` | Absent. |
| 036 | Filtre RGPD triple sur `marketing_consent_at` | Commentaires seuls (`marketing-brief.dto.ts:19-21`, `marketing-briefs.service.ts:12`). |
| 039 | Porte CI du schéma de proposition WIKI | Schéma présent, aucun workflow ne l'appelle. |
| 043 | Quatre couches secrets (types marqués, `parseSecretOrThrow`, 3 règles ast-grep, compteurs) | Aucune ; gitleaks et CodeQL existent à côté. |
| 049 | `validate-db-schema-invariants.sql` | Absent. |
| 050 | Garde ast-grep du contrat d'enrichisseur | Absente. |
| 059 | Garde contre la lecture directe de `__seo_entity_*` | Non trouvée ; lectures directes possibles dans trois services de sitemap (non confirmé). |
| 074 | Règle `seo-no-direct-robots-emission.yml` « bloquante » | Fichier absent ; l'ADR le reconnaît (l.41-43). |
| 077 | Dix portes de report projetées dans le registre | Rien trouvé. |
| 078 | Audit nocturne, règle ast-grep bloquante | Script non branché ; règle en avertissement. |
| 079 | Règle `no-direct-piece-media-access` | Absente. |
| 085 | Imposition de l'allocateur | Aucun appelant, aucune contrainte (P7). |
| 088 | Planchers à six dimensions comme porte | Mode ombre seulement ; bascule non posée. |
| 092, 093, 094 | Dimensions G et H, `refutation_gate.py`, `PAGE_QUALITY_COMPOSITE_PASS` | Absents. |
| 107, 108, 109, 110 | Champ `qa`, tables de rendu R4, R7, R8 | Non trouvés (titres lus seulement). |
| 116, 117 | Règle de preuve des relations, révision en place | Présentes, verrouillées (`None`). |
