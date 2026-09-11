# Fichiers `.env` en 664 — la cause n'est pas le mode, c'est l'umask

_2026-09-09 · machine DEV_

## Mesure AVANT

Les **9** fichiers d'environnement porteurs de secrets (non suivis par git) étaient en `664`,
c'est-à-dire lisibles par tout compte local :

```
MODE   GIT       PATH                                    KEYS
664    untracked backend/.env                            119
664    untracked backend/.env.backup-20251104-174224      34
664    untracked backend/.env.paybox-test-keys             6
664    untracked backend/.env.production                  34
664    untracked backend/.env.supabase.timeout             4
664    untracked backend/.env.test                        34
664    untracked config/vector/.env.vector                 7
664    untracked .env                                      3
664    untracked .env.vps                                 27
664    untracked frontend/.env                             6
```

Les fichiers **suivis** (`*.example`, `*.template`) sont aussi en 664 — c'est voulu, ils sont publics.

### Sévérité réelle, mesurée et non extrapolée

La chaîne de répertoires est traversable par tous :

```
drwxr-xr-x root:root      /opt
drwxr-xr-x deploy:deploy  /opt/automecanik/app
drwxrwxr-x deploy:deploy  /opt/automecanik/app/backend
```

Donc `664` expose bien réellement. **Mais** `deploy` est le seul compte humain, et le groupe
`deploy` n'a aucun autre membre :

```
$ awk -F: '$3>=1000 && $3<65534 {print $1}' /etc/passwd   ->  deploy
$ getent group deploy                                     ->  deploy:x:1001:      (liste vide)
```

Risque pratique aujourd'hui : **faible**. Risque réel : un futur compte de service, ou n'importe
quel processus non privilégié compromis, lit des identifiants de production vivants.

## Cause racine — pourquoi `chmod` seul ne suffit pas

L'umask de la machine est `0002`, y compris sur les processus longs :

```
$ umask                                   -> 0002
$ grep Umask /proc/<backend pid>/status   -> Umask: 0002
```

Il ne vient d'aucun fichier de login (`/etc/profile`, `~/.bashrc`, `~/.profile` : rien, seulement
un `#umask 022` **commenté**). Il vient de PAM :

```
/etc/pam.d/common-session:26   session optional  pam_umask.so
/etc/login.defs:151            UMASK           022
/etc/login.defs:230            USERGROUPS_ENAB yes
$ id -gn deploy                -> deploy          (groupe primaire = nom d'utilisateur)
```

Règle `pam_umask` : si l'utilisateur n'est pas root **et** que son groupe primaire porte son nom,
les bits groupe de l'umask sont alignés sur ceux du propriétaire — `022` devient `002`. D'où
`0666 & ~002 = 0664`, exactement le mode observé sur **tous** les fichiers.

**Conséquence : un `chmod 600` est un correctif de symptôme.** Le prochain `cp`, la prochaine
sauvegarde d'éditeur, le prochain script qui réécrit un `.env` recrée du 664.

## Correction appliquée

**1. Modes (fait, sur la machine)** — `chmod 600` sur les **8** fichiers hors zone paiement :

```
backend/.env  backend/.env.production  backend/.env.test  backend/.env.supabase.timeout
backend/.env.backup-20251104-174224  config/vector/.env.vector  .env  .env.vps  frontend/.env
```

`backend/.env.paybox-test-keys` **délibérément laissé en 664** — zone paiement, accord owner requis
(invariant 9). Mesuré, non modifié.

Contrôle de non-régression : tout tourne sous `deploy`, propriétaire des fichiers, donc `600`
n'enlève l'accès à personne. Vérifié :

```
$ node -e "fs.readFileSync('/opt/automecanik/app/backend/.env','utf8')"
  read OK, 296 lines — 600 does NOT block the owner
$ docker inspect (tous les conteneurs) | grep automecanik/app
  aucun bind-mount du repo -> aucun autre uid n'a besoin de ces fichiers
```

**2. Récidive (fait, dans le dépôt)** — 7e axe `check_env_file_permissions()` dans
`scripts/ops/sync-dev-runtime.sh` (cron 10 min), qui détecte tout `.env` non suivi dont le mode
n'est pas `600`.

Deux choix délibérés :

- **Aucun `chmod` automatique.** Un correctif auto masquerait *ce qui* recrée du 664, donc la cause.
  Et le script ne doit jamais toucher au fichier Paybox, même « pour améliorer ses droits ».
- **Périmètre = fichiers non suivis par git uniquement.** Les `*.example` / `*.template` suivis
  restent en 664 : les passer en 600 casserait l'arbre suivi pour rien.

**3. Umask système — NON fait, décision owner.** Le seul levier correct est
`/etc/login.defs:151 UMASK 022 -> 027` (la règle usergroups donnerait alors `007`). Rayon d'action :
**tout ce que la machine écrit**, pas seulement les `.env` — arbre de build npm/turbo inclus.
Disproportionné pour ce défaut, et hors périmètre. Le 7e axe couvre le besoin sans y toucher.

## Preuve APRÈS

Le garde, exécuté sur l'arbre réel après le `chmod`, ne signale **que** le fichier volontairement
laissé :

```
ALERT> fichiers d'environnement trop permissifs (attendu 600) : backend/.env.paybox-test-keys:664
       — corriger: chmod 600 <fichier>. Cause récurrente = umask 0002 (...).
       NE PAS chmod backend/.env.paybox-test-keys sans accord owner (zone paiement).
-> return=1  alerts=1
```

Contrôle — on desserre un fichier hors zone paiement, le garde l'attrape :

```
$ chmod 664 frontend/.env
ALERT> ... : backend/.env.paybox-test-keys:664 frontend/.env:664
$ chmod 600 frontend/.env     (restauré)
```

## Ce qui reste à l'owner

1. **`chmod 600 backend/.env.paybox-test-keys`** — zone paiement, accord nominatif requis.
2. **Supprimer `backend/.env.backup-20251104-174224`.** Copie de 2026-01-30 qui porte l'intégralité
   des identifiants de paiement de production (noms de clés vérifiés, valeurs jamais affichées),
   plus `SESSION_SECRET` et `SUPABASE_SERVICE_ROLE_KEY`. Un doublon périmé de secrets vivants n'a
   pas de raison d'exister. Non supprimé ici : zone paiement, et le fichier est non suivi — aucune
   récupération possible depuis git.

## Trouvé en chemin — beaucoup plus grave, traité séparément

`backend/.env.test.template` est **suivi par git, présent dans `origin/main`, dans un dépôt
GitHub PUBLIC**, et contient **9 secrets byte-identiques à des valeurs vivantes** (comparaison
SHA-256, valeurs jamais affichées). Le mode 664 est un défaut local ; **ceci est une publication**.
Zone paiement, rotation = action owner. Aucune modification faite.
