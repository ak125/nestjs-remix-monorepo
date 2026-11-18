# Mandat CT — définition SQL unique « vendable » et sitemap gamme × véhicule généré depuis elle

Date : 2026-11-18. Base de travail : `origin/main` `06c380173443`.
Décisions appliquées : 20, 48, 51, 118, 122, et le « oui » du 18 nov. 19:52 (Paris) pour la tranche sitemap seule.

Rien n'est appliqué en base, rien n'est activé, rien n'est régénéré ni publié. Toutes les mesures sont des `SELECT` ou des lectures HTTP.

## 1. À décider avant toute bascule

La règle de la décision 48 fait passer le sitemap gamme × véhicule de **101 097 à 1 373 594 URL** (× 13,6), soit 28 fichiers au lieu de 3. Elle ne retire que 44 URL, sans clic. Le garde-fou du §6.5 arrête un retrait, il ne dit rien d'une croissance : c'est donc à Marwane de dire si ce volume est voulu.

Les 1 272 541 entrées se répartissent ainsi (clics Search Console du 2026-10-19 au 2026-11-15) :

| Véhicule de l'URL | URL entrantes | Pages vues par Google | Pages cliquées | Clics |
|---|---:|---:|---:|---:|
| sans réserve | 781 212 | 9 747 | 400 | 458 |
| `type_relfollow = '0'` | 482 615 | 5 725 | 167 | 181 |
| modèle masqué et `type_relfollow = '0'` | 7 403 | 24 | 1 | 1 |
| marque masquée | 912 | 2 | 0 | 0 |
| marque masquée et `type_relfollow = '0'` | 399 | 2 | 0 | 0 |
| **Total** | **1 272 541** | **15 500** | **568** | **640** |

Le candidat retient comme « véhicule affiché » `auto_type.type_display = '1'`. Il n'ajoute ni filtre sur `type_relfollow`, le modèle ou la marque, ni plafond : aucune décision ne les porte, et les pages concernées répondent `200`, `index, follow` (contrôlé sur DEV). Les 101 053 URL communes sont toutes « sans réserve ». Si Marwane écarte les véhicules à réserve, le lot serait de 882 265 URL ; le changement tient en une condition de la fonction SQL.

## 2. Ce que contient le candidat

| Élément | Fichier | État |
|---|---|---|
| Fonction unique `public.est_vendable(dispo, état du tarif, prix TTC, pièce affichée)` | `backend/supabase/migrations/20261118_est_vendable_definition_unique.sql` | écrit, exécuté sur PostgreSQL 17 jetable ; **non appliqué** |
| `public.piece_est_vendable(piece_id)` | même migration | idem |
| `public.get_sitemap_r2_types_vendables(pg_id, type_min, type_max)` | même migration | idem |
| Retour arrière | `…_definition_unique.down.sql` | exécuté sur PostgreSQL 17 jetable |
| Échantillon du miroir, 29 cas | `backend/src/database/services/vendable.echantillon.json` | écrit |
| Miroir côté application | `backend/src/database/services/vendable.miroir.test.ts` | testé ; joué par la CI (jest du backend) |
| Miroir côté SQL | `scripts/ci/check-vendable-mirror.py` | testé en local ; **étape CI en patch**, voir §4 |
| Générateur « vendable » et garde-fou | `backend/src/modules/seo/services/sitemap-v10-pieces-vendable.service.ts` | testé (40 tests) |
| Bascule `SITEMAP_R2_SOURCE` | `feature-flags.service.ts`, `sitemap-v10.service.ts`, `seo.module.ts`, `.env.example` | testé ; **éteinte par défaut** |
| Entrée de la liste des RPC | `backend/governance/rpc/rpc_allowlist.json` | écrit |

Les trois fonctions sont `STABLE`, sans écriture, `SECURITY INVOKER`, réservées à `service_role`. `get_pieces_for_type_gamme_v3` et `get_listing_products_extended_filtered` ne sont pas touchées.

## 3. Définition (§6.2) et fraîcheur (décision 51)

