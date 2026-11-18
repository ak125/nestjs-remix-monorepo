# Mandat CT — ce qui est réutilisé (§6.1)

Lu sur `origin/main` `06c380173443`, le 2026-11-18.

## Repris tel quel

| Existant | Usage dans ce mandat |
|---|---|
| `backend/src/database/services/vendable.ts` (`estVendable`) | Reste la version applicative. Ses quatre entrées (disponibilité, état du tarif, prix TTC, pièce affichée) sont les quatre paramètres de `public.est_vendable`. Fichier non modifié. |
| `piece-price-data.service.ts` | Règle d'agrégation reprise : une pièce est vendable si au moins une de ses lignes de tarif l'est (`public.piece_est_vendable`). |
| `SitemapV10Service.generateAll()` (étape 9) | Orchestrateur conservé : même boucle, même index, même calcul de `success`. Seul le choix de la source des URL gamme × véhicule est ajouté. |
| `SitemapV10XmlService.writeStaticSitemapFile` | Écriture des fichiers XML, tranches de 50 000, sans changement. |
| `buildPieceUrl` et `pieceShardUrls` (`sitemap-v10-pieces.service.ts`) | Construction des URL partagée par les deux sources : sorties de la classe sans changement de comportement, pour que les URL communes restent identiques octet pour octet (aucune URL modifiée). |
| `SitemapV10DataService.getIndexGammeIds()` | Règle actuelle de la gamme indexable (`pg_display = '1'` et `pg_relfollow = '1'`), inchangée. |
| `evaluerGardeFou` (`pricing/config/supplier-sale-rules.ts`) | Même calcul de seuil que le garde-fou des tarifs (décision 51) : part des sorties, arrêt si elle dépasse 5 %. Importé, fichier non modifié. |
| `FeatureFlagsService` | Porte le réglage de bascule `SITEMAP_R2_SOURCE` (lecture de l'environnement seule). |
| Porte RPC (`callRpc`, `rpc_allowlist.json`) | Appel de la fonction SQL par la voie gouvernée ; une entrée ajoutée à la liste. |
| Job CI « Migration Safety » (PostgreSQL 17 éphémère) | Sert au miroir SQL : même service, même appel `psql`. Étape livrée en patch (fichier réservé à l'owner). |
| `__seo_gsc_daily_page_totals` | Clics Search Console en base, pour le garde-fou. |

## PR #966 (brouillon du 2026-06-13, tête `fada69a748c6`, jamais fusionnée)

Reprise :

- l'idée d'une fonction SQL `STABLE` qui lit les sources et dit si une pièce est vendable (`is_piece_sellable` là-bas, `piece_est_vendable` ici) ;
- l'agrégation par `bool_or` sur les lignes de tarif ;
- le principe « pas de repli silencieux » : le générateur s'arrête au lieu de publier un lot partiel.

Dépassée :

- son prédicat (`pri_dispo IN ('1','2','3') AND pri_vente_ttc_n > 0 AND piece_display`) ignore l'état `FROZEN`, ajouté par la décision 118 ;
- sa table `__catalog_sellable_candidates` et sa table d'état `ready` sont des tables figées à rafraîchir : le mandat les écarte (« sans table figée ») ;
- son `SellabilityTruthService` ferait une seconde version applicative à côté de `vendable.ts`, arrivé depuis ;
- sa chaîne d'affichage type → modèle → marque (`catalog_active`) n'est pas dans les décisions 48 et 118. Elle rejoint le point de décision signalé en tête du rapport.

À reprendre dans un mandat suivant, pas ici : sa garde « aucun filtre `pri_dispo` écrit à la main » (règle ast-grep et `check-dispo-canon.sh`). La PR #966 peut être fermée une fois ce mandat fusionné ; cet acte revient à Marwane.

## Procédure de chargement des tarifs (`docs/supplier-brand-price-load-procedure.md`)

Rien n'est repris en code. Elle confirme deux faits utilisés ici : la sortie de vente d'une pièce passe par `pri_dispo = '0'`, et l'activation de la fraîcheur par fournisseur vit dans `supplier-sale-rules.ts` (`premiereMajCompleteLe`, `null` pour tous les fournisseurs à ce jour).

## Sitemap v10 actuel

- `sitemap-v10-pieces.service.ts` lit `__sitemap_p_link` avec le seuil `map_has_item` : laissé en place comme source `legacy`, valeur par défaut.
- `sitemap.config.ts` et `.github/workflows/sitemap-daily-regen.yml` : non modifiés. Le cron de 03:00 UTC déclenche la même génération ; il ne choisit pas la source.
