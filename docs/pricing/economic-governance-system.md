# Economic Governance System — Doctrine pricing AutoMecanik

> **Statut** : canon doctrinaire référençable (extrait du plan de session
> `utiliser-superpower-pour-mettre-mellow-hickey.md` lors de la session
> 2026-05-23).
> Source de vérité opérationnelle : ce document. Toute ADR vault
> pricing future devra référencer cette doctrine.

## 1. Cadre conceptuel — pas un « Pricing Engine »

Le système construit ici **n'est pas un pricing engine** au sens
classique. Le pricing en est la conséquence, pas l'objet. Le vrai
objet est :

> Un **Economic Governance System** qui protège la rentabilité, le
> cash-flow, et la maîtrise des risques opérationnels — en arbitrant
> des compromis avec auditabilité et réversibilité.

Conséquences directes sur la conception :

- Le système doit rester **compréhensible humainement** à tout
  moment (un opérateur doit pouvoir lire et auditer les règles
  actives en ≤ 15 minutes). C'est la propriété la plus importante à
  long terme.
- Les outputs ne sont **pas seulement des prix** : ce sont aussi des
  alertes (rupture seuil rentabilité, dérive concurrentielle, cash
  bloqué, instabilité), des décisions humaines proposées (déstocker,
  renégocier), et des refus explicites (« ne pas vendre à perte
  silencieuse »).
- L'auto-décision est l'exception, l'aide à la décision humaine est
  la règle.

## 2. Propriété première (non-négociable)

> **Garder le système compréhensible humainement.**

C'est la propriété la plus précieuse du système entier — plus
importante que la précision des prix, la sophistication des règles,
ou l'optimalité économique théorique. Toute évolution qui sacrifie
cette propriété sans gain empirique majeur **doit être rejetée**,
quel que soit son apport apparent. Un opérateur qui ne comprend
plus son système pricing en perd le contrôle, et un système
hors-contrôle finit toujours par produire des dégâts plus grands
que les gains qu'il a optimisés.

Philosophie finale : **simple au cœur, mesuré autour, strictement
gouverné, lent à modifier.**

## 3. Anti-patterns interdits

Les approches suivantes sont **explicitement hors-scope** et ne
seront jamais introduites sans ADR vault préalable contradictoire :

- **Dynamic pricing** (ajustement prix automatique haute fréquence)
- **AI / Machine Learning pricing** (modèle opaque, audit impossible)
- **Competitor auto-repricing** (suivre les concurrents à la seconde)
- **Auto-adjustment** sans signoff humain
- **Dark patterns** (price anchoring trompeur, prix de référence
  artificiel, urgence simulée)

Raison structurante : la majorité des commerces n'en a jamais besoin,
ces approches détruisent la compréhensibilité humaine, et leurs
gains prouvés statistiquement sont marginaux face à la dette
opérationnelle qu'ils créent.

## 4. Fonction objectif (3 contraintes)

L'objectif business est **équilibrer la rentabilité à petit prix sans
dépasser la concurrence**. Traduit en fonction objectif par SKU :

```
applied_price(sku) = MAX(
    cost(sku) + fixed_overhead,                  // ① jamais à perte
    MIN(
        cost(sku) * (1 + margin_rate_bucket),    // ② cible marge (grille)
        competitor_ceiling(sku)                  // ③ jamais > concurrence
    )
)
```

Trois contraintes, deux objectifs :

- **Objectif a (rentabilité)** : sur les petits prix où la
  concurrence est absente ou plus chère, on encaisse pleinement la
  marge bucket (contrainte ② active, ③ inactive).
- **Objectif b (compétitivité)** : sur les prix moyens/élevés où la
  concurrence est intense, on plafonne au market_ceiling (contrainte
  ③ active, ② inactive).
- **Garde-fou ①** : si `competitor_ceiling < cost + fixed_overhead`,
  alors **on ne vend pas / on renégocie l'achat** — un troisième
  sortie doit exister dans l'engine (`unprofitable_flag`), pas une
  vente à perte silencieuse.

## 5. Hiérarchie des variables (`pricing_priority_weights`)

Toutes les variables n'ont pas le même poids économique. Hiérarchie
canon proposée (à valider Phase B avec données réelles) :

| Variable | Poids | Justification |
|----------|-------|---------------|
| Marge nette réelle (post-allocation Phase B) | **critique** | sans rentabilité, rien d'autre n'a d'importance |
| Cash immobilisé / inventory pressure | **critique** | une exploitation insolvable s'arrête, même profitable au P&L |
| Rupture fournisseur (variance OOS) | **critique** | un SKU rentable mais en rupture chronique = revenue zéro |
| Concurrence (GMC, spot-check) | moyenne | signal bruité, jamais autorité |
| SAV / taux retour | moyenne | impacte la marge nette via Phase B.1 |
| Benchmark GMC `lost_impressions` | faible à moyenne | indicateur indirect, sensible aux algos Google |
| Micro-écart prix (delta < 2 %) | faible | bruit dans la majorité des cas |

