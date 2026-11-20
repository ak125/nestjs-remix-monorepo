# Mandat DI — Codex contrôleur : consigne permanente, routine quotidienne, audit du département 23

Date : 2026-11-19. Base de la branche : `main` à `3600225ce2136a6102e8948d74097344a631936f`.
Base de l'audit du département 23 : `7b603c1a741e2f0d76d05f9b30c6989c19fc6cc7` (`main` au moment des passages).
Cadre repris de l'essai CP (PR #2185, tête `8e93eb69fe8cea9f7460d7dede0192d1dad7f32c`).

| État | Réponse |
|---|---|
| Préparé | oui : consigne, routine, tests, unités systemd, procédure d'installation, audit du département 23 trié |
| Testé | oui : `codex-controleur.test.sh`, 83 contrôles, 0 en échec ; audit réel du département 23 lancé par le mode `lot` de la routine |
| Installé | **non** : aucun timer, cron ni unité systemd posé sur DEV |
| Activé | **non** : aucun passage quotidien ne tourne ; la consigne attend l'approbation de Marwane |

## Règles appliquées (citées par chemin)

`CLAUDE.md`, `AGENTS.md`, `.claude/governance/journal-des-principes.md` (P20 fusion, P35, P42),
`.claude/rules/deployment.md`, `.claude/rules/guardrails.md`, `.claude/rules/payments.md`,
`.claude/rules/security-hooks.md`, `.claude/rules/agent-doc-search.md`, `.claude/rules/context7.md`.

## 1. Consigne permanente

Texte : [`scripts/ops/codex-controleur/consigne.md`](../../../scripts/ops/codex-controleur/consigne.md),
version 1, sha256 `777e6718d94d3ae3d1023d44f594926b62f2424aead9726bf90efd83416b9c00`. Courte, en
français, sans renvoi au vault ni aux ADR. Elle est jointe en tête de chaque passage ; le sha256 du
texte réellement joint est noté dans chaque `meta.json`. Elle couvre tout le dépôt, zones sensibles
comprises. Elle interdit toute écriture, tout acte Git ou GitHub et tout accès réseau, ainsi que
l'exécution du code, la lecture d'un secret ou d'une base, la recopie d'un secret ou d'une donnée
personnelle et la description d'un mode d'exploitation.

Le renvoi depuis `AGENTS.md` est proposé en patch (fichier réservé), non appliqué : voir §7.

**Approbation du texte : réservée à Marwane.**

## 2. Routine quotidienne (prête, non installée)

Dossier [`scripts/ops/codex-controleur/`](../../../scripts/ops/codex-controleur/README.md) : script,
tests, schéma de sortie, unités `.service` et `.timer`, procédure d'installation, d'arrêt et de
retrait. Le README du dossier décrit le passage, l'état gardé hors du dépôt
(`~/.local/state/automecanik/codex-controleur/`), les codes de sortie et la garde des données
sensibles.

Commande Codex effective (`codex-controleur.sh commande`) :

```
codex exec --ignore-user-config --ignore-rules --ephemeral -s read-only
  -c shell_environment_policy.inherit="core"
  --disable apps --disable plugins --disable remote_plugin --disable hooks --disable browser_use
  --disable browser_use_external --disable computer_use --disable in_app_browser
  --disable image_generation --disable multi_agent --disable tool_suggest
  --disable skill_mcp_dependency_install --disable goals --json
  -c default_permissions="controleur"
  -c permissions.controleur.filesystem={":minimal"="read","<WORKTREE>"="read","<DEPOT>/.git"="read","/home/deploy/.codex/packages/standalone"="read"}
  -m gpt-6.2-astra -c model_reasoning_effort="high" -C <WORKTREE>
  --output-schema scripts/ops/codex-controleur/constats.schema.json -o <SORTIE>/last.json
  <CONSIGNE + OBJET> < <DIFF ou /dev/null>
```

