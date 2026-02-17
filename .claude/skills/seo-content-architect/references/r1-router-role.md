# Page Gamme — Role de page R1_ROUTER

> **La page gamme repond a UNE question : "ou trouver la bonne piece pour MON vehicule ?"**
> Elle ne parle PAS de : definition encyclopedique, diagnostic, parcours d'achat, montage.
> Ces sujets relevent d'autres roles de page (R4 Reference, R5 Diagnostic, R3/guide-achat, R3/conseils).

---

## 1. Identite de page

| Champ | Valeur |
|-------|--------|
| Role SEO | R1_ROUTER |
| URL pattern | `/pieces/{slug}-{pg_id}.html` |
| Intent principal | Navigationnelle (TOFU → selection vehicule → page produit R2) |
| Schema.org | CollectionPage + ItemList + BreadcrumbList |
| Conversion goal | Selection vehicule → page R2 (`/pieces/{gamme}/{marque}/{modele}/{type}.html`) |
| Tables BDD | `__seo_gamme` (sg_content, sg_h1, sg_title, sg_descrip) + `pieces_gamme` |
| Rendu frontend | Hero + selecteur vehicule + grille motorisations + contenu editorial court |

---

## 2. Ce que ca apporte (valeur business)

| Benefice | Mecanisme |
|----------|-----------|
| **Taux de selection vehicule** | Justifier l'effort de selection → plus d'utilisateurs completent le parcours |
| **Reduction des erreurs** | Expliquer les variantes → moins de mauvais achats et de retours |
| **Confiance** | Montrer que le filtrage est fiable → conversion vers R2 |
| **SEO** | Page pilier qui maille vers R2/R3/R4/R5 → autorite thematique |

---

## 3. Personas cibles

| Persona | Part trafic | Ce qu'il cherche | Bloc cle |
|---------|:-----------:|-----------------|----------|
| **Acheteur direct** | ~60% | "Je connais ma voiture, je veux la piece" → selecteur rapide | Hero + VehicleSelector |
| **Acheteur hesitant** | ~30% | "C'est la bonne gamme ?" → reassurance + variantes | S1 + S2 |
| **Explorateur** | ~10% | "Quelles motorisations sont couvertes ?" → grille vehicules | MotorisationsSection |

---

## 4. Perimetre strict

### INCLUS (parcours de selection vehicule)

- Rassurer sur la gamme (variantes principales, pas une encyclopedie)
- Justifier la selection vehicule (montages multiples, danger erreur)
- Guider la selection (plaque/VIN, selection manuelle, erreurs courantes)
- Promettre le resultat (produits compatibles, criteres, qualites)
- Mailler vers les pages satellites (R3/guide-achat, R3/conseils, R4, R5)

### EXCLUS (autres roles de page)

| Sujet | Role de page concerne | Lien autorise |
|-------|----------------------|---------------|
| Definition / role mecanique encyclopedique | R4 Reference | Lien vers `/reference-auto/{slug}` dans S1 |
| Symptomes / diagnostic / quand changer | R5 Diagnostic | Lien dans bandeau "Conseils & Diagnostic" |
| Parcours d'achat (ref OEM, qualite, checklist) | R3/guide-achat | Lien dans bandeau "Conseils & Diagnostic" |
| Montage / remplacement / etapes | R3/conseils | Lien dans bandeau "Conseils & Diagnostic" |
| Prix, stock, livraison | R2 Product | INTERDIT dans le contenu |

---

## 5. Repartition du contenu

| Zone | Budget | Focus |
|------|--------|-------|
| **70%** | S2 + S3 | Aide selection vehicule + prevention erreur de selection |
| **20%** | S1 | Comprehension rapide gamme (orientation, pas encyclopedie) |
| **10%** | S4 | Reassurance + promesse post-selection |

**Budget total** : 150 mots maximum (gate backend `maxWords: 150`)

---

## 6. Structure H1

**Template** : `{Piece au pluriel} pour votre vehicule`

| Regle | Detail |
|-------|--------|
| Keyword primaire | `{piece}` + contexte vehicule (navigation) |
| Max 60 chars | Verifier avant insertion |
| Interdit dans H1 | `pas cher` (commercial), `definition` (R4), `symptome` (R5), `guide d'achat` (R3) |
| Champ BDD | `sg_h1` (override possible via `sgpg_h1_override`) |

**Exemples** :
- Disques de frein — trouvez la reference compatible avec votre vehicule
- Plaquettes de frein pour votre vehicule
- Kit d'embrayage — selectionnez votre vehicule

---

## 7. Meta description

