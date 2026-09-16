# Les sept sondes — missions prêtes à l'emploi

Chaque mission se colle dans un agent, précédée du bloc de contexte partagé (voir
`references/workflow.md`). Elles sont écrites pour être **aveugles les unes aux autres** : c'est la
redondance entre angles qui produit les confirmations croisées.

Adapter, ne pas réciter : après un incident, `logs-postgres`, `logs-edge` et `derive-machine` suffisent ;
avant une migration, `pre-upgrade` porte l'essentiel.

## 1. `logs-postgres`

> Classe TOUTES les erreurs et avertissements des journaux Postgres des 24 dernières heures, pas seulement
> ceux qu'on cherche. Méthode : agrégation sur `logs source=postgres_logs`, regroupée par motif normalisé
> (remplace les valeurs variables), triée par volume décroissant. Rends les 10 premières classes avec leur
> volume. Pour chaque classe non triviale : retrouve le code fautif dans le monorepo (`git grep`) et dis si
> la colonne, la fonction ou la table citée existe vraiment en base.

Pourquoi elle paie : un défaut vivant crie à chaque requête. C'est la sonde qui a trouvé `ba_resume`.

## 2. `logs-edge`

> Analyse les journaux edge des 24 dernières heures (`source=edge_logs`). Rends la répartition des codes
> HTTP, puis les chemins qui produisent le plus de 5xx et de 4xx anormaux (hors 404 de robots). Vérifie
> particulièrement : 500 sur des routes produit ou véhicule, timeouts, et tout appel vers des points
> d'entrée facturés à l'usage. Pour chaque anomalie, relie à une route du frontend ou un contrôleur.

Pourquoi elle paie : elle voit ce que voient les visiteurs, et elle chiffre le coût (temps origine, appels
facturés) — deux arguments qu'un rapport technique seul n'a pas.

## 3. `code-vs-schema`

> Cherche les décalages code ↔ schéma qui cassent en production sans que personne ne le voie. Méthode :
> extrais du backend les noms de colonnes utilisés dans les appels Supabase (`.select()`, `.eq()`, `.or()`,
> `.ilike()`, `.order()`, `.filter()`) pour les tables les plus servies, puis compare à
> `information_schema.columns`. Vérifie aussi les noms de tables contre `pg_class`. Concentre-toi sur les
> modules réellement servis. Signale chaque colonne ou table citée et absente, avec `fichier:ligne` et la
> preuve SQL de l'absence. Vérifie que le chemin est atteignable avant de classer en gravité haute.

Pourquoi elle paie : elle attrape par l'autre bout la même famille que la sonde 1, y compris les chemins
rarement empruntés qui n'ont pas encore produit d'erreur dans la fenêtre observée.

## 4. `planifie`

> État de tout ce qui est planifié, des deux côtés. Côté base : chaque job `cron.job` — dernière exécution
> réussie via `cron.job_run_details`, écart avec sa fréquence déclarée, durée moyenne. Signale tout job qui
> ne tourne plus, qui tourne à vide, ou qui gênerait une coupure. Côté machine : l'état du démon cron
> système et la crontab ; si des tâches ne tournent plus, liste-les et chiffre les dégâts constatables
> (fichiers absents, états figés), plutôt que de les supposer.

Pourquoi elle paie : un job mort ne produit **aucune** erreur — il ne produit rien. Seule la comparaison
« dernière exécution vs fréquence déclarée » le révèle.

## 5. `pre-upgrade`

> Vérifie la base contre ce qui fait échouer ou compliquer une migration majeure : slots de réplication,
> publications logiques, transactions préparées, transactions ouvertes de longue durée, extensions et leurs
> versions, rôles avec mot de passe md5, taille de `cron.job_run_details`, jobs qui tourneraient pendant la
> coupure, objets invalides, `statement_timeout` des rôles qui exécutent les jobs. Rends aussi une baseline
> à rejouer APRÈS : un bloc SQL copiable, exécutable tel quel.

Pourquoi elle paie : elle transforme « ça a l'air d'aller » en `diff`. Voir `scripts/baseline.sql`.

## 6. `restes-operation`

> Cherche ce qu'une opération récente a laissé derrière elle. Dans le code et les scripts : toute référence
> restante aux objets supprimés ou renommés — dis pour chacune si elle casserait à l'exécution ou si c'est
> de la documentation. Dans git : worktrees avec des fichiers non commités, preuves non versionnées, PR
> restées ouvertes. En base : vues, fonctions, policies, triggers ou jobs qui référencent encore ces objets.

Pourquoi elle paie : les preuves d'une opération lourde vivent souvent dans un worktree que le prochain
nettoyage supprimera.

## 7. `derive-machine`

> Mesure la dérive de la machine depuis le dernier événement marquant (redémarrage, arrêt d'un démon).
> Vérifie : checkout sur la bonne branche et à jour, version de Node vs `.nvmrc`, intégrité des workspaces,
> dumps récents dans `/var/crash`, stacks de dev concurrents ou orphelins réadoptés par PID 1, santé du
> runtime local, espace disque, sauvegardes attendues présentes ou non. Lis le script de synchronisation de
> l'environnement pour connaître les axes de dérive qu'il surveille, et rapporte l'état de chacun.

Pourquoi elle paie : quand la surveillance elle-même est morte, aucune alerte ne part — et c'est
précisément le moment où la dérive s'installe.
