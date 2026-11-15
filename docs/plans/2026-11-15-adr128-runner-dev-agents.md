# Runner DEV « agents » — procédure d'installation (ADR-128, étape 1)

Procédure **écrite, non exécutée**. Chaque commande est un geste de l'owner sur le VPS DEV : la
session de préparation n'a ni enregistré de runner, ni créé d'utilisateur, ni demandé de jeton.

## Rôle et limites

- Exécution des sessions d'agents à partir de l'étape 2 (`mandat-remise`, ADR-128 D4). À l'étape 1,
  **aucun workflow ne cible ce runner** : `pilote-file` tourne sur `ubuntu-latest`. Le critère de
  sortie est seulement « runner `online` vu par l'API avec un jeton de l'owner ».
- Enregistrement distinct du runner de la CI (ADR-128 D3). Les cinq workflows
  `[self-hosted, Linux, X64]` (`ci.yml`, `deploy-monitoring-scripts.yml`, `prod-smoke-tests.yml`,
  `release-prod.yml`, `visual-gate.yml`) sont servis aujourd'hui par le runner `hetzner-prod`.
  Ce runner porte **uniquement** le label `agents` (`--no-default-labels`) : un job n'est attribué
  qu'à un runner qui porte tous ses labels, il ne prendra donc jamais un job
  `[self-hosted, Linux, X64]`.
- Aucun code de fork (ADR-128 D4.4) : réglage du dépôt à poser (§6) et, à l'étape 2, aucun
  déclencheur `pull_request`/`pull_request_target` dans un workflow qui cible `agents`.
- Droits minimaux : utilisateur système dédié, sans `sudo`, hors des groupes `docker` (équivalent
  root) et `deploy` ; service durci par systemd (§5) qui masque `/home` et `/opt/automecanik`.

## Identité à utiliser

Sur le DEV, `gh` est connecté avec l'app `automecanik-agents[bot]` (jeton `ghs_…`, à vérifier avec
`gh auth status`). Cette app n'a pas le droit « Administration » du dépôt : les §3, §6 et §7
reçoivent HTTP 403 (« Resource not accessible by integration ») depuis le shell DEV. Ils se font
avec le compte de l'owner, soit dans l'interface web (voie indiquée à chaque paragraphe), soit
avec `gh` connecté au compte de l'owner sur son poste. Donner ce droit à l'app des agents
élargirait leur périmètre (runners, réglages du dépôt) : ce n'est pas la voie retenue. Seuls les
§0, §1, §2, §4 et §5 s'exécutent sur le DEV.

## 0. Pré-contrôles (lecture seule)

```bash
systemctl list-units --all 'actions.runner*'          # attendu : aucune unité
pgrep -a Runner.Listener                              # attendu : aucun processus
df -h /home                                           # le runner et ses _work occupent quelques Go
getent passwd gh-agents                               # attendu : rien (utilisateur à créer)
# Aucun fichier d'environnement lisible par tous (corriger avant l'étape 2, sans en afficher le contenu) :
sudo find /opt/automecanik /home -name '.env*' -perm -o+r -not -path '*/node_modules/*' -printf '%m %p\n'
```

## 1. Utilisateur dédié

```bash
sudo useradd --system --create-home --home-dir /home/gh-agents --shell /bin/bash gh-agents
sudo chmod 700 /home/gh-agents
id gh-agents                                           # attendu : un seul groupe, gh-agents
```

Ne jamais l'ajouter à `sudo`, `docker`, `deploy`, ni lui donner de clé SSH ou de fichier `.env`.

## 2. Binaire du runner, empreinte vérifiée

Version figée : `v2.338.2` (publiée le 2026-10-26). Empreinte SHA-256 de
`actions-runner-linux-x64-2.338.2.tar.gz` publiée dans les notes de version :
`baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40`.

```bash
gh release view v2.338.2 --repo actions/runner --json body --jq .body \
  | grep -o 'BEGIN SHA linux-x64 -->[0-9a-f]*' | cut -d'>' -f2   # doit redonner l'empreinte ci-dessus
sudo -u gh-agents -H bash -c '
  set -euo pipefail
  mkdir -p ~/actions-runner && cd ~/actions-runner
  curl -fsSLO https://github.com/actions/runner/releases/download/v2.338.2/actions-runner-linux-x64-2.338.2.tar.gz
  echo "baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40  actions-runner-linux-x64-2.338.2.tar.gz" | sha256sum -c -
  tar xzf actions-runner-linux-x64-2.338.2.tar.gz && rm actions-runner-linux-x64-2.338.2.tar.gz'
```

La mise à jour automatique du runner reste active (comportement par défaut) : il se met à jour
dans `/home/gh-agents/actions-runner`, seul répertoire où le service peut écrire.

## 3. Jeton d'enregistrement (owner)

Jeton à usage unique, valable une heure. Il se demande avec le compte de l'owner (le jeton
agent reçoit HTTP 403 sur l'API des runners) et **ne s'écrit nulle part** : ni issue, ni PR, ni chat,
ni fichier, ni historique du shell.

