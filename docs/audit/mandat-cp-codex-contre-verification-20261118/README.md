# Mandat CP — Codex en contre-vérification du code après fusion (essai à blanc)

Date : 2026-11-18. Base : `main` 47fc7e4c9d75ce038799ce746568eca9d3687862.
Nature : essai à blanc. Aucune routine, aucun workflow, aucun cron ni hook n'est installé, et
aucun code n'est corrigé. Ce rapport sert à décider ; la décision appartient à Marwane.

Règles appliquées, citées par chemin : `CLAUDE.md` (invariants 1, 3, 7, 8, 9),
`AGENTS.md`, `.claude/governance/journal-des-principes.md` (P4, P20, P25, P35, P36, P43 cités dans les
constats), `.claude/rules/payments.md`, `.claude/rules/security-hooks.md`,
`.claude/rules/agent-doc-search.md`.

Fichiers de ce dossier :

| Fichier | Contenu |
|---|---|
| `README.md` | ce rapport |
| `consigne-relecture-v1.md` | consigne de relecture versionnée, donnée telle quelle à chaque passage |
| `constats.schema.json` | schéma JSON imposé à la sortie de Codex (`--output-schema`) |
| `annexe-tri.md` | les 199 constats, un par ligne, avec le verdict et la preuve vérifiée |

## 1. Codex CLI : mise à jour et modèles

Codex est installé en mode autonome, sous le répertoire de Codex de l'utilisateur
(`packages/standalone/current`). La mise à jour a suivi sa voie d'origine, `codex update`,
qui relance le script d'installation officiel.

| | Version |
|---|---|
| Avant | `codex-cli 0.144.4` |
| Après | `codex-cli 0.170.0` |

Chaque modèle a reçu une demande courte : « Réponds uniquement par: OK <modèle> ». Effort
`low`, entrée standard fermée (`< /dev/null`). Mêmes réglages que les passages (§2).

| Modèle demandé | Réponse exacte | Entrée (tokens) | Sortie | Durée | Code retour |
|---|---|---|---|---|---|
| `gpt-6.2-astra` | `OK gpt-6.2-astra` | 16 513 | 13 | 6 s | 0 |
| `gpt-6-astra` | `OK gpt-6-astra` | 15 078 | 11 | 5 s | 0 |
| `gpt-6.1-sol` | `OK gpt-6.1-sol` | 15 143 | 12 | 4 s | 0 |
| `gpt-5.6-sol` | `OK gpt-5.6-sol` | 13 913 | 12 | 4 s | 0 |
| témoin `gpt-0-modele-inexistant` | erreur : « The 'gpt-0-modele-inexistant' model is not supported when using Codex with a ChatGPT account. » | — | — | — | 1 |

Les quatre modèles sont acceptés par le compte. Le témoin négatif montre qu'un nom inconnu est
refusé et non remplacé en silence. Limite : la sortie `--json` de `codex exec` ne renvoie pas
le nom du modèle servi. « Accepté » est donc prouvé, « servi tel quel » ne l'est pas.

Modèle retenu pour tous les passages : `gpt-6.2-astra`, effort `high`. C'est le modèle le plus
récent accepté ; les modèles n'ont pas été comparés sur une même relecture (voir §7).

## 2. Cadre de chaque passage

### 2.1 Commande

Commande identique pour les 14 passages. Seuls changent le fichier de consigne, le diff
joint et le dossier de sortie. Les chemins locaux sont remplacés par des marqueurs : `<WT>`
pour le worktree de l'essai, `<S>` pour un dossier de travail temporaire hors dépôt,
`<DEPOT>` pour le checkout principal, `<CODEX>` pour le répertoire d'installation de Codex.

```bash
codex exec --ignore-user-config --ignore-rules --ephemeral -s read-only \
  -c 'shell_environment_policy.inherit="core"' \
  --disable apps --disable plugins --disable remote_plugin --disable hooks \
  --disable browser_use --disable browser_use_external --disable computer_use \
  --disable in_app_browser --disable image_generation --disable multi_agent \
  --disable tool_suggest --disable skill_mcp_dependency_install --disable goals \
  --json \
  -c 'default_permissions="cp_review"' \
  -c 'permissions.cp_review.filesystem={":minimal"="read","<WT>"="read","<DEPOT>/.git"="read","<CODEX>/packages/standalone"="read","<S>/canary"="read","<S>/canary/.env"="deny"}' \
  -m gpt-6.2-astra -c model_reasoning_effort="high" \
  -C <WT> --output-schema <S>/findings.schema.json -o <S>/out/<objet>/last.json \
  "$(cat <S>/prompts/<objet>.txt)" < <S>/prompts/<objet>.diff   # PR : diff du squash
                                                                 # lot : < /dev/null
```

