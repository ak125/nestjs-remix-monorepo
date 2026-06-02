# Data & Analytics Report — Haut de funnel (le vrai dénominateur)

> Rapport départemental **Data & Analytics** (couche de pilotage → [automecanik-departments-map.md](./automecanik-departments-map.md)).
> Question owner : le « 4 % » est-il le vrai taux site, et d'où vient le trafic ? **D'abord mesurer l'existant, pas construire.**
> Période **30 j (GA4 : 2026-05-01 → 05-28)**, Supabase `cxpojprgwgubzjyqzmoq`. Maj 2026-06-01. Read-only.

## 0. Découverte clé — le tracking **existe déjà**, il n'était juste pas exploité
Contrairement à l'hypothèse « mesure incomplète », les tables sont **peuplées** (vérifié) :
`__seo_ga4_daily` = **10 488 lignes** (sessions site-wide GA4) · `__seo_gsc_daily` = **47 899** (Search Console) · `__seo_cwv_raw` = 1 729 (CWV humains). → **Pas besoin de construire du tracking** : il faut **exploiter l'existant**.

## 1. 🔴 Le vrai funnel — le « 4 % » était un sous-funnel flatteur
| Étape | Sessions | % du trafic site |
|---|---|---|
| **Sessions site (GA4)** | **10 475** | 100 % |
| → atteignent une **page produit** (`r2_view`) | 463 | **4,4 %** |
| → **ajout panier** | 18 | **0,17 %** |
| → commande créée | 9 | 0,086 % |
| → paiement | 3 | 0,029 % |
| → **vente gardée** | **0** | **0 %** |
**Le vrai trou n'est pas « vue→panier 4 % » — c'est le SOMMET : 95,6 % des sessions ne voient JAMAIS un produit.** Le taux de conversion site réel = **0,17 % au panier**.

