# R2 description composition — well-formed French + safe keyword enrichment

**Date** : 2026-05-20 (révisé — pivot après findings empiriques)
**Statut** : design validé, V1 en implémentation
**Branche** : `feat/seo-linguistic-quality-audit` (PR nommée « R2 descrip composition »)
**Lié à** : PR #660 (résolution switches R2), plan R-stack PR-2 (contenu R2), PR-6.4 (keywords). Mémoires `feedback_verify_existing_first`, `feedback_no_touch_meta_h1_if_optimized`, `feedback_no_questionnaire_propose_best`.

---

## 1. Problème (confirmé empiriquement)

La description R2 est 100 % pilotée par le template DB `sgc_descrip = #LinkGammeCar#, #CompSwitch#` →
`[gamme marque modèle], [fragment infinitif]` = **phrase sans verbe**. Ex. réel :

> « Plaquette de frein PEUGEOT 207, au meilleur rapport qualité-prix pour assurer le freinage par friction »

**118/118 descriptions** sont construites ainsi (mesuré). Ce n'est pas une page ratée, c'est le **mode de fabrication**.

## 2. Findings qui cadrent la solution (pourquoi ni grammaire-checker, ni keyword brut)

- **LanguageTool (meilleur correcteur FR, self-hosted) ne détecte PAS le « sans verbe »** (testé, même mode `picky` → 0 match). Et sur les fragments bruts il donne ~95 % de fausses alertes (CASING, car fragments minuscules à encastrer). → un correcteur grammatical n'est PAS l'outil principal. Conteneur arrêté ; piste « contrôle ponctuel sur phrase finale » documentée mais non retenue en V1.
- **`__seo_keywords` (10 344 kw, 19 gammes, volume) est contaminé** : pg 402 (plaquette) → top kw « disque de frein » (mauvais produit !) ; pg 424 → « filtre à habitacle » (faux). → le mot-clé brut **ne peut pas** servir de nom de produit.

## 3. Solution (best-in-class, déterministe, sûre)

Composer la description **en code** (pas en mutant les 118 templates DB), via un **composeur de phrase véhicule-aware** :

- **Terme produit = `gamme_name` autoritaire** (DB `pg_name`, toujours correct). Jamais le keyword brut.
- **Phrase complète avec verbe**, plusieurs **frames** grammaticalement valides, **tournés par `(type_id + pg_id)`** (anti-cannibalisation, comme `selectVariation`/`SEO_PRICE_VARIATIONS` existants).
- **Slots** depuis données autoritaires : marque, modèle, motorisation, puissance, années, `count`, `min_price`. Clause omise proprement si donnée absente (jamais « dès €» ni placeholder résiduel).
- **Enrichissement keyword GATÉ** : un modifieur issu de `__seo_keywords` n'est ajouté que si le keyword normalisé **contient les mots-cœur de la gamme** (ex. « filtre à huile » ✓ pour filtre-a-huile ; « disque de frein » ✗ pour plaquette). Sans gate → rejet. Couverture 19 gammes ; sinon pas de modifieur (fallback propre).
- **Respect meta optimisées** : si `sgc_descrip` est de la vraie prose (contient un verbe / pas seulement des placeholders), on la garde. Aujourd'hui les 118 sont dégénérées → composeur actif.

### Exemple cible
> « Trouvez votre **plaquette de frein** pour **PEUGEOT 207 1.4 HDI (68 ch)** : 24 références compatibles dès **9,00 €**. Livraison rapide. »
(frame 2, type 57720) → « Besoin de **plaquettes de frein** pour **PEUGEOT 207 1.9 D** ? Comparez les références compatibles à partir de **10,00 €**. Expédition rapide. »

## 4. Architecture (réutilise l'existant)

1. **`VehicleAwareDescriptionComposer`** (pur, `backend/src/modules/catalog/services/`) — `compose(ctx): string`. Frames + rotation déterministe + gestion slots manquants. **Cœur testable isolément, 0 I/O.**
2. **Gate keyword** : helper `pickGammeKeywordModifier(gammeCoreWords, keywords)` pur — filtre relevance, retourne un modifieur sûr ou `null`.
3. **`SeoTemplateService`** : pour le champ `description`, si template dégénéré → utiliser le composeur ; sinon garder prose. (Détection « dégénéré » = après substitution, pas de verbe-frame / quasi vide.)
4. **`RmBuilderService.getPageCompleteV2`** : injecte `gamme_keywords` dans `ctx` (comme `comp_switches` l.613), lus via une requête `__seo_keywords` par `pg_id` (cache, comme `loadCompSwitches`).

## 5. Garde-fous
- Déterministe, 0 LLM. Terme produit autoritaire (jamais keyword brut). Zéro nouvelle table. Zéro URL/route modifiée. Pas de placeholder résiduel. Meta optimisées intouchables. Branche dédiée + worktree.

## 6. Hors V1 (différé)
- Nettoyage du mapping keyword→gamme (`__seo_keywords` contaminé) → puis enrichissement keyword élargi.
- Contrôle ponctuel LanguageTool sur phrase composée (optionnel, CI/audit).
- Mesure GSC après recrawl PROD.

## 7. Critères de succès V1
- 2 motorisations d'un même modèle → descriptions **distinctes ET grammaticalement complètes** (verbe présent).
- Aucun placeholder résiduel ; clause prix/count omise proprement si absente.
- Terme produit = nom de gamme DB (jamais « disque » sur une page « plaquette »).
- Tests unitaires composeur + gate keyword verts.
