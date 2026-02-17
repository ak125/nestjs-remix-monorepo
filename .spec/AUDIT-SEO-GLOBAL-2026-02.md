# Audit SEO Global Multi-Roles — Rapport Complet

> Date : 2026-02-17 | Auditeur : Claude Opus 4.6
> Framework : content-audit R2D2 (Intent-First, Evidence-First, Decision-First)
> Base : Supabase massdoc (cxpojprgwgubzjyqzmoq)

---

## 1. CENSUS — Inventaire par Role

| Role | Pages | Couverture SEO | Score /6 | Etat |
|------|-------|----------------|----------|------|
| **R1 Router** | 4 205 gammes | 118 avec contenu (2.8%) | **1/6** | CRITIQUE |
| **R3a Conseils** | 155 gammes | 775 sections | **3/6** | LACUNES |
| **R3b Guide-achat auto** | 221 guides | FAQ OK, contenu partiel | **2/6** | LACUNES |
| **R3b Guide-achat manual** | 222 guides | 1 774 H2 | **3/6** | A ENRICHIR |
| **R4 Reference** | 138 refs | 138/138 Gold 6/6 | **6/6** | TERMINE |
| **R5 Diagnostic** | 193 observables | Contenu generique 66% | **1/6** | CRITIQUE |
| **R6 Support** | ~10 pages | Statiques | **3/6** | ACCEPTABLE |

**Score global moyen : 2.7/6** — Le site est en dessous du seuil de publication (4/6) sur 5 des 7 roles.

---

## 2. CONSTATS DETAILLES PAR ROLE

### R1 Router — Score 1/6

