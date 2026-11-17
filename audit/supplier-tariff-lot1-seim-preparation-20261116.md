# Premier lot de mise à jour de tarif : SEIM (préparé, non lancé)

Mandat AS, périmètre 6 (décision 51, amendée par la décision 118). Relevé du
2026-11-16, simulation rejouée le 2026-11-17 sous la décision 118, base DEV partagée,
**lecture seule** : aucune écriture en base, aucun appel aux routes d'import
(le dry-run d'import persiste un lot RAW, il revient donc à Marwane).

## 1. Choix du lot

| | SEIM (retenu) | SASIC (alternative) |
|---|---|---|
| Marque `pm_id` | 4200 | 4120 |
| Fichier Golda complet | `/opt/automecanik/data/tecdoc/golda/seim/2026-11-01/complet/extrait/Seivccpt_20261013_20261101.csv` | `…/sasic/2026-10-23/complet/extrait/Sasvccpt_20260922_20261023.csv` |
| Précédent gouverné | import juin 2026 (lots `cab4db4d…`, puis activations 4200 du 11 et 13 juin) | aucun |
| Codes remise Golda = base | 7 815/7 815 (FORMAT.md §4) | non comparé |

Raisons : SEIM a déjà un chemin d'import prouvé (flux DCA de juin), des codes
remise identiques à la base et un fichier Golda postérieur de 15 jours au
précédent. SASIC n'a ni précédent ni comparaison.

## 2. Fichier, analysé localement (sans base)

- sha256 : `06467e2f6b0a4ba9d59f3a7268c8e7b8cabdff304c56429419ad1dfca5a6dbdf`
- `parseGoldaTariffCsv` (backend/src/modules/pricing/services/golda-tariff-parse.ts) :
  9 016 lignes, 9 016 acceptées, 0 refusée ; type de prix **AP seul** (8 868 ; brut) ;
  statuts : 8 840 inchangées, 28 NOU, 148 SUP ; cycle de vie : 8 512 actives,
  356 fin de vie, 148 retirées ; aucun conditionnement > 1, aucune consigne.

## 3. Simulation (rapprochement fichier ↔ `pieces_price`, SELECT seul)

Clé : référence en majuscules sans espace (`pri_ref`, sinon `piece_ref`) ;
vendable = définition unique (décision 118 : `pri_dispo` '1', '2' ou '3', ni
FROZEN ni masquée, prix > 0). Sortie projetée = vendable absente du tarif ou `SUP`.

| `pri_frs` | lignes | vendables | dans le tarif | vendables absentes | vendables SUP | vendables fin de vie | sorties projetées |
|---|---|---|---|---|---|---|---|
| CAL | 5 522 | 5 422 | 5 510 | 12 | 98 | 134 | 2,03 % |
| NED | 2 314 | 2 236 | 2 305 | 7 | 28 | 187 | 1,57 % |
| (vide) | 28 | 20 | 25 | 3 | 0 | 0 | 15 % |
| **Marque 4200** | 7 864 | **7 678** | 7 840 | 22 | 126 | 321 | **148 = 1,93 %** |

Sous l'ancienne règle (dispo '1' seul, décision 51 initiale) : 7 663 vendables,
147 sorties = 1,92 %. La décision 118 ajoute 15 lignes vendables (dispo '2' ou
'3') et une sortie projetée.

- 1 161 références actives du tarif n'ont aucune ligne en base : candidates à
  création, hors de ce lot (création de pièce = autre chantier).
- Garde-fou 5 % (par marque) : **ne s'arrêterait pas** (1,93 %).
- Fraîcheur : CAL et NED sont à `null` dans `FRAICHEUR_PAR_FOURNISSEUR` ; un
  retrait motif `DISCONTINUED_TARIFF` est donc aujourd'hui **alerte seulement**,
  aucune ligne ne sort. Les 126 `SUP` relèvent de `CONFIRMED_OUT` seulement si
  Marwane le décide sur preuve (le statut SUP Golda est un retrait fabricant).

## 4. Ce qui bloque l'import réel (à trancher avant le dry-run)

1. **Prix d'achat.** Golda SEIM ne publie que le brut (AP). Le prix d'achat =
   brut × (1 − remise du code) exige la table de remises du fournisseur, absente
   de Golda (le fichier `codes_remises_et_sous_familles_seim_akwel.xls` est en
   BIFF, non convertible sur le serveur). 2 542 lignes sont en net direct depuis
   juin : seul le net du portail les recalcule (FORMAT.md §4).
2. **Fournisseur.** Le seul profil `supplier_price_profiles` est celui de DCA
   (id 1, `supplier_id` 71, `DIRECT_NET`, colonnes `ref`/`ean`/`achat_ht`). Les
   lignes SEIM portent `pri_frs` CAL et NED. Il faut dire quel fournisseur vend
   SEIM et, si ce n'est pas DCA, créer son profil (écriture en base : Marwane).
3. **Conversion.** Aucune route ne transforme un CSV Golda en `fileRows`
   d'`ImportRequest`. Pour un flux DCA (précédent de juin), le fichier du portail
   donne directement `ref`, `ean`, `achat_ht`.

Recommandation : lot 1 = **flux net du portail DCA pour SEIM** (même chemin
qu'en juin), le fichier Golda servant de contrôle (brut, statuts SUP, absents).

## 5. Gestes de Marwane (machine DEV, interface admin ou API authentifiée niveau admin)

1. Décider le fournisseur de SEIM (DCA par précédent, ou CAL/NED) ; si autre
   que DCA, créer son profil.
2. Déposer le flux net du portail (`ref;ean;achat_ht`) et lancer la simulation :

   ```http
   POST /api/admin/pricing/import/dry-run
   { "supplierId": "71", "brandPmId": "4200",
     "sourceFile": "dca-seim-202611-feed.csv",
     "fileRows": [ { "ref": "…", "ean": "…", "achat_ht": "…" } ],
     "operator": "marwane" }
   ```

   `activate` absent = `false` : les lignes nouvelles restent en attente
   (`pri_dispo` '0').
3. Lire le verdict (gardes `DELTA_EXCEEDS_MAX`, `VENTE_BELOW_ACHAT`, refus).
4. Sur GO seulement : `POST /api/admin/pricing/import/commit` (même corps + `batchId`).
5. Puis, sur GO : activation (`activate/dry-run` puis `activate/commit`), et
   retraits par `POST /api/admin/pricing/deactivate/dry-run` puis
   `deactivate/commit` avec `confirm: true`.
6. Après la première mise à jour complète validée : renseigner
   `premiereMajCompleteLe` du fournisseur dans
   `backend/src/modules/pricing/config/supplier-sale-rules.ts` par PR revue.
7. Rapport : `psql "$DATABASE_URL" -v batch_id=<uuid> -f scripts/audit/supplier-sale-report.sql`.

## 6. Limites

- Le rapprochement n'est pas le dry-run d'import : pas de calcul de prix, pas de
  garde de delta ni de marge.
- La clé normalisée ne gère pas les séparateurs (FORMAT.md §5 : plusieurs
  candidats = AMBIGU) ; les chiffres d'absence peuvent être un peu surestimés.
- Aucune donnée client ; aucune référence listée ici.
