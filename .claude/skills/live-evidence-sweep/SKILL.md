---
# === REQUIS (agentskills.io v1) ===
name: live-evidence-sweep
description: >
  Use when the question is "qu'est-ce qui est cassé en ce moment ?" plutôt que "est-ce conforme à la spec ?" :
  balayage lecture seule de la production vivante (journaux Postgres et edge, colonnes et tables citées par le
  code mais absentes de la base, planifié côté base et côté machine, restes d'une opération récente, dérive de
  la machine DEV), puis réfutation adverse de chaque constat, puis synthèse priorisée avant/après fenêtre.
  Triggers — "vérifie si il y a autre chose", "qu'est-ce qui est cassé", "balayage", "audit production",
  "avant la mise à jour de ce soir", "après l'incident", "what else is broken", "sweep the logs".

# === REQUIS (gouvernance AutoMecanik) ===
type: technique
status: experimental
owners: ['@ak125']
domain: D15
runtime_class: read-only
llm_safe: true

# === RECOMMANDÉ ===
last_verified: '2026-09-16'
license: Internal - Automecanik
compatibility: >
  Claude Code dans le monorepo AutoMecanik. Lit postgres_logs et edge_logs via le MCP supabase,
  la base via psql sur le pooler (identifiants backend/.env, jamais affichés), PostgREST avec la clé de
  service, /proc et systemd sur la machine DEV, gh en lecture. Aucune mutation, aucun déploiement.
allowed-tools: Read Grep Glob Bash
tags: [audit, logs, runtime, evidence, incident, upgrade, governance]

metadata:
  version: "1.0"
  argument-hint: "[sonde ou tout] [--fenetre <coupure visée>]"
  spec: agentskills.io/specification v1
---

# Live Evidence Sweep

Ce skill part de l'inverse d'un audit de conformité : il ne demande pas « le runtime respecte-t-il la
spec ? », il demande **« qu'est-ce que le système vivant est en train de crier que personne n'écoute ? »**.

L'écart n'est pas théorique. Le 2026-09-16, un balayage de ce type a trouvé en une heure que la recherche
du blog appelait une colonne `ba_resume` qui n'existe dans aucune table : **environ 500 erreurs par heure,
plus de 11 600 sur 24 h, sans creux la nuit, depuis des semaines**. Aucun test, aucun linter, aucun contrôle
de registre ne l'avait vue — la base le disait pourtant à chaque requête. Même passage : 33,8 % des requêtes
d'images produit répondaient 400, et un seul RPC consommait 12 852 secondes de temps origine en 24 h.

## Frontière avec les skills voisins

Charger le bon outil compte plus que de tout ratisser :

| Question posée | Skill |
|---|---|
| « le runtime dévie-t-il de la spec / du registre ? » (9 checks atomiques : dead services, RPC drift, STABLE qui écrit, partitions sans rotation, flags orphelins…) | **`runtime-truth-audit`** — ne pas refaire ces checks ici, l'appeler |
| « pourquoi l'INP/LCP se dégrade sur cette route ? » | **`web-vitals-audit`** |
| « cette PR est-elle correcte ? » | **`code-review`** |
| **« qu'est-ce qui est cassé en production, maintenant, d'après ses propres traces ? »** | **ce skill** |

Le recouvrement existe sur deux points (jobs planifiés, fonctions `STABLE` qui écrivent). Quand une sonde
tombe dessus, le constat vaut — mais la correction de fond appartient au check atomique de
`runtime-truth-audit`, qui porte déjà cette responsabilité.

## Méthode en trois temps

Le balayage seul produit du bruit : sur le premier passage réel, **64 constats bruts** sont sortis des
sondes, et la réfutation en a **écarté près d'un tiers** — dont deux convictions de l'agent qui menait le
balayage. Les trois temps ne sont donc pas décoratifs.

### 1. Sonder — en parallèle, aveugles les unes aux autres

