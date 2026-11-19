# Codex contrôleur — relecture quotidienne, en lecture seule, des fusions sur `main`

Codex relit après coup chaque PR fusionnée sur `main`, avec une consigne permanente et une sortie
sous schéma. Il ne bloque aucune fusion et n'écrit rien : ni dans le dépôt, ni sur GitHub. Les
constats restent sur la machine DEV ; leur suite (tri, issues, corrections) est une décision
humaine. Le cadre d'exécution reprend celui de l'essai CP (PR #2185).

| Fichier | Rôle |
|---|---|
| `consigne.md` | Consigne permanente du contrôleur : ce qu'il contrôle et lit, ce qu'il rend, ce qu'il ne fait jamais. Donnée en tête de chaque passage. Texte à approuver par Marwane. |
| `constats.schema.json` | Schéma de sortie imposé à Codex (`--output-schema`), copie de celui de CP. |
| `codex-controleur.sh` | La routine : `init`, `quotidien`, `lot`, `ignorer`, `commande`. |
| `codex-controleur.test.sh` | Tests sans réseau ni Codex réel (faux `codex`, faux `gh`, dépôt d'origine local). |
| `automecanik-codex-controleur.service` | Unité utilisateur `oneshot` qui lance `codex-controleur.sh quotidien`. Livrée, non installée. |
| `automecanik-codex-controleur.timer` | Un passage par jour à 05:30 UTC, rattrapé au démarrage s'il a été manqué. Livré, non installé. |

## Ce que fait un passage `quotidien`

1. Refuse de partir si le curseur manque (code 6), si un passage tourne déjà (code 7) ou si
   `codex --version` n'est pas exactement `codex-cli 0.170.0` (code 4, rien relu).
2. Liste les PR fusionnées sur `main` depuis le curseur (`gh pr list --state merged`), moins
   celles déjà relues ou ignorées, de la plus ancienne à la plus récente.
3. Crée un worktree jetable, détaché sur `origin/main` à jour, sous le dossier d'état ; il est
   retiré à la sortie, quelle qu'elle soit.
4. Pour chaque PR, dans l'ordre : diff du commit de fusion (fichiers générés retirés ; au-delà de
   400 000 octets, la seule liste des fichiers), puis un passage `codex exec` en lecture seule.
   Une PR n'est marquée relue que si la sortie est présente et conforme au schéma.
5. S'arrête au premier échec, sans sauter de PR :
   - quota Codex épuisé (code 5) : état `warn`, reprise au passage suivant à cette PR ;
   - tout autre échec (code 1) : état `error`, même reprise ; une PR qui échoue toujours se
     retire par `ignorer --pr N --motif …`, décision humaine et tracée dans le curseur ;
   - plafond de 40 PR atteint : état `warn`, le reste au passage suivant.
6. Écrit le résumé du jour et l'état du job (`cron_report`, affiché au début de chaque session
   Claude de la machine ; muet au-delà de 36 h = alerte).