### 2.2 Réglages et ce qu'ils garantissent

| Réglage | Effet |
|---|---|
| `--ignore-user-config` | le fichier de configuration de l'utilisateur n'est pas chargé. Il n'est ni modifié ni lu par l'essai, et avec lui disparaît le serveur MCP `supabase-local` |
| `--ignore-rules` | aucune règle d'exécution utilisateur |
| `--ephemeral` | aucune session conservée |
| `-s read-only` + profil `cp_review` | lecture seule. Lecture permise : le worktree, le `.git` du dépôt (le worktree y pointe), le binaire de Codex et un dossier témoin. Tout le reste du disque est hors du bac à sable |
| `shell_environment_policy.inherit="core"` | les commandes lancées par Codex ne reçoivent que les variables d'environnement de base |
| `--disable …` | applications, greffons, hooks, navigateur, contrôle de l'ordinateur, sous-agents, génération d'images et installation de dépendances coupés |
| `--output-schema` | sortie JSON imposée : fichier, ligne, gravité, catégorie, titre, preuve, correction proposée, confiance, fichiers lus. Pas de champ de réécriture |
| aucun jeton GitHub, aucun accès réseau sortant | ni push, ni action GitHub possible (preuve ci-dessous) |

Le fichier `auth.json` de Codex n'a pas été lu par l'essai. Le fichier de configuration
utilisateur est inchangé : même empreinte SHA-256 avant et après l'essai.

### 2.3 Preuve du bac à sable

Commande de preuve : `codex sandbox` avec les mêmes réglages `cp_review`, puis une série de
sondes shell. Résultats observés :

| Sonde | Résultat |
|---|---|
| lecture d'un fichier témoin autorisé | lu (`ALLOWED-OK`) |
| lecture d'un `.env` témoin marqué `deny` | `Permission denied` |
| `backend/.env`, `auth.json`, configuration utilisateur, configuration `gh`, clés SSH, répertoire de Claude (test `[ -e ]`) | absents du bac à sable (hors du bac à sable, `backend/.env` existe) |
| `CLAUDE.md` du checkout principal | `No such file` (seul le worktree est visible) |
| répertoire de Codex | seul `packages` est visible |
| `touch` dans le worktree | `Read-only file system` |
| `curl https://api.github.com` | `Could not resolve host` |
| `git log` dans le worktree | lisible (`47fc7e4c9`) |
| `AGENTS.md` | lisible |

Contrôle a posteriori des 14 passages : toutes les commandes lancées par Codex ont été
relevées dans le flux JSON. Les occurrences de « .env » sont des recherches de `process.env`
dans le code et la lecture de `backend/.env.example`, un modèle suivi par Git. Aucun vrai
fichier `.env` n'a été lu ; les globs de recherche de Codex excluaient `.env*`.

## 3. Ce que Codex lit par lui-même, et ce qu'il ne lit pas

