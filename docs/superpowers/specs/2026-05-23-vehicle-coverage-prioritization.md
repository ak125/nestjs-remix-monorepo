# Vehicle / Gamme Coverage Prioritization — Block A2bis

**Date** : 2026-05-23
**Audit parent** : `2026-05-23-diagnostic-engine-reality-audit.md`
**Objectif** : identifier les gammes/véhicules commerce-relevant pour prioriser la couverture diagnostic V1.1 data pipeline.

---

## Méthode

Requête `___xtr_order_line` jointe à `___xtr_order` sur 12 derniers mois, agrégée par `orl_pg_id` (gamme), filtre `pg_id` entier (exclut placeholders).

**Avertissement** : volumes commerce **très faibles** (max 6 commandes distinctes sur 12 mois pour la gamme top). Corrobore Reality Audit 2026-05-20 (PR #652) verdict `conversion_funnel` (0.17% conv organic) et mémoire `project_supplier_truth_v1_20260520` (audit proportionnalité 11 cmd payées/12mo). La prioritisation reste utile pour focaliser V1.1 mais l'absolu commerce reste à élargir indépendamment.

---

## Top 30 gammes par volume commande 12 mois (live)

| Rang | pg_id | Gamme | Distinct orders | Total units | Couvert CAUSE_GAMME_MAP ? |
|---|---|---|---|---|---|
| 1 | 312 | Galet enrouleur de courroie d'accessoire | 6 | 6 | ❌ |
| 2 | 3217238 | Cardan | 5 | 5 | ⚠️ (`soufflet_cardan` mappé sur 193) |
| 3 | 3283441 | Jeu d'émetteurs et récepteurs embrayage | 4 | 4 | ❌ |
| 4 | 9573325 | Filtre à huile | 3 | 3 | ❌ |
| 5 | 193 | Soufflet de Cardan | 2 | 2 | ✅ (`soufflet_cardan_dechire`) |
| 6 | 342627 | Joint de cache culbuteurs | 2 | 4 | ❌ |
| 7 | 1090573 | Jeu de 4 plaquettes de frein | 2 | 2 | ⚠️ (variant ; CAUSE_GAMME_MAP utilise 402 simple) |
| 8 | 3283439 | Jeu d'émetteurs et récepteurs embrayage | 2 | 2 | ❌ |
| 9 | 8291920 | Kit d'embrayage | 2 | 2 | ❌ (variant ; CAUSE_GAMME_MAP utilise 479 ⚠️ mismatch — voir Finding #2) |
| 10 | 1090658 | Jeu de 4 plaquettes de frein | 1 | 1 | ⚠️ variant |
| 11 | 1783478 | Capteur niveau de carburant | 1 | 1 | ❌ |
| 12 | 3090507 | Joint de cache culbuteurs | 1 | 1 | ❌ |
| 13 | 61100 | Jeu de 4 plaquettes de frein | 1 | 1 | ⚠️ variant |
| 14 | 3253191 | Kit d'embrayage | 1 | 1 | ❌ variant |
| 15 | 8934318 | Filtre à huile | 1 | 1 | ❌ |
| 16 | 478 | Câble d'embrayage | 1 | 1 | ❌ |
| 17 | 3468161 | Câble compteur de vitesse | 1 | 1 | ❌ |
| 18 | 222984 | Sphère de suspension | 1 | 2 | ❌ |
| 19 | 308374 | Maître-cylindre de frein | 1 | 1 | ❌ |
| 20 | 321 | Joint de cache culbuteurs | 1 | 3 | ❌ |
| 21 | 8650766 | Alternateur | 1 | 3 | ⚠️ variant (CAUSE_GAMME_MAP utilise 4) |

---

## Mapping commerce ↔ CAUSE_GAMME_MAP (gap analysis)

### Diagnostic-engine couvre déjà (causes mappées) :

- ✅ Plaquette de frein (pg_id 402) — variants commerce 1090573, 1090658, 61100
- ✅ Disque de frein (pg_id 82)
- ✅ Étrier de frein (pg_id 78)
- ✅ Batterie (pg_id 1)
- ✅ Démarreur (pg_id 2)
- ✅ Alternateur (pg_id 4) — variant commerce 8650766
- ✅ Soufflet de Cardan (pg_id 193) — variant commerce 3217238 (Cardan complet)
- ✅ Bougie de préchauffage (pg_id 243)
- ✅ Feu avant (pg_id 259), Feu arrière (pg_id 290), Ampoule (pg_id 1457)
- ⚠️ Liquide de frein (mauvais pg_id 479 → corriger en 71 — Finding #2)

### Gammes commerce-relevant SANS couverture diagnostic (V1.1 priority)

| pg_id | Gamme | Orders 12mo | Système diagnostic candidat | Cause à ajouter |
|---|---|---|---|---|
| 312 | Galet enrouleur de courroie d'accessoire | 6 | distribution | `galet_tendeur_courroie_use` ou similaire |
| 3217238 | Cardan (complet) | 5 | transmission | `cardan_use` (complément de `soufflet_cardan_dechire`) |
| 3283441, 3283439 | Jeu d'émetteurs et récepteurs embrayage | 4+2 | embrayage | `embrayage_assistance_hs` |
| 9573325, 8934318 | Filtre à huile | 3+1 | filtration | `filtre_huile_intervalle_depasse` ou `filtre_huile_use` |
| 342627, 3090507, 321 | Joint de cache culbuteurs | 2+1+1 | injection (fuite huile haute) | `joint_culbuteurs_fuite` |
| 8291920, 3253191 | Kit d'embrayage | 2+1 | embrayage | `embrayage_use_complet` |
| 478 | Câble d'embrayage | 1 | embrayage | `cable_embrayage_casse_use` |
| 1783478 | Capteur niveau carburant | 1 | injection | `capteur_niveau_carburant_hs` |
| 222984 | Sphère de suspension | 1 | suspension (hydropneumatique) | `sphere_suspension_dechargee` (Citroën spécifique) |
| 308374 | Maître-cylindre de frein | 1 | freinage | `maitre_cylindre_frein_hs` |

---

## Prioritization V1.1 Data Pipeline

**Recommandation** : V1.1 Data Enrichment Pipeline cible en priorité les 8 systèmes diagnostic avec coverage commerce active :

1. **freinage** — plaquettes (couvert), disques (couvert), maître-cylindre (à ajouter)
2. **embrayage** — kit, jeu émetteurs/récepteurs, câble (à ajouter — 3 causes)
3. **distribution** — galet enrouleur (à ajouter)
4. **transmission** — cardan complet (compléter)
5. **filtration** — filtre huile (à ajouter)
6. **injection** — joint culbuteurs, capteur carburant (à ajouter)
7. **demarrage_charge** — batterie/démarreur/alternateur (couvert, élargir variants)
8. **suspension** — sphère hydropneumatique (à ajouter, peu fréquent)

**Pas prioritaire V1.1** : climatisation, direction, echappement, eclairage — 0 commande historique 12 mois sur les pg_ids principaux. Reste couvert diagnostic mais data enrichment différé.

---

## Action items V1A.0 / V1.1

| Action | Phase | Détail |
|---|---|---|
| Fix `CAUSE_GAMME_MAP brake_fluid_low → pg_id 71` | V1A.0 PR ou hotfix | 1 ligne, déterministe |
| Audit CAUSE_GAMME_MAP complet (61 entrées vs pieces_gamme) | V1A.0 side-task | Script `scripts/audit/cause-gamme-map-cross-ref.ts` |
| Ajouter 10 nouvelles causes (variant commerce) | V1.1 Data Pipeline | Wiki frontmatter v2.0.0 + migration `__diag_cause` additive |
| Étendre CAUSE_GAMME_MAP +50 entrées variants | V1.1 | Mapping complémentaire pg_id principaux ↔ variants commerce |
| Mesurer absolute commerce volume | Commerce-Loop V1 (séparé) | Le faible volume order base est un problème indépendant de la couverture diagnostic |

---

## Caveat important

La couverture diagnostic actuelle est **déjà alignée** sur les gammes les plus vendues (freinage, alternateur, batterie, soufflet cardan). Le bottleneck réel n'est **pas** la coverage diagnostic mais le **volume commerce total** (réalité audit 2026-05-20). V1A.0 R5→Diagnostic→CTA vise précisément à augmenter ce volume via tunnel — V1.1 data enrichment vient ensuite pour multiplier la portée par couverture.

**Implication discipline V1A.0** : ne PAS over-investir en data enrichment avant prouver que le tunnel R5→Diagnostic→CTA convertit avec la couverture actuelle.
