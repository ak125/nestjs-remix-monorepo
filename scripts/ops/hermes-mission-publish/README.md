# Hermes : publication d'une mission DEV en PR brouillon

Cet outil couvre l'étape « créer une PR avec une identité limitée » d'une mission
d'écriture Hermes. Il ne lance aucune mission, ne fusionne rien, ne déploie rien
et n'écrit pas dans l'état du contrôleur Hermes.

Chemin : mission Telegram → Hermes → broker → contrôleur DEV, qui fixe et vérifie
le SHA complet puis crée l'espace isolé détaché → exécutant (Claude sous bwrap
sans réseau ni HOME, ou Codex avec son profil natif) → patch et empreinte SHA-256
dans l'état de la mission → **accord humain distinct pour publier cette mission
précise** → `python3 publish.py publish <mission_id>`, lancé sous le compte deploy
de DEV → branche `hermes/<mission_id>` et PR brouillon de `automecanik-agents[bot]`
→ CI de la PR → fusion selon les règles GitHub, par l'owner.

Identité : l'application GitHub du compte deploy, lue par `gh` et `git` via le
helper `gh auth git-credential`. Elle n'a ni Administration ni Workflows. Hermes
ne la reçoit jamais ; les exécutants ne peuvent pas lire sa configuration. Le
jeton administrateur n'est pas utilisé.

Contrôles avant toute écriture, chacun refusant sans rien laisser derrière lui :
- mission `completed`, en `bounded-write`, résultat `achieved` déclaré par
  l'exécutant, `scope_ok` prouvé par le contrôleur ;
- révision de 40 caractères hexadécimaux, présente dans la source réellement
  utilisée (`app`, ou la cible WIKI enregistrée dans l'état), et égale au HEAD
  de l'espace isolé tant que celui-ci est conservé (`workspace_head: verified` ;
  `released` après sa libération) ;
- fichiers dans les chemins du contrat, même règle que le contrôleur ; `.github/`
  refusé (réservé à l'owner), ainsi que tout `.gitleaks.toml` ou `.gitleaksignore`
  (gitleaks lit ceux de l'arbre scanné : le patch ne doit pas affaiblir son
  propre scan) ;
- patch identique à l'empreinte et à la taille enregistrées (8 Mio au plus) ;
- commit reconstruit dans un worktree temporaire détaché sur la révision exacte,
  liste des fichiers comparée deux fois (après `git apply`, puis après le commit) ;
- gitleaks sur le commit et sur le texte de la PR, avec les règles du dépôt à la
  révision fixée : le dépôt est public, le push publie.

Le commit est déterministe (auteur, committer et date fixés par la mission) : une
relance après un échec de `gh pr create` réutilise la branche déjà poussée ; une
branche existante portant un autre commit est refusée. Aucun hook Git ne tourne
(`core.hooksPath=/dev/null`) : le `core.hooksPath` relatif du dépôt se
résoudrait dans l'arbre patché, avec l'identité de publication, et le hook Node
ne pourrait pas tourner ici ; la CI de la PR fait foi. Titre `chore(hermes): …`
conforme à commitlint.

`check` exécute tous les contrôles et la reconstruction sans pousser.
`publish` ajoute le push, la PR brouillon et un reçu JSON dans
`/home/deploy/.local/state/hermes-mission-publish/<mission_id>.json` (mode 0700),
qui bloque une seconde publication.

Limites : le déclenchement reste manuel sur DEV, après l'accord humain ; aucun
accord Telegram natif n'est raccordé à cet outil. Une mission `partial` ou
`blocked` n'est pas publiable, même si son patch est propre.

Qualification : `python3 -B test_publish.py`. Les fixtures sont synthétiques
(dépôt Git local, remote nu, `gh` simulé ; gitleaks réel s'il est installé) ;
elles ne prouvent pas le fonctionnement réel. Un `check` sur une mission
existante est une répétition à blanc. La preuve réelle est une mission fraîche,
publiée après accord, dont la PR fusionnée contient exactement le patch.

Rollback : fermer la PR brouillon, supprimer la branche `hermes/<mission_id>`,
retirer le reçu si la mission doit être republiée. Rien d'autre à défaire :
aucun état Hermes, service, timer ou configuration n'est modifié.
