# Conseils How-To — Role de page R3_BLOG/conseils

> **La page conseils repond a UNE question : "comment et quand remplacer cette piece correctement et en securite ?"**
> Elle ne parle PAS de : definition encyclopedique, diagnostic approfondi, parcours d'achat.
> Ces sujets relevent d'autres roles de page (R4 Reference, R5 Diagnostic, R3/guide-achat).

---

## 1. Identite de page

| Champ | Valeur |
|-------|--------|
| Role SEO | R3_BLOG (sous-type : conseils) |
| URL pattern | `/blog-pieces-auto/conseils/{pg_alias}` |
| Intent principal | Informationnelle (MOFU — passage a l'action maintenance) |
| Schema.org | HowTo + TechArticle + FAQPage + BreadcrumbList |
| Conversion goal | CTA compatibilite → page gamme (`/pieces/{slug}-{pg_id}.html`) + pack complementaire |
| Tables BDD | `__blog_advice` (article) + `__seo_gamme_conseil` (sections structurees) |
| Rendu frontend | Article + sections conseil fusionnes, ordre template S1-S8 |

---

## 2. Ce que ca apporte (valeur business)

| Benefice | Mecanisme |
|----------|-----------|
| **Confiance** | Tu montres que tu maitrises la piece — les pieces proposees sont les bonnes |
| **Reduction des retours** | Compatibilite + erreurs frequentes expliquees avant achat |
| **Panier moyen** | Proposition naturelle de pack : pieces + consommables + accessoires |
| **Fidelisation** | Calendrier d'entretien + checklists → retour regulier |

---

## 3. Personas cibles

| Persona | Part trafic | Ce qu'il cherche | Bloc cle |
|---------|:-----------:|-----------------|----------|
| **Bricoleur intermediaire** | ~80% | "Je peux le faire moi-meme ?" → etapes + difficulte | S1 + S4 |
| **Pro presse** | ~10% | Un couple de serrage, une astuce, un repere rapide | S4 (version express) + S6 |
| **Acheteur hesitant** | ~10% | "C'est complique ?" → si non → CTA achat | S1 + S3 (CTA) |

---

## 4. Perimetre strict

### INCLUS (parcours maintenance)

- Evaluer la difficulte et preparer l'intervention (outils, temps, securite)
- Reconnaitre les signes d'usure justifiant le remplacement
- Verifier la compatibilite piece/vehicule avant de commencer
- Procedure de remplacement pas a pas (depose + repose)
- Erreurs frequentes a eviter (retours d'experience terrain)
- Verification finale et essai routier
- Pieces et consommables complementaires (pack naturel)

### EXCLUS (autres roles de page)

| Sujet | Role de page concerne | Lien autorise |
|-------|----------------------|---------------|
| Definition / role mecanique encyclopedique | R4 Reference | Lien vers `/reference-auto/{slug}` dans S1 |
| Diagnostic approfondi (arbre decision, codes DTC) | R5 Diagnostic | Lien vers `/diagnostic-auto/{slug}` dans S2 |
| Parcours d'achat (ref OEM, qualite, checklist commande) | R3/guide-achat | Lien vers `/blog-pieces-auto/guide-achat/{alias}` |
| Entretien programme / intervalles constructeur | R4 Reference | Mention breve autorisee en S2 (1-2 lignes) |
| Prix, stock, livraison | R2 Product | INTERDIT dans le contenu |

---

## 5. Structure H1

**Template** : `Changer {piece au singulier} : guide complet [{annee}]`

| Regle | Detail |
|-------|--------|
| Keyword primaire | `changer {piece}` ou `remplacer {piece}` (intent informationnelle) |
| Max 65 chars | Verifier avant insertion |
| "comment" optionnel | `Comment changer {piece}` si < 65 chars |
| Interdit dans H1 | `definition` (R4), `symptome` (R5), `acheter`/`guide d'achat` (R3/guide-achat) |

**Exemples** :
- Changer les plaquettes de frein : guide complet [2026]
- Remplacer un filtre d'habitacle : guide complet [2026]
- Changer la courroie de distribution : guide complet [2026]

---

## 6. Meta description

**Template** : `{Piece} usee ? Decouvrez quand et comment la remplacer etape par etape. Niveau, outils, erreurs a eviter. Guide entretien [{annee}].`

| Regle | Detail |
|-------|--------|
| Longueur | 120-155 chars |
| Must contain | `remplacer` ou `changer` + nom piece |
| Must NOT contain | `definition`, `acheter`, `diagnostic`, `prix` |

---

## 7. Template H2 obligatoire (8 sections)

### S1 — Avant de commencer

**H2** : `Avant de changer {piece} : ce qu'il faut savoir`

| Element | Contenu | Obligatoire |
|---------|---------|:-----------:|
| Niveau de difficulte | Facile / Moyen / Avance | OUI |
| Temps estime | "30 min" / "1h-2h" / "demi-journee" | OUI |
| Outils indispensables | Liste concrete (cle a douille X, tournevis, cric, chandelles) | OUI |
| Pieces et consommables | Liste avec liens vers packs gamme | OUI |
| Securite obligatoire | Points de levage, chandelles, EPI, batterie debranchee | OUI (safety-critical) |
| Role pratique de la piece | 2-3 phrases : ce que le conducteur ressent quand ca marche / ne marche pas | RECO |

**Version express** (en tete de S1, pour les pros presses) :
> Niveau : Moyen | Temps : 1h30 | Outils : cric, chandelles, cle 17, repousse-piston | Pieces : disques + plaquettes + nettoyant frein

**Source DB** : `__seo_gamme_conseil` (`sgc_title ILIKE '%role%' OR '%fonction%'`) + genere pour outils/temps

**Lien interne obligatoire** : → R4 Reference "En savoir plus : {piece} — definition et role mecanique"

---

### S2 — Signes d'usure — pourquoi intervenir maintenant

**H2** : `Quand faut-il changer {piece} ?`

| Element | Contenu | Obligatoire |
|---------|---------|:-----------:|
| Signes d'usure | 3-5 bullet points BREFS (ce que le conducteur observe) | OUI |
| Intervalles | Km/annees si source fiable, sinon "selon constructeur" | RECO |
| Risques si on attend | 1-2 phrases consequences | RECO |
| Controle visuel simple | Comment verifier soi-meme (epaisseur, jeu, etat) | RECO |

**REGLE ANTI-CANNIBALISATION** : Maximum 5 bullet points. Pas d'arbre de decision, pas de codes DTC, pas de "diagnostiquer". Le diagnostic approfondi appartient a R5.

**Source DB** : `__seo_gamme_conseil` (`sgc_title ILIKE '%symptome%' OR '%panne%' OR '%quand%'`)

**Lien interne obligatoire** : → R5 Diagnostic "Diagnostic complet : identifier une panne de {piece}"

---

### S3 — Verifier la compatibilite de votre piece (LE BLOC QUI CONVERTIT)

**H2** : `Verifier la compatibilite avant de commencer`

| Element | Contenu | Obligatoire |
|---------|---------|:-----------:|
| Ou trouver l'info | Carte grise (type mine), VIN, plaque constructeur, ancienne piece | OUI |
| Points qui font echouer | Diametre, epaisseur, ventile/plein, capteur, etrier, essieu AV/AR, PR code VW/Audi | OUI |
| CTA conversion | **"Voir les pieces compatibles avec votre vehicule"** → `/pieces/{slug}-{pg_id}.html` | OUI |

**Source DB** : `__seo_gamme_conseil` (`sgc_title ILIKE '%choisir%'`) + `selection.criteria` (v4) / `page_contract.howToChoose` (legacy)

**Lien interne obligatoire** : → R1/R2 Gamme (CTA)

---

### S4 — Etapes de remplacement pas a pas

**H2** : `{Action} {piece} etape par etape`

Decoupe en sous-etapes numerotees :

| Sous-etape | Contenu | H3 |
|------------|---------|-----|
| Preparation | Securiser le vehicule, debrancher batterie si besoin | `Preparation du vehicule` |
| Depose | Procedure de demontage detaillee | `Demonter {piece}` |
| Controle | Inspecter pieces adjacentes, surfaces de contact | `Controler les elements adjacents` |
| Remontage | Procedure de remontage + couples de serrage si source fiable | `Remonter {piece}` |
| Controle final | Verification immediate post-montage | `Verification avant essai` |

**Couples de serrage** : Integres dans le H3 "Remonter" sous forme d'encadre conditionnel. Si pas de donnees fiables → ecrire "Serrer au couple constructeur (voir carnet d'entretien)". Ne PAS inventer de valeur.

**Source DB** : `__seo_gamme_conseil` (`sgc_title ILIKE '%demontage%'` + `sgc_title ILIKE '%remontage%'`)

---

### S5 — Erreurs frequentes a eviter

**H2** : `{N} erreurs a eviter lors du remplacement`

| Element | Contenu | Obligatoire |
|---------|---------|:-----------:|
| Nombre d'erreurs | 6-12 erreurs "reelles" (retours d'experience terrain) | OUI (min 3) |
| Format | Erreur + consequence + comment eviter | OUI |
| Anti-retour | Erreurs qui generent des retours produit | OUI |

