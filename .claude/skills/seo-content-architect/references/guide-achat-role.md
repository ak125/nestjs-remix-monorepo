# Guide Achat — Role de page R3_BLOG/guide-achat

> **Le guide achat repond a UNE question : "comment acheter la bonne piece sans se tromper ?"**
> Il ne parle PAS de : montage, diagnostic, symptomes, entretien, reparation.
> Ces sujets relevent d'autres roles de page (R5 Diagnostic, R4 Reference).

---

## 1. Identite de page

| Champ | Valeur |
|-------|--------|
| Role SEO | R3_BLOG (sous-type : guide-achat) |
| URL pattern | `/blog-pieces-auto/guide-achat/{bg_alias}` |
| Intent principal | Informationnelle + Transactionnelle (TOFU → MOFU) |
| Schema.org | TechArticle + FAQPage + BreadcrumbList |
| Conversion goal | Clic vers page gamme (CTA `/pieces/{slug}-{pg_id}.html`) |
| Tables BDD | `__blog_guide` → `__blog_guide_h2` → `__blog_guide_h3` (IDs TEXT, tri lexicographique) |
| Rendu frontend | H2 BDD → `<h3>` rendu, H3 BDD → `<h4>` rendu, titre guide → `<h2>` rendu |

---

## 2. Perimetre strict

### INCLUS (parcours d'achat)

- Identifier la bonne piece (compatibilite vehicule)
- Trouver la bonne reference (OEM, equipementier)
- Verifier les specifications techniques
- Choisir le niveau de qualite
- Commander le bon pack (pieces associees)
- Checklist anti-erreur avant paiement
- Verification a reception + procedure retour

### EXCLUS (autres roles de page)

| Sujet | Role de page concerne | Lien autorise |
|-------|----------------------|---------------|
| Symptomes / diagnostic | R5 Diagnostic | Lien vers `/conseils/{slug}` |
| Quand changer / intervalles | R4 Reference | Lien vers page reference |
| Montage / remplacement | R4 Reference ou R6 Support | Lien si pertinent |
| Entretien / controle | R4 Reference | — |
| Risques mecaniques detailles | R5 Diagnostic | — |

---

## 3. Structure H1

**Template** : `{Piece au pluriel} : guide d'achat complet [{annee}]`

| Regle | Detail |
|-------|--------|
| Keyword primaire | `guide achat {piece}` (SD faible, fort intent mixte) |
| Max 60 chars | Verifier avant insertion |
| "choisir" interdit dans le H1 | Reserve a S4 uniquement |
| Champ BDD | `bg_h1` + `bg_title` (identiques) |

**Exemples** :
- Disques de frein : guide d'achat complet [2026]
- Plaquettes de frein : guide d'achat complet [2026]
- Amortisseurs : guide d'achat complet [2026]

---

## 4. Introduction (bg_content)

L'introduction est stockee dans `bg_content` et contient 2 blocs obligatoires :

### 4a. TL;DR Checklist (en tete)

5 a 7 points orientes ACHAT. Format HTML liste ordonnee. Vise le snippet Google.

```html
<strong>En resume — les points cles avant de commander :</strong>
<ol>
<li>Identifiez votre vehicule exact (VIN ou immatriculation)</li>
<li>Verifiez la position : avant/arriere, gauche/droite</li>
<li>Recuperez la reference OEM ou equipementier</li>
<li>Controlez les specs : dimensions, type, connectiques</li>
<li>Choisissez votre niveau de qualite (economique / OEM / premium)</li>
<li>Commandez le pack complet (pieces associees)</li>
<li>Verifiez la reference a la reception avant ouverture</li>
</ol>
```

### 4b. Intro redactionnelle (2-3 paragraphes)

| Regle | Detail |
|-------|--------|
| Seed | `page_contract.intro.role` (reformule GEO-first, JAMAIS copie verbatim) |
| Angle | Parcours d'achat — "ce guide vous aide a commander la bonne piece" |
| Must contain | Termes de `mechanical_rules.must_be_true` (dans le contexte achat) |
| Liens internes | Vers les gammes de `intro.syncParts` |
| Must NOT contain | Aucun terme de `mechanical_rules.must_not_contain_concepts` |

### 4c. CTA (dual)

| Champ BDD | Template |
|-----------|----------|
| `bg_cta_anchor` | "Trouver {piece} compatible avec votre vehicule" |
| `bg_cta_link` | `/pieces/{slug}-{pg_id}.html` |

