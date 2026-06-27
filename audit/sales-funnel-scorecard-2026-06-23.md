# Commerce funnel scorecard — replay 2026-06-23 (merge-anchored)

> Maj : 2026-06-23. Réplique méthodique du `sales-funnel-scorecard.md` (2026-05-31), **corrigée
> pour la validité de mesure**. Source : Supabase `cxpojprgwgubzjyqzmoq`, requêtes agrégées
> read-only (`execute_sql`, COUNT/SUM/GROUP BY → pas de cap 1000 lignes). Tables : `__seo_event_log`
> (`created_at` = `timestamptz`, UTC), `___xtr_order` (`ord_date` = **TEXT** ISO8601 → cast
> `::timestamptz` avant filtre, sinon dérive 2 h aux bornes).

## Pourquoi une fenêtre « plate » est invalide

Les deux correctifs à mesurer ont été **mergés en plein milieu** d'une fenêtre 30 j :
`r2_view`/`r2_order_placed` (#759) le **2026-05-25 20:59 UTC**, `can_sell` (#850) le
**2026-06-04 16:43 UTC**. Une fenêtre plate (et le baseline du 31/05) mélangent pré-fix /
partiel / plein → effet inattribuable. Segments **ancrés aux dates de merge** :

| Segment | Bornes (UTC) | Durée | `r2_*` events | `can_sell` |
|---|---|---|---|---|
| **1 — pré-fix** | 2026-04-24 → 2026-05-25 20:59 | 31.9 j | absents | OFF |
| **2 — r2-only** | 2026-05-25 20:59 → 2026-06-04 16:43 | 9.8 j | présents | **OFF** |
| **3 — both-active** | 2026-06-04 16:43 → 2026-06-23 00:00 | 18.3 j | présents | **ON** |

## Funnel événementiel (`__seo_event_log`)

| Métrique | Seg 2 (r2-only) | Seg 3 (both-active) | Δ /jour |
|---|---|---|---|
| `r2_view` (sessions) | 904 (≈ **92/j**) | 4 414 (≈ **241/j**) | **× 2,6** |
| `r2_add_to_cart` (sessions) | 17 (≈ 1,7/j) | 27 (≈ 1,5/j) | **plat** |
| **vue → panier** | **1,88 %** | **0,61 %** | **effondrement** |
| `r2_order_placed` (events) | **0** | **0** | jamais émis |
| `diag_hub_view` (sessions) | 154 (≈ 16/j) | 306 (≈ 17/j) | plat |

## Funnel commande (`___xtr_order`, bucketé par `ord_date`)

| Métrique | Seg 1 (pré-fix) | Seg 2 (r2-only) | Seg 3 (both, can_sell ON) |
|---|---|---|---|
| Commandes créées | 10 (0,31/j) | **0** | 4 (0,22/j) |
| Payées (`ord_is_pay='1'`) | 4 (0,13/j) | 0 | **0** |
| Annulées (`ord_ords_id='2'`) | 0 | 0 | 0 |
| Payées-puis-annulées | 0 | 0 | 0 |

**Annulations indispo** : **0 commande au statut « annulée » (`ord_ords_id='2'`) sur tout
avril→juin**. La métrique « 3 paiements / 3 annulations indispo » du scorecard 31/05 **n'est
pas reproductible** via le statut commande → elle reposait sur une définition différente
(probablement note `ord_info` / process manuel). Comparaison au 31/05 = **directionnelle seulement**.

## Verdict

- **Top-of-funnel en croissance saine** : vues produit ≈ 92/j → **241/j** (× 2,6).
- **Effondrement vue → panier → paiement** : `add_to_cart` reste **plat à ~1,5 sess/j** malgré
  2,6× de vues ; taux vue→panier **1,88 % → 0,61 %**. Une partie est le **fonctionnement
  correct de `can_sell`** (bouton désactivé sur pièce non vendable) ; l'autre signale une
  **couverture vendable mince** et/ou une forte friction sous la vue.
- **Effet `can_sell` NON MESURABLE** : **0 commande payée** dans la fenêtre can_sell-ON (4 cmd,
  0 payée sur 18 j) et **0 annulation au statut**. Le correctif est **correct en défensif**
  mais il **n'existe aucun signal cash** pour en prouver l'effet — volume trop faible (N≈0).
- **Goulot réel** = la chaîne vue → panier → paiement, **pas** ce que `can_sell` adresse.

## Couverture d'instrumentation (rapport séparé)

5/7 étapes funnel restent **non instrumentées** (cf. `reference_funnel_instrumentation_gaps`) —
tant qu'elles ne sont pas émises, aucun replay ne pourra juger le mid-funnel :

| Étape | Event | État 2026-06-23 |
|---|---|---|
| Vue produit | `r2_view` | ✅ émis (4 414 sess seg 3) |
| Ajout panier | `r2_add_to_cart` | ✅ émis (27 sess seg 3) |
| Checkout démarré | `checkout_start` | ❌ jamais émis |
| Tentative paiement | `payment_attempt` | ❌ jamais émis |
| Retour paiement | `payment_return` | ❌ jamais émis |
| Commande confirmée | `r2_order_placed` | ❌ **0 event** (émission serveur cassée) |
| Relance panier | `__abandoned_cart_emails` | ❌ dormant |
| Attribution source URL | `___xtr_order_line.orl_website_url` | ⚠️ ~0 % peuplé (col. ajoutée 2026-05-22) |

**Conséquence** : segment panier → checkout → paiement **invisible**. Prioriser l'**instrumentation
(`r2_order_placed` serveur, `checkout_start`/`payment_attempt`/`payment_return`)** AVANT toute
nouvelle feature commerce — sinon aucun correctif n'est prouvable. Mesure read-only, zéro mutation.