Test de chargement automatique, sans lancer de commande ni lire de fichier. Question :
« recopie mot pour mot le titre de la dernière section (##) des instructions de dépôt que tu
as reçues ; as-tu reçu le contenu de CLAUDE.md, de .claude/rules/payments.md ou d'un fichier
de mémoire de Claude ? » Réponse exacte :

> 1. `## Format de sortie`
> 2. CLAUDE.md : non ; .claude/rules/payments.md : non ; Fichier de mémoire de Claude : non

La dernière section de `AGENTS.md` s'intitule bien `## Format de sortie`. Codex charge donc
`AGENTS.md` de lui-même, et lui seul.

| Source | Chargée d'office | Lue pendant les passages |
|---|---|---|
| `AGENTS.md` | oui | oui, relue en commande dans les 14 passages |
| `CLAUDE.md` | non | oui, dans chaque passage : `AGENTS.md` y renvoie et la consigne cite la règle de domaine |
| `.claude/rules/*.md` | non | dans 12 passages sur 14 (`payments.md` pour le lot paiement) |
| `.claude/governance/journal-des-principes.md` | non | oui, demandé par la consigne |
| mémoire de Claude | non | jamais (hors du bac à sable, et non demandée) |

Nombre de lectures par passage, relevé dans les commandes de Codex :

| Passage | Commandes | AGENTS.md | CLAUDE.md | .claude/rules | journal | mémoire de Claude |
|---|---|---|---|---|---|---|
| pr2176 | 17 | 1 | 2 | 2 | 1 | 0 |
| pr2175 | 16 | 1 | 1 | 1 | 1 | 0 |
| pr2172 | 43 | 1 | 4 | 1 | 1 | 0 |
| pr2168 | 53 | 1 | 2 | 2 | 1 | 0 |
| pr2167 | 117 | 1 | 1 | 0 | 1 | 0 |
| pr2165 | 52 | 1 | 1 | 1 | 1 | 0 |
| pr2163 | 46 | 3 | 1 | 1 | 1 | 0 |
| pr2162 | 101 | 1 | 5 | 2 | 1 | 0 |
| pr2156 | 67 | 1 | 1 | 0 | 1 | 0 |
| pr2155 | 33 | 1 | 2 | 1 | 3 | 0 |
| lotA-paiement | 153 | 2 | 1 | 1 | 1 | 0 |
| lotB-commandes | 118 | 1 | 1 | 1 | 1 | 0 |
| lotC-panier | 76 | 1 | 1 | 1 | 1 | 0 |
| lotD-tunnel-site | 162 | 3 | 2 | 1 | 1 | 0 |

Conclusion : Codex lit les mêmes règles que Claude lorsque `AGENTS.md` ou la consigne y
renvoient. Il ne lit pas les décisions de Marwane qui ne vivent que dans la mémoire de Claude.
Plusieurs constats montrent cet écart : Codex juge sur le code et le journal, sans les
décisions de pilotage non écrites dans le dépôt.

## 4. Relecture des 10 PR fusionnées

Une passe par PR, sur le diff du squash joint en entrée standard. Les lignes se lisent sur
l'état de `main` à la base de l'essai. Modèle `gpt-6.2-astra`, effort `high`, code retour 0
pour chaque passe.

| PR | Commit de squash | Fusion (UTC) |
|---|---|---|
| #2176 | 47fc7e4c9d75ce038799ce746568eca9d3687862 | 2026-11-18 16:09:30 |
| #2175 | 6edabe0a353307d97e76aaa465c43e279024a2f6 | 2026-11-18 14:22:46 |
| #2172 | 0e9fb74197ea65b1282477f7ca151d805feb5591 | 2026-11-18 14:13:18 |
| #2168 | 67cf2352fc50de0adae42220713e870b13ef698c | 2026-11-18 12:32:39 |
| #2165 | 45b359d62630668fbdbfd754f3f9dbd6044b8fa7 | 2026-11-18 12:53:03 |
| #2167 | 8b097c8cafce0d7e1d5157156ef83dcfe862b78c | 2026-11-18 11:50:47 |
| #2163 | b40f93bbfb4eac74e743e08a4edd90deeb5c3349 | 2026-11-18 10:25:16 |
| #2162 | f0081e63514212a52cc161e69e4257cb51eea564 | 2026-11-18 08:29:01 |
| #2156 | 253b275815fee6aef7cf66670bfa8da98ecee63c | 2026-11-17 22:17:32 |
| #2155 | bd1da7ebc904be7971cd0e8e9b21c5f035077c44 | 2026-11-17 21:57:07 |

| Objet | Constats | Vrais | dont sécurité | Faux positifs | Déjà connus | Hors sujet | Non tranchés | Durée | Entrée (tokens) | dont cache | Sortie (tokens) | dont raisonnement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| #2176 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 46 s | 240 426 | 184 320 | 1 100 | 26 |
| #2175 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 34 s | 174 669 | 127 616 | 865 | 77 |
| #2172 | 4 | 1 | 0 | 0 | 3 | 0 | 0 | 157 s | 766 887 | 674 688 | 5 072 | 809 |
| #2168 | 7 | 5 | 2 | 2 | 0 | 0 | 0 | 159 s | 761 776 | 675 456 | 5 207 | 1 068 |
| #2167 | 14 | 13 | 0 | 0 | 1 | 0 | 0 | 378 s | 1 998 596 | 1 867 520 | 14 472 | 2 253 |
| #2165 | 11 | 11 | 0 | 0 | 0 | 0 | 0 | 207 s | 1 244 011 | 1 146 240 | 7 736 | 1 674 |
| #2163 | 6 | 6 | 3 | 0 | 0 | 0 | 0 | 187 s | 724 127 | 653 312 | 6 495 | 1 512 |
| #2162 | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 368 s | 2 894 193 | 2 738 560 | 13 913 | 1 861 |
| #2156 | 11 | 9 | 1 | 1 | 0 | 0 | 1 | 167 s | 676 924 | 599 040 | 6 221 | 1 482 |
| #2155 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 68 s | 268 956 | 220 032 | 2 261 | 163 |
| **Total** | **70** | **62** | **6** | **3** | **4** | **0** | **1** | **1771 s** | **9 750 565** | **8 886 784** | **63 342** | **10 925** |

## 5. Audit à blanc du département 13 (Commercial & Ventes)

Le périmètre est délimité d'après `.spec/00-canon/repository-registry/ownership.yaml`
(domaine D11) et le département `sales` de `.spec/00-canon/ai-registry/agent-operating-map.yaml`.
Une passe par lot, sur `main`, sans diff joint.

| Lot | Périmètre | Fichiers suivis |
|---|---|---|
| A — paiement et retour de paiement | `backend/src/modules/payments` | 29 |
| B — commandes | `backend/src/modules/orders` | 30 |
| C — panier | `backend/src/modules/cart`, `packages/domain-commerce` | 30 |
| D — tunnel côté site | 17 routes `frontend/app/routes/` (panier, tunnel de commande, retour de paiement, commandes client et commerciales, reprise de panier) | 17 |

| Objet | Constats | Vrais | dont sécurité | Faux positifs | Déjà connus | Hors sujet | Non tranchés | Durée | Entrée (tokens) | dont cache | Sortie (tokens) | dont raisonnement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A — paiement | 33 | 27 | 4 | 0 | 4 | 0 | 2 | 386 s | 2 754 316 | 2 610 816 | 13 787 | 1 074 |
| B — commandes | 35 | 34 | 3 | 0 | 1 | 0 | 0 | 359 s | 3 509 779 | 3 353 344 | 12 875 | 370 |
| C — panier | 23 | 22 | 1 | 0 | 1 | 0 | 0 | 265 s | 2 163 605 | 2 030 976 | 9 761 | 1 123 |
| D — tunnel côté site | 38 | 37 | 0 | 0 | 0 | 0 | 1 | 422 s | 3 610 437 | 3 442 688 | 15 683 | 1 040 |
| **Total** | **129** | **120** | **8** | **0** | **6** | **0** | **3** | **1432 s** | **12 038 137** | **11 437 824** | **52 106** | **3 607** |

## 6. Tri

Chaque constat a été vérifié dans le code du worktree, puis recherché dans les PR et issues du
dépôt (`gh search`). Verdicts :

- **vrai** : défaut réel. Gravité revue après vérification ;
- **vrai (sécurité)** : défaut réel de sécurité. Le fichier est cité, pas le détail ; le
  détail est transmis au pilotage, hors de ce dépôt public ;
- **faux positif** : comportement voulu, ou affirmation fausse dans le code ;
- **déjà connu** : déjà décrit dans une PR, une migration, le journal ou une liste de
  tolérance du dépôt, ou déjà corrigé par une PR postérieure ;
- **hors sujet** : hors de l'objet relu ;
- **non tranché** : la vérification demande une donnée hors du périmètre (base, exécution
  réelle) ou une intention non écrite.

| Verdict | haute | moyenne | faible | info | sans gravité | Total |
|---|---|---|---|---|---|---|
| vrai | 1 | 43 | 105 | 19 | 0 | 168 |
| vrai (sécurité) | 3 | 3 | 8 | 0 | 0 | 14 |
| faux positif | 0 | 0 | 0 | 0 | 3 | 3 |
| déjà connu | 0 | 1 | 3 | 0 | 6 | 10 |
| hors sujet | 0 | 0 | 0 | 0 | 0 | 0 |
| non tranché | 0 | 0 | 0 | 0 | 4 | 4 |

Gravité donnée par Codex, pour comparaison : high 70, low 14, medium 115.

Le détail des 199 constats est dans `annexe-tri.md`.

## 7. Limites

- **Quota** : `codex exec` ne renvoie aucun champ de quota restant. La consommation est
  relevée en tokens par passe (`turn.completed.usage`) ; le quota du compte ChatGPT n'est pas
  mesuré. Aucun passage n'a été refusé pour quota.
- **Modèle servi** : la sortie ne nomme pas le modèle qui a réellement répondu (§1).
- **`files_read`** est déclaré par Codex. Les comptes de lecture du §3 viennent des commandes
  relevées dans le flux JSON, plus fiables.
- **Exécution de code du dépôt** : Codex a parfois exécuté du code du dépôt dans le bac à
  sable (évaluation d'une fonction Python, vérifications en mémoire). Le bac à sable empêche
  l'écriture et le réseau, mais une routine devrait l'interdire par consigne ou le prévoir.
- **Variables d'environnement** : sous `codex sandbox`, une variable dont le nom évoque un
  jeton restait visible. Les passages `codex exec` utilisaient `inherit="core"`, qui ne la
  transmet pas ; la valeur n'a pas été affichée.
- **Gravité** : Codex surestime la gravité. Il a classé « high » des défauts latents
  derrière une route fermée par défaut. La gravité vérifiée est presque toujours plus basse
  (§6).
- **Une seule passe par objet**, un seul modèle : ni la répétabilité ni la comparaison entre
  modèles ne sont mesurées.
- **Tri** : fait par Claude sur le code, sans exécution, sans la base ni la PROD. Un constat
  « vrai » est un défaut présent dans le code de `main`. Ce n'est pas la preuve d'un incident
  servi en PROD.

## 8. Routines possibles après fusion (aucune installée)

Mesures de l'essai : 177 s et 975 000.0 tokens d'entrée en moyenne par PR, dont
91 % servis par le cache. Il y a eu 122 PR fusionnées du 2026-11-12 au 2026-11-18,
soit environ 17 par jour. Le temps de tri par Claude n'a pas été chronométré ; c'est le poste
le plus lourd de l'essai.

| Routine | Déclenchement | Coût estimé | Risques |
|---|---|---|---|
| **R1 — à la demande** | Marwane ou le pilotage désigne une PR fusionnée ; une session lance la commande du §2 et trie | ≈ 3 min de Codex et ≈ 975 000.0 tokens par PR, plus le tri | aucun nouveau composant ; couverture partielle |
| **R2 — lot quotidien sur le DEV** | une fois par jour, toutes les PR fusionnées des 24 h, puis tri | ≈ 17 × 3 min ≈ 50 min de Codex et ≈ 16,6 M tokens d'entrée par jour ; tri de plusieurs dizaines de constats par jour au rythme observé | le volume de constats faibles peut noyer les vrais ; demande un cron, à installer par décision |
| **R3 — zones STOP seulement** | seulement les PR qui touchent paiement, panier ou commande, RLS ou migrations | quelques PR par semaine au rythme récent, même coût unitaire | couverture limitée aux zones où une erreur coûte le plus |

Une exécution dans GitHub Actions est déconseillée en l'état : elle demanderait un secret
d'API sur un dépôt public, et un workflow lui-même relu par ses propres PR.

## 9. Export des décisions de Marwane (proposition, non appliquée)

Constat : Codex lit `AGENTS.md`, qui renvoie à `CLAUDE.md`, au journal et aux règles. Il ne
lit pas les décisions de pilotage gardées dans la mémoire de Claude. Proposition, à décider
par Marwane et à appliquer par sa PR :

- **Emplacement** : une table unique, en ajout seul,
  `.claude/governance/registre-des-decisions.md`, voisine du journal des principes ;
- **Format** : une ligne par décision. Colonnes : n°, date, énoncé neutre, périmètre ou
  département, source (PR ou principe), état (en vigueur, ou remplacée par n°) ;
- **Raccord** : une ligne de renvoi dans `AGENTS.md` et dans `CLAUDE.md`, sans copie du
  contenu.

Exclusions imposées par le caractère public du dépôt : identifiants de session ; comptes,
courriels et identifiants de connexion (y compris les noms de profils) ; adresses IP, noms
d'hôtes et chemins du serveur ; détails de sécurité non corrigés et état de rotation des
secrets ; données clients et commandes ; prix et remises fournisseurs ; liens vers des dépôts
privés ou des espaces de pilotage ; texte de la mémoire de Claude.

## 10. Ce que Codex a observé, ce que Claude a vérifié, ce qui reste non vérifié

- **Observé par Codex** : les 199 constats, avec sa gravité et sa preuve (annexe,
  colonne « Constat »).
- **Vérifié par Claude** : pour chaque constat, le fichier et la ligne cités, lus dans le
  worktree à la base de l'essai, et la recherche de l'antécédent dans le dépôt et sur GitHub
  (annexe, colonne « Preuve vérifiée »). Pour les constats de sécurité, la vérification est
  faite ; seul le détail est retiré.
- **Non vérifié** : tout comportement servi en DEV, PREPROD ou PROD ; l'état de la base
  (contraintes, données) ; les constats « non tranchés » ; la répétabilité de Codex.