**Exemples freinage** :
- Prendre la bonne voiture mais mauvaise variante (diametre)
- Oublier de nettoyer le moyeu → disque qui bat
- Confondre sens/position si disque directionnel
- Confondre AV/AR
- Rodage mal fait → bruit/vitrification
- Oublier le temoin d'usure

**Source DB** : `__seo_gamme_conseil` (`sgc_title ILIKE '%pieces a controler%'`) + `selection.anti_mistakes` (v4) / `page_contract.antiMistakes` (legacy)

**Lien recommande** : → R3/guide-achat "Eviter les erreurs d'achat"

---

### S6 — Verification finale et essai routier (RECOMMANDE)

**H2** : `Verification finale et essai routier`

| Element | Contenu | Obligatoire |
|---------|---------|:-----------:|
| Verifications statiques | Liste a cocher (serrage, clips, fuites, jeux) | OUI si present |
| Procedure d'essai progressive | Essai parking → vitesse lente → route normale | OUI si safety-critical |
| Quand arreter et consulter un pro | Seuils d'alerte (bruit anormal, comportement suspect) | OUI si safety-critical |

---

### S7 — Pieces et consommables complementaires (RECOMMANDE)

**H2** : `Pieces et consommables a prevoir`

Proposition naturelle de pack qui augmente le panier moyen SANS spam :