Réglages effectifs :
- codex-cli `0.170.0` exigé (autre version : arrêt, code 4) ;
- aucun serveur MCP ;
- `GH_TOKEN`, `GITHUB_TOKEN` et `GH_ENTERPRISE_TOKEN` retirés de l'environnement ;
- worktree jetable détaché sur `origin/main` ;
- arrêt propre sur quota (code 5) avec reprise sans saut ;
- plafond de 40 PR par passage ;
- un passage par jour à 05:30 UTC.

Tests (`bash scripts/ops/codex-controleur/codex-controleur.test.sh`, sans réseau ni Codex réel) :
**83 contrôles, 0 en échec**. Ils comprennent :
- l'arrêt sur version inattendue (code 4, Codex non lancé) ;
- l'arrêt sur quota à la 2e PR (code 5, curseur à la 1re), puis la reprise sans rien sauter ;
- les droits `700` posés aussi sur un dossier d'état déjà présent en `755`.

Registre des automatisations : aucune entrée ajoutée. La routine n'est ni installée ni active ; son
entrée (crontab/timer et état `cron_report`) relève du geste d'installation, sur décision de Marwane.

## 3. Complément n° 1 — accès base par `supabase-local`

Point 1 de la vérification : **arrêt**.
- Résultat de la lecture de `scripts/mcp-server/server.js` : au moins un paramètre d'outil
  n'est pas borné aux quatre lectures prévues et permet d'atteindre d'autres points de l'API.
- Ce constat est de sécurité : le détail est remis au pilotage, hors de ce dépôt public.

Conséquences :
- le serveur n'est pas branché ;
- la routine reste sans aucun serveur MCP ;
- la consigne garde l'interdiction d'interroger une base.

Ce que l'accès aurait apporté au département 23 :
- presque rien, car ce département est fait d'automatisations, de hooks, de skills et de règles ;
- six constats auraient seulement pu être confirmés ou chiffrés en base : D-21, D-23 et D-26
  (requêtes de contrôle), E-4 (fonction `STABLE` qui écrit), B-6 (colonnes de `__error_logs`) et
  A2-2 ;
- leur verdict tient déjà par la lecture du code et des migrations.

Tables portant des données personnelles, relevées dans le dépôt (migrations et services, non
vérifié en base) :

| Table | Données personnelles |
|---|---|
| `___xtr_customer`, ses tables d'adresses de facturation et de livraison | données client |
| `users`, `auth.users` | comptes |
| `___xtr_msg` | messages |
| `___xtr_order`, `___xtr_order_line`, `___xtr_invoice_line` | contenu des commandes |
| `__abandoned_cart_emails` | courriels |
| `__claims`, `__quote_requests` | réclamations et demandes de devis |
| `___config`, `___config_admin`, `___config_old` | coordonnées et identifiants |
| `shipping_rates_cache` | code postal |
| `__error_logs`, `__seo_crawl_log`, `__ux_captures` | IP et agent utilisateur |

Preuve du point 2 sur les six lots du département 23 :
- aucun secret ni donnée personnelle dans les sorties de Codex ni dans les constats stockés :
  `last.json`, messages et événements, 0 jeton JWT, 0 clé secrète, 0 courriel, 0 téléphone ;
- 0 appel d'outil MCP.

Les commandes de Codex qui citent `.env`, `auth.json` ou `service_role` ont été relues une à une,
et aucune ne lit un secret :
- des exclusions `--glob '!*.env*'` de `rg` ;
- un `wc -l` et la lecture de `scripts/ops/watchdog.env.example`, fichier d'exemple suivi dans le
  dépôt public ;
- des recherches dans une migration et dans le code.

## 4. Audit à blanc du département 23 (agents, automatisations)

Périmètre :
- 314 fichiers relevés ;
- 265 relus par Codex en 6 lots, avec la consigne et le cadre de la routine (mode `lot`) ;
- 49 notes descriptives de modules (`.claude/knowledge/modules/*.md`) écartées : elles décrivent
  du code, sans instruction ni automatisation propres ;
- non relevés : les références tierces vendorisées du skill `supabase-postgres-best-practices`
  (35 fichiers) et 5 fichiers `.pyc`.

