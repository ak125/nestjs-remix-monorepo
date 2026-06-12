# AutoMecanik — Acquisition quality (drill-down #2) — lecture seule

> Drill-down du levier #2 « Acquisition » de la [carte 24-départements](./automecanik-departments-map.md),
> en **lecture seule** sur `__seo_ga4_daily` + `__seo_gsc_daily` (Supabase `cxpojprgwgubzjyqzmoq`),
> fenêtre **30 j finissant 2026-05-30**. Maj : 2026-06-02. **Mesure-only, aucun code, OBSERVE respecté
> (fin 2026-06-08).** Re-crée le rapport perdu au cleanup #820 (était untracked). Source synthèse amont :
> [data-top-of-funnel-report.md](./data-top-of-funnel-report.md).

## Verdict en une phrase
Le « 75 % direct / bounce ~100 % / bot » et le « CTR 0,27 % » du rapport amont sont **trop grossiers** :
le direct est un **mélange** (≈19 % bot prouvé, ≈54 % home faible-engagement, ≈27 % humains réellement
engagés à 120 s), et le faible CTR non-marque vient surtout d'une **masse en page 3 (pos 22,9)** — MAIS il
existe un **cluster à fort volume en position cliquable (pos 1–9) qui prend ~0 clic**, porté par des **pages
conseils R3 sur mobile** (direction + embrayage). C'est là, et seulement là, qu'un fix CTR type capteur-esp
a du sens — sous réserve que la pièce soit vendable (l'embrayage ne l'est pas : rupture #1).

---

## 1. Direct 75 % : réel ou bot ? — **mélange, pas « bot »**

Canaux GA4 (30 j, pondéré sessions) :

| Canal | Sessions | % | Bounce | Durée moy. | Conv. |
|---|---|---|---|---|---|
| direct | 8 399 | **74,8 %** | **0,784** | **36,8 s** | 0 |
| organic search | 2 570 | 22,9 % | 0,362 | 73,4 s | 1 |
| referral | 227 | 2,0 % | 0,176 | 123,2 s | 0 |
| autres | 30 | 0,3 % | — | — | 0 |

**Correction** : direct n'est PAS « bounce ~100 % ». Bounce 78 %, durée 37 s = humain-plausible faible-engagement.
Segmentation du direct (8 399 sessions) :

| Segment | Sessions | % direct | Durée |
|---|---|---|---|
| **bot prouvé** (bounce ≥98 % ET durée <2 s) | 1 585 | **18,9 %** | 0,2 s |
| faible-engagement (bounce 85–98 %) | 4 558 | 54,3 % | 8,2 s |
| **engagé** (bounce <85 %) | 2 256 | **26,9 %** | **120,2 s** |

Pages d'atterrissage direct : `/` home = 4 167 (bounce 93,6 % / 12 s, ambigu : URL tapée / bookmark / app /
dark social + bots) ; `/search` = 977 (bounce 36 % / **64 s**, humains) ; puis un **cluster bot deep-link à
100 % / 0 s** sur URLs précises (renault-140 198, plaquette mégane dci 195, batterie 173, capteur 89+27,
plaquettes 20 ≈ 700+ = scrapers/monitors/concurrents).

→ **Conséquence** : le dénominateur « 10 475 sessions / 0,17 % panier » est **pollué**. Le vrai funnel humain
(engagé + organic) est moins catastrophique que 0,17 %. **Cadrage (important)** : Cloudflare filtre déjà une
partie du trafic indésirable en amont ; ce segment résiduel suspect reste **visible dans GA4**, c'est donc un
sujet de **mesure** (funnel-truth dé-botté), **PAS** un signal pour ajouter une nouvelle couche anti-bot runtime.
**Action read-only** : recalculer le funnel en excluant bounce ≥98 % + durée <2 s, puis **comparer au funnel
global**, avant de conclure « conversion catastrophique ».

---

## 2. SEO non-marque : pourquoi 0 clic ?

GSC 30 j, marque (`*automecanik*`) vs non-marque :

| Segment | Requêtes | Clics | Impr. | CTR | Pos. moy. |
|---|---|---|---|---|---|
| marque | 4 | 16 | 360 | **4,44 %** | 16,1 |
| non-marque | 5 471 | 78 | 34 169 | **0,228 %** | **22,9** |

Le CTR non-marque 0,23 % s'explique d'abord par la **position moyenne 22,9 (page 3)** — on ne clique pas en
page 3. (La marque ne fait que 360 impr mais 4,44 % CTR ; pos 16 pour son propre nom = anomalie mineure.)

**MAIS** le top non-marque par volume révèle **deux buckets** :