| Element | Contenu | Obligatoire |
|---------|---------|:-----------:|
| Kit principal | Pieces a remplacer ensemble (ex: disques + plaquettes) | OUI si present |
| Consommables | Liquide, nettoyant, graisse, anti-bruit | RECO |
| Accessoires | Vis/agrafe/ressorts neufs si recommandes | RECO |
| Capteurs | Temoin d'usure, capteur ABS si present | RECO |

**Source DB** : `domain.cross_gammes[].slug` (v4) / `page_contract.intro.syncParts` (legacy)

**Lien interne obligatoire** : → R1 Gammes associees (3+ liens vers pieces)

---

### S8 — FAQ rapide (OPTIONNEL)

**H2** : `Questions frequentes sur le remplacement {des pieces}`

| Regle | Detail |
|-------|--------|
| Minimum | 5 Q&A si section presente |
| Maximum | 8 Q&A |
| Orientation | Questions de MAINTENANCE uniquement |
| Format | `<details>/<summary>` pour FAQPage schema |

**Questions types (maintenance)** :
- "Peut-on changer un seul disque ou faut-il la paire ?"
- "Faut-il purger apres changement des plaquettes ?"
- "Combien de temps pour le rodage ?"
- "Si je n'ai pas X, puis-je quand meme faire l'operation ?"
- "Quelle est la duree de vie apres remplacement ?"