Sept angles, chacun indépendant. L'intérêt vient de leur cécité mutuelle : la sonde « journaux » trouve le
symptôme, la sonde « code vs schéma » trouve la même famille de défauts par l'autre bout, et ce qu'elles
rapportent toutes les deux est une confirmation croisée gratuite.

Les missions exactes, prêtes à coller dans un agent, sont dans **`references/probes.md`**. Les recettes
d'accès en lecture seule (psql sur le pooler, `query_logs`, PostgREST, `/proc`) sont dans
**`references/access.md`** — les lire avant de fabriquer sa propre commande, elles évitent les pièges
d'authentification et de secrets.

| Sonde | Ce qu'elle interroge | Ce qu'elle a réellement trouvé |
|---|---|---|
| `logs-postgres` | classes d'erreurs des 24 h, normalisées et comptées | `ba_resume`, `ba_date_add`, `ba3_ba_id` inexistantes ; une fonction `STABLE` qui appelle un écrivain |
| `logs-edge` | codes HTTP, chemins 5xx/4xx anormaux, coûts | 33,8 % d'images produit en 400 ; un RPC à 12 852 s/24 h ; `.single()` qui rend 406 |
| `code-vs-schema` | colonnes et tables citées par le code vs `information_schema` | table `__seo_gamme_slots` inexistante → lien croisé jamais émis sur 241 guides |
| `planifie` | `cron.job` + `cron.job_run_details` **et** la crontab système | un job qui tourne à vide depuis quatre mois ; démon cron masqué, 10 tâches mortes |
| `pre-upgrade` | slots, extensions, transactions, timeouts, baseline | `statement_timeout` du rôle qui gouverne les jobs ; index invalide de 0 octet sur 72 M lignes |
| `restes-operation` | ce qu'une opération récente a laissé : code, git, base | preuves d'exécution non versionnées ; types générés citant des vues supprimées |
| `derive-machine` | git, Node, workspaces, dumps, disque, santé du runtime | sauvegardes manquées, stacks de dev concurrents |

Adapter la liste au contexte : après un incident, `logs-*` et `derive-machine` suffisent souvent ; avant une
migration, `pre-upgrade` devient la sonde principale.

### 2. Réfuter — deux lentilles, présomption de faux

Chaque constat sérieux passe devant **deux sceptiques indépendants**, avec des lentilles distinctes :

- **exactitude technique** — la preuve montre-t-elle vraiment ce que le constat affirme ?
- **atteignabilité réelle** — ce chemin est-il servi en production, ou est-ce du code mort ?

La consigne qui fait tout le travail : *« par défaut, conclus réfuté si tu ne peux pas confirmer toi-même
avec une commande ; ne fais pas confiance au constat, re-exécute »*. Sans elle, les vérificateurs ratifient.

Deux lentilles différentes valent mieux que trois copies de la même : un défaut peut être techniquement
exact et pourtant sans conséquence, ou réel mais mal expliqué. C'est ce qui a permis d'écarter « neuf
scripts interrogent encore des tables supprimées » (vrai littéralement, mais ces scripts ne tournent plus)
tout en gardant « les types générés déclarent encore les vues supprimées » (silencieux, mais il casse la
prochaine régénération).

### 3. Trancher — priorisé par fenêtre, pas par gravité seule

Le rapport sert une décision datée, pas une collection. Classer chaque constat confirmé par **moment** :
`avant_fenetre`, `apres_fenetre`, `indifferent` — où la fenêtre est la coupure, la migration ou le
déploiement qui vient. Un défaut moyen à corriger avant la coupure passe devant un défaut haut qui attendra
une semaine sans risque.

## Fan-out

Au-delà de trois sondes, orchestrer avec l'outil **Workflow** plutôt qu'à la main : le script gère le
pipeline sonde → réfutation sans barrière, chaque constat partant en vérification dès que sa sonde rend.
Modèle complet et commenté dans **`references/workflow.md`**. En dessous de trois sondes, inline suffit.

