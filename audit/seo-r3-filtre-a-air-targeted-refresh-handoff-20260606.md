# Handoff seo-batch — Correction gouvernée S5 / S_GARAGE / FAQ — R3 `filtre-a-air`

> **Consigne d'exécution gouvernée (read-only doc).** À exécuter depuis `cd workspaces/seo-batch`
> via le pipeline gouverné (`/content-gen --r3` + quality-gate + `r3-conseils-validator`).
> **Ne pas** muter `__seo_gamme_conseil` à la main. **Aucune** 301/canonical/noindex/runtime/role-matrix.
> Pilote = `filtre-a-air` uniquement ; les 11 autres gammes = suivi documenté, **pas** maintenant.

## 1. Cause racine (vérifiée, read-only)

- 247/259 sections S5 sont correctes → le mapping `selection.anti_mistakes → S5` **fonctionne** ; ce
  n'est **pas** un bug global. **12 gammes** ont un RAW `selection.anti_mistakes` mal peuplé (garde-fous
  éditoriaux `❌ "homologué CT"` / `❌ "garanti à vie"` au lieu de vraies erreurs utilisateur).
- **`filtre-a-air` est le cas aigu** : son S5 = **uniquement** la liste de garde-fous (108 c, le seul S5
  < 200 c du corpus). Les 11 autres ont les `❌` **mélangés** à du contenu par ailleurs substantiel
  (343–2945 c, scores 78–90) → nettoyage plus léger.
- Régénérer aveuglément reproduirait le défaut (même source `anti_mistakes`). Patcher la DB à la main = bricolage.

## 2. État « avant » — `filtre-a-air` (pg_id 8) — capturé read-only le 2026-06-06

| Section | score | len | source actuelle | verdict |
|---|---|---|---|---|
| S5 (erreurs) | 85 | **108** | `selection.anti_mistakes` (garde-fous ❌) | **à corriger** (mal sourcé + trop court) |
| S_GARAGE | **70** | 374 | `installation.difficulty` | **à corriger** (< plancher eeat 75 ; générique « confier à un pro » vs pièce facile) |
| S8 (FAQ) | 100 | 1114 | `rendering.faq` | **5 questions** → ajouter 1 (eeat `minFaqCount=6`) |
| S1·S2·S2_DIAG·S3·S4_DEPOSE·S4_REPOSE·S6·S7·META | 76–100 | — | — | **préserver** (déjà conformes) |

Barre citée : `PACK_DEFINITIONS.eeat` (`backend/src/config/conseil-pack.constants.ts:49-67` :
`minSectionScore=75`, `minPackScore=85`, `minFaqCount=6`). Scorer : `conseil-quality-scorer.service.ts`.

## 3. Source S5 corrigée (sourcée RAW, jamais inventée)

Construire S5 « erreurs fréquentes » depuis les **vraies erreurs** du RAW `gammes/filtre-a-air.md`
(NE PAS rendre `selection.anti_mistakes` — le reléguer à son rôle de garde-fou de génération) :

- `maintenance.good_practices` (négativées) → « ne jamais souffler à l'air comprimé (endommage les
  fibres) », « ne pas rouler sans filtre », « vérifier l'étanchéité du boîtier après remplacement ».
- `domain.confusion_with` → confondre avec **filtre d'habitacle** (air passagers), **filtre à huile**,
  **filtre à carburant** (pièces distinctes).
- (prudemment) choisir sans vérifier la compatibilité véhicule / dimensions / référence OE.

## 4. Correction S_GARAGE

Réécrire selon la difficulté réelle (`installation.difficulty = très facile`, `time ≈ 5 min`) :
le remplacement est simple/DIY. Recommander un pro **seulement si** : boîtier d'accès difficile,
clips/vis cassés, doute sur la référence, **symptômes moteur persistants après remplacement**
(suspicion débitmètre / admission / turbo / EGR). Éviter le « confiez à un professionnel » générique.

## 5. Correction FAQ (S8 : 5 → ≥6)

Ajouter 1 question utile, non redondante, prudente. Pistes : « Peut-on rouler avec un filtre à air
encrassé ? » · « Différence filtre à air vs filtre d'habitacle ? » · « Un filtre encrassé peut-il
causer une perte de puissance ? ». Pas de promesse trompeuse.

## 6. Contraintes strictes

**Interdit** : patch DB manuel hors pipeline · modif R4/R6 · 301 · canonical · noindex · runtime ·
role-matrix · refonte complète R3 · génération massive · traitement des 11 autres gammes maintenant.
**Autorisé** : correction RAW/WIKI gouvernée `filtre-a-air` · régénération **limitée** à S5 / S_GARAGE
/ (si besoin S8) via `/content-gen --r3` · quality-gates existants · audit avant/après.

## 7. Workflow attendu (seo-batch)

```bash
cd workspaces/seo-batch
# 1. lire le RAW filtre-a-air ; 2. corriger la source S5 (good_practices + confusion_with, pas anti_mistakes) ;
# 3. régénérer UNIQUEMENT S5 / S_GARAGE / (S8 si <6) ; 4. quality-gate R3 + r3-conseils-validator ;
# 5. vérifier rendu DEV (http://localhost:3000/blog-pieces-auto/conseils/filtre-a-air).
```
Agents/skills : `content-gen` + `conseil-batch` + `r3-conseils-validator` (workspaces/seo-batch/.claude/).

## 8. Vérifications obligatoires (après)

- `S_GARAGE` `sgc_quality_score ≥ 75` ; `S5` longueur utile + contenu **réellement utilisateur** (plus de `❌`-garde-fous) ;
- `S8` FAQ ≥ 6 ; R3 reste **EEAT-baseline compatible** ; **aucune régression** sur les autres sections ;
- aucune action URL / R4 / R6 / panier / catalogue / prix ; rendu DEV OK.

## 9. Livrable attendu (produit par la session seo-batch)

`audit/seo-r3-filtre-a-air-targeted-refresh-20260606.md` : cause racine confirmée · sections modifiées
· sections préservées · score avant/après · FAQ count · rendu DEV vérifié · décision READY / PARTIAL /
BLOCKED · les 11 gammes de suivi listées (ci-dessous), **sans traitement**.

## 10. Suivi — 11 gammes (S5 guardrail-leak, NE PAS traiter maintenant)

`cardan`(13) · `colonne-de-direction`(1211) · `cable-d-embrayage`(478) · `capteur-abs`(412) ·
`maitre-cylindre-de-frein`(258) · `joint-de-collecteur`(40) · `evaporateur-de-climatisation`(471) ·
`radiateur-de-refroidissement`(470) · `agregat-de-freinage`(415) · `radiateur-de-chauffage`(467) ·
`bougie-d-allumage`(686). *(Contamination `❌` mineure mêlée à du contenu OK ; nettoyage léger, lot gouverné ultérieur.)*

## Verdict cible

`filtre-a-air R3 = EEAT-baseline compatible avec S5 + S_GARAGE corrigés + FAQ ≥ 6`.
Aucune 301, aucun canonical, aucune consolidation R4/R6 dans ce chantier.
