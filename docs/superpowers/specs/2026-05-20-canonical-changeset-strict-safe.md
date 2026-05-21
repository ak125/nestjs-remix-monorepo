# Change-set canonical STRICT-SAFE — à réviser avant application

**Date** : 2026-05-20
**Source** : `__seo_cannibalization_recommendations WHERE safety_flag='strict_safe_true_dup'`
**Volume** : 30 pages (vrais doublons : même gamme + marque + modèle + motorisation, seul `type_id` diffère)

> ⚠️ **Rien n'est appliqué.** Cette liste est un change-set proposé pour révision humaine. Appliquer = étape manuelle approuvée (garde `feedback_no_url_changes_ever`).

## Pourquoi seulement 30 sur 142 ?

L'audit GSC a identifié 142 `canonical_candidate` (pages perdantes sur une requête disputée). Mais sélectionner le « winner » par meilleure position GSC est **dangereux** : le winner est parfois un **produit différent** (gamme/modèle/moteur ≠). Canonicaliser vers lui dirait à Google « ces pages sont identiques » → client sur la mauvaise pièce → retour SAV.

Filtrage de sécurité (préfixe URL complet identique, seul `type_id` diffère) :
- **30 strict_safe_true_dup** : vrai doublon (ex. 2 entrées type_id du même `207 1.6 hdi`) → SÛR à canonicaliser
- **112 needs_human_review_diff_product** : gamme/modèle/moteur différent → NE PAS canonicaliser automatiquement (révision cas par cas, ou relève du fix structurel niveau-modèle)

## Les 30 paires sûres (source → canonical cible)

| Requête | Source (pos) | Canonical → cible (pos) |
|---|---|---|
| 816 x 5 | filtre-a-huile bmw x5-e70 30-i-xdrive-**61929** (86) | …**61930** (48) |
| c15 1.9d | cardan citroen c15 1-9-d-**18017** (83) | …**21090** (39) |
| calorstat 207 1.6 hdi | thermostat 207 1-6-hdi-**19353** (47) | …**33260** (20) |
| catalyseur laguna 2 1.9 dci | catalyseur laguna-ii 1-9-dci-**18643** (48) | …**15771** (32) |
| contacteur feu recul laguna 2 | …laguna-ii-break 1-9-dci-**15774** (59) | …**18583** (23) |
| embrayage saxo 1.5d | butee-d-embrayage saxo 1-5-d-**5616** (53) | …**5551** (29) |
| emetteur embrayage 807 hdi | emetteur 807 2-0-hdi-**27570** (64) | …**19771** (8) |
| filtre à air kangoo 1.5 dci | filtre-a-air kangoo-ii 1-5-dci-**23465** (55) | …**58648** (39) |
| filtre habitacle trafic 2 | filtre-habitacle trafic-ii 2-5-dci-**31996** (41) | …**19863** (25) |
| pajero 3.2 did | constructeurs pajero-iii 3-2-did-**57188** (47) | …**57184** (24) |
| turbo c8 2.0 hdi 163 | turbo c8 2-0-hdi-**16729** (42) | …**23048** (28) |
| turbo megane 2 1.5 dci | turbo megane-ii 1-5-dci-**17718** (48) | …**18791** (38) |
| vanne egr 207 1.6 hdi (×4 requêtes) | vanne-egr 207 1-6-hdi-**19353** | …**33260** |
| vanne egr 307 1.6 hdi (×2) | vanne-egr 307 1-6-hdi-**17989** | …**19341** |
| vanne egr 308 1.6 hdi (×2) | vanne-egr 308-sw-i 1-6-hdi-**11074** | …**59020** |
| vanne egr 407 sw | vanne-egr 407-sw 2-0-hdi-**76499** (49) | …**28141** (34) |
| vanne egr clio 1.5 dci (×2) | vanne-egr clio-ii 1-5-dci-**54943**/**29998** | (réciproque) |
| vanne egr clio 4 1.5 dci | vanne-egr clio-iv 1-5-dci-**57282** (63) | …**57281** (32) |
| vanne egr golf 6 1.6 tdi (×2) | vanne-egr golf-vi 1-6-tdi-**31340**/**33030** | (réciproque) |
| vanne egr laguna 2 1.9 dci | vanne-egr laguna-ii 1-9-dci-**18579** (81) | …**15476** (66) |
| vanne egr megane 2 (×2) | vanne-egr megane-ii 1-5-dci-**18790** | …**16919** |
| vanne egr scenic 3 1.5 dci 110 | vanne-egr scenic-iii 1-5-dci-**31546** (72) | …**5853** (42) |

(liste complète exacte dans `__seo_cannibalization_recommendations`, requête : `WHERE safety_flag='strict_safe_true_dup'`)

> ⚠️ **Doublons réciproques** : certaines paires apparaissent dans les 2 sens (ex. clio 1.5 dci) car la requête varie. Lors de l'application, choisir UN sens unique par paire (la cible = meilleure position stable) pour éviter une boucle canonical.

## Application (étape SÉPARÉE, manuelle, après votre validation)

1. Pour chaque paire, vérifier que les 2 type_id sont bien le **même produit** (compat identique) — c'est un doublon catalogue, pas 2 pièces.
2. Choisir la cible stable (mieux classée, en stock).
3. Déclarer `rel=canonical` source → cible **+ aligner les liens internes** (fil d'ariane, listings) vers la cible (best practice onwardSEO).
4. Ne PAS combiner avec noindex.
5. Idéalement : dédupliquer aussi les 2 type_id côté catalogue (cause racine = doublons de type véhicule).

## Le reste (112 + 84% intra-R2) = fix structurel

Les 112 non-strict-safe et la masse intra-R2 ne se règlent PAS par canonical page-à-page. Le vrai fix = **créer des pages niveau-modèle** (`/pieces/{gamme}/{marque}/{modele}.html`) qui captent la requête modèle et consolident les motorisations — chantier structurel à décider (cf rapport principal, chemin B).