Ordre de grandeur mesuré : 7 sondes ont produit 64 constats et environ 75 agents au total. Prévoir du temps
de mur, et **lancer le balayage en arrière-plan** pour continuer à travailler pendant qu'il tourne.

## Contrat de sortie

```markdown
# Balayage — <date>, fenêtre : <la coupure visée ou "aucune">
Sondes : N — constats bruts : X — confirmés après réfutation : Y — écartés : Z

## À faire avant la fenêtre
| Défaut | Impact mesuré | Correction de fond | Preuve |

## À vérifier après la fenêtre
<bloc copiable : SQL de baseline à rejouer + diff attendu, contrôles runtime>

## Peut attendre
| Défaut | Pourquoi ça peut attendre |

## Écartés par la réfutation
<titre + raison — pour que personne ne les re-remonte dans trois jours>
```

La section « écartés » n'est pas de la politesse : sans elle, le prochain balayage refait le même travail.

## Avant/après une fenêtre de maintenance

`scripts/baseline.sql` capture 18 compteurs structurels, les extensions avec leurs versions, et les volumes
des tables protégées. Le rejouer après la fenêtre et faire un `diff` transforme « ça a l'air d'aller » en
preuve. **Le ranger hors de `/tmp`** : un redémarrage efface le scratchpad, et la photo d'avant disparaît
précisément quand elle devient utile.

## Discipline de preuve — pièges vécus

Ces erreurs ont toutes été commises pendant le passage qui a produit ce skill :

- **Un garde-fou se prouve par l'échec attendu, jamais par sa lecture.** Le premier script « lecture
  seule » de ce skill s'appuyait sur `PGOPTIONS` : mesuré, il ne traverse ni le pooler en mode transaction
  ni en mode session — le réglage revenait `off` et un `CREATE TABLE` passait. Le test l'a découvert en
  créant une table de plus en production, qu'il a fallu supprimer. Le verrou qui tient est
  `--single-transaction` + `set transaction read only` (`scripts/sweep-psql.sh`), et il est validé par une
  écriture qui échoue.
- **Ne jamais inventer une URL pour tester.** Deux routes devinées ont rendu 404, ce qui ne prouvait rien
  sur le site. Prendre les URL dans le sitemap, la base ou les journaux.
- **Un constat sans commande exécutée n'est pas un constat.** Exiger la commande et un extrait de sa sortie.
- **Attention à l'attribution.** Un PID relevé avec `head -1` a fait conclure à un échec là où le test
  passait. Relire l'identité de ce qu'on mesure avant de conclure.
- **`pkill -f <motif>` tue le shell qui le lance** si sa propre ligne de commande contient le motif.
  Utiliser la classe de caractères : `pkill -f "fau[x]/motif"`.
- **L'API de journaux plafonne la fenêtre à 24 h.** Pour couvrir 48 h, croiser avec une source qui garde
  l'historique — `cron.job_run_details` par exemple — et le dire dans le rapport.
- **Absence de trace ≠ absence d'événement.** Les journaux dans `/tmp` disparaissent au redémarrage ; un
  fichier manquant peut signifier « effacé », pas « jamais écrit ».
- **Dire ce qui n'a pas été couvert.** Une portée annoncée honnêtement vaut mieux qu'un « tout est vert ».

## Après le balayage

Le skill s'arrête au rapport : il ne corrige rien et n'ouvre aucune PR tout seul. Pour chaque constat
confirmé que l'humain décide de traiter :

1. une PR par défaut, portant **la preuve avant/après** dans son corps (l'appel qui échouait, le même appel
   qui réussit) — c'est ce qui rend la revue instantanée ;
2. les défauts de cause identique se corrigent séparément : trois colonnes inexistantes dans le même module
   sont trois régressions distinctes, pas un « nettoyage du module » ;
3. ce qui relève d'un check atomique existant retourne à `runtime-truth-audit` ;
4. les découvertes durables (un piège d'outillage, une cause racine surprenante) vont en mémoire, sinon le
   prochain balayage les redécouvre au même prix.
