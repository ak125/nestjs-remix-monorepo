---
check: rpc-overload-ambiguity
severity: critical
confidence: high
expected_false_positive_rate: 0.02
autofixable: false
sources:
  - pg_proc + pg_depend via supabase MCP (proargnames, pronargs, pronargdefaults, extension ownership)
incidents_proven:
  - "#993 (2026-06-15, checkout cassé 24 j) — create_order_atomic(jsonb,jsonb) ET (jsonb,jsonb,uuid DEFAULT) coexistaient → PostgREST PGRST203 « Could not choose the best candidate function » sur CHAQUE .rpc('create_order_atomic'). Détecté par hasard, pas par un check. Fix: drop de l'overload obsolète (#992 monitor, #996 test de régression)."
risk_documented:
  - "Vérifié en live 2026-06-15 : get_cart_stats renvoie PGRST203 (3 overloads text/varchar/uuid)."
---

# Check : PostgREST Function Overload Ambiguity (PGRST203)

## Pattern audité

Fonctions Postgres du schéma `public` (exposé par PostgREST) ayant **plusieurs
overloads** dont l'ensemble est **ambigu pour un appel RPC PostgREST** :

- **Sous-ensemble + défauts** : l'ensemble des noms d'arguments d'un overload A
  est inclus dans celui d'un overload B, et les arguments en plus de B ont tous
  une valeur `DEFAULT`. Un body JSON `{...args de A}` matche **A ET B** →
  PostgREST ne peut pas choisir. *(C'est exactement le cas `create_order_atomic`
  (#993) : `(p_order, p_lines)` ⊆ `(p_order, p_lines, p_correlation_id DEFAULT)`.)*
- **Types seuls** : deux overloads avec des **noms d'arguments identiques** mais
  des types différents (ex. `text` / `varchar` / `uuid`). Un body JSON
  `{p_user_id: "..."}` matche les N candidats → PGRST203.

**Impact** : chaque appel `.rpc('<fn>', {...})` lève
`PGRST203 « Could not choose the best candidate function »`. Côté client =
**panne fonctionnelle totale et silencieuse** de la surface concernée (la
création de commande a échoué 24 jours, cf. #993). Un test SQL direct
(`SELECT fn(...)`) passe — l'ambiguïté n'existe **que** sur la voie PostgREST.

## Origine

PR #993 (2026-06-15). Une migration (#301) a ajouté un 3ᵉ argument à
`create_order_atomic` **sans dropper** l'overload à 2 arguments ; PostgREST est
devenu incapable de router l'appel → checkout cassé pour 100 % des clients
pendant 24 jours, sans alerte. La cause n'a été trouvée que par investigation
manuelle. Ce check encode la détection pour que cette classe ne soit plus
découverte par hasard.

## Méthode

`pg_proc` est la **source de vérité** des signatures — on ne parse jamais le
texte SQL des migrations (fragile, ne voit pas la dérive DB manuelle). On exclut
les fonctions appartenant à une extension (`pg_depend.deptype = 'e'` ; bruit
pgvector / unaccent).

```sql
WITH pub_fns AS (
  SELECT p.oid, p.proname,
         COALESCE((SELECT array_agg(an ORDER BY an)
                   FROM unnest(p.proargnames[1:p.pronargs]) an), '{}') AS in_names,
         p.pronargs, p.pronargdefaults
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND NOT EXISTS (            -- exclure les fonctions d'extension (bruit)
      SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
    )
),
overloaded AS (SELECT proname FROM pub_fns GROUP BY proname HAVING count(*) > 1)
SELECT DISTINCT a.proname,
       a.in_names AS args_a, b.in_names AS args_b
FROM pub_fns a
JOIN pub_fns b ON a.proname = b.proname AND a.oid < b.oid
WHERE a.proname IN (SELECT proname FROM overloaded)
  AND (
    -- A ⊆ B avec les args en plus de B tous défaultés
    (a.in_names <@ b.in_names AND (b.pronargs - a.pronargs) <= b.pronargdefaults)
    -- OU noms identiques (overloads par type seul)
    OR (a.in_names <@ b.in_names AND b.in_names <@ a.in_names)
  )
ORDER BY a.proname;
```

Chaque ligne renvoyée = un finding `severity: critical` (toute ambiguïté
PostgREST sur une fonction `public` est une panne potentielle silencieuse).

## Sortie attendue (JSON)

```json
{
  "check": "rpc-overload-ambiguity",
  "pass": false,
  "findings": [
    {
      "function": "get_cart_stats",
      "kind": "type-only-overload",
      "overloads": ["p_user_id text", "p_user_id varchar", "p_user_id uuid"],
      "severity": "critical",
      "fix_hint": "Garder UN seul type (text) ; dropper les autres après vérif des appelants internes."
    }
  ],
  "summary": { "overloaded_non_extension": 3, "ambiguous": 3 }
}
```

## Findings live au 2026-06-15 (preuve)

| Fonction | Type d'ambiguïté | Domaine | Appelée via `.rpc()` ? |
|---|---|---|---|
| `get_cart_stats` | types `text`/`varchar`/`uuid` | cart | non (mine dormante) |
| `evaluate_rule_condition` | sous-ensemble + défauts (3 overloads) | SEO rules engine | non |
| `backfill_seo_keywords_type_ids` | `{p_batch_size}` ⊆ `{p_batch_size, p_pg_id DEFAULT}` | SEO maintenance | non |

`get_cart_stats` confirmée renvoyant `PGRST203` via PostgREST live. Les 3 sont
**dormantes** (aucun `.rpc()` ne les appelle aujourd'hui) — exactement l'état où
était `create_order_atomic` avant qu'un appelant soit ajouté. `create_order_atomic`
n'apparaît plus (drop appliqué, #993).

## Faux positifs connus

- **Overloads par type *sans* exposition PostgREST** : si une fonction n'est
  jamais appelée via `.rpc()` (uniquement en SQL interne), l'ambiguïté est
  dormante. Le check la signale quand même (dette à risque), mais le finding
  doit noter `called_via_rpc: false` (grep `.rpc('<fn>'` dans backend/src +
  frontend/app) pour prioriser.
- Fonctions d'extension : déjà exclues via `pg_depend.deptype = 'e'`.

## Limites

- Ne détecte pas l'ambiguïté **positionnelle** (appels PostgREST par position,
  non utilisés ici — PostgREST route par noms d'arguments dans le body JSON).
- Ne classe pas automatiquement l'overload « canonique » à conserver — décision
  humaine (vérifier les appelants internes SQL avant tout drop).

## Action recommandée pour les findings

1. **Identifier l'overload canonique** (celui qui sert tous les appelants) et
   vérifier les appelants **internes** (`SELECT fn(...)`, triggers, vues) en plus
   des `.rpc()` — un drop aveugle peut casser un appelant SQL.
2. **Migration owner-gated** dropant le(s) overload(s) obsolète(s) :
   `DROP FUNCTION IF EXISTS public.<fn>(<signature obsolète>);` (préambule
   `set lock_timeout`/`statement_timeout`, *down* no-op documenté — re-créer
   réintroduirait l'ambiguïté). Domaines sensibles (cart, paiement, SEO) =
   revue owner obligatoire.
3. Si les deux overloads sont légitimes : **renommer les paramètres** ou la
   fonction pour lever l'ambiguïté PostgREST (hint officiel PGRST203).
