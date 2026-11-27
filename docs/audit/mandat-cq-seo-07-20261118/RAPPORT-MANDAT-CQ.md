# Mandat CQ — Département 07 (Pages & SEO) : état réel, écarts, plan décision 48

Rapport en lecture seule. Rien n'a été appliqué : aucun code, aucune écriture en
base, aucun drapeau, aucune régénération du sitemap, aucune fusion.

| Élément | Valeur |
|---|---|
| Mandat | CQ, rédigé par le chat 07 (session claude.ai 011BVGEKszHE3PCzZ4PKnTyT), 18/11/2026, complément n° 1 (Search Console) |
| Session Claude Code | `d39d74a2-6295-4717-9c9d-7cded2720a57` |
| Worktree | `/home/deploy/worktrees/claude-cq-seo-07-20261118` (neuf, sans `node_modules`, aucun `npm ci` ni `npm install`) |
| Branche | `docs/mandat-cq-seo-07-20261118` |
| Base | `origin/main` = `47fc7e4c9d75ce038799ce746568eca9d3687862` (#2176) |
| PR | brouillon ; numéro et tête donnés dans le rapport final de session |
| Fenêtre de mesure | 18/11/2026, 18:20 → 18:38 UTC |
| Fichiers | `RAPPORT-MANDAT-CQ.md` (ce rapport), `ANNEXE-REQUETES.md` (requêtes et commandes), `registre-seo-07.patch` (préparé, non appliqué), `r2-cliquees-non-vendables.tsv` (47 pages), `r1-liens-410-sg-content.tsv` (67 gammes) |

Statut de chaque élément : **relevé** (mesuré ou lu, avec source et heure),
**proposé** (recommandation, rien d'exécuté), **préparé en patch** (fichier
joint, non appliqué).

Sources, voie de lecture et bornes :
- base : `sweep-psql.sh`, la voie de lecture existante du dépôt (copie de
  `910b1e9f04:.claude/skills/live-evidence-sweep/scripts/sweep-psql.sh`) ;
  transaction `read only`, `statement_timeout` de 60 s, aucune donnée client ;
- PROD : lecture par GET seulement, au plus 1 par seconde (1,05 s), sans suivre
  les redirections ; on n'a lu que le code de statut, `X-Robots-Tag`, la balise
  meta robots, le canonical, le title, le H1 et les `href`. Total : **au plus
  138 GET**, sous le plafond de 200. Le compteur de budget est à 127 (115 pages
  journalisées entre 18:28:13Z et 18:36:21Z, plus 12 GET hors journal de page) ;
  les 11 fichiers sitemap ont été lus à 18:21Z ;
- code : `origin/main` en `47fc7e4c9`.

---

## 0. Ce qu'il faut retenir

1. **La décision 48 n'est appliquée nulle part.** Le sitemap R2 (101 097 URL)
   sort de `__sitemap_p_link`, une table figée qu'aucun processus n'écrit
   (aucune insertion, mise à jour ni suppression depuis la dernière remise à
   zéro des statistiques). Le seuil de sélection est `map_has_item > 20`, pas
   le caractère vendable. Le robots R2 suit par défaut la règle héritée
   `count>=2`. Aucune fonction SQL `est_vendable` n'existe ; la seule
   définition vendable est `backend/src/database/services/vendable.ts` (#2096).
2. **Les pages R2 que Google voit sont surtout hors du sitemap.** Sur 28 jours,
   21 141 pages R2 ont eu au moins une impression ; 2 789 seulement (13,2 %)
   sont dans le sitemap. Parmi les vues hors sitemap, 16 910 sont vendables
   (626 pages cliquées, 711 clics). Ce sont les entrées de la tranche 1.
3. **Côté sitemap, appliquer la décision 48 coûte presque rien** : 44 URL
   sortiraient, toutes sans clic sur 28 jours. **Côté robots, la garde des 5 %
   est franchie** : 47 des 834 pages R2 cliquées (5,6 %, 77 clics sur 1 002,
   soit 7,7 %) ne sont pas vendables. Elles sont toutes servies 200 `index,
   follow` (47 GET, 18:31:48Z → 18:33:02Z). Cette tranche revient à Marwane.
4. **Les pages R1 renvoient vers des 410.** 16 liens `/pieces/{alias}` sans
   identifiant, présents sur 7 des 10 pages R1 les plus vues, répondent tous
   410. En base, `__seo_gamme.sg_content` en contient 124 dans 67 gammes,
   dont 107 dans 57 des 122 gammes R1 indexées.
5. **La position R1 de 41,7 a deux causes établies.** D'abord la
   cannibalisation avec les pages conseils : 279 des 799 requêtes R1 affichent
   aussi une page conseils, souvent mieux classée. Ensuite une baisse réelle à
   requête égale : sur les 135 couples page × requête communs, la position
   passe de 34,5 en juillet à 63,2 en novembre. Ce n'est donc pas un simple
   effet de mélange.
6. **Les quatre tables de surveillance sont vides par construction** :
   collecteur bouchon, intercepteur jamais enregistré, drapeau éteint, ou
   service sans appelant. Le RUM CWV, lui, est alimenté : brut reçu jusqu'à
   18:33:05Z, agrégat quotidien jusqu'au 17/11.

---

## 1. Faits du pilote : recoupement (point 3)

Relevé du 18/11, 18:35:23Z (GitHub et disque), puis 18:21Z à 18:38Z (base et
PROD).

| Fait du pilote | Relevé | Écart et explication |
|---|---|---|
| main `47fc7e4c9d75` | `origin/main` = `1fdca8d8df1e` (#2181) | #2181 a été fusionnée après la rédaction du mandat. La base de cette branche reste `47fc7e4c9`, comme le mandat le demande. |
| 65 PR ouvertes | 64 | Une PR de moins, probablement #2181, fusionnée depuis. |
| 169 exécutions en file | 169 | Aucun |
| disque 83 % | 83 % (119 G sur 150 G, 25 G libres) | Aucun |
| AK = #2087 brouillon, tête `c32bec31ed` | brouillon, OPEN, tête `c32bec31ed` ; le worktree AK est en `c32bec31ed` | Aucun. #2087 a été lue seulement, rien n'y a été poussé. |
| 1 269 / 1 258 pages perdues | 1 269 pages `/pieces/` cliquées en juillet et sans clic en octobre, dont 1 258 R2 (`__seo_gsc_daily_page_totals`, URL normalisées sans protocole ni hôte) | Aucun après normalisation. Un premier comptage, avant fusion des variantes http et https, donnait 1 263. |
| Jaccard 0,50 | Médiane de 0,50 lue dans `RAPPORT-MANDAT-AK.md:35,170` (même gamme, véhicule différent, 12 paires) | Non recalculé : cela demande le contenu servi des 32 pages AK. |
| Le sitemap couvre 13–16 % de R2 | 13,2 % des pages R2 vues sur 28 jours | Cohérent |
| Index sitemap de 10 fichiers : catégories 122, blog 107, reference 231, diagnostic 1, pages 3 | 10 fichiers : racine 1, catégories 122, blog 107, pages 3, diagnostic 1, reference 231, brands 36, pieces-1 50 000, pieces-2 50 000, pieces-3 1 097 | Les comptes cités sont exacts. La liste du pilote omet racine et brands, et le total R2 est de 101 097. |
| `pg_sitemap` seulement dans `admin-gammes-seo`, `gamme-detail-enricher`, `pricing.repository` et les types | Confirmé par le sous-agent 1 (`rg pg_sitemap backend/src frontend/app`) | Aucun ; aucun générateur de sitemap ne lit `pg_sitemap` |
| `__seo_gsc_links_weekly` = 0 ligne | 0 (`pg_stat_user_tables`) | Aucun ; voir §6 |
| robots `Disallow: /` pour les bots IA | Servi en PROD (GET 18:36:21Z) : GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, anthropic-ai, Claude-Web, CCBot… | Aucun ; voir §7 |
| PR et tickets du domaine : #2087, #2145, #2078, #1944, #1938, #1940, #1584, #1025 ; #2144 | Aucune PR ouverte ne porte le label `dept:07-seo`. Aucun ticket ouvert ne le porte non plus (`gh issue list --label dept:07-seo`) : #2144 est OPEN avec le seul label `incident` | Le rattachement de ces PR et tickets au 07 ne se fait pas par label. Les PR des mandats voisins (BL #2145, etc.) n'ont pas été ouvertes. |

---

## 2. Les 10 fonctions du 07 (point 6.1)

Échelle (journal des principes, lignes 42-43 ; `department-functions.md:128-131`) :
L1 = code branché, L2 = testé en CI, L3 = observé en service, L4 = observé en
PROD. Le niveau ne dépasse jamais la preuve.

| Fonction | Déclaré | Chaîne relevée (contrat → appelant → config → données → sortie servie) | Niveau prouvé ici | Manque |
|---|---|---|---|---|
| `seo.pages` | L1 | `pieces.$slug.tsx:207` → `gamme-rest-rpc-v2.controller.ts` → RPC `get_gamme_page_data_cached` → `pieces_gamme`, `__seo_gamme` → pages R1 et R2 servies 200 (36 GET, 18:28–18:31Z) | L1 déclaré ; sortie PROD observée le 18/11 | La preuve `dynamic-seo.controller.ts` du registre est faible. Il manque une vérification déclarée qui teste le rendu R1/R2 lancé par la CI. |
| `seo.projection` | L2 | Écrivain `seo-projection-writer.service.ts` ; drapeau `SEO_PROJECTION_R1_FEED_ENABLED` éteint | L2, non actif | Drapeau éteint : la projection R1 ne nourrit pas la page servie |
| `seo.roles-contracts` | L1 | `packages/seo-roles`, `packages/seo-role-contracts`, workflows `seo-matrix-check`, `seo-url-immutability`… | L1 | Les tests des deux paquets ne sont pas lancés par `ci.yml` |
| `seo.url-status` | L2 | Chemin visiteur : `backend/src/api/errors-api.controller.ts`. Le registre cite `modules/errors/controllers/error.controller.ts`. 410 servi sur les URL sans identifiant (16 GET, 18:29–18:30Z). | L2 ; sortie PROD observée | `trigger.ref` du registre inexact (**préparé en patch**). Les 404/410 du loader `/pieces` ne sont pas écrits dans `__error_logs` (§3.5). |
| `seo.sitemap` | L1 | `sitemap-daily-regen.yml` (`0 3 * * *`, OIDC) → `POST /api/sitemap/v10/generate-all` (`sitemap-v10.controller.ts:93`, 202, file `seo-monitor`, `SitemapWriteGuard`) → `__sitemap_p_link`, `pieces_gamme`, `__sitemap_blog` → `SITEMAP_OUTPUT_DIR` servi par Caddy. Exécutions planifiées réussies du 14/11 au 18/11 (dernière : 18/11 03:07:30Z) ; `pieces-*.xml` `Last-Modified` 18/11 03:07:43 GMT. Test `sitemap-v10-indexability.test.ts` dans le jest backend de `ci.yml`. | **L2 prouvé** (déclencheur branché + test CI) ; sortie PROD observée | Le registre le déclare L1 (**préparé en patch** : L2). Il manque la règle de la décision 48 (§3). Second producteur : `sitemap-unified.controller.ts:32`. Le workflow appelle `/api/admin/sitemap/scheduler-status`, une route morte. Requête `.range()` sans `order by`. |
| `seo.internal-linking` | L1 | Demande de page → `gamme-rest-rpc-v2.controller.ts` → `internal-linking.service.ts` (`processLinkGammeCar` :312, `processLinkGamme` :910, `resolveConseilsLinks` :758) ; test `internal-linking.service.conseils-links.test.ts` en CI ; liens servis observés en PROD | **L2 prouvé** | Le registre dit L1, avec l'écart « déclencheur non relu » (**préparé en patch**). Aucune cible n'est filtrée sur le caractère vendable ou indexable (décision 82, §5). |
| `seo.gamme-audit` | L1 | `admin-gammes-seo-list.controller.ts` ; test `gamme-seo-badges.vlevel-stats.test.ts` en CI | L2 au sens de la vérification ; la fonction est admin seulement | La vérification n'est pas déclarée (**préparé en patch**, statut et niveau laissés au décideur) |
| `seo.keyword-briefs` | L1 | Contrôleurs `admin-keyword-planner`, `admin-page-brief` ; agents planificateurs R1–R8 | L1 | Pas de déclencheur planifié ; à la demande seulement |
| `seo.monitoring` | L1 | Drapeaux `SEO_MONITORING_ENABLED` et `SEO_INDEX_HISTORY_ENABLED` (défaut : éteints) ; `daily-fetch` à 04:00 UTC (BullMQ) ; collecteurs de `seo-control-plane`. GSC par page alimentée jusqu'au 15/11. | L1 | 4 tables vides (§6). `seo-control.controller.ts` absent des preuves (**préparé en patch**). Incident #2144 ouvert : l'échantillon aléatoire de `seo-monitor` ne teste aucune page. |
| `seo.substitution` | L2 | `api/substitution/check` → `substitution.service.ts` ; test light-mode en CI | L2 | 410 pour une gamme valide sans produit (`substitution.service.ts:220-221`), alors que le loader R2 sert 200 `noindex, follow` dans le même cas : deux réponses différentes pour un même état |

Le `@Cron` est mort dans tout le backend : `ScheduleModule.forRoot()` est
commenté (`app.module.ts:111-115`). Les déclencheurs réels sont les répétables
Bull et BullMQ, la crontab `config/cron/crontab`, pg_cron et les workflows
GitHub.

**Préparé en patch** : `registre-seo-07.patch`, contre
`.spec/00-canon/ai-registry/agent-operating-map.yaml` et
`department-functions.md`, réservés à @ak125. Le patch modifie :
- `url-status` : ajoute le chemin visiteur ;
- `sitemap` : passe en `operational` L2, avec déclencheur, vérification et
  écart décision 48 ;
- `internal-linking` : passe en `operational` L2, avec déclencheur,
  vérification et écart décision 82 ;
- `gamme-audit` : déclare la vérification ;
- `monitoring` : ajoute la preuve `seo-control.controller.ts` et l'écart des
  4 tables vides ;
- la ligne 07 et le total de `department-functions.md`.

Le patch a été vérifié sur une copie jetable en scratchpad, jamais dans le
worktree : `git apply --check` passe, et
`scripts/governance/validate-agent-operating-map.js` donne « 0 errors, 0
warnings » avant comme après.

---

## 3. Décision 48 : indexation, sitemap, entrées et sorties (point 6.2)

### 3.1 Qui alimente `__sitemap_p_link` et qui rend une page indexable (relevé)

- **`__sitemap_p_link`** : 472 917 lignes, 56 gammes ; colonnes `map_pg_id`,
  `map_type_id`, `map_has_item`, alias.
  - `pg_stat_user_tables` donne `n_tup_ins`, `n_tup_upd` et `n_tup_del` à 0.
    Aucune fonction, aucun déclencheur et aucune tâche pg_cron ne l'écrit.
  - **La table est figée**, et aucun écrivain n'existe dans le dépôt.
  - 99 912 lignes pointent un type absent de `auto_type`. 11 757 d'entre elles
    ont `map_has_item > 20` et seraient donc candidates au sitemap. Le service
    les retire au vol (`sitemapLinkState`, contrôle contre `auto_type`).
  - Deux de ces URL lues en PROD (18:34:50Z et 18:34:52Z, par exemple
    `/pieces/alternateur-4/audi-22/a3-iii-22032/1-6-tdi-100039.html`) répondent
    200 `noindex, follow`.
- **Sitemap R2** : `sitemap-v10-pieces.service.ts`. Il sélectionne
  `map_pg_id IN (gammes indexables)` et `map_has_item > minItems`
  (`DEFAULT_MIN_ITEMS_THRESHOLD = 20`, :66, surchargeable par
  `crawl_budget_experiments`), en tranches de 50 000, sans `order by`. Les
  gammes viennent de `getIndexGammeIds` (`sitemap-v10-data.service.ts:74-96`) :
  `pg_display='1'` et `pg_relfollow='1'`. **Aucun critère de prix ni de
  disponibilité.** `sitemap.config.ts:53,279` le dit lui-même : « SANS filtre
  de stock ».
- **Robots R1** : `gamme-response-builder.service.ts:390-391` sert
  `index,follow` si `pg_level==='1'`, sinon `noindex,nofollow`.
- **Robots R2** : `r2-indexability.ts:81-90`.
  - Par défaut : `index` si `count>=2`, ou si `count===1` et `dataQuality>=50`.
  - Avec `SEO_R2_SELLABLE_NOINDEX_ENABLED` : `index` si
    `sellableCount >= SEO_R2_MIN_SELLABLE_PRODUCTS` (1 par défaut).
  - Ce compte vendable n'est pas calculé par `vendable.ts`.
  - Sans produit (RPC 404 ou `count==0`), le loader sert 200
    `X-Robots-Tag: noindex, follow` avec des alternatives, et écrit l'événement
    dans `__soft_404_events` (#1595).
- **Règle à sept branches** `compose-indexability.ts:56-161` : utilisée
  seulement par la chaîne SEO derrière `SEO_CHAIN_GAMME`.

### 3.2 La définition vendable unique et comment la lire (relevé + proposé)

- **Relevé.** `backend/src/database/services/vendable.ts` (#2096, fusion
  `abcfc30c3494`, décision 118) définit `estVendable` :
  - `pri_dispo` ∈ {1, 2, 3} ;
  - `pricing_state` ≠ `FROZEN` ;
  - pièce affichée ;
  - `pri_vente_ttc_n` > 0.

  Son commentaire signale trois chemins non alignés :
  `get_listing_products_extended_filtered`, `get_pieces_for_type_gamme_v3` et
  `catalog_display_quarantine`. Il n'existe aucune fonction SQL `est_vendable`
  ou `sellable` (`pg_proc`, 18/11). `supplier-brand-price-load-procedure.md:57-68`
  l'annonce pour plus tard.
- **Proposé.** Le sitemap est produit en base par lots, et le robots R2 par une
  RPC : il faut une définition lisible en SQL. La voie sans seconde définition
  passe par trois étapes.
  1. Créer la fonction SQL `est_vendable` comme **expression unique** :
     migration, dans le département 16 ou 10, avec accord de Marwane.
  2. Faire de `vendable.ts` le miroir testé de cette fonction : un test
     d'égalité sur un échantillon fixe.
  3. Faire lire cette seule fonction par le sitemap R2, le robots R2 (à la
     place du `sellableCount` actuel) et le panier.

  Tant que la fonction SQL n'existe pas, toute tranche « sitemap vendable »
  créerait une seconde définition. **C'est un prérequis bloquant.**
- **Réserve.** La décision 118 fait courir la fraîcheur après la première mise
  à jour tarifaire complète. Mes mesures appliquent l'équivalent SQL de
  `estVendable` à l'état du 18/11, sans condition de fraîcheur.

### 3.3 Mesures par couple gamme × véhicule (relevé, 18:23 → 18:25Z)

Univers : les 120 265 couples (gamme, type) du sitemap R2 et des pages R2 vues
par GSC. Chaque couple a été testé par `exists` sur `pieces_relation_type` ×
`pieces_price` × `pieces`, en lots de 10 000 (`ANNEXE-REQUETES.md` §B). GSC :
`__seo_gsc_daily_page_totals`, du 19/10 au 15/11 (28 jours, dernière date
disponible le 15/11), lue à 18:22:02Z.

| Ensemble | Pages | Pages cliquées 28 j | Clics 28 j |
|---|---|---|---|
| Sitemap R2 | 101 097 | 161 | 214 |
| … dont vendables | 101 053 | 161 | 214 |
| … dont non vendables (**sorties**) | 44 | 0 | 0 |
| Pages R2 vues par GSC (≥ 1 impression) | 21 141 (185 gammes) | 834 | 1 002 |
| … dans le sitemap (toutes vendables) | 2 789 | 161 | 214 |
| … hors sitemap, vendables (**entrées**) | 16 910 | 626 | 711 |
| … hors sitemap, non vendables | 1 442 | 47 | 77 |
| … sans relation gamme × type | 0 | — | — |

- Avec la variante `pri_dispo='1'` seulement, on compte 48 pages cliquées non
  vendables au lieu de 47 : la définition retenue change peu le résultat.
- Les 12 078 types des couples mesurés ont tous `type_display='1'`.
- Les 47 pages cliquées non vendables ont toutes été lues en PROD : **200
  `index, follow`** (liste : `r2-cliquees-non-vendables.tsv`).
- Crawl synthétique `__seo_snapshot_synthetic`, du 11/11 au 17/11, 87 376 URL
  R2 lues à 18:33Z :

  | État | URL |
  |---|---|
  | Sitemap, vendable, index | 86 585 |
  | Sitemap, non vendable, noindex | 30 |
  | Sitemap, non vendable, index | 2 |
  | 301 hors sitemap | 744 |
  | Code 0 | 11 |
  | 503 | 2 |

  Le sitemap publie donc 30 URL qu'il sert en `noindex`. Ce crawl échantillonne
  le sitemap ; il ne couvre pas les pages vues seulement par GSC.

### 3.4 Pages gamme R1 (relevé, 18:26Z)

- **`pieces_gamme`** : 9 719 gammes.

  | Filtre | Gammes |
  |---|---|
  | `display` | 4 205 |
  | `display` + `relfollow` | 123 |
  | `display` + `relfollow` + `level 1` (= sitemap catégories, 122 URL) | 122 |
  | `display` + `level 1` ou `2` | 232 |

- **Gammes ayant au moins une pièce vendable** : 231. Les 122 gammes indexées en
  ont toutes : 374 148 pièces vendables, sur un total de 417 538 (somme par
  gamme).
- **Gammes vendables non indexées** :
  - 88 gammes `display`, `relfollow 0`, `level 2` : 22 874 pièces ;
  - 11 gammes `display`, `relfollow 0`, `level 1` : 14 292 pièces ;
  - 1 gamme `display`, `relfollow 1`, `level 2` : 317 pièces ;
  - 3 gammes `display`, `level 0` ; 2 + 2 + 2 gammes non affichées.
- **Sous la décision 48, les entrées R1 possibles sont donc 99 à 109 gammes.**
  Leur effet ne se mesure pas en clics avant indexation.
- **GSC R1, 28 jours** : 92 URL vues, dont 83 dans le sitemap. Les 9 hors
  sitemap totalisent 2 clics et 465 impressions (par exemple
  `support-de-boite-vitesse-249`,
  `capteur-pression-et-temperature-d-huile-4175`).

### 3.5 Complément n° 1 : rapprochement avec le rapport « Indexation des pages » (relevé + plausible)

Les volumes GSC du 13/11 sont ceux transmis par le chat 07. La console n'a pas
été consultée.

| Volume GSC | Ce que la base et le code permettent de dire | Statut |
|---|---|---|
| 138 k indexées | Univers servi `index` : 101 097 URL du sitemap R2 (dont 30 servies `noindex`), plus les R2 vendables hors sitemap servies `index` par la règle `count>=2` (16 910 vues en 28 jours, nombre total non mesuré), plus 122 R1, 231 reference, R7/R8, blog | Ordre de grandeur cohérent ; non rapprochable URL par URL sans export GSC |
| 401 752 explorées non indexées | Univers R2 de `__sitemap_p_link` = 472 917 couples, dont 373 005 avec un type valide ; seuls 101 097 sont dans le sitemap. Les autres restent atteignables par les liens R1 (motorisations), R8 et les anciens sitemaps. Les 9 exemples sur 10 en R2, explorés le 15/11, vont dans ce sens. Similarité : Jaccard médian 0,50 entre pages R2 sœurs (rapport AK). | **Plausible.** L'hypothèse « contenu mince ou similaire » est la plus cohérente avec les volumes. L'hypothèse « autre canonique » est faible : seulement 39 URL dans la catégorie GSC correspondante. Aucune preuve URL par URL possible ici. |
| 69 196 détectées non indexées | Pas de journal de crawl (`__seo_crawl_log` vide, §6) | Non vérifiable ici |
| 132 691 noindex | Sources servies en `noindex` : (a) pages R2 sans produit → 200 `noindex, follow`, soit **214 533 couples distincts vus par un bot** dans `__soft_404_events` (du 20/08 au 18/11) ; (b) pages R2 à type orphelin (2 sur 2 lues) ; (c) 223 guides d'achat (R6 consolidé) ; (d) R1 de niveau ≠ 1 (`noindex,nofollow`) ; (e) 30 URL du sitemap R2 | **Plausible** : la source (a) suffit à elle seule en volume. Non prouvé URL par URL. |
| 71 114 en 404 | `__error_logs` (51 505 lignes sur 30 jours) ne contient **aucun** 404/410 sous `/pieces` : le loader frontend ne les journalise pas. Ses 404 sont `/includes.img/constructeurs`, `.well-known`, `/assets/js`, `/rack2022`… ; 39 139 lignes sont des 429. Candidats dans le code : URL `/pieces/{alias}` sans identifiant (410 ; GSC classe un 410 dans « Introuvable (404) »), anciennes URL de l'ancien site, types retirés. Les liens sans identifiant des contenus ne comptent que quelques dizaines d'URL distinctes, très loin de 71 114. | **Non traçable depuis la base.** Il faudrait un export GSC des exemples ou un journal d'accès. |
| 8 952 redirection | 744 URL R2 en 301 dans le crawl synthétique (11–17/11) | Partiel |
| 70 en 5xx | 2 URL R2 en 503 dans le crawl synthétique | Partiel |

### 3.6 Plan par tranches avec garde (proposé ; toute décision revient à Marwane)

Garde : arrêter et attendre Marwane si une tranche retire plus de 5 % des pages
cliquées. Base de calcul : les 834 pages R2 cliquées sur 28 jours.

| Tranche | Contenu | Entrées | Sorties | Pages cliquées retirées | Garde |
|---|---|---|---|---|---|
| 0 (prérequis) | Fonction SQL `est_vendable` unique et miroir `vendable.ts` ; condition de fraîcheur de la décision 118 | — | — | 0 | Migration → Marwane, département 16 ou 10 |
| 1 | Sitemap R2 produit depuis `est_vendable`, sans `map_has_item` ni `__sitemap_p_link` figée (source : `pieces_relation_type` × vendable × `auto_type` affiché) | ≥ 16 910 pages déjà vues (626 cliquées, 711 clics) ; au plus ~272 k couples à type valide hors sitemap (373 005 − 101 097), part vendable non mesurée | 44 URL non vendables (0 clic), dont les 30 servies `noindex` | 0 (0 %) | Sous la garde |
| 2 | Retrait des 124 liens 410 dans `sg_content` (par la source WIKI/projection, ou en appliquant `resolveGammeAliasLinks` au rendu R1) | — | — | 0 | Sous la garde |
| 3 | Robots R2 = `est_vendable` (`SEO_R2_SELLABLE_NOINDEX_ENABLED` aligné sur la fonction unique) | — | 1 442 pages vues passent en `noindex` | **47 sur 834 = 5,6 % ; 77 clics sur 1 002 = 7,7 %** | **Au-dessus de la garde → Marwane** |
| 4 | R1 : indexer les gammes vendables `relfollow 0` ou `level 2` | 99 à 109 gammes | 0 | 0 | Décision de règle → Marwane (le niveau de gamme est un choix SEO) |

**Proposé pour la tranche 3** : au lieu d'une bascule unique, découper par
ancienneté de non-vente, pour que la tranche reste sous 5 % des pages
cliquées. La décision 118 fait de toute façon courir la fraîcheur après la
mise à jour tarifaire complète ; refaire la mesure à ce moment-là.

**Proposé pour le rapport de la décision 48** : mesurer indexables, soumises,
indexées, entrées et sorties, et clics perdus. Il faut pour cela
`__seo_index_history` (inspection d'URL), qui est vide, ou un export GSC
périodique (§6).

---

## 4. Pages gamme R1 à la position 41,7 (point 6.3)

Sources :
- `__seo_gsc_daily`, niveau requête, du 19/10 au 15/11. Ces données sont
  partielles : GSC anonymise une partie des requêtes.
- `__seo_gsc_daily_page_totals`, pour les totaux par page.
- crawl synthétique du 17/11 (28 pages R1) ;
- GET PROD des 10 pages R1 les plus vues (18:28:13Z → 18:28:34Z).

### 4.1 Requêtes et positions (relevé)

| Type de page | Pages | Requêtes | Clics | Impressions | Position pondérée |
|---|---|---|---|---|---|
| R1 | 79 | 799 | 7 | 6 879 | 53,6 |
| conseils | 64 | 2 530 | 14 | 25 355 | 28,0 |
| R2 | 2 546 | 3 065 | 52 | 12 657 | 30,0 |
| constructeurs | 291 | 1 389 | 19 | 9 043 | 43,7 |

Les requêtes R1 sont des têtes génériques classées entre 60 et 80 :

| Requête | Impressions | Position R1 | Position conseils |
|---|---|---|---|
| « filtre a huile » | 277 | 63,2 | — |
| « alternateur » | — | 66,4 | 75,9 |
| « support moteur » | — | 81,3 | 52,8 |
| « joint cache culbuteur » | — | 73,9 | 26,1 |

Comparaison à périmètre égal, du 1er au 15 juillet puis du 1er au 15 novembre :

| Ensemble | Juillet | Novembre |
|---|---|---|
| Totaux des pages R1 : impressions | 2 742 | 5 367 |
| Totaux des pages R1 : position | 22,0 | 41,7 |
| Totaux des pages R1 : clics | 15 | 33 |
| 135 couples page × requête communs : position | 34,5 | 63,2 |
| 446 couples nouveaux en novembre : position | — | 50,4 |
| 150 couples perdus : position | 26,8 | — |

### 4.2 Ce qui est servi (relevé)

Sur les 10 pages R1 les plus vues :
- toutes répondent 200 `index, follow`, avec un canonical vers elles-mêmes ;
- title au gabarit « Gamme | MARQUE, MARQUE | AutoMecanik », sans « prix »
  alors que des requêtes contiennent « prix » ;
- H1 au gabarit « … — trouvez la référence compatible » ;
- 57 à 77 liens par page (24 à 41 cibles uniques).

Certaines listes de marques semblent incohérentes, par exemple DAYCO sur barre
et rotule de direction (non vérifié).

### 4.3 Hypothèses

| Hypothèse | Classement | Preuve |
|---|---|---|
| Cannibalisation R1 ↔ conseils de la même gamme | **Établie** | 279 des 799 requêtes R1 affichent aussi une page conseils, et sur plusieurs têtes la page conseils est mieux classée (26,1 contre 73,9) |
| Cannibalisation R1 ↔ R2 | **Écartée comme cause principale** | 16 requêtes partagées seulement |
| La baisse est un simple effet de mélange (nouvelles requêtes plus lointaines) | **Écartée comme seule cause** | À requête égale, la position passe de 34,5 à 63,2. Le mélange joue aussi : 446 couples nouveaux à 50,4. |
| Canonical ou statut défaillant | **Écartée** pour les 10 premières | 200, `index, follow`, canonical vers soi |
| Liens R1 vers des 410 | **Établie** (le fait) | 16 liens sans identifiant sur 7 des 10 pages, tous en 410 ; 107 liens dans 57 gammes indexées |
| Les liens 410 font baisser la position | **Non vérifiable ici** | — |
| Title sans l'intention « prix » ou « pas cher » | Relevé ; effet **non vérifiable ici** | — |
| Listes de marques erronées dans le title | **Non vérifié** | Il faudrait comparer avec l'offre de la gamme |
| Contenu R1 mince ou similaire entre gammes | **Non vérifiable ici** | Similarité R1 non mesurée ; le rapport AK ne la mesure que pour R2 |
| Images R1 non explorables par Googlebot | Relevé : `/img/` est interdit à Googlebot, et c'est le proxy des images R1 (`pieces.$slug.tsx:124-140`) ; effet sur le classement **non vérifiable ici** | — |

---

## 5. Blog : 107 URL contre 223 guides (point 6.4)

**Relevé.**
- `__sitemap_blog` contient 330 lignes : 223 `guide-achat`, 86 `conseils`,
  20 `auto` et le hub.
- `sitemap-v10-static.service.ts` retire les guides d'achat par
  `excludeR6GuideAchatUrls` quand `SEO_R6_CONSOLIDATION_ENABLED` est actif
  (défaut éteint, `feature-flags.service.ts:141-142`). 330 − 223 = 107 : c'est
  le compte servi.
- En PROD, les guides d'achat répondent `noindex, follow` ou redirigent en 301
  vers conseils (par exemple `agregat-de-freinage`). Le hub est `noindex` et
  lie 172 guides. **La consolidation R6 est donc active en PROD.**
- L'écart n'est pas une perte : il découle de la consolidation.

**Proposé.** Vérifier que chaque guide passé en `noindex` a bien sa page
conseils indexable, et que les 172 liens du hub ne visent pas des pages en
`noindex`. Ce point relève du 06 (contenu).

---

## 6. Maillage interne, décision 82 (point 6.5)

### 6.1 Ce qui génère les liens (relevé, sous-agent 2 et code)

- **R1.**
  - `R1RelatedBlocks` lit `__seo_r1_related_blocks_cache`, précalculé.
  - Les sections Motorisations, Équipementiers et Catalogue viennent de la RPC.
  - Le HTML stocké `sg_content` passe par `resolveConseilsLinks`
    (`gamme-response-builder:355`).
  - `processLinkGammeCar` (:312) et `processLinkGamme` (:910) utilisent
    `fetchGamme` (:636), **sans filtre** d'affichage ni de niveau.
- **Alias sans identifiant.** `resolveGammeAliasLinks` (:679, contrôle
  `pg_level IN (1,2)`) est appelé seulement par `r3-guide`, **pas par R1**.
- **R2.**
  - CTE `cross_selling` de `rm_get_page_complete_v2`
    (`20260408_rm_page_v2_seo_extraction.sql:335-349`) : relation existante,
    sans contrôle vendable.
  - `buildVoirAussiLinks` (`url-builder.utils.ts:135-157`) : aucun contrôle.
- **Chaîne SEO.**
  - `chain/seo-internal-linking.service.ts:212` compare `pg_display === false`.
    `pg_display` est une chaîne `'0'`/`'1'`, donc la comparaison ne déclenche
    probablement jamais.
  - Elle est derrière `SEO_CHAIN_GAMME`.
- **Constat.** Nulle part une cible de lien n'est contrôlée comme vendable et
  indexable. C'est l'écart direct avec la décision 82.
- **Tables.** `__seo_internal_link` n'est jamais écrite. Les clics de liens
  sont suivis dans `seo_link_clicks` et `seo_link_impressions`.

### 6.2 Liens en dur dans le code (relevé)

| Fichier | Lien |
|---|---|
| `PopularSearches.tsx:7-20` | Liens en dur |
| Route sélecteur des guides d'achat du blog | Liens en dur |
| `NoteProBlock.tsx` | Liens en dur |
| `ContentGuidePills.tsx:52` | Liens en dur |
| `blog-pieces-auto.constructeurs._index.tsx` | Liens en dur |
| `BlogInternalLinks.tsx:133,141` | `/pieces/freinage`, qui répond 410 ; le composant semble mort |
| `diagnostic-auto.$slug.tsx:881` | Faux alias qui compte sur une 301 |
| `Footer.tsx` | Liens en dur |

### 6.3 Liens vers des pages en erreur ou non vendables (relevé, PROD 18:28–18:33Z)

Sur 10 R1, 3 conseils et le hub des guides, on compte 369 cibles uniques :
72 R1, 79 R2, 16 sans identifiant, 147 guides d'achat (depuis le hub),
24 conseils et 11 reference.

- **Liens sans identifiant** : les 16 répondent **410 `noindex, follow`**
  (thermostat, pompe-a-eau, bougie-d-allumage, filtre-a-air,
  kit-d-embrayage…).
- **Contenus en base** (18:37:27Z) :
  - `__seo_gamme.sg_content` : 124 liens sans identifiant dans 67 gammes
    (`r1-liens-410-sg-content.tsv`), dont 107 dans 57 des 122 gammes indexées ;
  - `__seo_gamme_conseil.sgc_content` : 746 liens sans identifiant, réécrits
    au rendu par `resolveGammeAliasLinks` (aucun dans les pages conseils
    servies) ;
  - `__blog_advice` : 0.
- **Cibles R2 depuis R1** : les 79 sont vendables, et 21 d'entre elles sont
  dans le sitemap ; celles lues répondent 200 `index`.
- **R8 constructeurs** (3 pages, environ 60 liens R2 chacune, 182 cibles
  uniques) : 164 vendables et **18 non vendables (10 %)**, dont 32 dans le
  sitemap.
  - Les cibles « ampoule » (relation présente) sont servies `index, follow`.
  - Les cibles « attelage » et « compresseur » (« non référencé ») sont
    servies 200 `noindex, follow`.

### 6.4 Pages orphelines (relevé + estimation)

- Les pages R2 lues lient leur R1 et 1 à 16 autres R1, mais **aucune autre
  page R2**.
- Une page R2 n'a donc de liens entrants que depuis :
  - les motorisations de sa R1 (environ 13 par gamme) ;
  - les pages R8 du type de véhicule ;
  - le sitemap.
- Sur 21 141 pages R2 vues, 18 352 sont hors sitemap : elles ne reçoivent des
  liens que par R1 et R8.
- Je n'ai pas calculé le nombre exact de couples atteignables par R1 et R8 :
  il faudrait reconstruire les blocs de liens de toutes les pages R1 et R8.
  **Non mesuré.**

**Proposé** (décision 82) :
- un filtre unique « cible vendable et indexable » appliqué au rendu :
  `cross_selling`, `buildVoirAussiLinks`, blocs R8, `fetchGamme` ;
- un maillage R2 → R2 par rôle (même gamme, véhicules proches ; même
  véhicule, gammes liées), limité aux cibles vendables ;
- `resolveGammeAliasLinks` appliqué aussi au rendu R1, ou la correction de la
  source.

---

## 7. Les tables vides (point 6.6)

| Table | Collecteur | Drapeau | Dernière exécution | Cause du vide |
|---|---|---|---|---|
| `__seo_gsc_links_weekly` | `gsc-links-fetcher.service.ts` | — | — | Bouchon : il renvoie `collector_not_implemented` (:22, :81) |
| `__seo_crawl_log` | `CrawlLoggerInterceptor` | — | jamais | Intercepteur jamais enregistré (`seo.module.ts:290-297`). Vector (`config/vector/vector.toml:55-64`) envoie les passages Googlebot vers Meilisearch et Loki seulement. |
| `__seo_index_history` | `gsc-index-history-collector.service.ts`, via `daily-fetch` `indexation` (processeur :126, :224) | `SEO_INDEX_HISTORY_ENABLED` éteint par défaut (:106), plus `SEO_INDEX_INSPECT_MAX_PER_RUN` et `GAP_MS` | jamais (table vide) | Drapeau éteint. Il faut aussi les identifiants GSC et `READ_ONLY` désactivé. |
| `__seo_cwv_daily` | `CwvFetcherService` (PSI de laboratoire) | — | jamais | Service sans appelant |

Ces quatre tables avaient 0 ligne à la lecture de `pg_stat_user_tables`, le
18/11.

**Relevé, CWV des vrais utilisateurs (18:35:12Z).**
- Chaîne : balise `web-vitals.client.ts:432` → `cwv-beacon.controller.ts` →
  `__seo_cwv_raw` (18 799 lignes sur 7 jours, dernière à 18:33:05Z) →
  `__seo_cwv_daily_rum` (7 094 lignes, dernière date le 17/11 ; pg_cron
  `cwv-hourly-aggregation`).
- P75 médian quotidien sur 28 jours, classe `human` :

  | Surface | LCP | INP | Échantillons |
  |---|---|---|---|
  | R2_PRODUCT | 2 132 ms | 187 ms | 14 150 LCP, 771 INP |
  | R8 | 1 203 ms | 108 ms | — |
  | R3 | 1 614 ms | 40 ms | — |
  | HOME | 1 596 ms | — | — |

  Le CLS est à 0 partout.
- `__seo_crux_field_history` existe ; son contenu n'a pas été mesuré.

**Relevé, budget CI.** `frontend/lighthouse-budget.json` fixe LCP 11 100, CLS
0,25, TBT 500 et FCP 10 200, **sans INP**. Il n'est appliqué que par le job
`lighthouse` de `ci.yml`, sur push vers main. `perf-gates.yml` ne contrôle que
la taille des bundles.

**Ce qu'il faut pour le rapport de la décision 48** (proposé) :
- un état d'indexation par URL : `__seo_index_history` activé avec un budget
  d'inspection, ou un export GSC périodique ;
- la liste des URL soumises (le sitemap du jour) ;
- les entrées et sorties : différence entre deux sitemaps datés, à conserver,
  alors que ce n'est pas fait aujourd'hui ;
- les clics par page : la table `__seo_gsc_daily_page_totals` existe déjà.

Le reste (journal de crawl, liens GSC) n'est pas nécessaire au premier rapport.

**Ce qu'il faut pour le rapport de la décision 81** (proposé) :
- le RUM existe déjà (`__seo_cwv_daily_rum`) ;
- il manque un budget INP en CI et un budget calé sur le RUM : les seuils
  Lighthouse actuels (LCP 11,1 s) ne contraignent rien ;
- `__seo_cwv_daily` (laboratoire) n'est pas nécessaire si la décision 81 vise
  les vrais utilisateurs. Le supprimer ou le brancher est une décision.

---

## 8. robots.txt (point 6.7)

**Relevé** (GET PROD 18:36:21Z ; code `packages/seo-url-contract/src/robots-policy.ts`).
- **Service** : la route frontend `robots[.]txt.tsx:48` appelle
  `api/seo/robots.txt` (`robots-txt.controller.ts:20,32`), avec un repli local.
  Seule la production publie cette politique.
- **Groupes servis** : 54 groupes `User-agent`, deux lignes `Crawl-delay: 1` et
  une ligne `Sitemap` (`https://www.automecanik.com/sitemap.xml`).
- **Groupe `*`** :
  - Disallow `/_form.get.car.*`, `/fiche/`, `/find/`, `/searchmine/`, `/api/`,
    `/admin/`, `/checkout/`, `/cart/`, `/private/`, `/img/`, les paramètres
    utm, fbclid et gclid, et `/search?*` ;
  - `Crawl-delay: 1`.
- **Groupes Googlebot, Googlebot-Image, Googlebot-Shopping et Bingbot** : propres
  à chaque robot. Le groupe Googlebot interdit `/img/`, qui est le proxy des
  images R1.
- **`Disallow: /`** pour :
  - les outils SEO (Ahrefs, Semrush, MJ12, DotBot, BLEXBot, DataForSeo…) ;
  - les moteurs chinois et russes ;
  - les robots IA : GPTBot, **ChatGPT-User**, CCBot, anthropic-ai, Claude-Web,
    **ClaudeBot**, **PerplexityBot**, Google-Extended, FacebookBot,
    Meta-ExternalAgent, Diffbot, Bytedance… ;
  - les scrapers.
- **Robots absents** de la politique : OAI-SearchBot, Claude-SearchBot,
  Claude-User, Perplexity-User. Ils relèvent donc du groupe `*` et peuvent
  explorer le site.
- **Tests** :
  - `backend/tests/unit/robots-txt.service.test.ts` (instantané) ;
  - `robots-policy.google-matching.test.ts` ;
  - `frontend/tests/unit/robots-txt-fallback.test.ts` ;
  - `frontend/tests/qa-audit/suites/seo-tech.spec.ts:111-121`.

**Question pour Marwane** (formulée seulement, rien n'est modifié) :

> Le robots.txt servi bloque entièrement ChatGPT-User, PerplexityBot et
> ClaudeBot (`Disallow: /`). Ces trois robots ne jouent pas le même rôle.
> ChatGPT-User et PerplexityBot vont lire une page quand un utilisateur pose une
> question à l'assistant et peuvent citer le site avec un lien. ClaudeBot sert
> surtout à collecter des données d'entraînement. À l'inverse, OAI-SearchBot,
> Claude-SearchBot, Claude-User et Perplexity-User ne sont pas nommés et sont
> donc autorisés par le groupe `*`. Veux-tu :
> (a) garder le blocage tel quel ;
> (b) autoriser les robots qui lisent à la demande d'un utilisateur
>     (ChatGPT-User, PerplexityBot, et par cohérence Claude-User et
>     Perplexity-User) sur les pages R1, R2, R3 et conseils, en gardant bloqués
>     les robots d'entraînement (GPTBot, ClaudeBot, CCBot, Google-Extended) ;
> (c) tout ouvrir ?
> Faut-il aussi nommer explicitement OAI-SearchBot et Claude-SearchBot ?
> Enfin, dois-je retirer `/img/` de l'interdiction pour Googlebot, puisque
> c'est le proxy des images R1 ?

---

## 9. Mandats de correction du 07, par effet attendu sur les clics (point 6.8, proposé)

Base de l'effet : les mesures du §3 (clics GSC sur 28 jours). L'effet en clics
d'une page qui entre dans le sitemap n'est pas garanti : l'entrée la rend
découvrable, pas indexée.

| Ordre | Mandat proposé | Effet attendu | Dépendances | Décisions |
|---|---|---|---|---|
| 1 | **CQ-A — `est_vendable` SQL unique et sitemap R2 issu de la règle** (tranches 0 et 1) : générer le sitemap R2 depuis la fonction unique ; ne plus lire `map_has_item` ni `__sitemap_p_link` figée ; conserver un sitemap daté par jour pour les entrées et sorties ; ajouter `order by` sur la requête de tranches. | +16 910 pages déjà vues soumises (711 clics sur 28 jours aujourd'hui hors sitemap), 44 sorties à 0 clic (dont 30 URL servies `noindex`) | 16 (fonction vendable et fraîcheur, décision 118), 10 (`pieces_relation_type`, `auto_type`), migration → Marwane | 48, 51/118, 20 |
| 2 | **CQ-B — Liens R1 : retirer les 410, cibles vendables seulement** : `resolveGammeAliasLinks` au rendu R1, ou correction de `sg_content` à la source ; filtre vendable et indexable sur `fetchGamme`, `cross_selling`, `buildVoirAussiLinks` et les blocs R8 | 124 liens 410 retirés ; 18 liens R8 sur 182 corrigés | 09 si `sg_content` est corrigé à la source (RAW → WIKI → projection) ; 10 pour la relation | 82, 48 |
| 3 | **CQ-C — Rôle R1 contre conseils sur les requêtes de tête** : attribuer chaque requête de tête (« filtre a huile », « alternateur »…) à un rôle unique, puis aligner title, H1 et maillage. Le libellé du title (« prix ») reste soumis à autorisation. | Sur les 279 requêtes partagées : position R1 aujourd'hui de 60 à 80 | 06 (contenu conseils), 04 (intention commerciale) ; pas de modification de title ou H1 optimisé sans autorisation | 17, 82, matrice des rôles |
| 4 | **CQ-D — Maillage R2 → R2 par rôle** vers des cibles vendables | Les 18 352 pages R2 vues hors sitemap reçoivent plus de liens entrants | 10 (proximité des véhicules), 20 (rendu de la page) | 82 |
| 5 | **CQ-E — Robots R2 = `est_vendable`** (tranche 3) : aligner `SEO_R2_SELLABLE_NOINDEX_ENABLED` et `sellableCount` sur la fonction unique, par sous-tranches | Négatif à court terme : −47 pages cliquées (5,6 %), −77 clics (7,7 %) ; positif sur le budget de crawl | CQ-A ; décision de Marwane (garde franchie) | 48, 118 |
| 6 | **CQ-F — Instruments du rapport décision 48** : `__seo_index_history` (activation et budget), sitemaps datés, journalisation des 404/410 de `/pieces` | Aucun effet direct ; c'est la mesure de la décision 48 | 22 (données), 21 (journaux) ; drapeau → Marwane | 48 |
| 7 | **CQ-G — Décision 81** : budget INP en CI, seuils calés sur le RUM, sort de `__seo_cwv_daily` | Indirect | 22, 20 | 81 |
| 8 | **CQ-H — Registre 07** : appliquer `registre-seo-07.patch` ; ajouter les tests `seo-roles` et `seo-role-contracts` à la CI | Aucun | @ak125 (`.spec/00-canon`) | 72 |
| 9 | **CQ-I — Gammes vendables non indexées (R1)** (tranche 4) | 99 à 109 gammes candidates | Décision de Marwane | 48, 17 |

**Ce que 06 et 04 doivent recevoir du 07** (proposé) :
- **06 (contenu)** :
  - la liste des gammes dont `sg_content` porte des liens 410
    (`r1-liens-410-sg-content.tsv`) ;
  - les requêtes de tête partagées R1/conseils, avec le rôle attribué (CQ-C) ;
  - la règle « cible vendable et indexable » pour tout lien éditorial
    (décision 82) ;
  - la confirmation que chaque guide d'achat en `noindex` a son équivalent
    conseils.
- **04 (marketing et acquisition)** :
  - la liste vendable unique (`est_vendable`, CQ-A), pour que le flux marchand
    et les annonces ne poussent pas une page non vendable ;
  - les pages R2 cliquées non vendables (`r2-cliquees-non-vendables.tsv`) ;
  - la question robots IA (§8) une fois tranchée ;
  - le rapport décision 48 (CQ-F) comme mesure commune.

---

## 10. Constats hors périmètre (signalés, non corrigés)

1. `sitemap-v10-pieces.service.ts` : `.range()` sans `order by`. Les tranches
   de 50 000 ne sont pas déterministes ; doublons ou trous possibles entre
   `pieces-1` et `pieces-2`.
2. `sitemap-daily-regen.yml` appelle `/api/admin/sitemap/scheduler-status`, une
   route morte.
3. Les tests de `packages/seo-roles` et `packages/seo-role-contracts` ne sont
   pas lancés par `ci.yml`.
4. `__sitemap_p_link` : 99 912 lignes à type orphelin, jamais purgées ; table
   sans écrivain.
5. `CrawlLoggerInterceptor` n'est pas enregistré.
6. `CwvFetcherService` n'a aucun appelant.
7. `chain/seo-internal-linking.service.ts:212` : la comparaison
   `pg_display === false` ne déclenche probablement jamais.
8. `BlogInternalLinks.tsx` est vraisemblablement mort et lie vers
   `/pieces/freinage`, qui répond 410.
9. Les 404/410 du loader `/pieces` ne sont pas écrits dans `__error_logs`.
10. Pas de budget INP en CI ; le budget LCP de 11,1 s ne contraint rien.
11. Le sitemap R2 publie 30 URL servies `noindex` et 44 URL non vendables.
12. Même état, deux réponses : une gamme valide sans produit donne 410 par
    `substitution` et 200 `noindex` par le loader R2.
13. Le hook de démarrage de session signale le cron `seo-audit` en **échec
    depuis le 16/11 03:00 (3 exécutions), avec le motif « sitemap
    indisponible »**. Le sitemap public répond pourtant (lu à 18:21Z) et sa
    régénération réussit chaque jour. Le lien avec #2144 (échantillon de
    `seo-monitor` vide) n'est pas établi. Non instruit : la cause est à lire
    dans le journal du cron, côté 21.
14. Les pages R1 servent des listes de marques à vérifier dans le title (DAYCO
    sur barre et rotule de direction). Non vérifié.