**Questions INTERDITES (hors perimetre)** :
- "Qu'est-ce que {piece} ?" → R4 Reference
- "Comment diagnostiquer une panne de {piece} ?" → R5 Diagnostic
- "Quelle marque choisir ?" → R3/guide-achat
- "Combien ca coute ?" → R2 Product

---

## 8. Profils gamme (3 types)

### 8a. Safety-critical (freinage, direction, suspension)

| Adaptation | Detail |
|-----------|--------|
| S1 difficulte minimum | Jamais "facile" — minimum "moyen" |
| S1 encadre securite | Encadre rouge : "Intervention sur organe de securite. En cas de doute, confiez a un professionnel." |
| S4 couples de serrage | Obligatoires si disponibles en base |
| S6 essai routier | Obligatoire — procedure progressive detaillee |
| S7 CTA pro | "Trouvez un garage de confiance pres de chez vous" (en plus du CTA pieces) |
| Quality gate | `MISSING_SAFETY_WARNING` = BLOQUANT (pas WARNING) |

**Gammes** : disque-de-frein, plaquette-de-frein, etrier-de-frein, machoire-de-frein, flexible-de-frein, maitre-cylindre, servo-frein, tambour-de-frein, kit-de-freins-arriere, cable-de-frein-a-main, amortisseur, rotule-de-direction, rotule-de-suspension, cremaillere-de-direction, barre-de-direction, barre-stabilisatrice, colonne-de-direction, capteur-abs, bras-de-suspension, roulement-de-roue

### 8b. DIY-friendly (filtration, eclairage, consommables)

| Adaptation | Detail |
|-----------|--------|
| S1 difficulte | "Facile" autorise |
| S1 outils | Liste detaillee avec alternatives (ex: "cle a douille 10 ou cle plate") |
| S4 detail | Etapes plus granulaires, orientation photo/illustration |
| S1 temps | Inclure "Temps estime : X minutes" |
| S7 consommables | Accent sur la simplicite du pack |

**Gammes** : filtre-a-air, filtre-a-huile, filtre-d-habitacle, filtre-a-carburant, balais-d-essuie-glace, feu-avant, feu-arriere, feu-clignotant, bougie-d-allumage, bougie-de-prechauffage, batterie

### 8c. Pro-only (turbo, distribution, embrayage, injection)

| Adaptation | Detail |
|-----------|--------|
| S1 difficulte | Toujours "avance" |
| S1 disclaimer | "Les etapes ci-dessous sont fournies a titre informatif. Cette intervention requiert un outillage specialise et une expertise professionnelle." |
| S4 approche | Decrire pour comprendre, pas pour faire soi-meme |
| S6 | Obligatoire — "Si vous avez realise l'intervention, voici les points de controle critiques" |
| CTA principal | "Cette intervention necessite un equipement specifique. Confiez-la a un professionnel." |
| S1 temps | "Duree : Xh en atelier" |

**Gammes** : turbo, kit-de-distribution, kit-d-embrayage, cremaillere-de-direction, injecteur, joint-de-culasse, volant-moteur, compresseur-de-climatisation, pompe-a-injection, arbre-a-came

---

## 9. Vocabulaire exclusif et anti-cannibalisation

### EXCLUSIF R3/conseils (reserve — aucun autre role ne peut utiliser)

- `demontage` / `demonter` / `depose`
- `remontage` / `remonter` / `repose`
- `etapes de remplacement` / `pas a pas`
- `outils necessaires` / `outils indispensables`
- `couple de serrage` (contexte procedural)
- `ordre de demontage` / `ordre de remontage`
- `temps d'intervention` / `temps estime`
- `niveau de difficulte` (facile / moyen / avance)
- `controler en meme temps`
- `verifier apres remontage` / `verification finale`
- `essai routier` / `essai progressif`
- `avant de commencer` (contexte procedural)

