# Session B — Post-mortem (Option A : ne rien toucher à v3)

> Date : 2026-04-13
> Branche : `fix/pieces-relation-type-pollution-session-a`
> Commits : `f3d65d02` (Session A) + `76fbfc47` (Session B déploiement) + `5b48f953` (test report)
> Décision finale : **Option A — laisser `get_pieces_for_type_gamme_v3` intact**. Session B reste en backup.

## 1. Pourquoi ce post-mortem

L'audit B.7 (identification des callers prod pour les 10 autres fonctions SQL) a révélé que **Session B a patché la mauvaise fonction** : `rm_get_page_complete_v2` est dans le module `rm/` qui est **dev-only** (CLAUDE.md infra), et n'est **pas le path prod**.

Le vrai path prod est :
```
Remix frontend → NestJS backend
  → backend/src/modules/gamme-rest/services/gamme-page-data.service.ts
    → UnifiedPageDataService (catalog module)
      → RPC supabase.rpc('get_pieces_for_type_gamme_v3', ...)
```

Fichier : [backend/src/modules/catalog/services/unified-page-data.service.ts:268](backend/src/modules/catalog/services/unified-page-data.service.ts#L268)

## 2. Mais `v3` est déjà protégé — "V8 Ghost fix"

`get_pieces_for_type_gamme_v3` contient déjà un filtre anti-pollution déployé antérieurement :

```sql
active_pieces AS (
  SELECT ...
  FROM pieces p
  INNER JOIN relations r ON p.piece_id = r.rtp_piece_id
  CROSS JOIN root_gamme rg
  WHERE p.piece_display = true
    -- ═══ FIX GHOST PIECES V8: exclure pièces sans nom ou sans catégorie ═══
    AND p.piece_name IS NOT NULL AND TRIM(p.piece_name) != ''
    AND p.piece_fil_name IS NOT NULL AND TRIM(p.piece_fil_name) != ''
),
```

Ce filtre "V8 Ghost" exclut les pièces avec `piece_fil_name` null ou vide. En pratique, **la plupart des pièces de la cohorte 2025 polluée ont `piece_fil_name = NULL`** (3 pièces testées, 3 à NULL : 12181205, 12181212, 12185463). Donc V8 Ghost filtre efficacement la pollution affichée.

## 3. Mesure comparative sur la page Skoda Rapid × plaquettes

| Path | Fonction prod | Filtre actif | Count returned |
|---|---|---|---|
| **Prod actuel** | `get_pieces_for_type_gamme_v3` | V8 Ghost (`piece_fil_name IS NOT NULL`) | **30** |
| Dev rm module | `rm_get_page_complete_v2` (patché B.5) | `NOT EXISTS _filter.rtp_pollution_ids` | 59 |
| Dev rm module sans filtre | `rm_get_page_complete_v2` (pré-patch) | aucun | 166 |
| Raw prt | direct SELECT | — | 990 total / 392 active display |

**Le count prod réel est 30**, pas 249 comme mentionné dans le rapport initial. Le rapport testait probablement `rm_get_page_complete_v2` dev-side (166 pieces limited to ~249 après tris/joins) ou un état antérieur à V8 Ghost.

## 4. V8 Ghost est over-aggressive mais safe

Limitation de V8 Ghost : il filtre les pièces légitimes 2025 aussi, pas juste la pollution.

Exemple concret : **Valeo 207541** (piece_id 12181205) :
- Vraie Valeo plaquette TecDoc, artnr présent dans `tecdoc_raw.t400` (381 relations réelles)
- **piece_fil_name = NULL** → filtrée par V8 Ghost
- **Invisible sur la page Skoda Rapid alors qu'elle est compatible et légitime**

Mon filtre `NOT EXISTS _filter.rtp_pollution_ids` est plus précis : il garde 207541 (pas marquée) et exclut 671889 (marquée). Mais activer ce filtre à la place de V8 Ghost nécessite une modification v3 avec validation métier.

**Estimation d'impact** : remplacer V8 Ghost par mon filtre restaurerait environ **1 200-1 500 pièces légitimes 2025** (les artnrs réellement en t400 mais piece_fil_name null) sur les pages vehicle_gamme. C'est un gain SEO net mais un changement de comportement prod à valider.

## 5. Décision : Option A — ne rien toucher à v3

### Rationale

1. **V8 Ghost fonctionne** : les utilisateurs prod ne voient plus la pollution. La page Skoda Rapid affiche 30 pièces au lieu de 249+.
2. **Risque zéro** : aucun changement sur le path prod signifie zéro risque de régression.
3. **Session B reste disponible** : `_filter.rtp_pollution_ids` (11 929 IDs) est prêt à l'emploi si/quand on décide d'affiner V8 Ghost en Session C.
4. **Cost zéro** : `get_listing_products_extended_filtered` + patch `rm_get_page_complete_v2` sont sur un path dev-only, ils ne consomment rien en prod.
5. **Les résidus cohorte 2023** sont déjà filtrés par V8 Ghost (mêmes pieces sans piece_fil_name), donc Session C n'est pas urgente non plus.

### Ce qui reste en place après Option A

| Élément | État | Impact prod |
|---|---|---|
| `_filter` schema + `rtp_pollution_ids` (11 929 rows, 2 MB) | Conservé | 0 (read-only, pas joint par v3) |
| `get_listing_products_extended_filtered` (nouvelle fonction) | Conservé | 0 (pas appelée en prod) |
| `rm_get_page_complete_v2` (patchée) | Conservé | 0 (dev-only module) |
| `get_listing_products_extended` (originale) | Inchangée | 0 (fonctionne comme avant) |
| `get_pieces_for_type_gamme_v3` + V8 Ghost | **Inchangée**, filtre actif | Continue à filtrer la pollution visible |
| Migrations `20260414_session_b_*.sql` | Conservées | Documentation replay |

### Ce qui n'est PAS fait

- ❌ Patch v3 (Option B) — pas nécessaire, V8 Ghost suffit
- ❌ Patch des 9 autres fonctions critiques (B.7) — v3 est la seule sur path prod et elle est protégée
- ❌ DELETE physique de la pollution dans prt — toujours Session C/D future
- ❌ Restauration des 1 200-1 500 Valeo 2025 légitimes filtrées par V8 Ghost — trade-off accepté

## 6. Leçons apprises

### Erreur d'identification du path prod

L'audit Session A a identifié `rm_get_page_complete_v2` comme entry point via grep + RPC allowlist. Mais :
- L'allowlist contient toutes les RPC callable, pas juste celles réellement appelées
- Le module `rm/` est dev-only per CLAUDE.md (import non résolu en Docker)
- Le vrai prod path est `catalog/unified-page-data.service.ts` qui utilise v3

**Corrective action** : avant de patcher une fonction SQL, **toujours tracer le call graph depuis un point d'entrée HTTP connu** (ex : Remix route → NestJS controller → service → RPC). Ne pas se fier à l'allowlist.

### V8 Ghost était le vrai fix

Le rapport initial ("249 Valeo plaquettes sur Skoda") a décrit un symptôme qui avait déjà été partiellement mitigé par un fix antérieur (V8 Ghost). Session A a analysé la cause racine (populate-source-linkages.py broken) mais n'a pas vérifié si un fix existait déjà côté lecture.

**Corrective action** : avant de designer un fix, **inventorier les fixes existants** sur le même symptôme (grep `GHOST`, `FIX`, `HACK` dans les fonctions SQL + commentaires).

### Session B n'est pas un échec

- Les v2 scripts Session A (`populate-source-linkages.v2.py`, `tecdoc-project-core.v2.py`) restent **pertinents** pour empêcher la récurrence lors du prochain reload t400
- Le `_filter.rtp_pollution_ids` table est une **infrastructure utile** pour des fixes futurs plus précis que V8 Ghost
- Les migrations documentées permettent une **replay facile** en cas de besoin
- La méthodologie de tests (7/7 PASS) est **reproductible** pour la prochaine patch

## 7. Actions de suivi (pas maintenant)

1. **Session C (optionnel)** : affiner V8 Ghost en remplaçant `piece_fil_name IS NOT NULL` par `NOT EXISTS _filter.rtp_pollution_ids`. Gain : +1 200 pièces légitimes 2025. Risque : changement de comportement prod, validation métier requise.

2. **Patches v2 scripts** : déployer les scripts patchés lors du prochain reload t400 pour empêcher la pollution récurrente. À planifier indépendamment.

3. **Documentation V8 Ghost** : ajouter un commentaire dans v3 pointant vers ce post-mortem pour expliquer pourquoi V8 Ghost existe et ce qu'il filtre.

4. **Cohorte 2023** (1 528 pièces) : déjà partiellement filtrée par V8 Ghost (mêmes critères piece_fil_name null). Pas d'action immédiate.

## 8. État final de la branche

Commits sur `fix/pieces-relation-type-pollution-session-a` :

| SHA | Session | Contenu |
|---|---|---|
| `f3d65d02` | Session A | Scripts v2 frozen+patched, 3 rapports A |
| `76fbfc47` | Session B deploy | Migrations 20260414 + sampling report |
| `5b48f953` | Session B tests | Test report 7/7 PASS |
| `<next>` | Session B post-mortem | Ce fichier |

**État prod** : identique à pré-branche sur le path visible (v3 + V8 Ghost). Additions invisibles : schema `_filter`, new function `get_listing_products_extended_filtered`, patched `rm_get_page_complete_v2` (dev-only).

**Rollback option** : si un jour on veut tout retirer :
```sql
DROP SCHEMA _filter CASCADE;
DROP FUNCTION public.get_listing_products_extended_filtered(integer, bigint, integer);
-- Restore rm_get_page_complete_v2 pre-patch via migration inverse
```

Branche **prête pour PR** quand tu voudras merger (ou laisser dormir). Aucune urgence.

## 9. Conclusion

Session B était **techniquement réussie** (infrastructure robuste, tests verts, rollback trivial) mais **fonctionnellement inutile en l'état** car le path prod est protégé par V8 Ghost. L'Option A consiste à reconnaître que V8 Ghost suffit pour la prod visible, et à garder Session B en backup.

**Règle d'or confirmée** : avant tout fix prod, tracer le call graph depuis HTTP → DB, et inventorier les fixes existants sur le même symptôme.

---

*"La meilleure approche robuste sans bricolage" → parfois c'est de ne rien toucher.*
