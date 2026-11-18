# Mandat CU — liens 410 dans le texte des pages gamme R1

Date : 2026-11-18. Base : `main` à `06c380173`. Accès base : SELECT seul, en
transaction en lecture seule. Sondes PROD : GET à 1 requête/s, code HTTP et balise
robots seulement.

## En bref

- Le texte R1 (`__seo_gamme.sg_content`) contient **124 liens `/pieces/<alias>`
  sans identifiant, dans 67 gammes** (19:27:32 UTC). En PROD, ces adresses
  répondent **410**.
- Correctif au rendu, dans `buildRpcV2Response`, juste avant `resolveConseilsLinks`.
  Sur les 81 lignes réelles de `sg_content` : **124 → 0 lien sans identifiant**,
  **111 réécrits** vers l'adresse canonique, **13 retirés** (libellé gardé). Sur les
  58 liens déjà canoniques, **51 gardés et 7 retirés**, car leur cible n'est pas indexable.
- Aucune écriture en base. Le texte source reste fautif : il faut le corriger à la
  source (§6.6).

## 6.1 Recompte

Requêtes : `q61-liens-sans-id.sql`, `q61b-cibles-non-indexables.sql`,
`q61c-canoniques-et-autres-champs.sql`.

| Mesure (19:27:32 UTC) | Valeur |
|---|---|
| Liens `/pieces/<cible>` sans identifiant dans `sg_content` | 124 |
| Gammes porteuses | 67 |
| Dont sur une R1 indexée (`pg_display=1`, `pg_relfollow=1`, `pg_level=1`) | 107 liens, 57 gammes |
| Cibles distinctes | 68 |

**10 pages R1 en PROD** (19:29:24–19:30 UTC) : 32 liens sans identifiant servis. Les 32
cibles répondent 410.

**Autres champs rendus.** Aucun autre champ rendu sur R1 n'ajoute ce défaut :
`sg_descrip`, `sg_title`, `sg_h1` et `__seo_gamme_info.sgi_content` n'en contiennent
aucun. `__seo_gamme_conseil.sgc_content` en contient 764, mais ce champ n'est pas
rendu sur R1 (constat hors périmètre).

## 6.2 Correctif au rendu

**Règle de cible indexable.** Celle de `sitemap-categories.xml`
(`sitemap-v10-static.service.ts:116-124`) : `pg_display='1'`, `pg_relfollow='1'` et
`pg_level='1'`. Pas de seconde règle : le filtre est une portée `'indexable'`
ajoutée à `fetchCatalogueGammes`. La portée `'catalogue'` (niveau 1 ou 2) des guides
R3 reste inchangée.

**Comportement.**

| Cas | Résultat |
|---|---|
| Cible indexable | Adresse canonique `/pieces/<alias>-<id>.html` |
| Cible inconnue, non affichée ou non indexable | Libellé gardé dans `<span data-gamme-link="unresolved">`, sans lien |
| Lien canonique vers une cible indexable | Intact |
| Lien canonique vers une cible non indexable | Libellé gardé, sans lien |
| Lien externe, page véhicule, autre chemin | Intact, aucune lecture |
| Lecture en échec | Repli sans lecture (`unlinkGammeAliasLinks`) : tout lien sans identifiant perd son lien, les liens canoniques restent. La page est servie et la réponse n'est **pas** mise en cache. |

**Pourquoi ce repli.** Lever l'erreur ferait tomber la page en 503. Servir le texte
tel quel laisserait passer des liens 410. Le repli enlève seulement ce qui répond 410.

**Comment voir une dégradation.** Elle est journalisée : `[R1-GAMME-LINKS] pg_id=…`
au niveau error, et `performance.gamme_links_degraded = 1`. Comme la réponse
dégradée n'est pas cachée, la requête suivante refait la résolution.

**Coût.**
- Au plus 2 requêtes `pieces_gamme` par construction : une par alias, une par
  identifiant, et seulement s'il y a des liens candidats.
- Elles n'ont lieu qu'en cas d'absence du cache de réponse (clé
  `gamme:resp:v2:<r6c0|r6c1>:<pgId>`, TTL 1 h). Aucun cache nouveau n'est ajouté.

**Intégration.** Le vrai `resolveGammeAliasLinks('indexable')` a été appliqué aux 81
lignes réelles et aux 9 719 gammes, extraites à 19:34:42 UTC (essai jetable, retiré).
Détail lien par lien : `liens-sg-content.tsv`.