## 2. D'où vient le trafic (GA4, 10 475 sessions)
| Canal | Sessions | Part | Bounce* |
|---|---|---|---|
| **direct** | **7 883** | **75 %** | 66 % |
| organic search | 2 340 | 22 % | ≈90 % |
| referral | 223 | 2 % | ≈90 % |
| unassigned / social | 29 | <1 % | — |
\* **Correction (cf. [direct-quality-report.md](./direct-quality-report.md))** : direct = **66 % bounce** (PAS ≈100 % — artefact d'une 1ʳᵉ mesure). 50 % du direct atterrit sur la **home** → **faible engagement, PAS majoritairement bot.** Le vrai trafic **engagé** (organic 38 % bounce + referral 15 %) ≈ **2 563**, dont ~463 atteignent un produit.

## 3. Où atterrit le trafic (top pages GA4)
| Page | Sessions | Part |
|---|---|---|
| **`/` (home)** | **4 056** | **39 %** |
| `/search` | 977 | 9 % |
| `/constructeurs/renault-140.html` | 204 | 2 % |
| `/pieces/...plaquette.../renault` (produit) | 201 | 2 % |
| `/pieces/batterie-1.html` (gamme) | 134 | 1 % |
| **`/blog-pieces-auto/conseils/...` (somme)** | **~240** | ~2 % |
| `/diagnostic-auto` | 42 | <1 % |
→ Le trafic atterrit surtout sur **home + search + blog**, **pas sur les produits**. Les parcours **home→produit**, **search→produit**, **blog→produit** **fuient massivement**.

## 4. 🔴 SEO / Search Console — rank sans clic
**31 828 impressions, 85 clics, CTR = 0,27 %** (30 j). Le site **est positionné** (positions 4-43) sur de **vraies requêtes pièces**, mais **personne ne clique** :
| Requête | Impr | Clics | Position |
|---|---|---|---|
| colonne de direction | 783 | 0 | 7,7 |
| cylindre de roue | 552 | 1 | 11,6 |
| capteur esp | 420 | 1 | 4,2 |
| **émetteur embrayage** | 383 | 0 | 14,6 |
| pompe embrayage | 289 | 0 | 9,3 |
| **automecanik** (marque) | 202 | **14** | **1,6** |
→ **Seule la requête marque convertit en clics.** Les requêtes pièces génériques = impressions sans clic (titres/snippets/position non gagnants). **Demande embrayage forte en search (~1 500 impressions cumulées)** → 0 clic **et** désormais en rupture/quarantaine.

## 5. Réponses aux 7 questions
| Question | Réponse mesurée |
|---|---|
| 4 % site-wide ou /pieces ? | **/pieces-only.** Vrai taux site = **0,17 % au panier** (10 475 sessions → 18). |
| Canaux des sessions courtes ? | **direct 75 %** (66 % bounce, faible engagement, 50 % home) + organic 22 % (engagé). |
| Pages qui précèdent /pieces ? | **home (39 %), /search (9 %), blog (~2 %)** — mesuré via GA4 `page`/`channel`. |
| Requêtes/URLs faible intention ? | **Mesurable (GSC)** : toutes les requêtes pièces = 0-1 clic ; seule « automecanik » clique. |
| Sessions avec vrai signal d'achat ? | **18** (add_to_cart) / 10 475 = 0,17 %. `diag_gamme_cta_click` = 0. |
| Bots polluent ? | r2_view propre (bots → `bot_cwv_beacon`). Direct = 66 % bounce, 50 % home → **faible engagement, pas majoritairement bot** (cf. direct-quality-report). `unassigned` (92 %/5 s) = bot mais marginal. |
| Conseil/diag/Fafa amènent du trafic utile ? | **Blog : OUI du trafic (~240) mais ne convertit pas** (pas relié aux produits). **Diagnostic : cul-de-sac** (203 sessions → 5 produits → 0 commande). **Fafa : 0** (DRAFT). |

## 6. Verdict — **REUSE (le tracking existe), IMPROVE l'acquisition. Pas de refonte, pas de nouveau tracking.**
Les vrais leviers ne sont **ni la page, ni le catalogue** (innocentés). Ce sont, par poids :
1. **Acquisition / qualité du trafic** : 75 % « direct » faiblement engagé (66 % bounce, 50 % home, 0 conv) ; le **vrai canal qui convertit = organique** (38 % bounce, 4,4 % sur produit) mais petit → grossir l'organique qualifié.
2. **SEO CTR** : 31 828 impressions, 0,27 % CTR → énorme **opportunité latente** (le site rank déjà). Améliorer titres/snippets/positions = **décision owner** (meta protégées).
3. **Routage home/search/blog → produit** : 39 % home + 9 % search + blog ne descendent pas vers les produits.

## 7. Mesurable MAINTENANT (zéro build) vs PARKÉ
**Maintenant (exploiter l'existant)** : taux site réel (GA4) · canaux · top pages/landing · CTR & positions par requête (GSC) · CWV par surface. **Tout est déjà en base.**
**PARKÉ (owner-GO, seulement si prouvé utile)** : fiabiliser le « direct » (filtre bot / tag) · jointure GSC-requête × panier (scoring intention) · event d'entrée home/blog/search (aujourd'hui non émis) · referrer `diagnostic` sur r2_view. **Rien à construire avant décision.**

## 8. Garde-fous
n=18 paniers = directionnel · **GA4 `direct`/bounce à fiabiliser** (ne pas conclure « 10 475 humains ») · **zéro meta/H1/URL/canonical** (SEO CTR = décision owner, pas une édition) · pas de nouveau tracking avant preuve · page & catalogue déjà innocentés (ne pas y revenir) · OBSERVE design-only.

---

## Mini-report départemental (format standard)
**Data & Analytics — Haut de funnel** · Période : 30 j (GA4 05-01→05-28) · KPI : taux de conversion **site réel** · **Résultat : 10 475 sessions → 463 produits (4,4 %) → 18 paniers (0,17 %) → 0 vente gardée** ; trafic **75 % direct (suspect) / 22 % organic** ; landing **home 39 % / search 9 % / blog ~2 %** ; **SEO 31 828 impressions, CTR 0,27 %, clics = marque seulement** · Score : **Critique (acquisition)** · Évolution : 1ʳᵉ mesure site-wide · Preuve : `__seo_ga4_daily` + `__seo_gsc_daily` (peuplés, vérifiés) · Trou : **sommet du funnel — 95,6 % ne voient pas de produit + CTR organique 0,27 %** · Cause probable : trafic direct non-qualifié + SEO qui rank sans clic + parcours home/blog→produit cassés · Action : **REUSE** (exploiter GA4/GSC déjà là), **IMPROVE acquisition** (fiabiliser direct, CTR SEO owner-gated, routage) — **pas de refonte, pas de nouveau tracking** · Risque : faible (mesure) · Owner-GO : oui (SEO titres / filtre bot) · Prochaine preuve : part réelle de « direct » humain vs bot + 1 test CTR sur une requête qui rank.