Conséquence : un signal de catégorie « moyenne » ne peut pas
déclencher une modification de grille seul. Il doit être confirmé
par un signal « critique » ou cumulé avec d'autres signaux
« moyens ».

## 6. Quatre garde-fous structurels permanents

Quatre métriques à intégrer dès Phase B et à conserver en monitoring
permanent (jamais sacrifiables).

### 6.1 `maximum_effective_complexity` — borne dure

Plafond du nombre de règles actives + profondeur de segmentation,
pour préserver la compréhensibilité humaine.

Valeurs cibles initiales :

- Nombre de règles actives `pricing_rules WHERE active = true` : ≤ 200
- Nombre d'overrides actifs (`category_gamme_id` ou `supplier_pm_id`
  non-NULL) : ≤ 50
- Profondeur max segmentation (combinaisons bucket × gamme ×
  supplier × customer_type) : ≤ 4 niveaux simultanés
- Détecteur de fragmentation : alerte si > 30 % des règles ont
  `n_orders_last_30d < 10` (règles inutilisées = bruit)

Implémentation : test CI `tests/pricing-complexity-cap.test.ts`
exécutant ces 4 checks sur le snapshot DB courant. Bloque la PR si
dépassement, force une simplification + ADR justifiant.

### 6.2 `pricing_stability_score` — volatilité contrôlée

Un moteur qui change trop les prix trop souvent détruit la confiance
client, complique le SAV, génère des écarts Google Merchant, et
fragmente le catalogue.

Calcul :

```
stability_score(sku, period) = 1 - (n_price_changes_in_period / n_days_in_period)
catalog_stability_index = MEAN(stability_score) ON active SKUs
```

Métriques associées :

- `n_price_changes_per_sku_per_month` (cible < 1, alerte > 3)
- `mean_absolute_price_change_pct` (cible < 5 %, alerte > 15 %)
- `variance_per_gamme` (alerte si gamme tourne en yo-yo)
- `variance_per_supplier` (alerte si fournisseur déclenche cascades)

Sortie : `audit/registry/pricing-stability.json` (canonical
projection) + alerte dans `rpc_*_alerts_v1` si seuil dépassé.

### 6.3 `governance_overhead_score` — coût de la gouvernance

Chaque ADR, audit, scorecard, sentinel, override, JSON registry a
un coût humain (lecture, maintenance, mise à jour, conflits, dérive).
Sans plafond, le système peut devenir « économiquement optimal mais
impossible à exploiter ». Donc on mesure le coût de la gouvernance
elle-même.

Calcul :

```
governance_overhead_score = SUM(
  n_active_rules                      // règles pricing actives
  + n_active_adrs_pricing             // ADR vault en vigueur sur pricing
  + n_audit_reports_last_quarter      // rapports générés sur 90 j
  + n_sentinels_active                // sentinels en exécution
  + n_overrides_active                // overrides gamme/supplier/customer
  + n_unresolved_alerts               // alertes pendantes
)
```

Seuils initiaux :

- `< 20` : système léger, sain
- `20–50` : système actif, surveiller
- `50–100` : zone d'alerte, simplification recommandée
- `> 100` : système ingouvernable, simplification obligatoire

Interaction avec `maximum_effective_complexity` : ce dernier compte
les règles, `governance_overhead_score` compte tout l'écosystème de
gouvernance. Les deux doivent rester bornés simultanément.

Principe directeur : si le coût annuel humain de la gouvernance
pricing dépasse 5 % de la marge brute additionnelle attribuable au
système, **la gouvernance est trop lourde** et doit être simplifiée.

### 6.4 `pricing_priority_weights` — hiérarchie active

Voir section 5. Encoder la hiérarchie dans une table gouvernée
(ADR-080+ Phase D) pour la rendre éditable sous traçabilité.

## 7. Decision closure protocol

Risque : « musée analytique » + fragmentation des phases sans
clôture. Chaque livrable d'audit (Phase B, C ou D) **DOIT** se
terminer par un verdict explicite parmi cinq options canoniques :

| Verdict | Signification | Suite |
|---------|---------------|-------|
| **KEEP** | l'état actuel est validé empiriquement | aucune action, archive |
| **MODIFY** | un changement est justifié et chiffré | PR Phase D + ADR vault |
| **REMOVE** | une règle/métrique/sentinel est devenu inutile | suppression gouvernée |
| **STOP** | l'investigation s'arrête, hypothèse invalidée | archive + note décision |
| **DEFER WITH EXPIRATION** | report explicite avec date butoir | TODO daté ≤ 6 mois |

Pas de sortie « ouverte » ou « en cours indéfiniment ». Un audit
sans verdict d'ici 30 jours après livraison est traité comme
**STOP par défaut**.

Trigger d'alerte : > 90 jours sans décision documentée
post-livraison d'un audit, OU verdict `DEFER` qui expire sans
conversion en KEEP/MODIFY/REMOVE.

## 8. Quatre risques structurels résiduels

À surveiller en permanence, même après livraison Phases A/B/C/D.

### 8.1 Explosion de complexité granulaire

- Symptôme : 20 000 règles, audit humain impossible, fragmentation
  de la base, « monstre invisible » accumulé malgré les garde-fous
  unitaires.