| | Avant | Après |
|---|---|---|
| Liens sans identifiant | 124 | 0 (0 aussi par le repli) |
| Réécrits vers l'adresse canonique | — | 111 |
| Retirés (libellé gardé) | — | 13 |
| Canoniques gardés / retirés | 58 | 51 / 7 |

**Cinq pages, avant (PROD) et après.**

| Page | Sans identifiant avant | Après |
|---|---|---|
| filtre-a-huile-7 | 5 | 4 réécrits : filtre-a-air-8 ×2, filtre-a-carburant-9, bouchon-de-vidange-593. Retiré : filtre-de-boite-auto |
| butee-d-embrayage-48 | 3 | kit-d-embrayage-479 ×2, emetteur-d-embrayage-234 |
| courroie-de-distribution-306 | 3 | kit-de-distribution-307 ×2, pompe-a-eau-1260 |
| cremailliere-de-direction-286 | 3 | rotule-de-direction-2066, pompe-de-direction-assistee-12, soufflet-de-direction-191 |
| durite-de-refroidissement-475 | 3 | radiateur-de-refroidissement-470, thermostat-316, pompe-a-eau-1260 |

**Sondes PROD des cibles.**
- 56 cibles réécrites : 200 pour toutes (19:35:42–19:36:56 UTC).
- 16 cibles retirées : 200 pour toutes, aucune 410 (19:38:29–19:38:53 UTC). 10 sont
  servies « noindex, nofollow » et 6 « index, follow ».

Liens retirés :
- **sans identifiant** : ampoule-feu-arriere, biellette-de-barre-stabilisatrice ×2,
  collecteur-d-echappement, convertisseur-de-couple, correcteur-de-portee,
  filtre-de-boite-auto, galet-tendeur-de-courroie-de-distribution,
  joint-d-echappement, liquide-de-frein, pochette-joints-moteur, servo-frein,
  tube-d-echappement ;
- **canoniques** : biellette-de-barre-stabilisatrice-3230,
  butee-elastique-d-amortisseur-1182 ×2, contacteur-demarreur-682,
  joint-arbre-longitudinal-1427, support-de-boite-vitesse-249 ×2.

### Point de décision pour l'owner : règle du sitemap ou règle robots

La page R1 se déclare « index » dès que `pg_level='1'`, sans regarder `pg_display`
ni `pg_relfollow`. Six cibles que ce correctif délie sont donc servies
« index, follow » en PROD :
- tube-d-echappement-17 et servo-frein-74, non affichées ;
- support-de-boite-vitesse-249, filtre-de-boite-auto-416,
  butee-elastique-d-amortisseur-1182 et biellette-de-barre-stabilisatrice-3230,
  avec relfollow 0.

J'ai gardé la règle du sitemap, pour deux raisons :
- `pg_relfollow` est littéralement le drapeau « suivre les liens » ;
- le sitemap est l'ensemble indexable déclaré.

Avec la règle robots, 8 liens resteraient liés : 3 sans identifiant (3230 ×2, 416)
et 5 canoniques (1182 ×2, 3230, 249 ×2). Changer de règle revient à modifier un seul
filtre (`fetchCatalogueGammes`, portée `'indexable'`).

## 6.3 `processLinkGamme` et `processLinkGammeCar`

**Réponse : oui.** `fetchGamme` lit `pieces_gamme` par `pg_id` sans aucun filtre, et
remplace le jeton même si la gamme n'est pas affichée ou n'est pas indexable.

Requête `q63-jetons-linkgamme.sql` (19:36:27 UTC), sur 103 colonnes éditoriales des
tables `__blog*`, `__seo*` et `__cross*` :

| Source | `#LinkGamme_N#` | `#LinkGammeCar_N#` |
|---|---|---|
| `__seo_gamme_car.sgc_content` | 5 | 376 |
| `__seo_gamme_car.sgc_descrip` | — | 118 |
| `__seo_gamme_car.sgc_preview` | — | 105 |
| `__seo_gamme_conseil.sgc_content` | 271 | — |

| État de la cible | LinkGamme | LinkGammeCar |
|---|---|---|
| Indexable | 247 | 567 |
| Affichée, non indexable | 28 | 18 |
| Non affichée | 1 | 14 |

**PROD** (19:37:50–19:38:14 UTC), sur les 15 cibles LinkGamme non indexables :
- `mecanisme-d-embrayage-261` et `disque-d-embrayage-262` (pg_level 5) répondent **410** ;
- `batterie-1` (non affichée), `neiman-1367` et `capteur-impulsion-4813` (relfollow 0)
  répondent 200 « index, follow » ;
