# AutoMecanik — Scorecard tunnel de vente (problème n°1)

> Chiffres **vérifiés en lecture seule** sur `__seo_event_log` + `___xtr_order(_line)` + `__abandoned_cart_emails`,
> projet Supabase `cxpojprgwgubzjyqzmoq`, fenêtre **30 jours** (sauf indication). Maj : 2026-05-31.
> Objectif : trouver **où le tunnel s'arrête avant un paiement gardé**. Mesure-only — **aucun build** ici.

## Verdict en une phrase
La rare personne qui paie est **remboursée car la pièce n'est pas disponible** : sur 30 j, **3 paiements → 3 annulés « pas dispo » → 0 vente gardée**. En amont, seules **~4 %** des vues produit ajoutent au panier, sur un trafic déjà faible et en partie non mesuré.

## Tunnel mesuré (30 jours)
| Étape | Mesuré ? (source) | Chiffre 30 j | Drop | Hypothèse | Owner |
|---|---|---|---|---|---|
| visite (tout le site) | ❌ non tracké | **inconnu** | — | trafic faible probable | Marketing / Data |
| vue produit | ✅ `r2_view` | **452 sessions** (546 ev.) | — | referrer : organic 222 / internal 172 / direct 53 / other 15 · **diagnostic 0** (non taggable) | Pages & SEO |
| (entrée diagnostic) | ✅ `diag_hub_view` | 196 sessions | diag→vue produit : **5** | pont diagnostic mort (3 events jamais émis) | Diagnostic |
| **ajout panier** | ✅ `r2_add_to_cart` | **18 sessions** (38 ev.) | **vue→panier ≈ 4 %** (11 joints/452) | page produit peu convaincante : compat / confiance / prix / CTA | Produit · Catalogue · Pricing |
| panier vu | ❌ pas d'event | inconnu | — | — | Produit |
| checkout démarré | ❌ pas d'event | inconnu | **segment aveugle** | rien tracké panier→paiement | IT |
| livraison choisie | ❌ pas d'event | inconnu | — | — | IT |
| tentative paiement | ❌ pas d'event | inconnu | — | — | IT |
| commande créée | ✅ `___xtr_order` | **9** | — | — | Commercial |
| **paiement reçu** | ✅ `ord_is_pay='1'` | **3** | commande→payé 33 % | — | IT · Finance |
| **paiement GARDÉ** | ✅ (non annulé) | **0** | payé→gardé **0 %** | **RUPTURE FOURNISSEUR** | Achats |
| (event confirmation) | ❌ `r2_order_placed` **0 émis** | 0 | — | confirmation jamais émise (≠ 0 vente) | IT |
| relance panier | ❌ `__abandoned_cart_emails` **0 ligne** | 0 | — | pipeline relance dormant / non capturé | Commercial |

## Les 2 trous confirmés (par ordre d'action)
1. 🔴 **Paiement → gardé = 0 % (rupture fournisseur).** Les 3 paiements des 30 derniers jours sont annulés ; raisons brutes : `« plus diponiblr » ×2`, `« pas dispo » ×1`. Sur 365 j : **11 payés, 3 annulés, ~8 gardés**. C'est la fuite la plus chère (argent réellement encaissé puis remboursé) et la plus claire à corriger. → **Toyota Gate dispo** : ne pas vendre une pièce non disponible.
2. 🟠 **Vue → panier ≈ 4 %.** 452 sessions voient un produit, 18 ajoutent au panier. Plus gros drop en volume. → page produit (Apple Trust : compatibilité visible, prix/délai clairs, CTA « vérifier compatibilité »).

## Failles structurelles d'instrumentation (constatées)
- **Haut du tunnel non mesuré** : `r2_view` ne se déclenche que sur `/pieces`, `diag_hub_view` sur le diagnostic. Home / blog / landing SEO **non comptés** → « 452 » ≠ trafic total. *Trancher trafic-faible vs reach-produit nécessite GA4 / logs (hors-bande).*
- **Segment panier→paiement aveugle** : aucun event `checkout_start` / `payment_attempt` / `payment_return`.
- **Attribution 0 %** : `orl_website_url` = **0/68** lignes commande (90 j) → impossible de relier une vente à sa page source (alors que le câblage existe → cause amont à investiguer, pas à reconstruire).
- **Confirmation jamais émise** : `r2_order_placed` = 0 (déclenché côté navigateur seulement).
- **Relance panier dormante** : `__abandoned_cart_emails` = 0 ligne (jamais capturé).
- **Pont diagnostic mort** : `diag_wizard_start` / `diag_analyze_complete` / `diag_gamme_cta_click` jamais émis ; diag→produit = 5/196.

## Top 5 problèmes
1. 0 vente gardée / 30 j. 2. Rupture fournisseur = cause directe (100 % des paiements récents). 3. Vue→panier 4 %. 4. Trafic faible + haut non mesuré. 5. Instrumentation aveugle panier→paiement + attribution 0 % + relance 0.

## Backlog « build » PARKÉ — owner-GO, RIEN pendant OBSERVE (fin 2026-06-08)
*Ce sont des changements de code, pas de la mesure. Aucun lancé.*
1. **Gate disponibilité (PRODUIT→PANIER)** : projection lecture seule `supplier_availability` (Supplier-Truth worktree, spl_id=26) → empêcher l'achat d'une pièce non dispo. ⚠️ touche cart/checkout → owner-GO.
2. **Instrumenter panier→paiement** : events `checkout_start` / `payment_attempt` / `payment_return`. ⚠️ payment-adjacent → **GO nominatif** (`.claude/rules/payments.md`).
3. **`r2_order_placed` depuis le callback HMAC serveur**. ⚠️ `payments/` → GO nominatif.
4. **Attribution** : investiguer pourquoi `orl_website_url` reste 0 % malgré câblage (sourceUrl amont / commandes legacy). Vérifier en DB, **ne pas reconstruire**.
5. **Relance panier** : vérifier le cron `abandoned-cart` (0 capturé).
6. **Pont diagnostic** : différé (mémoire 05-25 : NO-ACTION tant que diag→panier < 10/j — ici 5/196).

## Prochaine décision (après ce constat)
Le premier correctif **prouvé** est la **fuite rupture fournisseur** (0 % paiement gardé). La suite n'est PAS de coder tout de suite : c'est de décider, avec l'owner, d'étendre la **projection lecture-seule de disponibilité** (existante en worktree) pour **mesurer** combien de produits affichés sont réellement indisponibles, **avant** d'ajouter un gate. Le drop vue→panier (4 %) se traite ensuite côté page produit. Tout le reste reste parké jusqu'à preuve + GO.