| Lot | Contenu | Fichiers | Durée (s) | Entrée | dont cache | Sortie | Raisonnement | Constats | Consigne (sha256) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| A1 | workflows GitHub | 40 | 499 | 3 230 009 | 3 056 000 | 17 172 | 1 943 | 31 | `5c1419e0f788…` |
| A2 | workflows + `.github/scripts` | 45 | 470 | 3 771 422 | 3 570 048 | 15 240 | 1 180 | 33 | `5c1419e0f788…` |
| B | `scripts/ops` | 42 | 451 | 4 383 383 | 4 204 672 | 14 897 | 2 824 | 23 | `777e6718d94d…` |
| C | hooks Claude, cron, `scripts/agents`, `.husky` | 42 | 518 | 4 535 458 | 4 321 024 | 15 735 | 2 496 | 29 | `777e6718d94d…` |
| D | `.claude/skills` | 52 | 580 | 4 657 990 | 4 444 160 | 20 418 | 1 697 | 37 | `777e6718d94d…` |
| E | connaissances, prompts, règles, miroirs, gouvernance, `agents/` | 44 | 587 | 3 465 967 | 3 284 992 | 19 623 | 1 432 | 29 | `777e6718d94d…` |
| **Total** | | **265** | **3 105** | **24 044 229** | **22 880 896** | **103 085** | **11 572** | **182** | |

Lecture du tableau :
- A1 et A2 ont tourné avec la consigne d'avant l'ajout de la ligne sur les données personnelles ;
  les autres lots, avec la version 1 ;
- un premier passage du lot B, interrompu, n'a pas de mesure et n'est pas compté ;
- moyennes : 11,7 s et 90 700 tokens d'entrée par fichier (95 % servis par le cache, environ
  4 400 non cachés) ;
- le tri par Claude, fait dans le code à la base de l'audit, n'est pas chronométré séparément.

Tri des 182 constats (annexe : [`annexe-tri-23.md`](annexe-tri-23.md)) :

| Verdict | Gravité vérifiée | Nombre |
|---|---|---:|
| vrai | moyenne | 61 |
| vrai | faible | 88 |
| vrai (sécurité) | moyenne | 5 |
| vrai (sécurité) | faible | 19 |
| déjà connu | — | 2 |
| faux positif | — | 1 |
| non tranché (décision de Marwane) | — | 6 |

Aucun constat n'est retenu en gravité haute ; Codex en avait classé 4 en `high`.

Les six constats non tranchés :
- D-1 et D-2 : écart littéral à P35 par des procédures manuelles sur GO nominatif ;
- E-8 : portée de « par défaut » entre alerte et quarantaine ;
- E-15 : `deployment.md` décrit l'état appliqué des circuits, P20 décrit la cible ;
- B-4 : `log.md` non commité réinitialisé par la resynchronisation DEV ;
- B-17 : taille non mesurable d'un argument `jq`, car le workflow est inactif.

Doublons : E-5, E-6 et E-7 répètent D-9, D-10 et D-11 dans un autre document.

Constats de sécurité : les 24 constats de sécurité sont décrits dans l'annexe sans titre, sans
ligne ni preuve. Leur détail est remis à la session de pilotage, hors de ce dépôt public.

## 5. Plan d'audit des autres départements

Ordre de la décision 1 : ventes, agents, trafic, catalogue, puis les autres par priorité de la
carte.

Plusieurs départements partagent le même domaine de code (`repo_domains`). Un domaine n'est relu
qu'une fois : par exemple, D11 sert les départements 13, 14, 15, 16 et 17.

Hypothèses de calcul :
- taux mesurés : 11,7 s et 91 k tokens d'entrée par fichier (département 23), 13,5 s et 113 k
  (département 13 en CP) ;
- lots de 40 à 50 fichiers ;
- fichiers comptés dans `audit/registry/canonical.json`.