### INTERDIT sur R3/conseils (appartient a d'autres roles)

**R4 Reference** :
- `definition`, `qu'est-ce que`, `qu'est-ce qu'`, `designe`
- `se compose de`, `compose de`, `terme technique`
- `glossaire`, `par definition`, `au sens strict`
- `role mecanique` (comme titre de section — la notion peut apparaitre dans S1 en 2-3 phrases)
- `role negatif`, `scope et limites`, `regles metier`

**R5 Diagnostic** :
- `diagnostiquer`, `diagnostic` (comme focus principal)
- `bruit anormal`, `vibration anormale` (comme analyse approfondie)
- `code DTC`, `code OBD`
- `panne potentielle`, `usure prematuree` (comme conclusions diagnostiques)

**R3/guide-achat** :
- `guide d'achat`
- `commander`, `ajouter au panier`
- `reference OEM` / `reference OES` (comme sujet principal — mention breve autorisee dans S3)
- `niveau de qualite` (economique/OEM/premium)
- `checklist avant de payer`

**R2 Product** :
- `prix`, `euro`, `en stock`, `livraison`, `promotion`, `frais de port`

### PARTAGE (autorise sur conseils mais pas exclusif)

| Terme | Aussi utilise par | Difference de contexte |
|-------|------------------|----------------------|
| `fonctionnement` | R4 | R4 = principe encyclopedique. Conseils = "comment ca marche dans votre voiture" (2-3 phrases max) |
| `quand changer` | R5 | Conseils = intervalles/seuils proactifs. R5 = conclusion de diagnostic reactif |
| `symptomes` | R5 | Conseils = 3-5 signes brefs + lien R5. R5 = analyse approfondie |
| `pieces associees` | R3/guide-achat | guide-achat = quoi commander ensemble. Conseils = quoi inspecter pendant l'intervention |
| `compatibilite` | R3/guide-achat | guide-achat = trouver la bonne ref. Conseils = verifier avant de commencer le chantier |

---

## 10. Maillage interne (minimum 8 liens)

| Depuis | Vers | Ancre | Placement | Obligatoire |
|--------|------|-------|-----------|:-----------:|
| S1 | R4 Reference | "En savoir plus : {piece} — definition et role" | Fin de S1 | OUI |
| S2 | R5 Diagnostic | "Diagnostic complet : identifier une panne de {piece}" | Fin de S2 | OUI |
| S3 | R1/R2 Gamme | **"Voir les pieces compatibles avec votre vehicule"** | CTA S3 | OUI |
| S5 | R3/guide-achat | "Eviter les erreurs d'achat : guide {piece}" | Dans erreurs | RECO |
| S7 | R1 Gammes associees | Nom de chaque piece associee (lien direct) | Liste S7 | OUI (3+ liens) |
| Intro | R3/guide-achat | "Consultez notre guide d'achat {piece}" | Apres intro | RECO |
| S4 | Autres conseils | "Voir aussi : remplacer {piece liee}" | Dans procedure | RECO |
| S8 FAQ | R4 ou R5 | Lien contextuel dans reponse | Reponses FAQ | RECO |

**Maillage systematique inter-types** :
```
How-to (conseils) <-> Diagnostic (R5) <-> Guide d'achat (R3) <-> FAQ <-> Page gamme (R1/R2)
                  <-> Reference (R4)
```

**Qui peut lier VERS conseils ?**

| Depuis | Autorise | Ancre |
|--------|:--------:|-------|
| R4 Reference | OUI | "Guide de remplacement {piece}" |
| R5 Diagnostic | OUI | "Comment remplacer {piece}" |
| R3/guide-achat | OUI | "Nos conseils de montage {piece}" |
| R1 Router | OUI | Lien navigation |
| R2 Product | OUI | "Conseils de montage pour {piece}" |

---

## 11. Quality gates (11 flags)

