---
name: kp
description: "Keyword planner SEO par gamme OU véhicule. Détecte auto le type, demande le fichier SEO, lance les KP pour TOUS les rôles R concernés. Usage : /kp <pg_alias|vehicle_slug> [--r1|--r3|--r5|--r6|--r8|--all] [--batch top10]"
argument-hint: "<pg_alias ou vehicle_slug> [--r1|--r3|--r5|--r6|--r8|--all] [--batch top10]"
---

# Keyword Planner — Skill /kp v2.0 (gamme + véhicule unifié)

## Usage
- `/kp filtre-a-huile` — KP gamme : tous les rôles R1/R3/R4/R5/R6
- `/kp renault-clio-3` — KP véhicule : R8 (+ R2 si applicable)
- `/kp filtre-a-huile --r3` — force un seul rôle
- `/kp renault-clio-3 --r8` — force R8 uniquement
- `/kp filtre-a-huile --all` — explicitement tous les R*
- `/kp --batch top10` — KP batch sur les 10 entités prioritaires

## Projet Supabase
`cxpojprgwgubzjyqzmoq`

---

## Procédure

### Étape 0a — Détection automatique gamme / véhicule

1. Chercher en DB dans `pieces_gamme` — si trouvé → **MODE GAMME**
2. Sinon chercher en DB dans `auto_modele` — si trouvé → **MODE VÉHICULE**
3. Sinon : entité inconnue, `HOLD_INPUT_MISSING`

**Si MODE VÉHICULE** :
- Rôles à traiter : **R8** (obligatoire) + R2 (optionnel si gammes liées)
- Agent à invoquer : `r8-keyword-planner`
- Mots-clés : mêmes sources que le mode gamme (étape 0b)

**Si MODE GAMME** :
- Rôles à traiter : R1, R3, R4, R5, R6 (comme avant)
- Suivre la procédure gamme existante

**Afficher** : `Mode détecté : GAMME` ou `Mode détecté : VÉHICULE`

### Étape 0b — Source des mots-clés (mesurée, jamais générée)

Les mots-clés viennent d'une mesure de la demande, jamais d'une génération par un modèle
(CLAUDE.md, invariant 5). Ordre :

1. **Fichier SEO fourni dans le message**, exporté d'un outil de mesure (Google Ads Keyword
   Planner, Search Console…) : tableau avec au moins les colonnes Mot-clé et Volume, plus
   Intention et Rôle R cible si connus. Parser les tableaux et passer les données à chaque agent
   KP. Signaler `seo_source: FICHIER_SEO`.
2. Sinon, **demande importée dans `__seo_keywords`** (Google Ads KP, import par
   `scripts/seo/import-gads-kp.py`) : lecture seule, avec les SELECT de `/kw-classify`.
   Signaler `seo_source: SEO_KEYWORDS`.
3. Sinon : `seo_source: AUCUNE` et `HOLD_INPUT_MISSING` pour chaque rôle. Ne pas continuer
   avec le RAG, ni avec des mots-clés, volumes, PAA, H1 ou meta produits par un modèle.

Le top-kw brut de `__seo_keywords` mesure la demande ; il ne définit pas un terme produit.
Ce skill ne propose ni H1, ni meta title, ni meta description (CLAUDE.md, invariant 6).

### Étape 1 — Résoudre la gamme

```sql
SELECT pg_id, pg_alias, pg_name FROM pieces_gamme
WHERE pg_alias = '{input}' OR pg_id::text = '{input}';
```

### Étape 2 — Faits techniques de la gamme

Les faits (rôle mécanique, intervalle, symptômes, critères de choix) viennent de la projection
WIKI de la gamme, celle que lisent les consommateurs (`/seo-content-loop`, étape CONSUMER).
Projection absente : le signaler ; les agents KP passent en `HOLD_EVIDENCE_INSUFFICIENT` sur les
sections concernées. Le RAG (`/opt/automecanik/rag/knowledge/`) est un consommateur chatbot, pas
une source de faits ni de mots-clés (CLAUDE.md, invariant 4).

### Étape 3 — Déterminer les rôles cibles

