---
name: kp
description: "Keyword planner SEO par gamme. Demande le fichier SEO, puis lance les KP pour TOUS les rôles R concernés. Usage : /kp <pg_alias> [--r1|--r3|--r5|--r6|--all] [--batch top10]"
argument-hint: "<pg_alias> [--r1|--r3|--r5|--r6|--all] [--batch top10]"
---

# Keyword Planner — Skill /kp

## Usage
- `/kp filtre-a-huile` — KP pour TOUS les rôles R* de cette gamme
- `/kp filtre-a-huile --r3` — force un seul rôle
- `/kp filtre-a-huile --all` — explicitement tous les R*
- `/kp --batch top10` — KP batch sur les 10 gammes prioritaires

## Projet Supabase
`cxpojprgwgubzjyqzmoq`

---

## Procédure

### Étape 0 — DEMANDER LE FICHIER SEO

**OBLIGATOIRE AVANT TOUTE EXÉCUTION.**

Afficher ce message à l'utilisateur :

---

> ## Fichier SEO requis pour **{gamme}**
>
> Pour produire des keyword plans de qualité, j'ai besoin de tes données SEO.
> Tu peux fournir **un des formats suivants** (du plus complet au plus simple) :
>
> ---
>
> ### Option A — Fichier structuré (recommandé)
>
> CSV, JSON, Excel ou tableau avec ces colonnes :
>
> | Mot-clé | Volume | Difficulté | Intention | Rôle R cible | Position actuelle | URL concurrente |
> |---------|--------|-----------|-----------|-------------|-------------------|-----------------|
> | filtre à huile | 12100 | 35 | navigation | R1 | 8 | oscaro.com/... |
> | changer filtre huile | 4400 | 28 | do | R3 | 12 | vroomly.com/... |
> | filtre huile bouché symptôme | 880 | 15 | identify | R5 | — | — |
> | quel filtre à huile choisir | 1600 | 42 | choose | R6 | 15 | — |
> | filtre à huile c'est quoi | 720 | 12 | define | R4 | 22 | wikipedia.org/... |
>
> **Colonnes critiques** : Mot-clé + Intention + Rôle R cible
> **Colonnes utiles** : Volume + Difficulté + Position actuelle
> **Colonnes bonus** : URL concurrente (pour analyse SERP)
>
> ---
>
> ### Option B — Liste de mots-clés par rôle
>
> Simplement les mots-clés classés par rôle :
>
> **R1 (trouver la pièce)** : filtre à huile, filtre huile voiture, oil filter compatible
> **R3 (comment faire)** : changer filtre huile, remplacement filtre huile, vidange filtre
> **R4 (comprendre)** : filtre à huile définition, rôle filtre huile, composition
> **R5 (problème)** : filtre huile bouché, voyant huile, pression huile basse
> **R6 (choisir)** : quel filtre huile choisir, meilleur filtre huile, comparatif
>
> ---
>
> ### Option C — URLs concurrentes
>
> Les 3-5 URLs des meilleurs résultats Google pour cette gamme.
> J'analyserai les keywords à partir du contenu concurrent.
>
> ---
>
> ### Option D — Pas de fichier SEO
>
> Si tu n'as rien, dis "pas de fichier" — je travaillerai avec le RAG technique.
> ⚠️ Les keywords seront basés sur le contenu existant, pas sur la vraie recherche utilisateur.
>
> ---
>
> **Intentions de recherche par rôle** (pour t'aider à classer) :
>
> | Rôle | Intentions typiques | Exemples de requêtes |
> |------|-------------------|---------------------|
> | R1 | `navigation`, `find`, `compatibility` | "filtre huile clio 3", "filtre huile compatible 206" |
> | R3 | `do`, `how-to`, `maintain`, `replace` | "comment changer filtre huile", "tutoriel vidange" |
> | R4 | `define`, `understand`, `compare_terms` | "c'est quoi filtre huile", "filtre huile vs filtre carburant" |
> | R5 | `identify`, `diagnose`, `troubleshoot` | "voyant huile allumé", "filtre huile bouché symptômes" |
> | R6 | `choose`, `compare`, `buy_guide` | "quel filtre huile choisir", "meilleur filtre huile 2026" |

---

**Après avoir affiché les options** :

Générer automatiquement le **prompt de recherche SEO** prêt à copier-coller dans Claude (chrome) :

---

> **Copie ce prompt dans Claude (chrome) pour générer ton fichier SEO :**
>
> ```
> Tu es un expert SEO automobile français spécialisé dans les pièces auto e-commerce.
>
> Pour la gamme **{pg_name}** (pièce automobile vendue sur automecanik.com),
> génère un dossier SEO complet au format Markdown (.md).
>
> Le site vend des pièces auto en ligne. Chaque gamme a 5 types de pages
> avec des intentions de recherche différentes. Tu dois produire les
> mots-clés, les PAA, les FAQ, les titres H1/H2, les meta descriptions,
> les CTA, les schémas structurés et l'analyse concurrentielle pour chaque page.
>
> ---
>
> ## R1 — PAGE GAMME (trouver la bonne pièce pour son véhicule)
>
> **Intention** : "Je cherche un {pièce} pour ma voiture"
> **Objectif** : sélection véhicule → pièces compatibles
> **Schema.org** : CollectionPage + ItemList + BreadcrumbList
> **CTA principal** : "Sélectionnez votre véhicule"
>
> Génère :
> 1. **5-10 mots-clés** classés par volume (patterns : "{pièce} + véhicule", "{pièce} compatible")
> 2. **3-5 variantes orthographiques/régionales** (ex: "filtre huile" vs "filtre à huile" vs "oil filter")
> 3. **3 PAA Google** (People Also Ask réelles pour cette intention)
> 4. **3 questions FAQ** orientées sélection/compatibilité
> 5. **H1 suggéré** + **Meta title** (max 60 chars) + **Meta description** (120-155 chars)
> 6. **3 mots-clés négatifs** (à NE PAS cibler sur cette page — ils appartiennent à R3/R5/R6)
> 7. **3 URLs concurrentes principales** pour cette intention + ce qu'elles couvrent qu'on ne couvre pas
> 8. **Pic saisonnier** : oui/non + mois concernés (ex: batterie = octobre-février)
>
> ---
>
> ## R3 — PAGE CONSEILS (comment remplacer / entretenir)
>
> **Intention** : "Comment changer/vérifier/entretenir mon {pièce}"
> **Objectif** : guider l'action, réduire les erreurs
> **Schema.org** : HowTo + FAQPage
> **CTA principal** : "Voir les pièces compatibles"
>
> Génère :
> 1. **5-10 mots-clés** (patterns : "changer {pièce}", "quand remplacer", "tutoriel")
> 2. **3-5 variantes orthographiques**
> 3. **5 PAA Google** pour cette intention
> 4. **8 H2 suggérés** : S1 Prérequis, S2 Quand intervenir, S3 Compatibilité,
>    S4 Dépose/repose, S5 Erreurs fréquentes, S6 Vérification finale,
>    S7 Pièces associées, S8 FAQ maintenance
> 5. **5-8 questions FAQ** orientées how-to
> 6. **H1** + **Meta title** + **Meta description**
> 7. **3 mots-clés négatifs** (appartiennent à R5/R6)
> 8. **3 URLs concurrentes** + gaps identifiés
> 9. **Clusters sémantiques** : regrouper les mots-clés par sous-intention
>    (ex: cluster "timing" = quand changer, kilométrage, fréquence ;
>     cluster "méthode" = comment changer, tutoriel, étapes)
>
> ---
>
> ## R4 — PAGE RÉFÉRENCE (comprendre la pièce)
>
> **Intention** : "C'est quoi un {pièce} ? À quoi ça sert ?"
> **Objectif** : définir, expliquer, désambiguïser
> **Schema.org** : DefinedTerm + TechArticle + FAQPage
> **CTA principal** : "Voir les {pièces} compatibles"
>
> Génère :
> 1. **5-10 mots-clés** (patterns : "{pièce} c'est quoi", "rôle", "composition", "vs")
> 2. **3 PAA Google**
> 3. **5-7 H2 suggérés** : Définition, Rôle mécanique, Types/variantes,
>    Confusions courantes, Règles métier, Scope
> 4. **3-5 questions FAQ** compréhension
> 5. **H1** + **Meta title** + **Meta description**
> 6. **3 paires de confusion** : "{pièce A} vs {pièce B}" avec explication courte
> 7. **3 mots-clés négatifs** (appartiennent à R3/R5)
>
> ---
>
> ## R5 — PAGE DIAGNOSTIC (identifier un problème)
>
> **Intention** : "J'ai un bruit/voyant/problème — c'est le {pièce} ?"
> **Objectif** : orienter prudemment à partir d'un symptôme
> **Schema.org** : FAQPage + TechArticle
> **CTA principal** : "Consulter un professionnel" ou "Vérifier votre {pièce}"
>
> Génère :
> 1. **5-10 mots-clés** (patterns : "{pièce} HS symptômes", "voyant", "bruit", "panne")
> 2. **5 PAA Google** orientées symptôme/diagnostic
> 3. **4-6 H2 suggérés** : Symptômes observables, Hypothèses, Quick checks,
>    Codes OBD, Quand consulter
> 4. **5-8 questions FAQ** symptôme/diagnostic
> 5. **H1** + **Meta title** + **Meta description**
> 6. **Liste de symptômes** classés par type : bruit, vibration, voyant, odeur, visuel
> 7. **3 mots-clés négatifs** (appartiennent à R3/R6)
> 8. **Niveau de prudence** : LOW/MEDIUM/HIGH selon la criticité de la pièce
>
> ---
>
> ## R6 — PAGE GUIDE D'ACHAT (choisir avant commande)
>
> **Intention** : "Quel {pièce} acheter ? Comment ne pas me tromper ?"
> **Objectif** : sécuriser la décision d'achat
> **Schema.org** : BuyingGuide (Article) + FAQPage
> **CTA principal** : "Trouver la référence compatible"
>
> Génère :
> 1. **5-10 mots-clés** (patterns : "quel choisir", "meilleur", "comparatif", "OEM vs adaptable")
> 2. **3-5 variantes orthographiques**
> 3. **5 PAA Google** orientées choix/achat
> 4. **7 H2 suggérés** : Identifier, Référence, Spécifications, Qualité OEM/OES/adaptable,
>    Commander le bon pack, Checklist, FAQ achat
> 5. **5-8 questions FAQ** achat/choix
> 6. **H1** + **Meta title** + **Meta description**
> 7. **3-5 erreurs d'achat courantes** à documenter
> 8. **3 mots-clés négatifs** (appartiennent à R3/R5)
> 9. **3 URLs concurrentes** + gaps identifiés
> 10. **Clusters sémantiques** achat
>
> ---
>
> ## SECTIONS TRANSVERSALES (après les 5 rôles)
>
> ### Analyse saisonnière
> Cette gamme a-t-elle un pic saisonnier ? Si oui :
> - Mois de pic
> - Variation estimée du volume de recherche
> - Mots-clés saisonniers spécifiques
>
> ### Clusters sémantiques globaux
> Regroupe TOUS les mots-clés des 5 rôles en clusters sémantiques :
> | Cluster | Mots-clés | Rôle principal | Rôles secondaires |
> |---------|-----------|---------------|-------------------|
> Objectif : identifier les chevauchements et garantir que chaque cluster a UN rôle principal.
>
> ### Maillage inter-rôles suggéré
> Pour chaque rôle, quel lien interne vers les autres rôles :
> | Depuis | Vers | Ancre suggérée |
> |--------|------|---------------|
> | R1 | R4 | "En savoir plus sur {pièce}" |
> | R1 | R3 | "Comment changer {pièce}" |
> | R3 | R6 | "Guide d'achat {pièce}" |
> | R5 | R3 | "Comment remplacer {pièce}" |
> | R6 | R1 | "Trouver {pièce} compatible" |
>
> ---
>
> ## FORMAT DE SORTIE OBLIGATOIRE
>
> Pour CHAQUE rôle (R1, R3, R4, R5, R6), donne :
>
> ### 1. Tableau mots-clés
> | # | Mot-clé | Volume | Intention | Usage SEO | Cluster |
> |---|---------|--------|-----------|-----------|---------|
> | 1 | {principal} | high | {intent} | **H1 + meta title** | {cluster} |
> | 2 | {variation} | medium | {intent} | **H2** | {cluster} |
>
> ### 2. PAA Google (People Also Ask)
> ### 3. H1 suggéré
> ### 4. Meta title (max 60 chars)
> ### 5. Meta description (120-155 chars)
> ### 6. H2 suggérés par section
> ### 7. FAQ (questions + réponses courtes 2-3 lignes)
> ### 8. Mots-clés négatifs (à ne PAS cibler sur cette page)
> ### 9. URLs concurrentes + gaps
> ### 10. CTA principal + secondaire
> ### 11. Schema.org recommandé
> ### 12. Erreurs/confusions/symptômes (selon le rôle)
>
> ---
>
> RÈGLES :
> - Produis le résultat au format **Markdown (.md)**
> - Nomme le fichier : `seo-{pg_alias}.md`
> - Utilise des titres ## pour chaque rôle
> - Utilise des tableaux markdown pour les mots-clés
> - Volume : high (>5000/mois), medium (1000-5000), low (<1000)
> - Français courant, pas jargon sauf si le mot-clé l'exige
> - Chaque rôle = page SÉPARÉE — pas de mélange d'intentions
> - Minimum 5 FAQ par rôle, 3 PAA par rôle
> - Les mots-clés négatifs d'un rôle sont les positifs d'un autre
> - Les clusters sémantiques servent à éviter la cannibalisation interne
> - Utilise des tableaux markdown pour les mots-clés
> - Le fichier doit être prêt à copier-coller directement comme fichier .md
> - Nomme le fichier : `seo-{pg_alias}.md` (ex: `seo-filtre-a-huile.md`)
> ```

---

**Après avoir affiché le prompt** :

Dire à l'utilisateur :

> Copie ce prompt dans Claude (chrome), colle le résultat ici, et je lance les KP pour tous les rôles.
> Si tu n'as pas le temps, dis "D" et je continue avec le RAG seul.

**Quand l'utilisateur colle le résultat** :
- Parser les 5 tableaux (R1, R3, R4, R5, R6)
- Extraire pour chaque rôle : mot-clé principal (H1), variations (H2), longue traîne (body/FAQ)
- Passer les données à chaque agent KP dans le prompt
- Signaler dans le rapport : `seo_source: "FICHIER SEO (généré via Claude chrome)"`

**Si l'utilisateur dit "D"** :
- Continuer avec le RAG technique seul
- Signaler : `seo_source: "RAG_ONLY — keywords techniques, pas SEO-optimisés"`
- Recommander : "🔴 Fournir un fichier SEO pour améliorer le ciblage keywords"

### Étape 1 — Résoudre la gamme

```sql
SELECT pg_id, pg_alias, pg_name FROM pieces_gamme
WHERE pg_alias = '{input}' OR pg_id::text = '{input}';
```

### Étape 2 — Lire le fichier RAG gamme

```
Read /opt/automecanik/rag/knowledge/gammes/{pg_alias}.md
```

Parser le frontmatter YAML pour déterminer :
- `domain.role` → domaine mécanique
- `maintenance.interval` → intervalle remplacement
- `diagnostic.symptoms` → symptômes (pour R5)
- `selection.criteria` → critères (pour R3/R6)
- `seo_cluster` → keywords existants (si dispo)

### Étape 3 — Déterminer les rôles cibles

**Par défaut (sans --rX)** : lancer les KP pour TOUS les rôles pertinents :

| Rôle | Condition pour lancer | Agent |
|------|----------------------|-------|
| R1 | Toujours (gamme active) | r1-keyword-planner |
| R3 | Toujours (how-to universel) | r3-keyword-planner |
| R4 | Si RAG a `domain.role` + `domain.confusion_with` | r4-keyword-planner |
| R5 | Si RAG a `diagnostic.symptoms` (≥1 symptôme) | r5-keyword-planner |
| R6 | Si RAG a `selection.criteria` + `anti_mistakes` | r6-keyword-planner |

**Si `--rX` fourni** : lancer uniquement ce rôle.
**Si `--all` fourni** : forcer les 5 rôles même si evidence faible.

### Étape 4 — Invoquer les agents KP (séquentiellement)

Pour chaque rôle déterminé à l'étape 3, invoquer l'agent via `Agent tool` :

| Rôle | subagent_type |
|------|---------------|
| R1 | r1-keyword-planner |
| R3 | r3-keyword-planner |
| R4 | r4-keyword-planner |
| R5 | r5-keyword-planner |
| R6 | r6-keyword-planner |
| R7 | r7-keyword-planner |
| R8 | r8-keyword-planner |

Prompt à passer à chaque agent :
```
Génère un keyword plan pour la gamme {pg_alias} (pg_id={pg_id}).

Fichier RAG : /opt/automecanik/rag/knowledge/gammes/{pg_alias}.md
Projet Supabase : cxpojprgwgubzjyqzmoq
{SEO data fourni par l'utilisateur si dispo}

Exécute le pipeline complet (P0→QA Gate) et écris le résultat dans la table __seo_r{X}_keyword_plan.
```

### Étape 5 — Rapport consolidé

Afficher un rapport unique pour TOUS les rôles traités :

```
## KP Gamme — {pg_name} (pg_id={pg_id})

Source SEO : {RAG_ONLY | CSV fourni | URLs analysées}

| Rôle | Sections | Score | Gates | Status |
|------|----------|-------|-------|--------|
| R1 | 5/5 | 82 | 7/7 | PLAN_OK |
| R3 | 7/8 | 78 | 6/7 | PLAN_OK (S4 blocked) |
| R4 | 5/7 | 65 | 5/7 | PLAN_OK (2 sections low evidence) |
| R5 | 4/6 | 70 | 7/8 | PLAN_OK |
| R6 | 6/8 | 75 | 6/7 | PLAN_OK (S8 blocked) |

Manquants : {rôles non lancés et pourquoi}
```

---

## Mode batch

### `--batch top10`

1. Identifier les 10 gammes actives avec le plus de gaps KP :
```sql
SELECT pg.pg_alias, pg.pg_id,
  (SELECT count(*) FROM __seo_r3_keyword_plan WHERE rkp_pg_id = pg.pg_id AND rkp_status = 'validated') as has_r3_kp,
  (SELECT count(*) FROM __seo_r6_keyword_plan WHERE r6kp_pg_id = pg.pg_id) as has_r6_kp
FROM pieces_gamme pg
WHERE pg.pg_id IN (SELECT DISTINCT sg_pg_id::int FROM __seo_gamme WHERE sg_content IS NOT NULL)
ORDER BY has_r3_kp ASC, has_r6_kp ASC
LIMIT 10;
```

2. Pour chaque gamme, demander le fichier SEO puis invoquer `/kp {alias}`.

---

## Règles

1. **Toujours demander le fichier SEO en premier** — c'est la procédure
2. **Traiter tous les R* par gamme** — pas un seul rôle
3. **Signaler la source SEO** dans le rapport (RAG_ONLY vs CSV vs URLs)
4. **Ne jamais inventer de keywords** — uniquement RAG + fichier SEO fourni
5. Le skill /kp ne génère jamais de contenu final, il produit des plans de mots-clés
