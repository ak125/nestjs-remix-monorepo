# R3 EEAT Baseline — filtre-a-air (pg_id 8) — 2026-06-06

> Pilote #1 de la doctrine `seo-r-page-excellence-baseline-doctrine-20260606.md`.

## 1. Scope

Audit **read-only**. Aucune génération · aucune action URL · aucun changement contrat/role-matrix ·
aucune 301/canonical · aucun nouveau scorer. Une note Markdown, point.

## 2. Canon cited, not redefined

- **Barre d'excellence R3** = `PACK_DEFINITIONS.eeat` — `backend/src/config/conseil-pack.constants.ts:49-67` :
  requiredSections `[S1,S2,S2_DIAG,S3,S4_DEPOSE,S5,S_GARAGE,S6,S8]` · optional `[S4_REPOSE,S7,META]` ·
  `minSectionScore=75` · `minPackScore=85` · `minFaqCount=6`.
- **Scorers** : `backend/src/modules/admin/services/conseil-quality-scorer.service.ts` (`sgc_quality_score`
  /100 par section) ; `quality-scoring-engine.service.ts` (page). **Non ré-exécutés** ici — on lit les
  `sgc_quality_score` déjà persistés (read-only).
- **Ancres** : invariant `slugifyTitle(sgc_title)` — `backend/src/modules/blog/services/r3-guide.service.ts:434`.
- **Garde-fou rôle** : `role-matrix.md` R3 `forbidden_dominant_signals` (buying_checklist, quality_tiers,
  transactional_listing, symptom_tree, deep_glossary) ; **S3 = compatibilité/critères** (≠ « comment choisir » = R6) ;
  **CTA soft → R1** uniquement (le runtime strippe déjà le prix + no-cart).

> **Cet audit n'introduit aucune formule de score nouvelle. La vue /100 côté owner est une *projection*
> des scores section/page existants + les 3 checks de gap observés.**

## 3. Live state — filtre-a-air (DB `__seo_gamme_conseil`, sgc_pg_id='8', read-only)

| Section | order | len | `sgc_quality_score` | source (RAG) | eeat |
|---|---|---|---|---|---|
| S1 (rôle) | 10 | 845 | **100** | domain.role | req ✓ |
| S2 (quand changer) | 20 | 321 | 85 | maintenance.interval | req ✓ |
| S2_DIAG (#diagnostic) | 25 | 1128 | 85 | diagnostic.symptoms | req ✓ |
| S3 (compatibilité*) | 30 | 617 | **100** | selection.criteria | req ✓ |
| S4_DEPOSE | 40 | 542 | 85 | diagnostic.causes | req ✓ |
| S5 (erreurs) | 60 | **108** | 85 | selection.anti_mistakes | req ✓ (len anormale) |
| S6 (vérifs après) | 65 | 2363 | **100** | maintenance.good_practices | req ✓ |
| **S_GARAGE** (pro) | 67 | 374 | **70** | installation.difficulty | **req ✗ (<75)** |
| S8 (FAQ) | 85 | 1114 | **100** | rendering.faq | req ✓ |
| S4_REPOSE | 50 | 1668 | 76 | installation.steps | opt ✓ |
| S7 (pièces liées) | 80 | 2031 | **100** | domain.related_parts | opt ✓ |
| META | 99 | 282 | 80 | domain.role+ | opt ✓ |

`*` S3 titre = « Comment choisir vos filtre à air » **mais source = `selection.criteria`** ⇒ contenu
**compatibilité-light (role-safe)** ; seul le *libellé* flirte avec le vocabulaire R6.

- **9/9 sections requises eeat présentes** ; pack moyenne (requises) ≈ **90 ≥ 85** ✓.
- **Toutes les 12 sections sourcées RAG** (`gammes/filtre-a-air.md`) ✓.

## 4. Thin gap checks (observés, non scorés par un nouvel engine)

- **Ancres canoniques** : ⚠️ les ancres sont des **slugs de titres complets** (`fonction-du-filtre-a-air`,
  `diagnostic-rapide-du-filtre-a-air`, `comment-choisir-vos-filtre-a-air`…), **pas** le set propre
  `#role/#diagnostic-rapide/#comment-choisir/#compatibilite/#faq`. Gap d'ancres = réel (titres ≠ ancres figées).
- **CTA → R1/pièces** : chemin de rendu `SoftCTA → /pieces/{alias}-{id}.html` (`ConseilSections.tsx`) — soft,
  canon-OK ; **non re-vérifié live** dans cette baseline (observation, pas mesure).
- **Provenance RAW/WIKI** : `sgc_sources` non-vide ET référence `gammes/filtre-a-air.md` (RAW) pour 12/12 ✓.

## 5. Verdict

**EEAT-baseline compatible with known soft spots.** 9/9 sections requises présentes, pack ≈ 90 ≥ 85,
100 % sourcé RAG. **NON « excellent » tant que** : (a) **S_GARAGE = 70 < `minSectionScore` 75** (seul
manquement au plancher par-section eeat) ; (b) **S5 anormalement court (108 c)** malgré un score 85
(angle mort du scorer sur la longueur) ; (c) **`minFaqCount` eeat = 6 non vérifié** sur S8 ; (d) **ancres
canoniques non confirmées** (slugs de titres).

> **Correction des soft spots présumés** : la donnée DB montre que le manquement au plancher eeat est
> **S_GARAGE (70)**, **pas** S4_REPOSE (76, optionnel, ≥75 → passe). S5 reste un point faible *de longueur*
> (108 c), pas de score. ⇒ le `next_action` cible S_GARAGE + S5, pas « S5 + S4_REPOSE ».

## 6. Next action (étroit, owner-gated)

Refresh contenu gouverné limité à **S_GARAGE + S5 uniquement** via `/content-gen --r3` (seo-batch), si l'owner approuve :
- **S_GARAGE** : remonter à `sgc_quality_score ≥ 75` (plancher eeat) ;
- **S5** : étoffer à une longueur utile (108 c → contenu réel « erreur → risque → correctif ») ;
- **vérifier** `S8` FAQ count ≥ 6 (`minFaqCount` eeat) ;
- **préserver** S1/S2_DIAG/S3/S6/S7/S8 (déjà 100/85) ; **aucune** action URL R4/R6 ; **aucune** 301/canonical ; **aucune** régénération complète.
- (Optionnel, séparé) clarifier le *libellé* S3 « comment choisir » → « critères de compatibilité » pour lever l'ambiguïté R6 (contenu déjà role-safe).

## 7. 301 posture

**NO-GO maintenant.** Cross-link `#866` (`seo-r3-pillar-consolidation-evidence` : `OBSERVE 10/10`,
R4/R6 = KEEP — l'évidence ne soutient pas un fold massif). 301 chirurgicale plus tard, owner-gated + ADR,
par lot ≤5 + surveillance GSC, **après** R3 prête.
