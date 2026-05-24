# Cost allocation model — Phase B compta analytique

> **Statut** : modèle de répartition des coûts (Phase B Day-2..5).
> Valeurs initiales = estimations industrie en fallback (sensibilité ± 30 %)
> tant que le questionnaire owner [`cost-data-request.md`](./cost-data-request.md)
> n'est pas rempli. Après réponse owner : remplacer les valeurs estimées par
> les valeurs réelles, re-runner les scripts d'audit.
>
> Doctrine de référence : [`economic-governance-system.md`](./economic-governance-system.md).

## Objectif

Calculer le **coût total réel** d'une ligne de commande pour chaque bucket
de prix d'achat, afin de pouvoir déterminer le **seuil de rentabilité**
unitaire et identifier les buckets en perte structurelle.

Sans ce modèle, le « taux de marge % » apparent peut masquer une vente à
perte : une pièce à 1 € HT vendue à 1.65 € (65 % de marge) génère
0.65 € de marge brute — bien en-dessous du coût-fixe par commande estimé
à 3.50 €.

## Périmètre

- Allocation par ligne de commande (`___xtr_order_line`) et par bucket
  d'achat HT (6 buckets canon : 0-10 / 10-30 / 30-80 / 80-150 /
  150-300 / 300+ €).
- Période de référence : 12 derniers mois roulants.
- Granularité de seconde phase (Phase D) : par gamme × customer_type ×
  supplier (encodage via `pricing_rules.category_gamme_id`,
  `customer_type`, `supplier_pm_id`).

## 9 catégories de coûts

| # | Catégorie | Driver d'allocation | Source data | Estimation fallback |
|---|-----------|---------------------|-------------|---------------------|
| 1 | **Direct variable (COGS)** | par ligne | `pieces_price.pri_achat_ht × qty` | **mesuré directement** — pas d'estimation |
| 2 | **Picking** | par ligne | logs WMS si existe, sinon estim industrie | 0.40 – 0.80 €/ligne (pondération gamme à venir) |
| 3 | **Packing** | par commande | logs WMS si existe, sinon estim | 0.30 – 0.50 €/commande |
| 4 | **Expédition** | par commande (palier poids) | facture transporteur agrégée | 3.00 – 8.00 € amorti / commande |
| 5 | **Frais paiement** | par commande | Paybox/SystemPay fee schedule | 1.2 – 1.8 % du TTC + 0.10 € fixe |
| 6 | **Support client** | par ligne (pondéré retour) | tickets/ligne ratio | 0.20 – 0.50 €/ligne |
| 7 | **Retours/annulations** | par ligne (pondéré gamme) | `___xtr_order_line` status events | 2.00 – 6.00 €/ligne retournée |
| 8 | **Fixe alloué** | par revenu | compta générale annuelle ÷ revenu annuel | 8 – 15 % du revenue (ratio à mesurer) |
| 9 | **Capital immobilisé** | par SKU (jours stock × coût capital) | `pieces` qty stock + `___xtr_order_line` ventes 12 mois | coût du capital 4 – 8 %/an pondéré par durée stock |

Les valeurs fallback sont volontairement larges (sensibilité ± 30 %) :
elles suffisent à identifier les buckets **manifestement** en perte
unitaire, mais pas à trancher les cas borderline (qui exigeront les
vraies données owner).

## Coefficients d'ajustement (à compléter Phase B)

Le seed `pricing_rules` accepte déjà 3 dimensions de segmentation
(`category_gamme_id`, `customer_type`, `supplier_pm_id`) qui hébergeront
les coefficients suivants — à mesurer sur 12 mois historiques avant
toute mutation de grille (Phase D) :

- `picking_coef_per_gamme` — pondère le coût picking par gamme (gros
  pneus vs petites vis). Tabulé dans une table d'accompagnement, pas
  dans `pricing_rules`.