- Garde : `maximum_effective_complexity` (test CI bloquant).
- Trigger d'alerte : > 80 % du plafond atteint sur un trimestre.
- Action : ADR de simplification (consolidation de règles
  similaires, suppression des règles inutilisées).

### 8.2 Système trop analytique, pas assez décisionnel (« musée analytique »)

- Symptôme : phases B/C livrent des rapports, mais aucune décision
  n'est prise. Le système devient un musée de chiffres.
- Garde : `decision_closure_protocol` (section 7).
- Trigger d'alerte : > 90 jours sans décision documentée
  post-livraison d'un audit.
- Action : rétrospective + simplification du processus de décision.

### 8.3 Dérive documentaire / sur-gouvernance

- Symptôme : ADR, audits, scorecards, sentinels, projections, JSON
  registry, reports, simulations s'accumulent au point que le coût
  humain de gouverner le système dépasse la marge brute
  additionnelle qu'il génère.
- Garde : `governance_overhead_score` (section 6.3).
- Trigger d'alerte : coût annuel humain de la gouvernance pricing
  > 5 % de la marge brute additionnelle attribuable.
- Action : ADR de simplification, suppression de signaux peu
  utilisés, consolidation de rapports, désactivation de sentinels
  redondants.

### 8.4 Inflation des métriques elles-mêmes

- Symptôme : `priority_weights`, `stability_score`,
  `governance_overhead_score`, `complexity_cap`, sentinels, balance
  metrics, profitability metrics — chaque nouvelle question génère
  une nouvelle métrique, et le monitoring finit par remplacer
  l'action réelle. Système qui mesure tout, décide de rien.
- Garde structurel : **toute nouvelle métrique introduite doit être
  accompagnée de son critère de retrait** (à quoi reconnaît-on
  qu'elle n'est plus utile ?).
- Remédiation future : introduction éventuelle d'une
  `metric_retirement_policy` quand le système aura matürit, avec
  règles canoniques : `last_used_for_decision_date`,
  `n_decisions_influenced`, archivage automatique des sentinels
  dormants, fusion des scorecards redondants.
- Critère d'activation de la policy : ≥ 12 mois post-Phase B avec
  traces de décisions, OU `governance_overhead_score` > 50 stable.

## 9. Verdict tranché sur la grille pricing legacy (xls + DB)

La grille xls FINALE (542 lignes × 1 €, plafond 25 % à ≥ 500 €) est
**structurellement saine** :

| Aspect | Verdict | Raison |
|--------|---------|--------|
| Forme de la courbe décroissante | correct, ne pas rectifier | industry-standard (Oscaro, MisterAuto, Yakarouler) |
| Valeurs par bucket | valides V1, ajustables Phase D | preuve manquante avant Phase B |
| Floor sur micro-prix | correct | couvre coût-fixe par commande |
| Plateau 25 % au-delà 500 € | correct | alignement marché |
| « Déséquilibre asymétrique » perçu | faux problème | degressivité intentionnelle |

La degressivité (petite pièce = grosse marge %, grosse pièce =
petite marge %) est économiquement justifiée :

1. **Coût fixe par commande dilué** : sur une pièce à 1 €, 60 % de
   marge = 0.60 € → perte sèche après picking/packing. D'où le
   floor 2 €.
2. **Élasticité-prix variable** : compare-shopping intense > 100 €,
   inélastique < 5 €.
3. **Volume × marge unitaire** : KPI = `Σ(volume × marge €)`, pas la
   marge % moyenne.
4. **Risque & retour** : croissent avec le prix.
5. **Plateau concurrentiel** : Oscaro/Yakarouler fixent le prix
   marché ≥ 500 €.

L'éventuel vrai déséquilibre serait : un bucket sous le seuil de
rentabilité, un bucket trop au-dessus du marché, ou une
concentration excessive du profit. Aucun des trois ne peut être
affirmé sans Phase B/C.

## 10. Phases d'évolution

Quatre phases gouvernées :

- **Phase A** — Ship V1 seed legacy (préserve l'existant, 0 delta
  attendu).
- **Phase B** — Compta analytique + seuil de rentabilité par bucket
  (non-gated, parallèle V1). Phase la plus importante.
- **Phase C** — Réconciliation xls/DB + balance audit + sentinel
  concurrence (gated par ≥ 30 j conversion stable + ≥ 4 sem GMC).
  Signaux d'aide, jamais autorités.
- **Phase D** — Enrichissements gouvernés ADR-by-ADR. Pas de
  catalogue prédéfini. Chaque ADR doit être motivée par un signal
  Phase B/C quantifié et fermée par un verdict du `decision_closure_protocol`.

**Sans signal quantifié → Phase D n'arrive pas. STOP est valide.**

## Référence canon historique

Fichier source de la grille pricing legacy maintenue par l'owner :
[`.archive/docs/MARGE_NEW_2021.xls`](../../.archive/docs/MARGE_NEW_2021.xls)
(auteur Yassine, 542 lignes × 1 €, révision 2020-11-17).
