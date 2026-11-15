# Jeton GitHub App des agents de la machine DEV

Source versionnée du mécanisme qui donne aux agents de la machine DEV leur jeton d'installation
GitHub App (1 h). La machine est une installation de ce dossier : on modifie ici, on installe
ensuite selon la procédure ci-dessous. Droits demandés : ADR-130 D3.4 (vault), sans `workflows`.

| Source (ce dossier) | Installé | Propriétaire, mode | Rôle |
|---|---|---|---|
| `automecanik-gh-app-token` | `/usr/local/libexec/automecanik-gh-app-token` | `root:root 0755` | Délivreur : signe un JWT avec la clé de l'App, demande un jeton limité à `REPOS` et `PERMS`, refuse toute réponse qui n'est pas exactement ce périmètre. Exécuté sous `automecanik-ghapp`, seul lecteur de la clé. |
| `automecanik-gh-app-token-refresh` | `/home/deploy/.local/libexec/automecanik-gh-app-token-refresh` | `deploy:deploy 0700` | Wrapper : appelle le délivreur par sudo, réécrit `~/.config/gh/hosts.yml` (0600), enregistre le résultat par `cron_report`. |
| `automecanik-gh-app-token-refresh.service` | `/home/deploy/.config/systemd/user/` | `deploy:deploy 0644` | Unit utilisateur `oneshot` qui lance le wrapper. |
| `automecanik-gh-app-token-refresh.timer` | `/home/deploy/.config/systemd/user/` | `deploy:deploy 0644` | Relance toutes les 20 min (jeton valable 1 h). |

Restent hors du dépôt et lus à leur emplacement, jamais copiés ni affichés :

- `/etc/automecanik/github-app/private-key.pem` : clé privée de l'App, lisible par `automecanik-ghapp` seul ;
- `/etc/automecanik/github-app/app.conf` : `APP_ID` et `INSTALLATION_ID` ;
- la règle sudoers qui autorise `deploy` à lancer, sous `automecanik-ghapp` et sans mot de passe,
  `/usr/local/libexec/automecanik-gh-app-token ""` et `… describe` (lue par `sudo -n -l`, fichier
  non lisible par `deploy`, non versionné ici) ;
- `~/.config/gh/hosts.yml` : le jeton en cours.

## Échec du renouvellement : où le lire

- **Journal du service** : `journalctl --user -u automecanik-gh-app-token-refresh -n 20 --no-pager`.
  Depuis ce wrapper, une ligne `ÉCHEC : délivreur en échec (code N) : <cause>` y figure. Avant lui,
  la sortie d'erreur du délivreur, lancé sous sudo (`use_pty`), n'atteignait pas ce journal : seul
  `status=1/FAILURE` restait (15 nov. 2026, 09:24 à 11:03 UTC).
- **Constat du pilote** : `~/.local/state/automecanik/cron/gh-app-token-refresh.json`, écrit par
  `scripts/cron/lib-supabase-report.sh`. Le hook SessionStart affiche
  `⚠️ cron gh-app-token-refresh : ÉCHEC depuis …` en tête de chaque session Claude de la machine,
  ou `MUET` si aucun rapport depuis plus d'une heure (minuteur arrêté, jeton expiré).
- **Refus détaillés du délivreur** : `journalctl -t automecanik-gh-app-token` (journal système,
  groupe `adm` ou root).

## Contrôles

```bash
cd /opt/automecanik/app
bash scripts/ops/gh-app-token/gh-app-token.test.sh          # sans réseau, ni sudo, ni installation
bash scripts/ops/gh-app-token/controle-installation.sh       # empreintes source / installé, lecture seule
```

Le test échoue si `PERMS` gagne `workflows` ou tout droit au-delà des six attendus, si l'égalité
stricte des droits reçus disparaît, ou si le wrapper perd la cause d'un échec.

## Installer ou mettre à jour depuis la source

Réservé à Marwane (droits root). Écrit, non exécuté par l'agent. Depuis le checkout servi, à jour
sur `main` après fusion :

```bash
cd /opt/automecanik/app
git status --short scripts/ops/gh-app-token/      # vide attendu
git log -1 --format=%H                             # commit installé, à noter
bash scripts/ops/gh-app-token/gh-app-token.test.sh
S=scripts/ops/gh-app-token
J=$(date -u +%Y%m%d)

# 1. Délivreur (root) : sauvegarde, puis remplacement atomique
sudo cp -p /usr/local/libexec/automecanik-gh-app-token "/usr/local/libexec/automecanik-gh-app-token.avant-$J"
sudo install -o root -g root -m 0755 "$S/automecanik-gh-app-token" /usr/local/libexec/automecanik-gh-app-token.neuf
sudo mv -f /usr/local/libexec/automecanik-gh-app-token.neuf /usr/local/libexec/automecanik-gh-app-token

# 2. Wrapper et unités (utilisateur deploy, sans sudo)
cp -p ~/.local/libexec/automecanik-gh-app-token-refresh ~/.local/libexec/automecanik-gh-app-token-refresh.avant-"$J"
install -m 0700 "$S/automecanik-gh-app-token-refresh" ~/.local/libexec/automecanik-gh-app-token-refresh
install -m 0644 "$S/automecanik-gh-app-token-refresh.service" "$S/automecanik-gh-app-token-refresh.timer" ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now automecanik-gh-app-token-refresh.timer

# 3. Recette
systemctl --user start automecanik-gh-app-token-refresh.service
journalctl --user -u automecanik-gh-app-token-refresh -n 10 --no-pager
gh auth status
bash "$S/controle-installation.sh"                 # attendu : 4 « identique », code 0
```

Une sauvegarde `….avant-<date>` est laissée en place à chaque étape ; la retirer après recette.

**Retour arrière** : réinstaller la sauvegarde au même emplacement, avec les mêmes propriétaires et
modes (`sudo install -o root -g root -m 0755 /usr/local/libexec/automecanik-gh-app-token.avant-$J
/usr/local/libexec/automecanik-gh-app-token` ; `install -m 0700
~/.local/libexec/automecanik-gh-app-token-refresh.avant-$J
~/.local/libexec/automecanik-gh-app-token-refresh`), puis relancer le service.

Changer `PERMS` ou `REPOS` suppose d'abord le même changement côté App (ADR-130 D3.4) et dans le
test ; sinon GitHub refuse la demande, ou le délivreur refuse la réponse.