| Flag | Severite | Condition |
|------|----------|-----------|
| `MISSING_PROCEDURE` | BLOQUANT | S4 (etapes pas a pas) vide ou < 100 chars |
| `MISSING_DIFFICULTY` | BLOQUANT | S1 sans indicateur facile/moyen/avance |
| `MISSING_COMPATIBILITY_CTA` | BLOQUANT | S3 sans CTA vers page gamme/pieces |
| `ENCYCLOPEDIC_OVERLAP` | BLOQUANT | 2+ termes exclusifs R4 (`definition`, `compose de`, `glossaire`) |
| `DIAGNOSTIC_OVERLAP` | BLOQUANT | S2 depasse 5 bullet points ou approfondit un diagnostic (arbre decision, DTC) |
| `MISSING_SAFETY_WARNING` | WARNING* | Pas d'avertissement securite (*BLOQUANT si gamme safety-critical) |
| `MISSING_ERRORS_SECTION` | WARNING | S5 (erreurs frequentes) vide ou < 3 erreurs |
| `NO_LINK_TO_R4` | WARNING | Zero lien vers `/reference-auto/` |
| `NO_LINK_TO_R5` | WARNING | Zero lien vers `/diagnostic-auto/` |
| `PURCHASE_VOCABULARY` | WARNING | Contient vocabulaire R2/guide-achat (`prix`, `euro`, `en stock`) |
| `GENERIC_PHRASES` | WARNING | Contient "joue un role essentiel" ou "assure le bon fonctionnement" |

**Publication** : Zero BLOQUANT = autorise. Maximum 2 WARNING toleres. 3+ WARNING = revue manuelle.

---

## 12. Mapping v4 / legacy → sections

```
# v4 paths                          → Section              # Legacy fallback
domain.role                          → S1 (role pratique)    page_contract.intro.role
domain.cross_gammes[].slug           → S7 (pack) + liens     page_contract.intro.syncParts
diagnostic.symptoms[].label          → S2 (3-5 signes)       page_contract.symptoms
maintenance.interval (km/mois)       → S2 (intervalles)      page_contract.timing.km/years
maintenance.interval.note            → S2 (condition)        page_contract.timing.note
rendering.risk_consequences          → S2 (motivation)       page_contract.risk.consequences
selection.cost_range                 → S1 (budget)           page_contract.risk.costRange
selection.anti_mistakes              → S5 + S4               page_contract.antiMistakes
rendering.faq                        → S8 (MAINTENANCE)      page_contract.faq
selection.criteria                   → S3 (compatibilite)    page_contract.howToChoose
rendering.arguments                  → NON utilise           page_contract.arguments
diagnostic.causes                    → NON utilise           page_contract.diagnostic_tree
```

---

## 13. Matrice de differenciation complete

| Dimension | R3/conseils | R3/guide-achat | R4 Reference | R5 Diagnostic |
|-----------|------------|----------------|--------------|---------------|
| **Question core** | Comment remplacer ? | Comment acheter ? | Qu'est-ce que c'est ? | Ma piece est-elle HS ? |
| **Intent** | Informationnelle (action) | Info + Transactionnelle | Informationnelle (education) | Informationnelle (probleme) |
| **Persona** | Bricoleur qui va agir | Acheteur qui va commander | Curieux qui apprend | Conducteur inquiet |
| **Ton** | Pratique, procedural, securite | Decision, anti-erreur | Encyclopedique, neutre | Investigatif, diagnostic |
| **Contenu cle** | Etapes remplacement + erreurs | Ref OEM + qualite + pack | Definition + composition | Symptomes + arbre decision |
| **Schema.org** | HowTo + TechArticle | TechArticle + FAQPage | DefinedTerm + TechArticle | TechArticle + FAQPage |
| **H1 pattern** | "Changer {piece} : guide complet" | "{Pieces} : guide d'achat complet" | "{Piece} : definition, role..." | "Symptomes {piece} defaillant" |
| **CTA** | Compatibilite → gamme | Compatibilite → gamme | Lien R3 + R5 | Lien R3/guide-achat |
| **Demontage/Remontage** | CONTENU CLE (S4) | EXCLU | EXCLU | EXCLU |
| **Symptomes** | Brief (S2, max 5 points) | EXCLU | Mention possible | CONTENU CLE |
| **Compatibilite** | Verification avant chantier (S3) | Trouver bonne reference | EXCLU | EXCLU |
| **Erreurs frequentes** | CONTENU CLE (S5) | Checklist anti-erreur (S6) | EXCLU | EXCLU |
| **Pack complementaire** | Inspecter pendant intervention (S7) | Commander ensemble (S5) | EXCLU | EXCLU |