**Par défaut (sans --rX)** : lancer les KP pour TOUS les rôles — les agents décident eux-mêmes HOLD si evidence insuffisante :

| Rôle | Toujours lancé | Agent |
|------|---------------|-------|
| R1 | ✅ OUI | r1-keyword-planner |
| R3 | ✅ OUI | r3-keyword-planner |
| R4 | ✅ OUI | r4-keyword-planner |
| R5 | ✅ OUI | r5-keyword-planner |
| R6 | ✅ OUI | r6-keyword-planner |

**Si `--rX` fourni** : lancer uniquement ce rôle.
**Les agents KP gèrent eux-mêmes** le HOLD si evidence insuffisante — le skill ne filtre plus.

### Étape 4 — Lancer via le moteur agentique

**Le skill /kp passe par le moteur agentique** pour orchestrer les keyword planners.
Cela donne automatiquement : plan multi-branches → solve parallèle → critique → approve humain.

#### 4a — Créer le run agentique

```bash
curl -s -X POST http://localhost:3000/api/admin/agentic/runs \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Keyword plan pour gamme {pg_alias} (pg_id={pg_id})",
    "goal_type": "keyword_plan",
    "triggered_by": "skill:kp"
  }'
```

Récupérer le `run_id` de la réponse.

#### 4b — Lancer le planner (décompose en branches R*)

Invoquer l'agent planner qui lit le run et crée les branches :

```
Agent tool, subagent_type: "agentic-planner"
Prompt: "run_id = {run_id}"
```

Le planner crée automatiquement 2-3 branches (ex: r3-keyword-planner, r6-keyword-planner, r8-keyword-planner) basées sur le goal_type.

#### 4c — Lancer les solvers (un par branche, en parallèle)

Pour chaque branch_id retourné par le planner, lancer un solver **en parallèle** :

```
Agent tool, subagent_type: "agentic-solver"
Prompt: "run_id = {run_id}, branch_id = {branch_id}"
run_in_background: true
```

#### 4d — Lancer le critic (après tous les solvers)

Quand tous les solvers sont terminés (`branches_completed = branches_total`) :

```
Agent tool, subagent_type: "agentic-critic"
Prompt: "run_id = {run_id}"
```

Le critic score les branches, choisit la meilleure, et le pipeline avance vers verify → arbitrate → apply.

#### 4e — Le run s'arrête en phase `applying` (gate humaine)

Le moteur prépare le payload et attend l'approbation humaine.
Afficher au user : "Run terminé. Approve avec `POST /api/admin/agentic/runs/{run_id}/approve`"

**Fallback** : si le backend n'est pas démarré (localhost:3000 indisponible), revenir au mode direct : invoquer les agents KP séquentiellement comme avant :

| Rôle | subagent_type |
|------|---------------|
| R1 | r1-keyword-planner |
| R3 | r3-keyword-planner |
| R4 | r4-keyword-planner |
| R5 | r5-keyword-planner |
| R6 | r6-keyword-planner |
| R7 | r7-keyword-planner |
| R8 | r8-keyword-planner |

### Étape 5 — Rapport consolidé

Afficher un rapport unique pour TOUS les rôles traités :

```
## KP Gamme — {pg_name} (pg_id={pg_id})

Source SEO : {FICHIER_SEO | SEO_KEYWORDS | AUCUNE}

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

1. **Ne pas attendre un fichier SEO absent** — passer à `__seo_keywords`, sinon `HOLD_INPUT_MISSING` ; jamais de repli sur le RAG ni sur des mots-clés produits par un modèle
2. **Traiter TOUS les R* par gamme** — pas un seul rôle. Les agents décident eux-mêmes HOLD si evidence insuffisante
3. **Signaler la source SEO** dans le rapport (FICHIER_SEO, SEO_KEYWORDS ou AUCUNE)
4. **Ne jamais inventer de keywords** — uniquement un fichier SEO mesuré fourni ou la demande importée dans `__seo_keywords`
5. Le skill /kp ne génère jamais de contenu final, il produit des plans de mots-clés
6. **Zéro intervention manuelle** — le pipeline tourne de bout en bout sans demander
