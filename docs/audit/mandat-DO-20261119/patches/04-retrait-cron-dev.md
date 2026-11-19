# Retrait du cron DEV `registry-self-heal.sh` (mandat DO)

À faire **après** l'application du patch 01 (workflow de régénération étendu),
jamais avant : sinon plus aucun écrivain ne régénère `deps.json` sur main.

Ligne actuelle (crontab de `deploy` sur le DEV, ligne 36, relevée le 2026-11-19) :

```
*/30 * * * * /usr/bin/bash /opt/automecanik/app/scripts/ops/registry-self-heal.sh >> /tmp/registry-self-heal.log 2>&1
```

Pourquoi : ce script écrit sur la même branche `chore/registry-self-heal` que le
workflow. Deux écrivains sur une branche, l'un toutes les 30 minutes pendant le
train de fusion, l'autre la nuit : courses de push et PR de régénération en
journée, ce que le mandat DO veut supprimer.

Geste (DEV, compte `deploy`) : commenter la ligne, sans supprimer le script.

```
crontab -l > /tmp/crontab.avant-mandat-do
crontab -l | sed 's#^\(\*/30 \* \* \* \* /usr/bin/bash /opt/automecanik/app/scripts/ops/registry-self-heal.sh\)#\# mandat DO 2026-11-19 : \1#' | crontab -
crontab -l | grep -n registry-self-heal
```

Retour arrière : `crontab /tmp/crontab.avant-mandat-do`.

Le script `scripts/ops/registry-self-heal.sh` reste dans le dépôt (retour
arrière possible) ; sa suppression éventuelle relève d'une PR séparée.