Voie web : *Settings → Actions → Runners → New self-hosted runner* (Linux, x64) ; le jeton figure
dans la commande `./config.sh` affichée, à copier dans l'invite du §4 et nulle part ailleurs.
Voie `gh`, sur le poste de l'owner, connecté à son compte (pas le shell DEV) :

```bash
gh api -X POST repos/ak125/nestjs-remix-monorepo/actions/runners/registration-token --jq .token
```

## 4. Enregistrement

Le jeton est lu au clavier, sans écho :

```bash
sudo -u gh-agents -H bash -c '
  cd ~/actions-runner
  read -rsp "Jeton d’enregistrement : " T; echo
  ./config.sh --unattended \
    --url https://github.com/ak125/nestjs-remix-monorepo \
    --token "$T" --name dev-agents \
    --no-default-labels --labels agents \
    --work _work
  unset T'
```

## 5. Service systemd durci

```bash
cd /home/gh-agents/actions-runner
sudo ./svc.sh install gh-agents
U=actions.runner.ak125-nestjs-remix-monorepo.dev-agents.service
systemctl cat "$U" | grep -E '^(User|ExecStart)='       # attendu : User=gh-agents
sudo mkdir -p "/etc/systemd/system/$U.d"
sudo tee "/etc/systemd/system/$U.d/durcissement.conf" > /dev/null <<'EOF'
[Service]
NoNewPrivileges=yes
RestrictSUIDSGID=yes
LockPersonality=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=tmpfs
BindPaths=/home/gh-agents
InaccessiblePaths=/opt/automecanik
ProtectProc=invisible
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
Nice=10
CPUWeight=50
IOWeight=50
EOF
sudo systemctl daemon-reload
sudo systemctl start "$U"
systemctl status "$U" --no-pager | head -5
systemd-analyze security "$U" | tail -1                # score d'exposition, à noter dans l'issue
# Contrôle dans l'espace de montage réel du service (pas celui d'un sudo -u) :
P="$(systemctl show -p MainPID --value "$U")"
sudo nsenter -t "$P" -m ls /opt/automecanik /home/deploy 2>&1 | head -3
# attendu : « Permission denied » pour /opt/automecanik, « No such file or directory » pour /home/deploy
```

Effet attendu du durcissement : le service ne voit ni `/home/deploy` ni `/opt/automecanik` (code,
`.env`, clones), ne voit pas les processus des autres utilisateurs, n'écrit que dans
`/home/gh-agents`, ne gagne aucun privilège et passe après les opérations du DEV (`Nice`, poids
CPU et E/S). Ces directives n'ont pas été essayées sur le DEV : si le service ne démarre pas, lire
`journalctl -u "$U" -n 50`, retirer la seule directive en cause et le consigner dans l'issue.

Conséquence pour l'étape 2 : ADR-128 D4.2 prévoit un worktree « depuis le clone DEV ». Avec ce
durcissement, le runner n'accède pas à `/opt/automecanik/app` : l'étape 2 tranchera entre un clone
propre à `gh-agents` dans son répertoire et un assouplissement nommé, à décider par l'owner.

## 6. Code de fork (D4.4)

Réglage du dépôt : *Settings → Actions → General → Approval for running fork pull request workflows
from contributors* → **Require approval for all external contributors**. La page affiche la
valeur en cours : c'est le contrôle. Voie `gh`, sur le poste de l'owner, connecté à son compte :

```bash
gh api repos/ak125/nestjs-remix-monorepo/actions/permissions/fork-pr-contributor-approval
# attendu : {"approval_policy":"all_external_contributors"}
```

Depuis le shell DEV, cette API répond HTTP 403 (constaté le 2026-11-15 par la session et par
l'owner). Constat de l'owner du 2026-11-15, dans le web après rechargement de la page : **Require
approval for all external contributors**.

## 7. Vérification (critère de sortie de l'étape 1)

Voie web : *Settings → Actions → Runners* : `dev-agents` en « Idle » (vert), label `agents` seul.
Voie `gh`, sur le poste de l'owner, connecté à son compte :

```bash
gh api repos/ak125/nestjs-remix-monorepo/actions/runners \
  --jq '.runners[] | {name, status, busy, labels: [.labels[].name]}'
# attendu : dev-agents, status "online", labels ["agents"] seulement ;
# hetzner-prod inchangé (self-hosted, Linux, X64).
```

## Arrêt d'urgence et retour arrière (owner seul, ADR-128 D6)

| Niveau | Geste | Effet |
|---|---|---|
| N1 | `sudo systemctl stop actions.runner.ak125-nestjs-remix-monorepo.dev-agents.service` puis `sudo systemctl disable` sur la même unité | plus aucune exécution sur le DEV ; un job qui cible `agents` reste en file et expire après 24 h |
| Retrait | `cd /home/gh-agents/actions-runner && sudo ./svc.sh uninstall`, puis `sudo -u gh-agents -H ./config.sh remove --token <jeton de retrait>` (jeton : `gh api -X POST repos/ak125/nestjs-remix-monorepo/actions/runners/remove-token --jq .token`, même règle que §3) | runner désenregistré ; `sudo userdel -r gh-agents` en dernier |