| Critere | Resultat | Seuil | Status |
|---------|----------|-------|--------|
| Couverture SEO | 118/4 205 (2.8%) | 100% | BLOQUANT |
| Meta description | Moy. 38 chars | 140-160 | BLOQUANT |
| Meta format | Templates (#Variables#) | Texte reel | WARNING |
| Contenu body | 114 avec contenu (moy 935 chars) | >150 words | OK pour les 114 |
| H1 | Templates (#VMarque# #VModele#...) | OK si resolu | OK |
| Contenu sans SEO | 4 087 pages thin content | 0 | BLOQUANT |

**Constat principal :** 97.2% des pages gamme servent du contenu SEO nul. Les 118 pages avec contenu utilisent des templates variables (#VMarque#, #CompSwitch_2#) resolus dynamiquement — le contenu DB lui-meme est un template, pas du contenu reel.

**Meta descriptions :** Toutes a 34-40 chars (ex: "#LinkGammeCar_415#, #CompSwitch_3_415#") — ce sont des placeholders de template, pas des meta reelles.

### R3a Conseils — Score 3/6

| Section | Remplie | Total | Taux | Status |
|---------|---------|-------|------|--------|
| S1 Avant de commencer | 153 | 155 | 99% | OK |
| S2 Signes d'usure | 151 | 155 | 97% | OK |
| S3 Compatibilite | 5 | 155 | 3% | BLOQUANT |
| S4 Depose | 126 | 155 | 81% | WARNING |
| S4 Repose | 127 | 155 | 82% | WARNING |
| S5 Erreurs frequentes | 1 | 155 | 0.6% | BLOQUANT |
| S6 Verification finale | 1 | 155 | 0.6% | BLOQUANT |
| S7 Pieces complementaires | 33 | 155 | 21% | WARNING |
| S8 FAQ | 1 | 155 | 0.6% | BLOQUANT |
| **Complete (S1+S2+S3+S4+S5+S8)** | **1** | **155** | **0.6%** | BLOQUANT |

**Constat principal :** Le contenu existant (S1, S2, S4) est de bonne qualite (procedures detaillees avec liens internes). Mais 4 sections obligatoires sont quasi-vides : S3 Compatibilite (3%), S5 Erreurs (0.6%), S6 Verification (0.6%), S8 FAQ (0.6%).

**Qualite contenu existant :**
- plaquette-de-frein : S1 (835 chars), S2 (2 517 chars), S4 (1 788 chars) — bon
- filtre-a-huile : S1 (385 chars), S2 (2 214 chars), S4 (1 586 chars) — bon
- turbo : S1 (1 010 chars), S2 (579 chars), S4 (2 446 chars) — bon
- Maillage interne present (liens vers R4, R1, pieces associees)

### R3b Guide-achat Auto — Score 2/6

| Champ | Rempli | Total | Taux | Status |
|-------|--------|-------|------|--------|
| intro_role | 221 | 221 | 100% | OK |
| risk_explanation | 221 | 221 | 100% | OK |
| timing_km | 214 | 221 | 97% | OK |
| symptoms | 221 | 221 | 100% | OK |
| FAQ (3+ questions) | 221 | 221 | 100% | OK |
| **how_to_choose** | **38** | **221** | **17%** | **BLOQUANT** |
| **anti_mistakes** | **1** | **221** | **0.5%** | **BLOQUANT** |
| selection_criteria | 3 | 221 | 1.4% | BLOQUANT |
| decision_tree | 3 | 221 | 1.4% | BLOQUANT |
| use_cases | 1 | 221 | 0.5% | WARNING |
| **source_type** | **1** | **221** | **0.5%** | **WARNING** |

**Constat principal :** Structure de base presente (intro, risque, timing, FAQ, symptoms). Mais le coeur du guide d'achat manque : la methode de choix (how_to_choose), les erreurs a eviter (anti_mistakes), et les criteres de selection.

**Echantillon disque-de-frein (pg_id=82) :** Le seul guide enrichi — contenu de qualite professionnelle (intro, how_to_choose, risk, FAQ 6 questions, source RAG). Cet enrichissement doit etre replique sur les 220 autres.

### R3b Guide-achat Manual — Score 3/6

| Critere | Resultat | Seuil | Status |
|---------|----------|-------|--------|
| Contenu moyen | 741 chars | 600-900 | OK (fourchette basse) |
| Min/Max contenu | 643 - 1 534 chars | — | OK |
| Meta description | Moy. 107 chars | 120-170 | BLOQUANT (91% sous 120) |
| Meta OK (120-170) | 20/222 (9%) | 100% | BLOQUANT |
| H2 par guide | ~8 H2/guide | >=7 | OK |
| H3 profondeur | 8 total (0.04/guide) | >=1/H2 | WARNING |

**Constat principal :** Contenu editorial de longueur acceptable mais structure plate (pas de H3). Meta descriptions trop courtes (107 chars en moyenne, 91% sous le seuil de 120).

### R4 Reference — Score 6/6

| Critere | Resultat | Status |
|---------|----------|--------|
| Gold 6/6 | 138/138 | OK |
| Meta 140-160 | 138/138 | OK |
| Role mecanique >= 300 | 138/138 | OK |
| Generic AI phrases | 0 | OK |
| **Anti-pattern prix/€** | **25 refs** | **WARNING** |

**Constat principal :** Enrichissement termine et conforme. **Seul defaut : 25 refs contiennent "prix" ou "€" dans la definition (20), role_negatif (6) ou scope_limites (2).** Ce vocabulaire commercial est interdit en R4 selon le spec.

**Refs concernees :** agregat-de-freinage, alternateur, batterie, capteur-abs, chaine-de-distribution, courroie-d-accessoire, courroie-de-distribution, cylindre-de-roue, demarreur, disque-de-frein, etrier-de-frein, filtre-a-huile, interrupteur-des-feux-de-freins, kit-d-embrayage, kit-de-chaine-de-distribution, kit-de-distribution, kit-de-freins-arriere, maitre-cylindre-de-frein, pompe-a-eau, pompe-a-vide-de-freinage, poulie-d-alternateur, poulie-vilebrequin, servo-frein, soufflet-de-direction, temoin-d-usure.

### R5 Diagnostic — Score 1/6

| Critere | Resultat | Seuil | Status |
|---------|----------|-------|--------|
| Pages publiees | 193 | — | OK |
| Meta description | Moy. 109 chars | 120-170 | BLOQUANT (69% sous 120) |
| Schema.org | 0/193 | 100% | BLOQUANT |
| Contenu generique | 127/193 (66%) | 0% | BLOQUANT |
| Template "bruit anormal" | 136/193 (70%) | 0% | BLOQUANT |
| Descriptions courtes | Moy. 169 chars symptom | >300 | BLOQUANT |
| Risk level renseigne | 193/193 | 100% | OK |
| Safety gate renseigne | 193/193 | 100% | OK |
| Actions >= 3 | 188/193 | >= 3 | OK |
| DTC codes | 42/193 | — | OK (attendu) |

**Constat principal :** Le contenu R5 est MASSIVEMENT generique. 66% des pages utilisent le template "peut indiquer une usure ou un dysfonctionnement" et 70% commencent par "Un bruit anormal au niveau du {piece}". Les descriptions sont trop courtes (moy. 169 chars vs cible >300). Aucun Schema.org genere.

**Ventilation par canal de perception :**
| Canal | Pages | Avg symptom | Avg sign | Avg meta |
|-------|-------|-------------|----------|----------|
| auditory | 139 | 148 chars | 136 chars | 102 chars |
| visual | 33 | 207 chars | 253 chars | 126 chars |
| tactile | 10 | 270 chars | 287 chars | 132 chars |
| olfactory | 10 | 223 chars | 279 chars | 136 chars |
| electronic | 1 | 170 chars | 138 chars | 112 chars |

Les descriptions auditives (72% des pages) sont les plus courtes et generiques.

---

## 3. ANTI-PATTERNS DETECTES

| # | Anti-pattern | Severite | Pages | Action |
|---|-------------|----------|-------|--------|
| AP-1 | R4 definition contient prix/€ | WARNING | 25 refs | Supprimer mentions prix |
| AP-2 | R5 contenu template generique (66%) | BLOQUANT | 127 pages | Reecriture complete |
| AP-3 | R5 schema_org absent (100%) | BLOQUANT | 193 pages | Generer JSON-LD |
| AP-4 | R1 meta description = template (#var#) | BLOQUANT | 118 pages | Reecrire metas |
| AP-5 | R3b manual meta < 120 chars (91%) | BLOQUANT | 202 pages | Allonger metas |
| AP-6 | R3a S5/S6/S8 quasi-vides | BLOQUANT | 154 gammes | Generer contenu |
| AP-7 | R3b auto how_to_choose vide (83%) | BLOQUANT | 183 guides | Enrichir |
| AP-8 | R3b auto anti_mistakes vide (99.5%) | BLOQUANT | 220 guides | Enrichir |
| AP-9 | R1 thin content (97.2% sans SEO) | BLOQUANT | 4 087 gammes | Plan long terme |
| AP-10 | R5 meta < 120 chars (69%) | WARNING | 133 pages | Allonger metas |

---

## 4. TOP 10 ACTIONS DE REMEDIATION

Ordonnees par **Impact SEO x Effort** :

| Prio | Action | Role | Pages | Effort | Impact | ROI |
|------|--------|------|-------|--------|--------|-----|
| **P1** | R5 : generer Schema.org pour 193 observables | R5 | 193 | SQL bulk | Rich snippets Google | TRES HAUT |
| **P2** | R4 : purger prix/€ des 25 definitions | R4 | 25 | SQL bulk | Conformite role | HAUT |
| **P3** | R5 : reecrire 127 descriptions generiques | R5 | 127 | Contenu genere | Qualite page | HAUT |
| **P4** | R3b manual : allonger 202 meta descriptions | R3b | 202 | SQL bulk | CTR SERP | HAUT |
| **P5** | R3a : generer S5 Erreurs pour 154 gammes | R3a | 154 | Contenu genere | Decision-First | MOYEN |
| **P6** | R3a : generer S8 FAQ pour 154 gammes | R3a | 154 | Contenu genere | Rich snippets FAQ | MOYEN |
| **P7** | R3b auto : enrichir how_to_choose pour 183 guides | R3b | 183 | Contenu genere | Decision-First | MOYEN |
| **P8** | R3b auto : enrichir anti_mistakes pour 220 guides | R3b | 220 | Contenu genere | Qualite page | MOYEN |
| **P9** | R5 : allonger 133 meta descriptions | R5 | 133 | SQL bulk | CTR SERP | MOYEN |
| **P10** | R1 : plan de contenu SEO pour top gammes | R1 | TBD | Strategie | Trafic organique | LONG TERME |

---

## 5. ROADMAP DE REMEDIATION

### Sprint 1 — Quick Wins SQL (1 session)
- [P1] Generer schema_org JSON-LD pour 193 R5 observables
- [P2] Purger prix/€ des 25 R4 definitions
- [P4] Allonger 202 meta descriptions R3b manual (bulk SQL)
- [P9] Allonger 133 meta descriptions R5 (bulk SQL)

**Estimation :** ~300 UPDATEs SQL, 1 session

### Sprint 2 — Enrichissement R5 (2-3 sessions)
- [P3] Reecrire 127 descriptions R5 generiques avec contenu specifique
- Structure : symptom_description (>300 chars), sign_description (>300 chars), meta (140-160)
- Modele : `/seo-content-architect` adapte R5 (vocabulaire symptome/diagnostic)

**Estimation :** ~400 UPDATEs, 2-3 sessions

### Sprint 3 — Enrichissement R3a Sections (2-3 sessions)
- [P5] Generer S5 "Erreurs frequentes" pour 154 gammes
- [P6] Generer S8 "FAQ" pour 154 gammes
- [P3a-bonus] Generer S3 "Compatibilite" et S6 "Verification" si temps

**Estimation :** ~620 INSERTs, 2-3 sessions

### Sprint 4 — Enrichissement R3b Auto (2-3 sessions)
- [P7] Enrichir how_to_choose pour 183 guides
- [P8] Enrichir anti_mistakes pour 220 guides
- [P7b] Enrichir selection_criteria et decision_tree

**Estimation :** ~400 UPDATEs, 2-3 sessions

### Sprint 5+ — Plan Long Terme R1 (strategie)
- [P10] Identifier top 50-100 gammes par volume de recherche
- Generer contenu SEO dedie (`__seo_gamme_car`) pour ces gammes
- Repenser le format meta description (pas de templates #var#)

---

## 6. MATRICE RISQUE / EFFORT

```
EFFORT →   Faible (SQL)    Moyen (genere)    Fort (refactor)
           ┌──────────────┬─────────────────┬─────────────────┐
  HAUT     │ P1 Schema R5 │ P3 Rewrite R5   │                 │
  Impact   │ P2 Prix R4   │ P5 S5 R3a       │ P10 R1 content  │
           │ P4 Meta R3b  │ P6 S8 R3a       │                 │
           ├──────────────┼─────────────────┼─────────────────┤
  MOYEN    │ P9 Meta R5   │ P7 Choose R3b   │                 │
  Impact   │              │ P8 Mistakes R3b │                 │
           ├──────────────┼─────────────────┼─────────────────┤
  FAIBLE   │              │                 │                 │
  Impact   │              │                 │                 │
           └──────────────┴─────────────────┴─────────────────┘
```

**Recommandation :** Commencer par le quadrant haut-gauche (P1, P2, P4 = SQL bulk, impact immediat), puis enchainer le quadrant haut-milieu (P3, P5, P6 = contenu genere, impact fort).

---

## 7. CONCLUSION

Le site AutoMecanik a un **score global de 2.7/6**, tire vers le haut par R4 Reference (6/6) et vers le bas par R1 (1/6) et R5 (1/6).

**Points forts :**
- R4 Reference : 138/138 Gold, enrichissement exemplaire
- R3a Conseils : contenu de base solide (S1, S2, S4) avec maillage interne
- R3b Guide-achat auto : structure FAQ+symptoms presente

**Points critiques :**
- R5 Diagnostic : 66% de contenu generique template, 0% Schema.org
- R1 Router : 97.2% de pages sans contenu SEO dedie
- R3a Conseils : 4 sections obligatoires quasi-vides (S3, S5, S6, S8)
- R3b Guide-achat : coeur du guide (how_to_choose, anti_mistakes) absent

**Next steps recommandes :**
1. **Sprint 1 immediate** (P1+P2+P4+P9) — Quick wins SQL bulk
2. **Sprint 2** (P3) — Enrichissement R5 descriptions
3. **Sprint 3** (P5+P6) — Sections manquantes R3a