| Bucket | Exemples (impr / pos / clics) | Nature | Levier |
|---|---|---|---|
| **A — cliquable, ~0 clic** | `colonne de direction` 878 / **4,8** / **0** · `colonne de direction voiture` 169 / **2,3** / 0 · `colonne direction` 268 / 6,7 / 0 · `câble d'embrayage` 191 / 6,4 / 0 · `pompe embrayage` 292 / 9,0 / 0 · `carter d'huile` 222 / 9,3 / 0 | rank OK, clic nul | **titre/snippet/intent (fix CTR)** |
| **B — profond** | `voyant abs allume` 469 / 44,7 · `crémaillère de direction` 151 / 34,6 · `joint collecteur` 158 / 26,6 · `contacteur feu de recul` 178 / 23,9 | page 2-3 | **ranking/autorité (PAS un fix CTR)** |

---

## 3. Le cluster cliquable-0-clic = pages conseils R3, mobile

Pages réellement classées pour le Bucket A (par device) :

| Requête | Page | Device | Impr | Pos | Clics |
|---|---|---|---|---|---|
| colonne de direction | `/blog-pieces-auto/conseils/colonne-de-direction` | **mobile** | 606 | **3,5** | **0** |
| colonne de direction | idem | desktop | 261 | 7,0 | 0 |
| colonne de direction voiture | idem | **mobile** | 122 | **1,3** | **0** |
| capteur esp | `/conseils/capteur-abs` (optimisé 06-01) | mobile | 297 | 3,9 | 1 |
| câble d'embrayage | `/conseils/cable-d-embrayage` | mobile | 157 | 5,0 | 0 |
| pompe embrayage | `/conseils/emetteur-d-embrayage` | mobile | 264 | 8,8 | 0 |

**Constats** : (a) trafic ≈2:1 **mobile**, et le site rank **mieux sur mobile** (3,5 vs 7,0) ; (b) ce sont des
**pages conseils R3 (surface B)**, pas des fiches produit ; (c) **pos 1,3 avec 0/122 clic = anomalie** (à pos
1-2 on attend 20-35 % CTR) → hypothèse à vérifier (SERP feature / featured snippet non attribué / titre
inadapté), **pas prouvé**. Cohérent avec le test capteur-esp 06-01 (même surface, même playbook titre).

---

## 4. Collision acquisition #2 × rupture #1 (à ne pas ignorer)

La demande non-marque est **massivement embrayage** : `émetteur`+`emetteur`+`pompe`+`câble`+`cable`+`récepteur
embrayage` ≈ **1 700 impr cumulées** (pos 9-13). Or l'embrayage est **l'épicentre de la rupture fournisseur
(#1, ACR/SASIC)**. → Améliorer le CTR embrayage **enverrait du trafic vers des pièces invendables**. Le levier
#2 ne doit pas devancer le #1 sur ce thème.

---

## 5. Décisions proposées pour la levée d'OBSERVE (2026-06-08) — toutes owner-GO

1. **Funnel-truth dé-botté** (read-only, côté **mesure** — Cloudflare filtre déjà en amont, donc **ne pas**
   ajouter de protection anti-bot runtime maintenant) : recalculer vue→panier→payé en excluant le segment bot
   prouvé (bounce ≥98 % + durée <2 s, 1 585 sessions) et en isolant le direct-home faible-engagement, puis
   **comparer au funnel global**. Le « 0,17 % » n'est pas la vérité humaine.
2. **CTR playbook capteur-esp → `colonne-de-direction`** (plus gros volume : 878 impr, pos 3,5 mobile, 0 clic) :
   même méthode que le 06-01 (titre/meta R3 régénéré, gates, post-condition), **owner-gated** (meta optimisée),
   **uniquement si la direction est vendable** (≠ embrayage). Vérifier d'abord l'anomalie pos-1-0-clic (SERP).
3. **Séquence thème** : direction (vendable) AVANT embrayage. CTR embrayage **seulement après** le gate dispo (#1).
4. **Bucket B (pos 20+)** = travail de ranking/contenu, **pas** un fix CTR — différé, hors quick-win.

## Limites (anti-overclaim)
- Segmentation bot = heuristique au grain de ligne `(date,page,channel)`, pas un fingerprint serveur. « bot
  prouvé » = très haute confiance (100 %/0 s), pas une certitude absolue.
- pos-1-avec-0-clic = **anomalie à expliquer** (SERP feature probable), pas un fait établi.
- GA4/GSC = `__seo_*_daily` (déjà peuplé en prod) ; `SEO_MONITORING_ENABLED=false` en `.env.example` mais data
  présente. Aucune écriture effectuée.