Une ligne de tarif est vendable si `pri_dispo` vaut `'1'`, `'2'` ou `'3'`, si `pricing_state` n'est pas `'FROZEN'`, si `pieces.piece_display` est vrai et si `pri_vente_ttc_n` est un nombre fini strictement positif. Une pièce est vendable si une de ses lignes l'est. Ce sont les entrées et les sources de `estVendable`.

Fraîcheur : rien n'est branché, et rien ne peut l'être depuis la base. Elle ne contient aucune trace de la première mise à jour complète d'un fournisseur. L'activation vit dans le code, `backend/src/modules/pricing/config/supplier-sale-rules.ts` (`premiereMajCompleteLe`), à `null` pour tous les fournisseurs. Elle agit sur la sortie de vente : le lot de désactivation passe `pri_dispo` à `'0'`, et la fonction en hérite. Y ajouter une date créerait une seconde règle.

Ce qui manque et à qui cela revient :

- mandat AS (import des tarifs) : écrire en base la date du dernier import complet par fournisseur ;
- mandat CH (fiche fournisseur) : porter en base la date d'activation de la fraîcheur, aujourd'hui dans le code.

## 4. Miroir (§6.3)

Les deux versions lisent le même échantillon de 29 cas : disponibilité 0, 1, 2, 3, absente, hors liste ; tarif gelé, autre état, état absent ; pièce masquée, affichage inconnu ; prix nul, négatif, absent, non fini.

- Côté application : `vendable.miroir.test.ts`, joué par le jest du backend en CI. Un écart fait échouer la CI.
- Côté SQL : `check-vendable-mirror.py` produit un script `psql` qui crée une base jetable, applique la migration deux fois, joue les 29 cas, le retour arrière, la migration, le retour arrière. Sortie : `preuves/pg17-migration-miroir.out` (PostgreSQL 17.11, 2026-11-18T19:24:13Z, code de sortie 0).

L'étape CI du côté SQL n'est **pas** dans le diff : le hook du dépôt réserve `.github/workflows/ci.yml` à l'owner. Elle est livrée dans `ci-miroir-vendable.patch` (`git apply --check` passe sur la tête de la branche). Sa logique, témoin négatif compris, a été rejouée telle quelle sur le PostgreSQL jetable : `preuves/pg17-etape-ci-rejouee.out` (2026-11-18T19:52:50Z ; le témoin, qui retire la disponibilité 3, échoue sur 2 cas ; le miroir passe). Tant que ce patch n'est pas appliqué, un écart du côté SQL seul n'arrête pas la CI.

## 5. Générateur, garde-fou, bascule (§6.4 et §6.5)

Réglage : **`SITEMAP_R2_SOURCE`**, lu dans l'environnement seulement. Valeur par défaut : `legacy` (comportement actuel, inchangé). Toute valeur autre que `vendable` vaut `legacy`. Retour arrière : remettre `legacy`, ou retirer la variable.

En mode `vendable` :

1. gammes indexables par la règle actuelle (`getIndexGammeIds`), véhicules affichés, puis un appel de la fonction SQL par gamme et par fenêtre de 5 000 types. Sur délai dépassé (57014), la fenêtre est coupée en deux, jusqu'à 250 types ; toute autre erreur arrête la génération ;
2. ordre fixe : gamme croissante, puis type croissant. Deux générations sur les mêmes données donnent les mêmes fichiers ;
3. écriture dans un dossier d'attente non servi (`.attente-sitemap-pieces`) ;
4. garde-fou : comparaison aux fichiers `sitemap-pieces*.xml` en place. Si plus de 5 % des URL cliquées sur 28 jours en sortent, rien n'est publié, les fichiers précédents restent, l'orchestrateur rend `success = false` et le message donne le compte, les clics et les premières URL ;
5. publication par renommage seulement si tout a réussi. Aucune URL produite, Search Console vide ou illisible, fonction absente, gamme sans alias : arrêt sans publication.

`__sitemap_p_link` et `map_has_item` ne sont pas lus dans ce mode. Les robots des pages, les drapeaux `SEO_R2_*` et `robots.txt` ne sont pas touchés.

Limites connues :