- les autres répondent 200 « noindex, nofollow ».

**Liens 410 servis aujourd'hui** (19:39:16 UTC) :
- le guide R3 `butee-d-embrayage` lie vers 262 et 261 ;
- le guide R3 `cable-d-embrayage` lie vers 261 ;
- lignes en base : pg 48, 478, 479 et 577.

**Non corrigé dans cette PR**, pour quatre raisons :
- ces jetons ne passent pas par le rendu R1, mais par R3, R6 et le blog ;
- la règle des guides R3 est la portée `'catalogue'`, pas `'indexable'` ;
- `fetchGamme` a un cache par jeton, alimenté aussi par `preloadPopularGammes`, qui
  contourne tout filtre posé à la lecture ;
- `fetchGamme` est silencieux en cas d'erreur, alors que `fetchCatalogueGammes` lève.

Par ailleurs, `processLinkGammeCar` relève du maillage R2, hors périmètre.

**Correctif proposé (non appliqué).** Dans `processLinkGamme`, résoudre les
identifiants par `fetchCatalogueGammes('pg_id', ids, 'catalogue')` au lieu de
`fetchGamme`. Cela retire les cibles de niveau 5 qui répondent 410, et définit ce
que devient le libellé quand la lecture échoue.

## 6.4 Garde et ligne du rapport de la décision 82

**Garde (dans la PR).** `gamme-response-builder-gamme-links.test.ts` échoue si
l'étape de rendu R1 laisse un `href="/pieces/<x>"` sans `-<id>.html`. Il vérifie le
cas nominal et le cas de panne.

**Ligne proposée (non créée) : « liens vers une page d'erreur ».**
- **Sources** :
  - `__seo_gamme.sg_content`, requête `q61-liens-sans-id.sql` (liens sans
    identifiant) ;
  - `q63-jetons-linkgamme.sql` restreint aux cibles `pg_level` hors 1 et 2 (jetons
    vers une page 410) ;
  - plus un échantillon de HTML rendu : N pages R1 par jour, GET sur les cibles
    `/pieces/…`, avec compte des 410 et 404.
- **Où la brancher** : dans le rapport du cron `seo-audit`, qui produit déjà le
  rapport quotidien SEO et lit le sitemap. Il est en échec depuis le 2026-11-16 03:00
  (sitemap indisponible), ce qu'il faut réparer d'abord. La ligne serait reprise par
  le Command Center sans nouvelle source.
- **Attendu** : 0 en rendu. Un compte en base différent de 0 reste une dette de
  source pour le département 06.

## 6.5 Liens en dur du frontend

| Lien | Servi ? | Preuve | Suite |
|---|---|---|---|
| `BlogInternalLinks.tsx:133,141` → `/pieces/freinage` et `/pieces/embrayage` | Oui, sur `/blog-pieces-auto` (200), rendu par `blog-pieces-auto._index.tsx:287` et `:345` | Les deux répondent **410** (19:40:03 UTC). Aucune gamme n'a ces alias. | **Corrigé** : libellés gardés, sans lien. Aucune cible devinée. |
| `diagnostic-auto.$slug.tsx:881` → `/pieces/gamme-<id>.html` (301) | **Non servi** | Les 1176 slugs de `__seo_observable` ont tous des `related_gammes`, et `get_r5_redirect_target` renvoie une ligne pour tout slug existant : le loader répond 301 avant le rendu. Échantillon bruit-amortisseur, bruit-cardan, bruit-demarreur, bruit-agregat-de-freinage : 301 (19:40:21 UTC). | Listé, non corrigé |

**Hors périmètre, même composant** (19:41:13–19:41:38 UTC). Ces liens répondent
**404** :
- `/pieces` ;
- les conseils `compresseur-climatisation`, `filtre-a-particules`, `kit-embrayage`,
  `pompe-direction-assistee` et `volant-moteur`.

## 6.6 Origine de `sg_content`, alimentation et décision 32

Mesures du 2026-11-18 à 19:42 UTC.

**La table.** `__seo_gamme` compte 177 lignes, toutes avec un `sg_content`. Elle est
classée « vivante », propriétaire 07 seo
(`audit/massdoc-table-inventory-2026-11-18.md:376`).

**Elle n'est plus alimentée.**
- Dernière écriture datée : `sg_updated_at` max = **2026-03-29 15:15 UTC**. 0 ligne
  modifiée depuis 30 jours et 0 depuis 90 jours.