**Template** : `{Piece au pluriel} : selectionnez votre vehicule pour voir uniquement les references 100% compatibles. {N}+ references, livraison 24-48h.`

| Regle | Detail |
|-------|--------|
| Longueur | 120-155 chars |
| Must contain | nom piece + `vehicule` ou `compatible` |
| Must NOT contain | `definition`, `symptome`, `diagnostic`, `guide d'achat`, `changer`, `remplacer` |

---

## 8. Template H2 obligatoire (4 sections)

### S1 — Rassurance gamme (20% du budget, ~50 mots)

**H2** : `{Piece au pluriel} : les variantes a connaitre`

| Element | Contenu | Obligatoire |
|---------|---------|:-----------:|
| Role pratique | 1-2 phrases simples : a quoi ca sert (conducteur-first, pas encyclopedique) | OUI |
| Variantes cles | 2-3 criteres qui changent selon le vehicule (diametre, type, position, capteur) | OUI |
| Lien R4 | "En savoir plus : {piece} — definition et role mecanique" → `/reference-auto/{slug}` | OUI |

**REGLE ANTI-CANNIBALISATION** : Maximum 2-3 phrases. Pas de "definition", "compose de", "qu'est-ce que". La page R4 couvre l'encyclopedie.

**Adaptation par profil gamme** :
- **Safety-critical** : ajouter 1 phrase "Organe de securite — la compatibilite exacte est essentielle"
- **DIY-friendly** : insister sur la simplicite "Quelques variantes existent, le selecteur les filtre pour vous"
- **Pro-only** : ajouter "Intervention professionnelle recommandee — le selecteur identifie la reference exacte"

---

### S2 — Justification selecteur (35% du budget, ~40 mots)

**H2** : `Pourquoi selectionner votre vehicule ?`

| Element | Contenu | Obligatoire |
|---------|---------|:-----------:|
| Montages multiples | Un meme modele a plusieurs montages selon moteur, finition, freinage | OUI |
| Danger erreur | Une piece "presque compatible" = mauvais montage, usure, retour, danger | OUI |
| Filtrage | Le selecteur affiche uniquement les references 100% compatibles | OUI |

**Format** : 3-4 bullet points courts. Pas de paragraphes.

---

### S3 — Guide selecteur (35% du budget, ~40 mots)

**H2** : `Trouvez votre vehicule rapidement`

| Element | Contenu | Obligatoire |
|---------|---------|:-----------:|
| Option rapide | Par plaque d'immatriculation ou VIN (si disponible) | OUI |
| Option manuelle | Marque → modele → motorisation/version | OUI |
| Erreurs frequentes | 2-3 bullets : ne pas se baser sur le nom commercial seul, verifier kW/ch, attention changements en milieu d'annee | OUI |

