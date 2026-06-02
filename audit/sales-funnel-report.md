# Sales Funnel Report — département Commercial & Ventes

> Rapport départemental read-only (couche de pilotage → [automecanik-departments-map.md](./automecanik-departments-map.md)).
> **Aucune mutation** (sauf la quarantaine déjà appliquée, cf. [unavailable-quarantine-plan.md](./unavailable-quarantine-plan.md)).
> Période mesurée : **30 derniers jours** (Supabase `cxpojprgwgubzjyqzmoq`), à réactualiser chaque semaine. Maj 2026-05-31.
> KPI possédé : **paiement gardé**. Prérequis : [sales-funnel-scorecard.md](./sales-funnel-scorecard.md).

## 1. Tunnel mesuré (30 j)
| Étape | Mesure | Drop |
|---|---|---|
| Vues produit (sessions) | **463** (546 ev.) | — |
| → Ajout panier (sessions) | **18** (38 ev.) | **vue→panier ≈ 4 %** (11 sessions ont vue+panier tracées) |
| → Commande créée | **9** | panier→commande ~50 % (non joignable par session) |
| → Paiement reçu | **3** | **commande→payé 33 %** (6 commandes **non payées**) |
| → Paiement **gardé** | **0** | **payé→gardé 0 %** (3/3 annulés rupture — **désormais traité**) |
*Trafic total site = non tracké (`r2_view` seulement sur `/pieces`). Segment panier→checkout→paiement = aucun event.*

## 2. Les 3 grandes fuites — et où agir maintenant
1. 🔴 **Vue → panier : ~96 % de perte** (463 → 18). La plus grosse en volume. → **page produit** (compatibilité/confiance/prix/CTA) = département **Pages & SEO / Produit** (prochain rapport).
2. 🟠 **Commande → payé : 66 % ne paient pas** (9 créées → 3 payées ; **6 commandes non payées**). → friction **checkout/paiement** = domaine **Commercial**. **C'est désormais la 1ʳᵉ fuite actionnable côté Commercial** (la rupture étant traitée).
3. ✅ **Payé → gardé : était 100 % de perte (rupture), MAINTENANT fermé** par la quarantaine des 3 pièces embrayage.

## 3. ✅ Effet quarantaine — confirmé dans les données panier
La pièce **3283441 (émetteur LUK/ACR)** — qui était le **2ᵉ produit le plus ajouté au panier** (6 adds / 4 sessions ≈ **22 % des sessions panier**) **ET** cause de 2/3 remboursements — est maintenant **`piece_display=false` + `pricing_state=FROZEN`** : elle **ne peut plus être ajoutée au panier ni payée**. Les 3 produits qui produisaient « paiement → remboursement » sont hors du flux. **La boucle est fermée pour ce cas.**

## 4. Les 18 paniers (30 j) — détail
- **1/18 désormais gelé** (émetteur 3283441) ✅. **17/18 restent vendables** (`piece_display=true`, `pricing_state=ACTIVE`, `pri_dispo='1'`, marges 29-110 % saines).
- **Concentration demande** : Cardan SNR (PAP) = top (6084054 : 7 adds, 6084053 : 6 adds — **1 seul utilisateur très engagé**, 13 adds) ; puis émetteur (gelé) ; puis **plaquettes de frein ×4 marques** (BREMBO/SASIC/ATE/TEXTAR).
- **Fournisseurs panier** : **ACR = 6/18 produits** (émetteur gelé, plaquette BREMBO, tambour, injecteur, servo, étrier), PAP 4, DCA 3, NED 2, SOREA/AFP/CS 1. → ACR (fournisseur à rupture prouvée) reste très présent : **à surveiller** (matrice risque), **pas à quarantiner sans preuve**.