- Répartition : 89 lignes en février 2026, 88 en mars 2026.
- Brouillons : `sg_draft_updated_at` max = 2026-03-28. 100 brouillons non vides,
  sources `content-gen-r1`, `content-gen-skill`, `content-gen-skill:editorial`,
  `pipeline` et `pipeline+llm`.
- Limite de cette mesure : aucun déclencheur ne pose `sg_updated_at`, la date vaut
  ce que les écrivains y ont mis.

**Écrivains connus.**
- `scripts/seo/generate-content-r1.py` : neutralisé le 2026-07-02 (PR-C, ADR-031/046,
  RAG interdit comme source de contenu). Il écrivait `sg_content_draft`.
- Fonctions SQL : aucune n'écrit `__seo_gamme` (`refresh_gamme_aggregates`,
  `get_gamme_page_data_optimized` et les autres ne font que lire). Aucun cron ne
  l'écrit.
- Les 4 déclencheurs (`trg_write_scope___seo_gamme`,
  `trg_auto_restore_accents_r1_meta`, `trg_gpc_invalidate_seo_gamme`,
  `trg_warn_orphan_r1_meta`) gardent ou réagissent à une écriture, ils n'en
  produisent pas.
- Saisie admin : `admin.gammes-seo.$pgId.tsx` envoie
  `PATCH /api/admin/gammes-seo/<pgId>/seo`, mais aucun contrôleur backend ne déclare
  cette route (`admin-gammes-seo-update.controller.ts` ne porte que `PATCH :id`,
  `PATCH batch` et `POST action`). C'est déduit du code, non essayé : l'enregistrement
  depuis l'admin ne peut pas aboutir.

**Ce que dit la décision 32.** Elle vise `__seo_gamme_conseil` (« plus alimentée,
retirée quand plus aucune page ne la lit »), **pas** `__seo_gamme`. Elle n'interdit
donc pas de corriger `sg_content`.

**Pour le département 06.**
- La source porte toujours les 124 liens sans identifiant. Le rendu les neutralise,
  mais tout autre lecteur de `sg_content` les voit : `script-generator.service.ts`,
  `admin-keyword-planner.controller.ts`, `r1-readiness.ts`.
- La correction de source passe par la voie RAW → WIKI → projection
  (ADR-031/119), pas par une écriture directe ni par une réactivation du générateur.
- La table `liens-sg-content.tsv` donne, pour chaque lien, la cible canonique ou le
  retrait.

## Constats hors périmètre, non corrigés

1. Un échec de `resolveConseilsLinks` fait tomber toute la page R1 en 503.
2. `__seo_gamme_conseil.sgc_content` contient 764 liens sans identifiant (non rendus
   sur R1).
3. `chain/seo-internal-linking.service.ts:212` compare `pg_display === false`, sur une
   colonne texte.
4. `seo-v4-switch-engine.service.ts:181` filtre `.eq('pg_display', true)` sur une
   colonne texte.
5. La règle robots de la R1 ne suit pas le sitemap. Exemple : batterie-1 est non
   affichée et pourtant servie 200 « index, follow » ; de même servo-frein-74 et
   tube-d-echappement-17.
6. 3 liens R3 répondent 410, via `processLinkGamme` (§6.3).
7. `BlogInternalLinks` sert 6 liens 404 (§6.5).
8. La route `PATCH /api/admin/gammes-seo/<pgId>/seo` est absente du backend (§6.6).
9. Le cron `seo-audit` est en échec depuis le 2026-11-16 (sitemap indisponible). Le
   DEV a des crashs relancés (alerte `sync-dev-runtime`).

## Ce qui est prouvé, et à quel niveau

| État | Contenu |
|---|---|
| Corrigé dans la PR | Rendu R1 (`resolveR1GammeLinks`), portée `'indexable'`, repli `unlinkGammeAliasLinks`, réponse dégradée non cachée, `BlogInternalLinks` |
| Testé | Jest ciblé (7 suites, 93 tests), `tsc` backend (code et specs), ESLint des fichiers touchés, `tsc` frontend, essai sur les 81 lignes réelles |
| Proposé seulement | Correctif de `processLinkGamme`, ligne du rapport de la décision 82, choix de la règle robots ou sitemap, correction de source pour 06 |
| Intégré | Non : PR en brouillon, non fusionnée |
| Activé ou servi | Non : ni PREPROD ni PROD. Il faudra recompter les liens 410 sur les 5 pages après le déploiement. |