| Rang | Département(s) | Domaine(s) | Fichiers | Durée Codex estimée | Tokens d'entrée estimés |
|---:|---|---|---:|---|---|
| 1 | 13 ventes (+ 14, 15, 16, 17 par le même domaine) | D11 | 334, dont 106 relus en CP : reste 228 | 45 à 51 min | 21 à 26 M |
| 2 | 23 agents | automatisations, hooks, skills, règles | 265 | fait (52 min) | 24 M |
| 3 | 7 trafic (SEO) | D3 | 440 | 86 à 99 min | 40 à 50 M |
| 4 | 10 catalogue | D1, D4 | 206 | 40 à 46 min | 19 à 23 M |
| 5 | 2 gouvernance (P0) | D15 | 334 | 65 à 75 min | 30 à 38 M |
| 6 | 12 fournisseurs (P0) | D13 (D11 et D15 déjà relus) | 257 | 50 à 58 min | 23 à 29 M |
| 7 | 21 runtime, 22 données, 3 stratégie (P1) | D10 (D13 déjà relu) | 43 | 8 à 10 min | 4 à 5 M |
| 8 | 9 wiki (P1) | D6 | 72 | 14 à 16 min | 7 à 8 M |
| 9 | 24 people (P1) | D8 | 948 | 3 h 05 à 3 h 35 | 86 à 107 M |
| 10 | 11 diagnostic, 6 contenu (P2) | D7, D5 | 53 | 10 à 12 min | 5 à 6 M |
| 11 | 4 marketing, 5 marque, 8 médias (P3) | D12 | 83 | 16 à 19 min | 8 à 9 M |
| — | 1, 18, 19, 20 | aucun domaine déclaré | 0 | rien à relire dans le code | — |
| — | domaine `UNKNOWN` | non rattaché | 243 | à rattacher d'abord | — |

Total restant : environ 2 660 fichiers, soit 8 h 40 à 10 h de Codex et 240 à 300 M tokens d'entrée,
dont environ 12 M non cachés.

Le tri par Claude s'ajoute, à raison d'environ 30 constats par lot de 45 fichiers.

La routine quotidienne, à environ 17 PR par jour (mesure CP : 177 s et 975 k tokens par PR),
coûterait environ 50 min et 17 M tokens par jour.

## 6. Où vont les constats (proposition, rien n'est ouvert)

Une issue par département, avec l'étiquette existante `dept:NN-<nom>`.
- Pour le département 23 : `dept:23-ia-agents`, titre « Contrôle Codex — département 23 » ;
- une ligne cochable par constat **vrai** hors sécurité de l'annexe (149 lignes),
  `fichier:ligne`, gravité vérifiée.

N'y entrent pas :
- les faux positifs, les déjà connus et les non tranchés ;
- **tout constat de sécurité** : le dépôt et ses issues sont publics, conformément aux décisions 92
  et 138.

Qui fait quoi :
- la session de pilotage trie chaque matin le résumé de la routine et tient les issues ;
- Marwane décide des priorités et confie les corrections par mandat ;
- les constats de sécurité passent du pilotage à Marwane, hors GitHub.

Aucune issue n'a été ouverte par ce mandat.

## 7. Fichiers réservés : patch, non appliqué

| Patch | Cible | sha256 |
|---|---|---|
| [`patches/AGENTS.md.patch`](patches/AGENTS.md.patch) | `AGENTS.md` : renvoi vers la consigne de Codex contrôleur | `f022cfe8ae908cb015a8b873feada69dc477766fe2cb550ef4ff85a9b07d7b48` |

Aucun autre fichier réservé n'est concerné : rien sous `.github/`, `.spec/00-canon/` ni dans
`CODEOWNERS`.

## 8. Limites

- Les tables de données personnelles sont relevées dans le dépôt, pas vérifiées en base : l'accès
  est suspendu.
- Les estimations du §5 extrapolent deux mesures (départements 13 et 23) dont la nature diffère :
  code applicatif pour le premier, automatisations et documents pour le second.
- Le serveur `supabase-local` demande une correction puis une nouvelle vérification avant tout
  branchement, avec la décision de Marwane.

## Actes réservés à Marwane

- Approuver la consigne.
- Appliquer le patch `AGENTS.md`.
- Fusionner la PR.
- Installer et activer la routine.
- Décider de l'ouverture des issues par département.