## 5. Réponses aux questions owner
| Question | Réponse mesurée |
|---|---|
| Les pièces gelées disparaissent-elles des futurs paniers ? | **Oui par construction** (3283441 = `piece_display=false`, non-addable). Métrique business à confirmer sur de **nouveaux** paniers post-quarantaine (fenêtre trop courte aujourd'hui). |
| Les alternatives sont-elles vues/cliquées ? | **NON MESURÉ** — aucun event sur `NoProductsAlternatives` (clic alternative). **Trou d'instrumentation** (parké). |
| Les produits encore visibles sont-ils vendables ? | `pri_dispo='1'` pour tous, **mais ce signal est non fiable** ; **6/18 sont ACR** (fournisseur à risque). À surveiller, pas à geler sans preuve. |
| Où les clients abandonnent-ils ? | Volume : **vue→panier (96 %)**. Sur le chemin acheteur : **commande→payé (6/9 non payées)**. Le « où exactement » dans le checkout = **non instrumenté**. |
| Y a-t-il une relance panier possible ? | Infra existe (`__abandoned_cart_emails`, `abandoned-cart.service`) mais **dormante (0 capturé)**. Les **6 commandes non payées ont des données client** → relance **manuelle** possible **sans toucher au paiement**. |

## 6. Trous d'instrumentation (constatés — parkés owner-GO)
- Segment **panier→checkout→paiement** : aucun event (`checkout_start`/`payment_attempt`/`payment_return`) → on ne voit pas *où* les 6 non-payées décrochent.
- **Clic alternatives** non tracké → on ne sait pas si `NoProductsAlternatives` convertit.
- **Relance panier dormante** (0 capturé) + **attribution 0 %** (déjà constaté).

## 7. Verdict scoring — **IMPROVE + REUSE, pas CREATE**
| Cas | Décision |
|---|---|
| Pièces gelées hors panier | **REUSE** — confirmé ; surveiller nouveaux paniers |
| 6 commandes non payées | **IMPROVE** — relance **manuelle** sur les clients identifiés (réutilise données existantes), **sans toucher paiement/cart** |
| Vue→panier 96 % | **IMPROVE** — renvoyé au **Page report** (Pages & SEO), pas Commercial |
| ACR 6/18 paniers | **WATCH** — matrice risque, pas de quarantaine de masse |
| Où décrochent les non-payées | **PARKED** — instrumenter panier→paiement (payment-adjacent, GO nominatif) |
| Alternatives convertissent ? | **PARKED** — event clic alternative |

## 8. Backlog « build » PARKÉ (owner-GO, hors OBSERVE)
1. Instrumenter `checkout_start`/`payment_attempt`/`payment_return` (payment-adjacent → **GO nominatif**).
2. Event clic `NoProductsAlternatives` (mesurer la conversion alternative).
3. Réveiller la relance panier (`abandoned-cart` cron) — vérifier pourquoi 0 capturé.
**Rien maintenant** : pas de quarantaine de masse, pas de cron, pas de gate auto, pas de Supplier-Truth prod, pas de nouveau module/agent, pas de refonte page.

---

## Mini-report départemental (format standard)
**Commercial & Ventes** · Période : 30 derniers jours · KPI : paiement gardé · **Résultat : 463 vues → 18 paniers (4 %) → 9 commandes → 3 payées → 0 gardée** ; mais **rupture fermée** (3 pièces gelées, dont 1 top-panier) · Score : Critique → **en amélioration** (cause #3 traitée) · Évolution : 1ʳᵉ mesure post-quarantaine · Preuve : ce rapport · Trou : (a) vue→panier 96 % [Pages&SEO], (b) **commande→payé 66 % non payées** [Commercial], checkout non instrumenté · Cause probable : page produit peu convaincante + friction paiement non mesurée · Action : **IMPROVE** — relance manuelle des 6 commandes non payées (sans toucher paiement) ; surveiller paniers ACR · Risque : faible (mesure) · Owner-GO requis : oui (instrumentation/relance auto) · Prochaine preuve : nouveaux paniers post-quarantaine (les pièces gelées disparaissent-elles ?) + raisons des 6 non-payées.