**CTA secondaire (en fin d'article, apres S7/S8)** :
- Texte : "Besoin d'aide ? Nos experts vous guident gratuitement"
- Lien glossaire : "Consultez notre glossaire technique" → `/reference-auto`

---

## 5. Template H2 obligatoire (7 sections)

Chaque guide d'achat DOIT contenir ces 7 H2 dans cet ordre. Ils suivent le parcours d'achat naturel.

| # | ID pattern | H2 template | Contenu | Source page_contract |
|---|-----------|-------------|---------|---------------------|
| **S1** | `{bg_id}00` | Identifier {la bonne piece} pour votre vehicule | Methode VIN → immatriculation → selection manuelle. Point cle : meme voiture = plusieurs variantes → verifier position (avant/arriere), cote (gauche/droite), options (capteur, ABS, clim, boite...) | `howToChoose` |
| **S2** | `{bg_id}01` | Trouver la bonne reference de {piece} | Ref OEM (etiquette, facture, ancienne piece) + ref equipementier. Croiser les references : si ref + dimensions concordent → achat securise | `howToChoose` (detail ref) |
| **S3** | `{bg_id}02` | Verifier les specifications techniques | Dimensions (diametre, epaisseur, longueur), type (ventile/plein, avec/sans), connectiques (capteur, nombre de broches). **Regle : si 1 critere ne colle pas → ne pas acheter.** Format tableau recommande : Critere / Comment verifier / Piege courant | RAG markdown + `sgpg_selection_criteria` (si disponible) |
| **S4** | `{bg_id}03` | Quelle qualite de {piece} choisir ? | 3 niveaux : Economique / Equivalent OEM / Premium. Pour chaque : durabilite, homologation, garantie. Adapter au profil d'usage (urbain, route, intensif) si `sgpg_use_cases` disponible | Marques RAG + `risk.costRange` + `sgpg_use_cases` (si disponible) |
| **S5** | `{bg_id}04` | Commander le bon pack — eviter les oublis | Pieces associees a commander ensemble (SANS expliquer le montage). Format anti-erreur : Oubli frequent → Consequence → Solution. Ex freinage : commander sans plaquettes → usure prematuree → toujours en kit | `intro.syncParts` + `antiMistakes` |
| **S6** | `{bg_id}05` | Checklist avant de payer | 2 blocs : **Verifications obligatoires** (vehicule, position, specs, reference, quantite, retour/garantie) + **Pieges courants** (format "Si... alors..." actionnable). Repetition des anti-erreurs cles de S1-S5 | Synthese S1-S5 |
| **S7** | `{bg_id}06` | Apres la commande — verifier et agir | Verifier photo/etiquette a reception (ref + dimensions). Garder emballage tant que non valide. Procedure retour/echange si erreur | Generique |

### FAQ optionnelle (S8)

| # | ID pattern | H2 template | Contenu |
|---|-----------|-------------|---------|
| **S8** | `{bg_id}07` | Questions frequentes sur l'achat de {pieces} | 6-10 Q&A orientees ACHAT uniquement. Format accordion `<details>` |

La FAQ est **recommandee** (FAQPage schema) mais pas bloquante. Si le page_contract fournit < 3 FAQ orientees achat, omettre et produire sans.

---

## 6. H3 sous chaque H2

| H2 parent | H3 possibles | Source |
|-----------|-------------|--------|
| S1 (Identifier) | Par VIN, Par immatriculation, Par selection manuelle | `howToChoose` |
| S2 (Reference) | Reference constructeur (OEM), Reference equipementier, Croiser les references | `howToChoose` |
| S3 (Specifications) | Dimensions, Type, Connectiques/options, Criteres de compatibilite (si `sgpg_selection_criteria`) | RAG markdown + `sgpg_selection_criteria` |
| S4 (Qualite) | Economique, Equivalent origine, Premium/performance, Quel niveau selon votre usage (si `sgpg_use_cases`) | Marques RAG + `sgpg_use_cases` |
| S5 (Pack) | Aucun H3 — liste anti-erreur : Oubli → Consequence → Solution | `intro.syncParts` + `antiMistakes` |
| S6 (Checklist) | Aucun H3 — 2 blocs : Verifications obligatoires + Pieges courants | Synthese S1-S5 |
| S7 (Apres commande) | Aucun H3 — contenu court | — |
| S8 (FAQ) | Aucun H3 — accordion `<details>` | — |

---

## 7. Format FAQ (S8)

```html
<details>
<summary><strong>Question orientee achat ?</strong></summary>
<p>Reponse factuelle.</p>
</details>
```

| Regle | Detail |
|-------|--------|
| Minimum | 6 Q&A si section presente |
| Maximum | 10 Q&A |
| Orientation | Questions d'ACHAT uniquement |
| Schema.org | FAQPage genere automatiquement par le frontend (regex `<details>/<summary>`) |

**Questions types (achat)** :
- "Faut-il acheter par paire ?"
- "Quelle difference entre OEM et adaptable ?"
- "Comment verifier la compatibilite avec mon vehicule ?"
- "Que faire si la piece recue ne correspond pas ?"
- "Peut-on melanger les marques (disque + plaquette) ?"

**Questions INTERDITES (hors perimetre)** :
- "Quand changer ?" → R5 Diagnostic
- "Quels sont les symptomes ?" → R5 Diagnostic
- "Comment monter/remplacer ?" → R4 Reference
- "Quel est l'intervalle d'entretien ?" → R4 Reference

---

## 8. Mapping page_contract → sections

```
page_contract.howToChoose         → S1 (identification) + S2 (reference) + S3 (specs)
page_contract.intro.syncParts     → S5 (pack associe) + liens internes bg_content
page_contract.risk.costRange      → S4 (niveaux qualite, fourchettes prix)
page_contract.antiMistakes        → S5 (oublis a eviter) + S6 (checklist)
page_contract.faq                 → S8 (FAQ, reformulee orientation achat)
page_contract.intro.role          → bg_content intro (reformule GEO-first)
page_contract.arguments           → bg_content intro (integres, pas de H2 dedie)
seo_cluster.paa_questions         → headings H2 (reformules, pas copies verbatim)
mechanical_rules                  → validation post-redaction
sgpg_selection_criteria (JSONB)   → S3 (tableau Critere/Comment verifier/Piege) [si peuple]
sgpg_use_cases (JSONB)            → S4 (profils conducteur/usage) [si peuple]
```

**Champs page_contract NON utilises dans guide-achat :**

| Champ | Raison | Role de page concerne |
|-------|--------|----------------------|
| `symptoms` | Diagnostic, pas achat | R5 Diagnostic |
| `timing.km` / `timing.years` | Intervalle de remplacement, pas achat | R4 Reference |
| `timing.note` | Condition mecanique, pas achat | R4 Reference / R5 |
| `risk.consequences` (detail) | Peut apparaitre en intro (1 phrase) mais pas de H2 dedie | R5 Diagnostic |

---

## 9. Regles SEO des headings

| Regle | Application |
|-------|------------|
| "choisir" | Maximum 1 H2 (S4 "Quelle qualite choisir" — PAA exacte Google) |
| Keyword principal | Present dans H1 + au moins 3 H2 |
| Diversification | Utiliser PAA + keywords du `seo_cluster` pour varier |
| Anti-stuffing | Pas de repetition du meme verbe/structure dans 2+ headings consecutifs |
| Longueur H2 | 40-80 chars (Google tronque au-dela) |
| Verbe d'action | Privilegier : identifier, verifier, commander, trouver, comparer |

---

## 10. Liens internes

| Type | Cible | Ancre | Placement |
|------|-------|-------|-----------|
| syncParts | `/pieces/{slug}-{pg_id}.html` | Nom de la piece associee | bg_content + S5 |
| Cross-guide | `/blog-pieces-auto/guide-achat/{alias}` | "notre guide {piece}" | S5 (pack associe) |
| Gamme principale | `/pieces/{slug}-{pg_id}.html` | CTA "Trouver {piece} compatible" | bg_cta_link |
| Diagnostic | `/conseils/{slug}` | "consultez notre guide diagnostic" | bg_content intro (1 lien max) |

**Minimum** : 8 liens internes par guide.

### Guides similaires (automatique)

Le backend resout automatiquement 4 guides de la **meme famille** via :
`bg_alias → pieces_gamme → __seo_family_gamme_car_switch (sfgcs_mf_id) → siblings`

18 familles distinctes (Freinage, Eclairage, Embrayage, Filtration, etc.). Si aucune famille trouvee, fallback sur 4 guides recents.

**Impact contenu** : les cross-guides en S5 (pack associe) et les related guides automatiques forment un maillage interne complementaire. S5 = pieces associees (ex: disque + plaquette), related guides = pieces de la meme famille (ex: disque + etrier + flexible).

---

## 11. Pre-requis gamme pour generer un guide

| Champ RAG | Requis | Si absent |
|-----------|--------|-----------|
| `page_contract` | OUI | **STOP** — enrichir via `/rag-ops ingest` |
| `page_contract.howToChoose` | OUI | STOP — impossible de generer S1/S2/S3 |
| `page_contract.antiMistakes` | OUI | Flag — S5/S6 seront generiques |
| `page_contract.faq` (≥3) | RECOMMANDE | S8 omise ou generique |
| `seo_cluster` | RECOMMANDE | Headings non optimises SEO |
| `mechanical_rules.must_be_true` | OUI | WARNING — pas de validation anti-hallucination |

---

## 12. Exemple de reference : disque-de-frein (bg_id=2)

Guide migre en v2 (2026-02-17). Structure 8 H2 (7 sections + FAQ), 6 H3.

| Section | bg2_id | H2 reel | H3 |
|---------|--------|---------|-----|
| S1 Identifier | 200 | Identifier le bon disque de frein pour votre vehicule | — |
| S2 Reference | 201 | Trouver la bonne reference de disque de frein | — |
| S3 Specifications | 202 | Verifier les specifications techniques de votre disque de frein | Taille disque (bg3_id=200), Epaisseur (bg3_id=201) |
| S4 Qualite | 203 | Quelle qualite de disque de frein choisir ? | Marques (bg3_id=202), Entree de gamme 20-35 EUR (203), Milieu 35-60 EUR (204), Haut 60-120 EUR (205) |
| S5 Pack | 204 | Commander le bon pack — eviter les oublis | — |
| S6 Checklist | 205 | Checklist avant de payer | — |
| S7 Apres commande | 206 | Apres la commande — verifier et agir | — |
| S8 FAQ | 207 | Questions frequentes sur l'achat de disques de frein | — (6 Q&A accordion) |

**RAG source** : `rag://gammes.disque-de-frein` (pg_id=82, truth_level L2, updated_at 2026-02-17)

---

## 13. Post-generation workflow (insertion en base)

Apres la generation du contenu par le skill, l'insertion suit ce pipeline :

### Etape 1 — Insertion BDD (via MCP Supabase)

| Table | Champs cles | ID pattern |
|-------|-------------|-----------|
| `__blog_guide` | bg_id (TEXT), bg_title, bg_h1, bg_alias, bg_content, bg_cta_anchor, bg_cta_link | Prochain ID libre (SELECT MAX(bg_id::int)+1) |
| `__blog_guide_h2` | bg2_id (TEXT), bg2_h2, bg2_content, bg2_bg_id | `{bg_id}{section_number}` (00-07) |
| `__blog_guide_h3` | bg3_id (TEXT), bg3_h3, bg3_content, bg3_bg2_id | `{bg2_id}{sub_number}` (0-9) |

**Attention** : IDs TEXT, tri lexicographique. Pas d'auto-increment natif.

### Etape 2 — Sitemap

Inserer dans `__sitemap_blog` :
- `map_alias` = `guide-achat/{bg_alias}`
- `map_date` = date du jour (YYYY-MM-DD)
- `map_id` = prochain ID libre (SELECT MAX(map_id::int)+1)

### Etape 3 — Verification

```sql
-- Verifier le guide insere
SELECT bg_id, bg_title, bg_alias FROM __blog_guide WHERE bg_alias = '{alias}';

-- Verifier les H2
SELECT bg2_id, bg2_h2 FROM __blog_guide_h2 WHERE bg2_bg_id = '{bg_id}' ORDER BY bg2_id;

-- Verifier le sitemap
SELECT map_alias FROM __sitemap_blog WHERE map_alias LIKE 'guide-achat/{alias}';
```

### Etape 4 — Index page

Le loader index (`blog-pieces-auto.guide-achat._index.tsx`) charge `limit=300` guides. Si le total depasse 300, augmenter la limite.

La famille du guide est resolue automatiquement via `pieces_gamme → __seo_family_gamme_car_switch` pour le groupement dans la page index.