- `return_coef_per_gamme` — pondère le coût retour (gamme électronique
  > gamme consommable).
- `payment_coef_per_customer_type` — B2C ≠ PRO (PRO = virement, frais
  plus bas).
- `supplier_oos_coef` — pondère la variance de rupture fournisseur
  (variable critique du `pricing_priority_weights`).

Les coefficients **ne remplacent pas** la grille de marge ; ils ajustent
le `min_margin_amount_cents` effectif (floor cost) par combinaison
bucket × gamme × customer_type.

## Score additionnel : `inventory_pressure_score` par SKU

Calcul :

```
days_of_stock(sku) = qty_in_stock(sku) / (sales_last_12mo(sku) / 365)
cost_of_capital_daily = annual_cost_of_capital / 365
inventory_pressure_score(sku) = days_of_stock × cost_of_capital_daily × pri_achat_ht
```

Avec `annual_cost_of_capital` ∈ [0.04, 0.08] selon contexte financier
(fallback 0.06 = 6 %).

Interprétation :

- Score < 5 € : pièce qui tourne, capital sain.
- Score 5 – 20 € : pression modérée, surveiller.
- Score > 20 € : capital lourdement immobilisé — la marge apparente
  peut masquer une destruction de cash-flow.

Conséquence pour la grille : SKUs avec `inventory_pressure_score` haut
**ne doivent pas être prioritairement promus** (cannibaliseraient cash),
voire **déstockés** à marge réduite. À traiter dans Phase D si signal
matériel, pas dans la grille de base.

## Formule de seuil de rentabilité par bucket

```
fixed_overhead_per_line(bucket) =
    picking_cost(bucket)
  + packing_cost / orders_per_line(bucket)
  + shipping_cost / orders_per_line(bucket)
  + payment_fee_avg(bucket)
  + support_cost(bucket)
  + return_cost(bucket) × return_rate(bucket)
  + fixed_allocated_per_line(bucket)

break_even_price_per_unit(bucket) =
    pri_achat_ht_median(bucket) + fixed_overhead_per_line(bucket)

break_even_margin_pct(bucket) =
    (break_even_price - pri_achat_ht_median) / pri_achat_ht_median
    × 100

safety_margin(bucket) =
    applied_margin_pct(bucket) - break_even_margin_pct(bucket)
```

Verdict par bucket :

- `safety_margin > 0` : profitable, marge de sécurité = X points.
- `safety_margin ≤ 0` : **perte unitaire** — flag rouge, fast-track
  correction via PR V1.5 ajustant `min_margin_amount_cents` (jamais le
  taux % pour préserver la forme de courbe).

## Procédure d'exécution (Phase B Day-2..5)

1. Exécuter [`scripts/audit/pricing-break-even.sql`](../../scripts/audit/pricing-break-even.sql)
   avec les estimations fallback. Output : `audit/registry/pricing-break-even.json`.
2. Lire le rapport généré `docs/pricing/break-even-by-bucket.md` (à produire).
3. Pour chaque bucket, appliquer le `decision_closure_protocol`
   (`KEEP` / `MODIFY` / `REMOWE` / `STOP` / `DEFER WITH EXPIRATION`) — cf.
   doctrine.
4. Si un bucket sort en perte unitaire **manifeste** (vrai même avec ± 30 %
   de sensibilité sur le fallback) : PR fast-track V1.5 immédiate.
5. Sinon : attendre la réponse owner sur [`cost-data-request.md`](./cost-data-request.md)
   avant de trancher les cas borderline.

## Prochaines étapes post-réponse owner

1. Remplacer les valeurs fallback du tableau ci-dessus par les valeurs
   réelles fournies par le questionnaire owner.
2. Re-runner `pricing-break-even.sql`.
3. Mettre à jour `break-even-by-bucket.md` avec les verdicts revus.
4. Décider Phase D (si signal mature) ou STOP (si grille déjà optimale).
