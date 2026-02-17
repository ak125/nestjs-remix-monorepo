# Score Qualité Multi-Dimensionnel

> Aligné avec le scoring du backend (`buying-guide-enricher.service.ts` + `quality-validator.service.ts`)

---

## 6 dimensions (total 100 pts)

| Dimension | Pts | Critères |
|-----------|-----|----------|
| Alignement intent | 0-20 | Rôle page (R1-R6) respecté, vocabulaire exclusif, pas de cannibalisation |
| Signaux E-E-A-T | 0-20 | Données terrain, expertise technique, sources référencées, transparence |
| Clarté entité | 0-15 | Entité primaire nommée dans les 100 premiers mots, schema.org correct |
| GEO-readiness | 0-15 | Paragraphes auto-suffisants, info front-loaded, format extractible |
| Profondeur contenu | 0-15 | Word count adapté au V-Level, sous-thèmes couverts, FAQ ≥ 3 |
| Conformité technique | 0-15 | mechanical_rules respectées, family terms présents, source provenance, page_contract exploité |

---

## Seuils de publication

| Score | Décision |
|-------|----------|
| ≥ 80 | Publiable tel quel |
| 60-79 | Acceptable avec réserves (justifier les manques) |
| < 60 | Rejet — réécriture nécessaire |
| > 90 | **Interdit en auto-évaluation** — nécessite validation externe |

---

## Pénalités automatiques

| Flag | Pénalité | Détection |
|------|----------|-----------|
| `GENERIC_PHRASES` | -18 pts | "rôle essentiel", "bon fonctionnement", "il est important" |
| `MISSING_REQUIRED_TERMS` | -16 pts | Termes famille absents (ex: "frein", "freinage" pour famille freinage) |
| `MISSING_SOURCE_PROVENANCE` | -20 pts | Aucune source RAG/PDF/OEM référencée |
| `FAQ_TOO_SMALL` | -14 pts | Moins de 3 FAQ |
| `SYMPTOMS_TOO_SMALL` | -12 pts | Moins de 3 symptômes (si R5 ou guide achat) |
| `TOO_SHORT` | -10 pts | Contenu narratif < 40 caractères par section |
| `TOO_LONG` | -8 pts | Section narrative > 420 caractères |
| `DUPLICATE_ITEMS` | -8 pts | Doublons dans les listes (FAQ, symptômes, critères) |
| `STALE_SOURCE` | -6 pts | Knowledge doc `updated_at` > 6 mois |

---

## Termes famille requis

| Famille | Termes obligatoires (au moins 2) |
|---------|--------------------------------|
| freinage | frein, freinage, distance, sécurité |
| moteur | moteur, combustion, lubrification, fiabilité |
| suspension | suspension, stabilité, amortissement, tenue |
| transmission | transmission, couple, embrayage, motricité |
| electrique | électrique, charge, alimentation, batterie |
| climatisation | climatisation, froid, pression, compresseur |

---

## Termes purchase_guardrails (additifs)

Les `purchase_guardrails.forbidden_terms` de chaque knowledge doc s'ajoutent **dynamiquement** aux mots interdits globaux.

Termes courants dans le corpus :
- `universel`, `tous modèles`, `adaptable tous`, `compatible tout véhicule`

Ces termes sont **additifs** aux termes famille requis et aux mots interdits globaux définis dans le SKILL.md.
Ils sont extraits du frontmatter YAML du knowledge doc en Phase 1b (Étape 2).
