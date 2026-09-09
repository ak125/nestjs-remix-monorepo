# `turbo dev` SIGSEGV — bug amont turbo 2.10.0 au shutdown, et le silence local

_2026-09-09 · machine DEV (`dev-automecanik`) · turbo 2.10.0 · Node v24.17.0 · 8 CPU · 15 GiB_

## Résumé

Deux défauts distincts, empilés :

| Couche | Défaut | Statut |
|---|---|---|
| **1 — le crash** | Bug amont **turbo 2.10.0**, corrigé en **2.10.4** (upstream issue #13254 / PR #13256) | corrigé ici par bump de version |
| **2 — le silence** | `sync-dev-runtime.sh` ne peut pas voir « superviseur mort, enfants vivants » *par construction* | corrigé ici par une 6e sonde |

**`concurrency: "12"` (PR #1421) n'est PAS la cause** — preuve plus bas. C'est en revanche la
**condition d'accès** : avant elle `turbo dev` refusait de démarrer (11 tâches persistantes > plafond
par défaut 10), donc le bug amont était inatteignable sur ce repo.

## Mesure AVANT

Incident du 2026-09-09 09:01:41 (`turbo dev` démarré 08:52:56, mort à T+8 min 45 s) :

```
$ sudo grep -a "Sep  9 09:01" /var/log/kern.log
traps: tokio-rt-worker[499388] general protection fault ip:7f9a37ed1d5e sp:7f9a34eb7030 error:0
tokio-rt-worker[499393]: segfault at 7f0030bbc815 ip 00007f9a37ec2816 sp 00007f9a3449b0c0 error 4 in turbo[7f9a360a8000+1e31000]
```

Pas un OOM — `earlyoom` mesurait 66–74 % de mémoire **disponible** sur toute la fenêtre :

```
$ sudo grep -a earlyoom /var/log/syslog | grep "Sep  9 09:0"
09:00:58 mem avail: 10346 of 15604 MiB (66.31%), swap free: 7441 of 8191 MiB (90.84%)
09:01:58 mem avail: 11557 of 15604 MiB (74.06%), swap free: 7442 of 8191 MiB (90.85%)
```

Orphelins confirmés — les enfants ont survécu au superviseur, et `:3000` répondait toujours 200 :

```
$ ps -eo pid,ppid,etime,cmd | awk '$2==1'
 499482       1  13:38 npm run dev          <-- reparenté à PID 1
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health
200
```

### Localisation du fautif (sans gdb — non installé, non installé volontairement)

Les deux IP tombent dans le segment exécutable de `turbo` (`ProcMaps` du dump apport) :

```
7f9a360a8000-7f9a37ed9000 r-xp 0010e000 ... /opt/automecanik/app/node_modules/@turbo/linux-64/bin/turbo
offset fault 1 = 0x1e1a816     offset fault 2 = 0x1e29d5e
```

Désassemblage aux deux adresses (binaire `static-pie`, strippé — identification par **signature**,
pas par symbole) :

```
$ objdump -d --start-address=0x1f37d30 --stop-address=0x1f37d90 <turbo>
 1f37d57: 41 80 7d 00 00   cmpb $0x0,0x0(%r13)
 1f37d5c: 74 01            je   0x1f37d5f
 1f37d5e: f4               hlt              <-- FAULT 2 : `hlt` en ring 3 => #GP
```

`hlt` est un **piège compilé volontairement** (89 occurrences dans une fenêtre de 256 Ko, chacune
précédée d'un saut conditionnel). Le fault 1 déréférence `0x7f0030bbc815`, adresse qui ne
correspond à **aucun mapping** du processus. Autrement dit : l'allocateur durci de la libc statique
a détecté une corruption de tas et s'est arrêté net. Ni OOM, ni saut sauvage.

## Cause racine — reproduite

Le crash survient dans le **chemin d'arrêt** de turbo, pas en régime établi.

```
$ scripts/… 4 tâches persistantes, SIGTERM après 10 s
  trial 1..6 : SIGSEGV 5/6
$ … même chose avec SIGINT (Ctrl+C) : SIGSEGV 3/3
```

Balayage du nombre de tâches persistantes (SIGTERM, 3 essais chacun) :

| tâches persistantes | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| crashes | 0/3 | 0/3 | **2/3** | **3/3** |

Les adresses de fault reproduites retombent **sur les mêmes instructions** que l'incident
(`0x1e1a81c` et `0x1e29d5e` vs `0x1e1a816` et `0x1e29d5e`).

### `concurrency: "12"` est hors de cause — contrôle explicite

Même test, `turbo.json` **sans aucune clé `concurrency`** (défaut turbo pur), 4 tâches :

```
CONTROL default-concurrency, 4 persistent tasks: crashes 3/3   exit codes: 135 139 139
```

Le crash se reproduit sans le réglage. PR #1421 ne l'introduit pas ; elle le rend seulement
**atteignable**, en permettant à `turbo dev` de démarrer.

### Correspondance amont

- issue **vercel/turborepo#13254** — _« segfault after Ctrl-C on 2.10 (but not on 2.9.18) »_ (CLOSED)
- PR **#13256** — _« Avoid non-reentrant libc calls in concurrent shutdown process scans »_,
  MERGED 2026-07-06, un seul fichier `crates/turborepo-process/src/child/handle.rs`
- régression introduite par PR **#13100** (MERGED 2026-06-17), livrée dans **v2.10.0**

Première release contenant le correctif — vérifié par `git compare` sur les tags :

```
$ gh api repos/vercel/turborepo/compare/v2.10.3...bf2d8273  -> diverged   (correctif absent)
$ gh api repos/vercel/turborepo/compare/v2.10.4...bf2d8273  -> behind     (correctif présent)
```

## Preuve APRÈS — A/B, même workspace, même arrêt, seul le binaire change

```
workspace: 4 persistent tasks, SIGTERM after 10s, 4 trials each
turbo 2.10.0 (installed)           crashes=4/4   exit codes: 139 139 139 135
turbo 2.10.12 (fixed, >=2.10.4)    crashes=0/4   exit codes: 0 0 0 0
```

## Couche 2 — pourquoi personne n'a rien vu

`scripts/ops/sync-dev-runtime.sh` tourne en cron toutes les 10 min, mais :

1. son unique appel à `$HEALTH_URL` vit dans l'étape 8, **atteignable seulement sur le chemin de
   resync** — quand `HEAD == origin/main` (cas nominal) le script sortait sans rien sonder du runtime ;
2. même ce health-check n'aurait rien vu : un superviseur mort avec enfants orphelins rend
   **exactement le même 200** qu'un stack sain. Le seul signal qui les distingue est **topologique** ;
3. les gardes branche (étape 1) et working-tree (étape 2) font `abort` **avant** tout le reste — au
   moment de l'incident les deux étaient déclenchées, donc le cron n'a rien probé pendant des heures.

D'où la 6e sonde, placée **avant** les gardes git, `alert`-only (jamais `abort` : un abort couperait
les axes de resync qui gardent DEV:3000 frais).

### Ce que la sonde vérifie, et pourquoi `/health` ne suffit pas

| Contrôle | Ce qu'il attrape |
|---|---|
| (a) `/health`, 3 essais / 5 s | runtime réellement mort — sur **chaque** tick, pas seulement au resync. Debounce : nodemon coupe `:3000` quelques secondes à chaque rebuild |
| (b) racine dev reparentée à **PID 1** | **la signature exacte de l'incident** — insensible à la cause (segfault, OOM, `kill -9`) |
| (c) plusieurs racines `npm run dev` | deux arbres concurrents écrivant le même `backend/dist` (état observé après le crash) |
| (d) dumps frais dans `/var/crash` | la machine écrit déjà des dumps apport ; **aucun script du repo ne lisait `/var/crash`** (vérifié) |

(b) est le cœur : il ne peut **pas** être satisfait par `/health`.

## Preuve APRÈS — la sonde

Vrai positif sur un `:3000` réellement tombé (constaté indépendamment : rien en écoute) :

```
  ALERT> DEV:3000 ne répond pas après 3 essais (http://localhost:3000/health) — runtime DOWN
  -> return=1  alerts=1
```

Détection d'un orphelin reproduisant la signature observée (`ppid=1`, `npm run dev`, cwd sous `APP_DIR`) :

```
  pid=625425 ppid=1 cwd=<APP_DIR> :: npm run dev
  ALERT> superviseur dev MORT — 1 racine(s) orpheline(s) reparentée(s) à PID 1 (pids: 625425).
  -> return=1  alerts=1
```

Le stack sain du repo, hors `APP_DIR` du test, n'est pas remonté : le filtrage par `cwd` fonctionne.

## Limites assumées / non-vérifié

- **Ce qui a déclenché l'arrêt à 09:01:41 n'est pas déterminé.** `Ctrl+C`, fermeture de terminal et
  fin de tâche persistante mènent tous au même chemin. Aucune trace ne dit lequel. Je ne le déduis pas.
- **Pourquoi ~8-9 min** dans les deux occurrences observées : non expliqué, non instrumenté.
- Le core dump du 09:01:41 a été **écrasé par apport** à 09:16:44 (dédup par exécutable) ; l'analyse
  ci-dessus vient de la copie extraite avant écrasement.
- L'identification du code fautif est une **correspondance de signature** (idiome `hlt`, séquence
  d'instructions), corroborée par la description de la PR amont — pas une résolution de symboles :
  le binaire est strippé, `.dynsym` ne contient que l'entrée nulle, pas de DWARF.
- Le canal structuré `report()` → `cron_report()` → `__cron_runs` de ce script **n'a jamais émis**
  (`SUPABASE_URL` absent de l'environnement cron ; `/tmp/.cron_last_sync-dev-runtime` inexistant).
  Non corrigé ici — hors périmètre, signalé.

## Incident causé pendant l'enquête

La première tentative de reproduction (churn sur 15 watchers `tsc`) a saturé la RAM ; `earlyoom` a
tué le `tsc --build --watch` du stack réel à 09:16:21 (mémoire dispo 3,22 %), coupant DEV:3000
environ 2 minutes. Service restauré, vérifié 9/9 × HTTP 200. Les reproductions suivantes ont tourné
sous garde mémoire explicite, puis sur des tâches triviales sans `tsc`.
