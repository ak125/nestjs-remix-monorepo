# Mandat BD — audit du journal des principes

Décision 109 de l'owner (2026-11-16) : trier le journal, où des confusions et des contradictions
venaient des ADR. Ce dossier donne la preuve, principe par principe, de ce qui est appliqué ou
non, la liste des contradictions, les règles en service absentes du journal, et les questions
qui reviennent à l'owner. La PR qui le porte corrige `.claude/governance/journal-des-principes.md`.

| Fichier | Contenu |
|---|---|
| `tableau-principes.md` | Un principe par ligne : mécanisme, chemin, niveau, verdict. |
| `contradictions.md` | Constat de sécurité, contradictions, doublons, règles absentes du journal, ADR sans mécanisme. |
| `README.md` | Méthode, relevés datés, couverture, changements du journal, questions. |

## 1. Périmètre et méthode

- Lu sur `main` `0e2d0e7ed4db86a71111cb3f2abaa533328b2693`, dans un worktree isolé. Aucun checkout
  partagé touché. Tête relue égale à `origin/main` à 22:56:17Z et à 23:03:15Z le 2026-11-16.
- ADR lus dans le vault en lecture seule (tête `b2e7127`, fusion de la PR #422). WIKI lu sur
  `origin/main` `1386963`, sans checkout.
- Modifié : le journal et ce dossier. Non modifié : code applicatif, `.github`, base, PROD, vault,
  `CLAUDE.md`, `.claude/rules`.
- Le mandat BC (sortie du vault, étapes 1 à 8) n'est pas doublé : P30 renvoie à sa PR #2112.
- Les constats rapportés par des lectures déléguées ont été recontrôlés sur le fichier avant
  d'être écrits ; ce qui ne l'a pas été est marqué « non confirmé » ou « non vérifié ».

## 2. Résultat en chiffres

- 31 principes relus. Verdicts au bas de `tableau-principes.md` : 2 appliqués avec un libellé
  juste, 7 appliqués avec un libellé ou une source à corriger, 10 appliqués en partie, 5 contredits
  par le code ou la pratique, 1 implémenté et non activé, 6 en intention seulement.
- 15 contradictions principe contre fait, 6 principe contre principe, 13 principe contre source,
  6 doublons, 10 écarts entre ADR non tranchés.
- 19 règles en service dans le code absentes du journal.
- 22 ADR classés valables dont le mécanisme annoncé n'existe pas, et 2 dont il existe mais
  reste verrouillé (`contradictions.md` §G).
- 1 constat de sécurité hors périmètre de correction (C1).

## 3. Relevés datés (UTC, 2026-11-16)

| Heure | Relevé | Résultat |
|---|---|---|
| 20:52:02 | Fusion de la PR du vault #422 (`gh pr view`) | fusionnée ; `main` du vault = `b2e7127` |
| 22:02:52 | PR #2110 (touche `.github/workflows/`) | fusionnée par l'owner, aucune revue, `🚦` en échec |
| 22:21:34 | PR #2109 (documentation) | fusionnée par l'App `automecanik-actions`, exécution 43968032404 |
| 22:32:56 | PR #2111 | fusionnée par l'owner, aucune revue, `🚦` en échec |
| 22:42:25 | `🛡️ Import Firewall` sur `0e2d0e7ed` | succès |
| 22:42:26 | `🛡️ RPC Safety Gate` | succès |
| 22:42:34 | `🗄️ Migration Safety` | succès |
| 22:43:38 | `🔒 Security Audit` | succès |
| 22:43:52 | `🛡️ ADR-010 Governance` | succès |
| 22:44:33 | `🔐 Secrets Detection` | succès |
| 22:45:15 | `🔒 Core Build Only` | succès |
| 22:45:26 | `⬣ ESLint` | succès |
| 22:45:29 | `ʦ TypeScript` | succès |
| 22:45:44 | `🧪 Frontend Tests`, `🐳 Build` | succès |
| 22:48:31 | `🧪 Backend Tests` | succès |
| 22:50:41 | `node --test scripts/ci/merge-circuit.test.mjs`, lancé dans le worktree | 6 tests sur 6 verts |
| 22:52:53 | DEV : deux anciennes routes `callback-test` de paiement | 404 |
| 22:52:53 | DEV : lecture d'une route de test des commandes, sans session | 200 (constat C1) |
| 22:54:04 | `🧪 Deploy PREPROD` sur `0e2d0e7ed` | succès |
| 22:54:19 | DEV : `/health` | `revision: null` |
| 22:56:17 | `git fetch` puis comparaison de tête | worktree = `origin/main` |
| 23:06:50 | DEV : `/health` | 200 |

Checks requis de `main` (14), lus par `gh api repos/ak125/nestjs-remix-monorepo/branches/main` :
`🔒 DEV Safety (Blocking)`, `🔬 CodeQL Scan`, `⬣ ESLint`, `ʦ TypeScript`, `🧪 Backend Tests`,
`🧪 Frontend Tests`, `🔒 Security Audit`, `🔒 Core Build Only`, `🛡️ Import Firewall`,
`🛡️ RPC Safety Gate`, `🛡️ ADR-010 Governance`, `🔐 Secrets Detection`, `🗄️ Migration Safety`,
`🧾 DoD self-evaluation present`. `🚦 Circuit de fusion` n'en fait pas partie. L'environnement
`app-actions` est restreint à la branche `main` (`gh api …/environments/app-actions`).

## 4. Couverture

Couvert :

- les 31 principes, chacun confronté à son ADR source et au code ;
- 108 des 109 ADR classés valables par `tri-adr.md`, ouverts dans le vault. ADR-015 n'a pas été
  relu : ADR-138, lu, le remplace ;
- les zones à risque d'abord : paiement, prix et stock, commande, migrations, déploiement PROD,
  sécurité, contenu RAW et WIKI ;
- `CLAUDE.md`, `.claude/rules/`, les 35 règles ast-grep, les workflows cités, les hooks d'agent.

Lu en partie seulement :

- ADR-106 à ADR-110 : titres et décisions de tête ;
- ADR-025, 070 (D, G), 077, 079, 094, 096 (D3, D4, D7), 113 (D3 à D7) : passages ;
- ADR-011, 062, 126, 127 : en-tête et statut, décisions non relues.

Non vérifié :

- l'état de la PROD (version servie, mode du RPC gate, routes de test) ;
- la base vivante : contraintes, drapeaux, RLS, advisors Supabase, usage de l'allocateur `type_id` ;
- le dépôt RAW ;
- le réglage « revue des CODEOWNERS exigée » de la protection de `main` (lecture refusée, 403) ;
- l'usage réel de l'image `Dockerfile.worker` ;
- le verdict du garde `cron-schedulemodule-guard` sur les trois `@Cron(` restants.

## 5. Questions pour l'owner

Chaque question tient en une phrase, avec la réponse proposée. Rien de ce qui suit n'est tranché
dans le journal.

| N° | Question | Réponse proposée |
|---|---|---|
| Q1 | Les trois circuits sont-ils déclarés activés, ce qui clôt la porte ADR-124 ? | Oui pour le circuit faible, observé en service ; la porte ADR-124 est close, son script n'étant appelé par aucun workflow. |
| Q2 | Pour le circuit élevé, ta fusion vaut-elle approbation, ou faut-il une revue approuvante enregistrée sur la tête ? | Enregistrer la revue approuvante, puis laisser l'App fusionner ; ajouter `🚦 Circuit de fusion` aux checks requis de `main`. |
| Q3 | Les routes de test des commandes et du paiement sont-elles retirées ou placées sous garde d'environnement ? | Les retirer, par un mandat de code séparé (zone commande et paiement), et étendre la règle ast-grep des routes de test au backend. |
| Q4 | `Dockerfile.worker` doit-il installer avec `--ignore-scripts` comme l'image applicative ? | Oui, ou retirer ce fichier si l'image n'est plus construite. |
| Q5 | La gate des balises dupliquées (P16) est-elle allumée, ou reste-t-elle éteinte ? | La laisser éteinte jusqu'à une décision datée de ta part ; P16 dit déjà son état. |
| Q6 | Un mandat collé dans une session vaut-il mandat, ou chaque mandat doit-il être une issue (P24) ? | Garder les deux voies jusqu'à l'activation du plan d'ADR-128, et l'écrire dans P24. |
| Q7 | « Toujours indépendante du producteur » (P31) s'applique-t-il au circuit faible, qui fusionne sur CI verte sans relecteur ? | Non : pour le code de risque faible, la CI est la validation ; l'écrire dans P31. |
| Q8 | « Aucun orchestrateur maison » (P25) et « jamais une gate » (P27) sont-ils absolus, ou valent-ils « par défaut », comme dans ADR-034 et ADR-082 ? | Par défaut : une exception passe par une PR sur le journal, donc par ton approbation. |
| Q9 | Quelles règles en service entrent au journal (`contradictions.md` §F) ? | Six d'abord : `timingSafeEqual`, autorités commerce, jamais vendre à perte, URL immuables, PROD depuis un tag `v*` seulement, zones STOP. |
| Q10 | P13 vaut-il pour tous les rôles SEO ou pour R2 seulement ? | Pour tous, comme doctrine ; le mécanisme n'existe que pour R2 et le journal le dit. |
| Q11 | Le module `rm/` est-il permis en PROD (la CI l'autorise) ou banni (le hook d'agent et ADR-004 le disent) ? | Permis : le code servi l'importe ; corriger le message du hook par un mandat séparé. |
| Q12 | Qui doit appeler l'allocateur de `type_id` (P7), aujourd'hui sans appelant ? | Tout import de véhicules ; poser la contrainte en base par un mandat de migration séparé. |

## 6. Changements du journal, avec leur preuve

« Preuve » renvoie à la ligne du tableau ou de `contradictions.md` qui porte le chemin et l'heure.
Aucun principe n'est retiré ni renuméroté. Chaque principe reçoit une ligne « Application ».

| Endroit | Avant | Après | Preuve |
|---|---|---|---|
| En-tête | PR #422 « ouverte, non fusionnée » | fusionnée le 2026-11-16 à 20:52 UTC ; renvoi à ce dossier | A1 |
| Règle de vigueur | deux textes (règle et P29) | un seul texte, qui reprend la phrase normative de P29 ; source nommée | doublon D1, S7 |
| Nouvelle section | — | lecture des lignes « Application » : niveaux, « intention seulement », « écart » | mandat, point 1 |
| P1 | « restent séparés » | trois environnements distincts ; PREPROD sur l'hôte de PROD, base lue en lecture seule ; les six objets nommés | B3, ADR-075 D2 et D3 |
| P2 | source ADR-002 §2.2 | source ADR-012 et ADR-129 D1 ; la voie d'accès est nommée | S1 |
| P3 | « la base PREPROD » | le déploiement PREPROD lit la base de production en lecture seule | A14 |
| P4 | « les écritures sensibles » | les appels RPC, classés par niveau ; une écriture hors RPC n'y passe pas | A15 |
| P6 | « toute migration … avant d'être appliquée » | toute migration ajoutée ou modifiée par une PR, avant la fusion | A13 |
| P8 | source ADR-014 | les deux sources nommées ; texte inchangé, écart écrit | S3, A7 |
| P10 | seuil sourcé ADR-091 ; « aucune relecture humaine » | seuil sourcé ADR-125 D2 ; les actes humains d'ADR-119 D7 nommés | S2, B5 |
| P12 | « seulement dans `seo-role-contracts` » | identité dans `seo-roles`, contrats dans `seo-role-contracts` | tableau P12 |
| P13 | quatre interdits sans condition | « sur une page valide » remis ; portée de l'ADR citée | B2 |
| P14 | « une page sans contenu valable … jamais 404 ni 410 » | la branche `noProducts` de R2 ; 404 et 410 gardés pour les raisons 1 à 3 | A10 |
| P15 | sources en vrac | une source par phrase | S4 |
| P17 | « chaque champ » ; « jamais réécrits » | portée d'ADR-111 D1 citée ; D5 repris : aucun writer, tables intactes, sort réservé à l'owner | S5 |
| P18 | — | « écrit pour R2 » | tableau P18 |
| P19 | « relue » non définie | « relue » = `evidence.reviewed: true`, acte humain ; règle de sécurité : source et relecture humaine | B5, tableau P19 |
| P20 | « Statut : proposé, non activé » ; constats AR-5 et AR-6 ; « remplacent » | statut retiré ; règles des décisions 105 et de l'App gardées, faits périmés retirés ; « amendent » ; état relevé par circuit | A2 à A6, B1, S6 |
| P21 | « le mandat couvre son exécution » | les limites d'ADR-121 D1 remises | S12 |
| P22 | — | « un push qui change la tête la rend périmée » (ADR-120 D4) | tableau P22 |
| P23 | « on cherche l'existant » | équivalents et consommateurs, sans quota, résultat nul | S13 |
| P25 | « aucun orchestrateur maison » | les six composants d'ADR-034 nommés ; source ADR-128 D3 ajoutée | S9 |
| P28 | deux phrases sans chiffre | G9 et G10 remis avec leurs chiffres, comme ADR-138 l'annonce | S8 |
| P29 | texte complet | renvoi à la règle de vigueur ; numéro gardé | doublon D1 |
| P30 | — | état de l'étape 1 au 2026-11-16 | tableau P30 |
| P31 | « P10 pour le WIKI » ; `content_approved` sans origine | P10 et P19 ; approbation de l'owner pour une règle du journal ; origine de `content_approved` | S11, B5 |
| P5, P7, P9, P11, P16, P24, P26, P27 | — | texte inchangé ; ligne « Application » seule | tableau |

## 7. Écarts signalés hors du journal, non corrigés ici

- `CLAUDE.md` §Gouvernance nomme deux sources normatives, le journal trois ; il dit encore « tant
  que l'owner ne les a pas activés » pour les circuits.
- `.claude/rules/deployment.md:187-188` cite P21 pour une règle que P21 ne porte pas.
- `.claude/rules/security-hooks.md:14-16` et `.claude/canon-mirrors/exploration-budget.md` nomment
  canonique une règle du vault.
- `scripts/governance/validate-agent-operating-map.js:176` refuse une décision hors 1–90, alors que
  le journal cite les décisions 91, 105 et 109.
- `scripts/ci/pr-dod-gate.mjs` porte un commentaire périmé (« pas encore un check requis »).
- ADR-138 l.45 compte 29 principes ; le journal en porte 31.
- Les décisions 72, 73, 91, 98, 105 et 109 n'ont pas d'enregistrement primaire dans le dépôt :
  elles n'y existent que par citation.
- WIKI, `_meta/quality-gates.md` : l.68 garde des seuils 0.70/0.85/0.95, contre 0.85 l.152.

## 8. Suite : décision 120 (2026-11-17)

L'owner retient les douze réponses proposées au §5. Les sections 1 à 7 restent le relevé du
2026-11-16 et ne sont pas réécrites. La décision 120, comme les précédentes, n'a pas
d'enregistrement primaire dans le dépôt : elle y entre par le journal.

| Question | Où la réponse est portée |
|---|---|
| Q1 | Journal, P20 : transition close, circuit faible déclaré activé, porte ADR-124 close. |
| Q2 | Journal, P20, circuit élevé. L'ajout de `🚦 Circuit de fusion` aux checks requis de `main` est un acte de l'owner, préparé hors dépôt. |
| Q3 | Retrait fait par #2117 (mandat BF). Extension de la règle ast-grep : `projets-de-mandats.md`, M4. |
| Q4 | `projets-de-mandats.md`, M1. |
| Q5 | Journal, P16. |
| Q6 | Journal, P24. |
| Q7 | Journal, P31. |
| Q8 | Journal, P25 et P27. |
| Q9 | Journal, P34 à P39. |
| Q10 | Journal, P13. |
| Q11 | `projets-de-mandats.md`, M2. |
| Q12 | `projets-de-mandats.md`, M3. |

Les six principes entrés par Q9 portent les numéros P34 à P39. Leur preuve est dans leur ligne
« Application » ; le tableau du 2026-11-16 ne les contient pas.