- le mode `vendable` exige la migration appliquée ; sans elle il s'arrête sans publier ;
- sans sitemap précédent sur le disque, le garde-fou est sans objet (journalisé) ;
- la fenêtre de 28 jours finit à la dernière date présente en base ; aucune limite d'ancienneté n'a été inventée ;
- après un retour à `legacy`, les fichiers `sitemap-pieces-4.xml` à `-28.xml` restent sur le disque, hors de l'index ; leur retrait est proposé au §9 ;
- durée réelle de bout en bout non mesurée, la fonction n'existant pas en base (voir §6).

## 6. Performance

- Relevé complet des 123 gammes par le corps exact de la fonction, en `SELECT`, deux fils, du 2026-11-18T19:09:47Z au 19:28:56Z : 2 005 s de lecture cumulée, soit environ 33 min en séquence. Gamme la plus lourde : 208 s.
- Une fenêtre de la gamme 4 a dépassé le délai de 40 s fixé pour le relevé (plan sur mesure) ; la gamme a été relue en 100 fenêtres. C'est ce cas qui a motivé la coupe en deux sur 57014.
- En plan générique, celui d'une fonction : gamme 4 entière en 25,5 s ; fenêtre de 3 267 identifiants (1 500 types affichés lus, 1 015 retenus) en 2,3 s (`preuves/plan-generique.out`, 2026-11-18T19:31:07Z). Le délai de `service_role` est de 60 s.
- 738 appels par génération (123 gammes × 6 fenêtres).

Si la durée gêne, deux options, proposées seulement : un index couvrant `pieces_relation_type (rtp_pg_id, rtp_type_id) INCLUDE (rtp_piece_id)`, ou une vue matérialisée gamme × type rafraîchie après chaque import de tarifs. Aucune table figée.

## 7. Mesure (§6.6)