---

## 14. Concepts hors-template (articles separes)

### 14a. Hub "Calendrier d'entretien simple" (fidelisation)

Article hub avec grille par kilometres. Maille vers chaque fiche how-to + packs :

| Intervalle | Postes | Liens |
|------------|--------|-------|
| 10k-15k km | Huile + filtre huile (selon moteur/usage) | → conseils filtre-a-huile, filtre-a-carburant |
| 20k km | Filtre d'habitacle | → conseils filtre-d-habitacle |
| 30k-40k km | Filtre a air | → conseils filtre-a-air |
| 2 ans | Liquide de frein / liquide refroidissement | → conseils frein, refroidissement |
| 60k-120k km | Distribution (selon moteur) | → conseils kit-de-distribution |

### 14b. Format "Erreurs a eviter" (standalone)

Articles rang + conversion sans forcer :
- "10 erreurs qui detruisent des disques neufs"
- "7 erreurs apres changement de plaquettes (pedale molle, bruit...)"
- "5 erreurs sur batterie Start&Stop (AGM/EFB)"

Structure : erreur → consequence → solution → CTA checklist + "Voir pieces compatibles"

---

## 15. Exemple de reference : disque-de-frein (pg_id=82)

| Section v2 | H2 concret |
|------------|-----------|
| S1 | Avant de changer vos disques : ce qu'il faut savoir |
| S2 | Quand faut-il changer les disques de frein ? |
| S3 | Verifier la compatibilite de vos disques |
| S4 | Changer les disques de frein etape par etape |
| S5 | 8 erreurs a eviter lors du remplacement des disques |
| S6 | Verification finale et essai routier |
| S7 | Pieces et consommables a prevoir |
| S8 | Questions frequentes sur le remplacement des disques |

**Pack qui augmente le panier (S7)** :
- Disques + plaquettes (kit)
- Liquide de frein (si purge conseillee)
- Nettoyant frein
- Graisse adaptee / anti-bruit
- Vis/agrafe/ressorts neufs si recommandes
- Capteur d'usure si present

**Erreurs frequentes (S5)** :
1. Prendre la bonne voiture mais mauvaise variante (diametre 258 vs 280mm)
2. Oublier de nettoyer le moyeu → disque qui bat
3. Remonter sans reperer sens/position si disque directionnel
4. Confondre AV/AR
5. Rodage mal fait → bruit + vitrification des plaquettes
6. Oublier le temoin d'usure
7. Ne pas repousser le piston d'etrier correctement
8. Serrage inegal des boulons de roue

**Profil gamme** : safety-critical → difficulte "moyen", encadre securite, essai routier obligatoire

**Source RAG** : `rag://gammes.disque-de-frein` (pg_id=82, truth_level L2)

---

## 16. Astuces de redaction (immediatement exploitables)

1. **Version "express" en haut de S1** : outils + compat + etapes resumees (les pros adorent)
2. **Bloc "A acheter en plus" dans S7** : consommables en liste → booste le panier moyen sans spam
3. **"Si tu n'as pas X, ne commence pas" dans S1** : securite + confiance
4. **Couples/valeurs** : ecrire "ref constructeur" tant qu'on n'a pas une base fiable par vehicule
5. **Maillage systematique** : chaque how-to maille vers diagnostic + guide d'achat + FAQ + gamme