Le mode `lot --nom NOM --liste FICHIER [--departement NN]` relit un lot de fichiers entiers (audit
d'un département) avec la même consigne et le même cadre, sans toucher au curseur.

### Commande Codex effective

`bash scripts/ops/codex-controleur/codex-controleur.sh commande` l'affiche. Réglages : `-s
read-only`, `--ignore-user-config` (le `~/.codex/config.toml` n'est pas lu), `--ignore-rules`,
`--ephemeral` (aucune session conservée), environnement des commandes réduit au noyau
(`shell_environment_policy.inherit="core"`), applications, greffons, hooks, navigateurs, image,
multi-agent et suggestions d'outils désactivés, aucun serveur MCP (configuration utilisateur
ignorée), profil de permissions `controleur` : lecture du minimum système, du
worktree jetable, du `.git` commun et du paquet de Codex, rien d'autre. `GH_TOKEN`,
`GITHUB_TOKEN` et `GH_ENTERPRISE_TOKEN` sont retirés de son environnement. Modèle `gpt-6.2-astra`,
effort `high`. Codex lit `AGENTS.md` du worktree ; la consigne est jointe au prompt, suivie de
« OBJET DU PASSAGE ».

### Réglages (variables d'environnement)

| Variable | Défaut |
|---|---|
| `CODEX_CONTROLEUR_DEPOT` | dépôt qui contient le script (`/opt/automecanik/app` une fois installé) |
| `CODEX_CONTROLEUR_ETAT` | `${XDG_STATE_HOME:-~/.local/state}/automecanik/codex-controleur` |
| `CODEX_CONTROLEUR_BIN` / `_VERSION` | `codex` / `0.170.0` |
| `CODEX_CONTROLEUR_MODELE` / `_EFFORT` | `gpt-6.2-astra` / `high` |
| `CODEX_CONTROLEUR_MAX_PR` | `40` (aussi `--max N`) |
| `CODEX_CONTROLEUR_DIFF_MAX` | `400000` octets |

### Ce qui reste hors du dépôt (dossier d'état, machine DEV)

- `curseur.json` : date de départ et PR relues ou ignorées (`statut`, `motif`, date) ;
- `bruts/<jour>/pr<N>/` et `bruts/<jour>/lot-<NOM>/` : `prompt.txt`, `entree.diff`,
  `evenements.jsonl`, `last.json` (constats), `stderr.txt`, `meta.json` (base `main`, modèle,
  sha256 de la consigne, durée, tokens d'entrée, de cache, de sortie et de raisonnement) ;
- `resume-<jour>.md` : décompte par gravité et tableau des constats ;
- `~/.local/state/automecanik/cron/codex-controleur.json` : dernier état du job.

Les constats bruts peuvent décrire une faille : ils ne quittent pas la machine DEV sans tri. Le
script crée ses fichiers en `umask 077` et pose les droits `700` sur le dossier d'état et sur
`bruts/` à chaque lancement, même s'ils existaient déjà (lecture réservée à l'utilisateur `deploy`).

### Garde des données sensibles

Après chaque passage, les notes et les constats sont confrontés à des formes de secret (jeton JWT,
clé secrète Supabase) et de donnée personnelle (courriel, téléphone français). Un objet qui en
contient une garde ses constats dans `last.json`, marqué `"alerte": "donnee_sensible_possible"`
dans `meta.json`, et le résumé du jour ne les reprend pas : il indique seulement de les lire et
de les trier avant tout partage. La garde ne bloque pas le passage et ne remplace pas la consigne
(qui interdit déjà de recopier un secret ou une donnée personnelle) : elle rattrape un oubli.

### Accès à la base : suspendu

Le pilotage a demandé (complément n° 1 du mandat DI) que les passages chargent le serveur MCP
`supabase-local` (`scripts/mcp-server/server.js`), à condition qu'aucun de ses outils n'écrive et
qu'aucun chemin ne permette une écriture ou un SQL libre. La vérification demandée a trouvé dans
`server.js` un chemin qui ne se limite pas aux quatre lectures prévues ; le détail est remis au
pilotage hors dépôt. Le serveur n'est donc pas branché : les passages restent sans aucun serveur
MCP et la consigne garde l'interdiction d'interroger une base. Le brancher demande d'abord une
correction de `server.js` puis une nouvelle vérification, et une décision de Marwane.

### Limites connues

- Le worktree jetable écrit ses métadonnées sous `.git/worktrees/` du checkout DEV le temps du
  passage, puis les retire ; `git fetch origin main` met à jour la référence distante.
- La détection du quota repose sur les codes d'erreur relevés dans le binaire 0.170.0
  (`usage_limit_reached`, `rate_limit_exceeded`, `quota_exceeded`, `credits_depleted`…). Une autre
  version de Codex est refusée avant tout passage, ce qui oblige à revoir cette liste.
- La consigne lue est celle du checkout DEV ; le sha256 du texte réellement joint au prompt est
  noté dans chaque `meta.json` (version 1 : `777e6718d94d3ae3d1023d44f594926b62f2424aead9726bf90efd83416b9c00`).
- `codex exec` ne renvoie aucun quota restant : la consommation se lit en tokens par passage.

## Contrôles

```bash
cd /opt/automecanik/app
bash scripts/ops/codex-controleur/codex-controleur.test.sh    # sans réseau ni Codex réel
bash scripts/ops/codex-controleur/codex-controleur.sh commande
```

Le test couvre : curseur absent (6), `init` (format, double init), version inattendue (4, Codex
non lancé), quota à la 2e PR (5, curseur arrêté à la 1re) puis reprise sans rien sauter, mots du
quota lus dans un fichier sans arrêt, rien de neuf, cadre de lecture seule et jetons GitHub
retirés, aucun serveur MCP, `package-lock.json` retiré du diff, `--max`, échec générique (1),
`ignorer`, mode `lot` (curseur intact, fichier absent, quota), garde des données sensibles
(constat retenu hors du résumé, autres lots intacts), droits `700` du dossier des constats bruts (y compris sur un dossier d'état déjà présent en `755`),
verrou (7), worktrees retirés, unités livrées. Résultat au 2026-11-19 : 83 contrôles, 0 en échec.

## Installer et activer

Réservé à Marwane. Écrit, non exécuté par l'agent. Utilisateur `deploy`, sans sudo, depuis le
checkout DEV à jour sur `main` après fusion :

```bash
cd /opt/automecanik/app
git status --short scripts/ops/codex-controleur/    # vide attendu
git log -1 --format=%H                              # commit installé, à noter
S=scripts/ops/codex-controleur
bash "$S/codex-controleur.test.sh"                  # attendu : 0 en échec
codex --version                                     # attendu : codex-cli 0.170.0

# 1. Curseur : point de départ choisi (ici, les fusions à partir du jour de l'installation)
bash "$S/codex-controleur.sh" init --depuis "$(date -u +%Y-%m-%dT00:00:00Z)"

# 2. Unités
install -m 0644 "$S/automecanik-codex-controleur.service" "$S/automecanik-codex-controleur.timer" ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now automecanik-codex-controleur.timer

# 3. Recette : un premier passage tout de suite, puis lecture du résultat
systemctl --user start automecanik-codex-controleur.service
journalctl --user -u automecanik-codex-controleur -n 20 --no-pager
cat ~/.local/state/automecanik/cron/codex-controleur.json
ls ~/.local/state/automecanik/codex-controleur/
systemctl --user list-timers automecanik-codex-controleur.timer
```

Le `start` du service est bloquant jusqu'à la fin du passage (environ 3 min par PR mesurées en CP).

**Arrêt** : `systemctl --user disable --now automecanik-codex-controleur.timer`. Le curseur reste :
une réactivation reprend là où le dernier passage réussi s'était arrêté.
**Retrait** : arrêt, puis `rm ~/.config/systemd/user/automecanik-codex-controleur.{service,timer}`
et `systemctl --user daemon-reload` ; le dossier d'état peut être gardé pour ses constats.

## Où vont les constats (proposition, rien n'est ouvert)

- **Tri d'abord** : la session de pilotage lit `resume-<jour>.md` chaque matin et trie chaque
  constat dans le code (vrai avec gravité, faux positif, déjà connu, indécis), comme les annexes
  de CP et de DI. Marwane tranche les priorités et confie les corrections par mandat. Un constat
  brut n'est jamais publié tel quel.
- **Une issue par département**, étiquette existante `dept:NN-<nom>` (`dept:23-ia-agents`…),
  titre « Contrôle Codex — département NN », tenue à jour par la session de pilotage : une ligne
  cochable par constat vrai (fichier:ligne, gravité, PR d'origine), cochée à la correction. Les
  faux positifs et les indécis n'y vont pas.
- **Sécurité exclue** : aucun constat de catégorie `security`, ni aucun constat qui touche à
  l'authentification, aux droits, aux secrets, au paiement ou à une donnée personnelle, n'entre
  dans une issue publique (le dépôt est public). Ces constats sont remis à la session de pilotage,
  hors GitHub, qui les porte à Marwane.
- La routine elle-même n'écrit jamais sur GitHub ; ouvrir ou tenir ces issues reste un geste
  humain ou de pilotage, à décider.