**REGLE ANTI-CANNIBALISATION** : Parler du selecteur UI (comment utiliser l'interface), PAS de la methode d'identification piece (reference OEM = R3/guide-achat).

---

### S4 — Promesse post-selection (10% du budget, ~20 mots)

**H2** : `Ce que vous verrez apres selection`

| Element | Contenu | Obligatoire |
|---------|---------|:-----------:|
| Promesse | Liste filtree 100% compatible, variantes qualite, criteres gamme | OUI |
| CTA | Ancre vers `#vehicle-selector` : "Selectionner mon vehicule" | OUI |

**Format** : 1-2 phrases + CTA. Pas de detail produit (c'est R2).

---

## 9. Vocabulaire exclusif et anti-cannibalisation

### EXCLUSIF R1 (reserve — aucun autre role ne doit utiliser dans le contenu editorial)

- `selectionnez votre vehicule` / `selectionner mon vehicule`
- `vehicules compatibles` / `pieces 100% compatibles`
- `montages differents selon` / `plusieurs variantes selon`
- `filtrer par vehicule` / `afficher les references compatibles`

### INTERDIT sur R1 (appartient a d'autres roles)

**R4 Reference** :
- `definition`, `qu'est-ce que`, `qu'est-ce qu'`, `designe`
- `se compose de`, `compose de`, `terme technique`
- `glossaire`, `par definition`, `au sens strict`
- `role mecanique` (comme titre de section — la notion peut apparaitre en 1 phrase dans S1)

**R5 Diagnostic** :
- `symptome`, `symptomes`, `bruit`, `vibration`, `claquement`
- `panne`, `defaillance`, `usure prematuree`
- `quand changer`, `pourquoi changer`, `comment diagnostiquer`, `comment savoir`
- `causes`, `risques`, `danger`, `consequences`, `si vous ne changez pas`
- `code DTC`, `code OBD`

**R3/guide-achat** :
- `guide d'achat`, `parcours d'achat`
- `reference OEM`, `reference OES`, `reference constructeur` (comme sujet principal)
- `niveau de qualite` (economique/OEM/premium)
- `checklist avant de payer`, `commander`

**R3/conseils** :
- `demontage`, `remontage`, `depose`, `repose`
- `etapes de remplacement`, `pas a pas`
- `outils necessaires`, `couple de serrage`
- `essai routier`, `verification finale`

**R2 Product** :
- `prix`, `euro`, `en stock`, `livraison`, `promotion`, `frais de port`
- `ajouter au panier`, `garantie constructeur`

### PARTAGE (autorise sur R1 mais pas exclusif)

| Terme | Aussi utilise par | Difference de contexte |
|-------|------------------|----------------------|
| `compatible` | R3/guide-achat | R1 = filtrage vehicule. Guide-achat = trouver la bonne reference |
| `vehicule` | Tous | R1 = selection UI. Autres = contexte technique |
| `avant/arriere` | R3/conseils, R4 | R1 = variante a selectionner. Autres = contexte technique |

---

## 10. Maillage interne (minimum 4 liens)

| Depuis | Vers | Ancre | Placement | Obligatoire |
|--------|------|-------|-----------|:-----------:|
| S1 | R4 Reference | "En savoir plus : {piece} — definition et role" | Fin de S1 | OUI |
| Bandeau | R5 Diagnostic | "Diagnostic : identifier une panne de {piece}" | Section liens | OUI |
| Bandeau | R3/guide-achat | "Guide d'achat {piece}" | Section liens | OUI |
| Bandeau | R3/conseils | "Conseils : changer {piece} etape par etape" | Section liens | OUI |
| CatalogueSection | R1 gammes soeurs | Nom de chaque gamme soeur (lien direct) | Bas de page | OUI (2+ liens) |

**Qui peut lier VERS R1 ?**

| Depuis | Autorise | Ancre |
|--------|:--------:|-------|
| R4 Reference | OUI | "Voir toutes les {pieces}" |
| R5 Diagnostic | OUI | "Trouver {piece} compatible" |
| R3/guide-achat | OUI | CTA "Trouver {piece} compatible avec votre vehicule" |
| R3/conseils | OUI | CTA "Voir les pieces compatibles" (S3) |
| R2 Product | OUI | Breadcrumb retour gamme |

---

## 11. Quality gates (6 flags)

| Flag | Severite | Condition |
|------|----------|-----------|
| `MISSING_SELECTOR_CTA` | BLOQUANT | Pas de CTA/lien vers `#vehicle-selector` ou selecteur |
| `OVER_WORD_LIMIT` | BLOQUANT | > 150 mots dans sg_content (deja en backend) |
| `FORBIDDEN_KEYWORD` | BLOQUANT | 1+ mot interdit R1 detecte dans sg_content (deja en backend) |
| `R4_VOCABULARY` | BLOQUANT | 2+ termes exclusifs R4 (`definition`, `compose de`, `glossaire`) |
| `R5_VOCABULARY` | BLOQUANT | 1+ terme exclusif R5 (`symptome`, `diagnostic`, `bruit anormal`) |
| `GENERIC_PHRASES` | WARNING | Contient "joue un role essentiel" ou "assure le bon fonctionnement" |

**Publication** : Zero BLOQUANT = autorise. Maximum 1 WARNING tolere.

---

## 12. Blocs UI du frontend (post-nettoyage)

Le template frontend R1 rend ces blocs dans cet ordre :

| # | Bloc | Source donnees | Role R1 |
|---|------|---------------|---------|
| 1 | SEOHelmet + Breadcrumbs | meta, breadcrumbs | Schema + navigation |
| 2 | Hero (wallpaper + badge + H1 + UXMessageBox + VehicleSelector + trust badges) | pieces_gamme, __seo_gamme | **Coeur R1** : selecteur vehicule above-the-fold |
| 3 | Bandeau "Conseils & Diagnostic" | pg_alias | Maillage R3/R4/R5 (liens uniquement) |
| 4 | Bandeau "Besoin d'aide ?" | pg_alias | Guide selecteur + lien conseils |
| 5 | QuickGuideSection (3 cards) | purchaseGuideData (intro, risk, timing) | Apercu rapide gamme (role, budget, periodicite) |
| 6 | MotorisationsSection | motorisations | **Coeur R1** : grille vehicules → R2 |
| 7 | HtmlContent (sg_content) | __seo_gamme.sg_content | Contenu editorial R1 (4 sections, 150 mots max) |
| 8 | EquipementiersSection | equipementiers | Logos marques (confiance) |
| 9 | CatalogueSection | catalogueMameFamille | Gammes soeurs (maillage R1↔R1) |
| 10 | FAQ selecteur | purchaseGuideData.faq (filtree) | 3-5 questions selection vehicule |
| 11 | MobileStickyBar + ScrollToTop | — | CTA mobile |

**Blocs SUPPRIMES** (hors-role R1) :
- SymptomsSection (R5)
- PurchaseNarrativeSection (R3/guide-achat)
- ConseilsSection (R3/conseils)
- AntiMistakesSection (R3)
- InformationsSection (couvert par QuickGuide + sg_content)

---

## 13. Matrice de differenciation complete (R1 inclus)

| Dimension | R1 Router | R2 Product | R3/conseils | R3/guide-achat | R4 Reference | R5 Diagnostic |
|-----------|----------|------------|------------|----------------|--------------|---------------|
| **Question core** | Ou trouver la piece pour MON vehicule ? | Acheter CETTE piece | Comment remplacer ? | Comment acheter ? | Qu'est-ce que c'est ? | Ma piece est-elle HS ? |
| **Intent** | Navigationnelle | Transactionnelle | Info (action) | Info + Transactionnelle | Info (education) | Info (probleme) |
| **Persona** | Acheteur qui cherche | Acheteur qui achete | Bricoleur qui agit | Acheteur qui decide | Curieux qui apprend | Conducteur inquiet |
| **Ton** | Direct, utilitaire | Commercial, rassurant | Pratique, procedural | Decision, anti-erreur | Encyclopedique, neutre | Investigatif |
| **Contenu cle** | Selecteur vehicule + variantes | Prix + stock + CTA | Etapes remplacement | Ref OEM + qualite + pack | Definition + composition | Symptomes + arbre decision |
| **Schema.org** | CollectionPage + ItemList | Product + Offer | HowTo + TechArticle | TechArticle + FAQPage | DefinedTerm | TechArticle + FAQPage |
| **CTA** | Selecteur vehicule | Ajouter au panier | Compatibilite → gamme | Compatibilite → gamme | Lien R3 + R5 | Lien R3/guide-achat |
| **Max mots** | 150 | Illimite | Illimite | Illimite | Illimite | Illimite |

---

## 14. Exemple de reference : disque-de-frein (pg_id=82)

### sg_h1
`Disques de frein — trouvez la reference compatible avec votre vehicule`

### sg_title
`Disques de frein : selectionnez votre vehicule | AutoMecanik`

### sg_descrip
`Disques de frein : selectionnez votre vehicule pour voir uniquement les references 100% compatibles. Ventile ou plein, avant ou arriere. Livraison 24-48h.`

### sg_content (~110 mots)

```html
<h2>Disques de frein : les variantes a connaitre</h2>
<p>Les disques de frein existent en version <strong>ventilee</strong> ou
<strong>pleine</strong>, avec des diametres de 238 a 345 mm selon le vehicule.
Position avant ou arriere, avec ou sans capteur ABS —
<a href="/reference-auto/disque-de-frein">tout comprendre sur le disque de frein</a>.</p>

<h2>Pourquoi selectionner votre vehicule ?</h2>
<ul>
<li>Un meme modele a plusieurs montages selon moteur, finition et freinage</li>
<li>Un disque incompatible = vibrations, freinage degrade</li>
<li>Le selecteur affiche uniquement les references 100% compatibles</li>
</ul>

<h2>Trouvez votre vehicule rapidement</h2>
<p>Selectionnez marque → modele → motorisation. En cas de doute, le
<strong>code moteur</strong> figure sur votre carte grise (case D.2).
Attention aux changements de serie en milieu d'annee.</p>
```

**Profil gamme** : safety-critical → S1 mentionne "organe de securite"

---

## 15. Astuces de redaction (immediatement exploitables)

1. **UXMessageBox au-dessus du selecteur** : "Pas besoin de connaitre la reference. Selectionnez votre vehicule : nous affichons uniquement les pieces compatibles." (deja en place dans le frontend)
2. **3 erreurs de selection sous S3** : "Ne vous fiez pas au nom commercial seul", "Verifiez kW/ch si plusieurs moteurs", "Attention aux changements en milieu d'annee"
3. **FAQ selecteur** : repondre aux 3 blocages les plus frequents ("Vehicule introuvable ?", "Plusieurs motorisations ?", "Comment lire la carte grise ?")
4. **Profil gamme** : adapter S1 en 1 phrase selon le type (securite, DIY, pro)
5. **Maillage dans le bandeau** : les 4 liens vers R3/R4/R5 sont deja implementes dans le frontend — ils restent inchanges
