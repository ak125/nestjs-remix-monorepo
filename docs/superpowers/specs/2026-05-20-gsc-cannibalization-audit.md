# GSC Cannibalization Audit — rapport cluster-first (run réel 2026-05-20)

**Source** : signal Google réel (`__seo_gsc_daily`, 28j) — pas de similarité de contenu, pas de crawl
**Clusters cannibalisés** : 286 · **Pages analysées** : 662
**Recommandations** : stockées dans `__seo_cannibalization_recommendations` (100% `status='proposed'`)

> Reproduction : `npx ts-node scripts/audit/render-cannibalization-report.ts`

## Pivot diagnostic (vs hypothèse initiale)

L'hypothèse de départ était un duplicate **R8↔R2**. Le signal Google réel le contredit :

| Pattern de cannibalisation | Clusters | Part |
|---|---|---|
| **intra-R2** (pages /pieces/ entre elles) | **241** | **84%** |
| intra-R8 (/constructeurs/ sœurs) | 43 | 15% |
| R8↔R2 (inter-rôles) | 2 | <1% |

➡️ **Le vrai coupable est l'auto-cannibalisation R2** (pages produit/gamme se disputant les mêmes requêtes), PAS le duplicate R8↔R2. Données pilotes confirmant le contexte : `__seo_r8_pages`=155 (154 noindex), `__seo_r2_pages`=0 — ces tables de génération v2 ne sont pas les pages live indexées.

## Distribution des actions recommandées

| Action | Nb pages | Lecture |
|---|---|---|
| keep (HIGH) | 286 | winners de cluster — page de référence |
| differentiate (MEDIUM) | 180 | page proche du winner, à différencier |
| **canonical_candidate (HIGH)** | **142** | loser profond + 0 clic → canonical vers winner |
| noindex_candidate (MEDIUM) | 31 | quasi invisible → candidate noindex (manuel) |
| keep (LOW) | 20 | signaux contradictoires → investiguer |
| differentiate (LOW) | 3 | a ses propres clics |

**Actionnable haute confiance** : 142 canonical_candidate + 31 noindex_candidate = **173 pages** clairement en cannibalisation, recommandées pour consolidation.

## Exemples de clusters réels (requêtes produit)

| Requête | Pattern | Pages | Winner pos | Reco dominante |
|---|---|---|---|---|
| support moteur 207 | intra_r2 | 5 | 15.8 | 4× canonical_candidate |
| embrayage zx | intra_r2 | 5 | 43.0 | 4× canonical_candidate |
| vanne egr 308 1.6 hdi 110 | intra_r2 | 4 | 48.3 | 3× canonical_candidate |
| embrayage saxo 1.5d | r8_vs_r2 | 4 | 29.0 | 3× canonical_candidate |
| vanne egr laguna 2 | intra_r2 | 4 | 47.0 | 2× canonical + 1 diff |
| poulie vilebrequin 1.9 dci | intra_r2 | 5 | 1.0 | 4× differentiate |

Toutes ces requêtes : **0 clic** malgré des impressions — signal clair que la dispersion entre pages dilue le ranking.

## Cause STRUCTURELLE (root-cause, pas symptôme)

Analyse des URLs en concurrence : pattern `/pieces/{gamme}/{marque}/{modèle}/{motorisation}.html`. Les pages produit existent au niveau **motorisation** (type_id), mais les utilisateurs cherchent au niveau **modèle** (« support moteur 207 », pas « support moteur 207 1.6 hdi »). Google voit donc N pages motorisation quasi-identiques matcher la requête modèle → cannibalisation.

| Forme du cluster | Clusters | Pages | Fix structurel |
|---|---|---|---|
| **same_model_diff_motor** (même gamme × même modèle, motorisations ≠) | 117 (48%) | 245 | canonical motorisation → page niveau-modèle |
| same_gamme_diff_model (même gamme, modèles/générations ≠) | 104 (43%) | 271 | examiner : générations distinctes (garder) vs doublons |
| diff_gamme (gammes ≠) | 22 (9%) | 51 | ambiguïté requête, souvent garder |

Exemple `support moteur 207` : 5 URLs `support-moteur-247/peugeot-128/207-128018/{1-4-16v, 1-6-hdi×4}` → même gamme, même modèle 207, 5 motorisations.

➡️ **Le bon fix n'est PAS 142 canonicals ad-hoc, mais UNE règle structurelle** : pour les 117 clusters `same_model_diff_motor`, les pages motorisation devraient déclarer un canonical vers la page niveau-modèle (si le contenu ne varie pas matériellement par motorisation). À valider + appliquer manuellement (règle, pas page par page).

## ⚠️ Aucune action appliquée

Toutes les recommandations sont `status='proposed'`. **Révision humaine obligatoire** avant tout changement canonical/noindex (gardes `feedback_no_url_changes_ever`, `feedback_no_auto_page_suppression_ever`). L'application des canonical/noindex est une étape SÉPARÉE, approuvée page par page (ou batch validé).

## Recommandation orientation

1. **Prioriser les 142 canonical_candidate HIGH** : consolider les losers vers leur winner sur les requêtes produit cannibalisées. Réversible, faible risque.
2. **Cibler le pattern intra-R2** (84% du problème) : comprendre POURQUOI plusieurs pages /pieces/ rankent sur la même requête produit (variantes véhicule ? pages quasi-doublons ?).
3. Le duplicate R8↔R2 et intra-R8 sont secondaires (16% combiné) — traiter après l'intra-R2.
4. Lien avec verdict `conversion_funnel` (0.17%) : la cannibalisation dilue le peu de trafic restant ; consolider peut améliorer position ET conversion.

---
_Étape suivante = révision humaine des recommandations dans `__seo_cannibalization_recommendations`, puis application manuelle approuvée._