Heures UTC des lectures, le 2026-11-18 : couples gamme × type 19:09:47Z–19:28:56Z ; véhicules et gammes 19:20:29Z ; sitemap PROD (GET de l'index et des 3 fichiers publics) 19:20:42Z–19:20:43Z ; Search Console 19:20:51Z, fenêtre du 2026-10-19 au 2026-11-15. Requêtes : `preuves/requetes.sql`.

| Mesure | Valeur |
|---|---:|
| URL du sitemap actuel | 101 097 |
| URL selon la nouvelle règle | 1 373 594 |
| Communes | 101 053 |
| Entrées | 1 272 541 |
| Sorties (`sorties-44.txt`) | 44 |
| Clics 28 j des entrées | 640 (568 pages cliquées) |
| Clics 28 j des sorties | 0 (aucune des 44 n'apparaît dans Search Console) |
| Pages R2 cliquées sur 28 j | 834 (1 002 clics) |
| Pages cliquées couvertes, avant | 161, soit 19,30 % (214 clics, 21,36 %) |
| Pages cliquées couvertes, après | 729, soit 87,41 % (854 clics, 85,23 %) |

Les 44 sorties sont des couples sans aucune pièce vendable ; leur gamme est indexable et leur type affiché.

Les 105 pages cliquées qui restent hors du lot (148 clics) :

| Raison | Pages vues | Cliquées | Clics |
|---|---:|---:|---:|
| gamme hors de la règle d'indexabilité actuelle | 1 766 | 67 | 81 |
| gamme indexable, type affiché, aucune pièce vendable | 1 073 | 38 | 67 |
| couple vendable, URL de Google différente de l'URL canonique | 13 | 0 | 0 |
| **Total** | **2 852** | **105** | **148** |

### Recoupement avec le rapport CQ

Identiques : 101 097 URL au sitemap, 101 053 gardées, 44 sorties sans clic ; 21 141 pages R2 dans Search Console, 834 cliquées, 1 002 clics.

Écart : CQ compte 16 910 pages vendables hors sitemap (626 cliquées, 711 clics) ; ce mandat en fait entrer 15 500 (568, 640). La différence, 1 410 pages, 58 cliquées, 71 clics, est expliquée en entier :

- 1 397 pages (58 cliquées, 71 clics) portent une pièce vendable mais leur gamme n'est pas indexable selon la règle actuelle, que le mandat garde inchangée : 66 gammes à `pg_relfollow = '0'` et 2 gammes à `pg_display = '0'`. Vérifié par `SELECT` à 19:54:15Z (`preuves/gammes-hors-regle.out`) ;
- 13 pages sont des couples vendables que Google connaît sous une autre URL que la forme canonique.

De même, les 1 442 pages non vendables de CQ (47 cliquées, 77 clics) sont les 1 073 de la ligne 2 du tableau plus 369 pages de gammes hors règle (9 cliquées, 10 clics).

## 8. Génération à blanc et contrôles (§9)

La fonction n'étant pas en base, la génération à blanc fait tourner **le code réel du générateur** avec un accès aux données remplacé par les relevés ci-dessus (couples, véhicules, gammes, clics, sitemap PROD comme sitemap précédent), dans un dossier jetable, sans publication. Ce n'est pas un passage par PostgREST.

| Contrôle | Résultat |
|---|---|
| URL produites | 1 373 594, dans 28 fichiers (27 de 50 000, un de 23 594) |
| Doublons | 0 |
| Appels de la fonction | 738 |
| Garde-fou | 0 URL cliquée sur 161 sortirait (0,00 %, seuil 5 %) : publication |
| Durée, hors base | 16,6 s (2026-11-18T19:49:35Z) |
| Échantillon de 50 URL, une tous les 27 471 | 50 × `200`, 50 × `index, follow`, 50 canoniques identiques à l'URL, sur DEV de 19:51:25Z à 19:52:01Z |
| Pièces vendables de ces 50 couples | 50 couples avec au moins une pièce (minimum 1), `SELECT` à 19:51:21Z |
| Prix non finis dans `pieces_price` | 0 (`SELECT` à 19:52:07Z) |

Pièces : `preuves/generation-a-blanc.json`, `preuves/echantillon-50.txt`.

Autres vérifications : jest sur les 8 suites touchées, 173 tests verts ; typecheck du backend vert (`turbo typecheck --filter=@fafa/backend`) ; eslint sans erreur sur les fichiers TypeScript touchés ; squawk 2.52.1, 0 problème sur la migration ; marqueurs `@non_transactional`, compilation PL/pgSQL des blocs `DO`, couverture de la liste des RPC, surface DEFINER/anon : sans erreur.

## 9. Suite proposée (§6.7), un mandat chacun

1. **Panier** : faire lire `piece_est_vendable` à l'ajout et à la validation, à la place de la règle applicative seule. Zone commande : accord nominatif.
2. **Listes R2** : aligner `get_pieces_for_type_gamme_v3` (qui ne retient que la disponibilité `'1'`) et `get_listing_products_extended_filtered` sur `est_vendable`. À faire après le mandat CO, qui réécrit ces deux fonctions.
3. **Robots R2** : fonder le `noindex` des pages sur la même fonction, à la place de `isSellable` et des drapeaux `SEO_R2_*`. SEO indexé : accord nominatif.
4. **Autres lecteurs de `__sitemap_p_link`** : hubs de crawl, `generateByFamily`, `sitemap-unified.controller.ts`, `sitemap.config.ts`.
5. **Garde « aucun filtre `pri_dispo` écrit à la main »**, reprise de la PR #966.
6. **Fraîcheur en base** : les deux manques du §3, aux mandats AS et CH.
7. **Performance** : index couvrant ou vue matérialisée, si la durée réelle le demande.
8. **Fichiers résiduels** après un retour à `legacy`.
9. **Véhicules à réserve** : la décision du §1.

## 10. Constats hors périmètre, non corrigés

- En mode `legacy`, si le service des pièces échoue, l'index est régénéré sans les fichiers pièces.
- `getIndexGammeIds` rend un ensemble vide sur erreur de lecture ; le mode `vendable` s'arrête dans ce cas, le mode `legacy` continue.
- Lectures paginées de `__sitemap_p_link` et de `getTypeModelIndex` sans `ORDER BY`, arrêt silencieux sur erreur de page.
- La page R2 répond `index, follow` pour 16 443 types à `type_relfollow = '0'`, 283 types à modèle masqué et 60 à marque masquée.
- 318 types dont `type_marque_id_i` diffère de la marque de leur modèle (aucun parmi les couples vendables).
- `buildPieceUrl` passe `null` comme nom de type alors que le canonique du frontend se replie sur `type_name`.
- `rpc_allowlist.json` : le champ `total` vaut 185 pour 192 entrées ; il n'est contrôlé par rien et n'a pas été modifié.
- `database.types.ts` est en retard sur `auto_type`.
- Cron `seo-audit` en échec depuis le 2026-11-16 (« sitemap indisponible ») ; alerte `sync-dev-runtime`.
- Avertissement « collation version mismatch » à chaque connexion à la base.
- Un worktree neuf n'a pas les paquets internes construits : jest échoue sur `@repo/seo-roles` tant que le paquet n'est pas construit.
- La cohérence entre `pieces_relation_type.rtp_pg_id` et `pieces.piece_pg_id` n'a pas été mesurée.

## 11. Deux fichiers réservés à l'owner

Deux fichiers sont réservés à l'owner ; leurs changements sont livrés en patch, sans contournement.

| Patch | Fichier visé | État |
|---|---|---|
| `ci-miroir-vendable.patch` | `.github/workflows/ci.yml` | non appliqué : le miroir côté SQL n'est pas joué par la CI (§4) |
| `ownership-ct.patch` | `.spec/00-canon/repository-registry/ownership.yaml` | pas appliqué par l'agent ; l'owner l'applique en ouvrant la PR (commit « chore(ownership): couvrir la migration et le miroir « vendable » du mandat CT ») |

`ownership-ct.patch` pose le domaine D11, celui de `vendable.ts` : `@ak125` pour la migration, `@ak125/payments-team` pour l'échantillon et son test. Les trois globs sont exacts et insérés juste après l'entrée de `vendable.test.ts`, pas en fin de fichier, pour ne pas entrer en conflit avec les autres PR ouvertes.

Sans ces globs, la garde « Registry block-new gate » refuse les deux fichiers de migration et `vendable.echantillon.json`, et le ratchet de dérive de contrat signale `vendable.miroir.test.ts`. Dans le worktree de ce mandat, cette garde tourne aussi au push : la branche ne pouvait pas être poussée par l'agent sans l'exception `SKIP_REGISTRY_GATE`, qui n'a pas été utilisée. L'ouverture de la PR passe donc par un script lancé par l'owner (`open-pr-mandat-ct.sh`, rangé hors du dépôt avec ses autres outils) : contrôle de la tête relue, insertion de l'extrait, commit, régénération des projections, validations, push, PR en brouillon.

Ce script a été joué en mode essai, sans push ni PR, sur une copie jetable du worktree à la tête `7043ef5f8` (`preuves/essai-script-owner.out`) : garde block-new verte sur les 19 fichiers ajoutés, ratchet de dérive de contrat à 0 nouveau constat, `audit:cleanup-candidates:check`, `registry:validate-invariants` et `audit:inventory:check` verts. Le commit de documentation posé après cet essai ne change aucune projection : aucun fichier de ce dossier n'y figure.

Les projections (`audit/registry/*.json`, `REPO_MAP.md`, `audit/db-usage-map.json`, `audit/module-boundaries.json`, `audit/runtime-entrypoints.json`, `audit/cleanup/pr-8-*`) sont régénérées par leurs générateurs, pas éditées à la main. Le script les régénère de nouveau après le commit d'ownership.

La régénération signale un avertissement d'hygiène nouveau, non bloquant (`no-deep-module-access`, une violation de plus) : le générateur importe `evaluerGardeFou` depuis `modules/pricing/config/supplier-sale-rules.ts`, pour ne pas écrire une seconde fois la règle « arrêt strictement au-delà du seuil ». Le module pricing n'a pas de point d'entrée public et n'est pas modifié ici. Si l'owner préfère zéro dépendance du sitemap vers le module des prix, la comparaison tient en une ligne à recopier.

## 12. Actes réservés à Marwane

1. Lancer le script d'ouverture de la PR, ou le refuser. Le lancer vaut accord pour les trois globs d'ownership.
2. Appliquer `ci-miroir-vendable.patch` sur cette branche, ou le refuser.
3. Fusionner la PR.
4. Appliquer la migration par le workflow « Apply Supabase migrations (manual) ».
5. Trancher le §1, puis basculer `SITEMAP_R2_SOURCE` à `vendable`.
