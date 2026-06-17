# Vague 5 — RLS drift-tail + function-privilege hardening

> **Date** : 2026-06-16
> **Status** : `MIGRATIONS_PREPARED` (NOT applied — shared DB, owner-gated apply)
> **Source** : Supabase advisor (security) — project `cxpojprgwgubzjyqzmoq`
> **Auteur** : Claude (extension du programme vagues 1→4b, ADR-021 / ADR-028 Option D)
> **Pattern** : identique aux migrations `20260422_enable_rls_internal_tables.sql` /
> `20260422_views_invoker_kg.sql` — **étendu, pas réinventé**.

---

## Résumé exécutif

L'advisor sécurité remonte **776 lints** : **215 ERROR**, **541 WARN**, **20 INFO**.
Le cœur = **216 tables `public` internes sans RLS** (analytics SEO, miroirs GSC/GA4/CWV,
snapshots, **données de prix/marge fournisseurs**, backups média) — créées ou
**rotées (partitions) après** la vague de durcissement du 2026-04-22/23. Avec les
GRANT anon/authenticated par défaut de Supabase (411 tables), n'importe quel
détenteur de la clé publique `SUPABASE_ANON_KEY` pouvait **lire ET écrire** ces
tables via PostgREST.

Vague 5 = **5 migrations** préparées (réversibles, idempotentes, gouvernées) qui ferment
**215 ERROR → 0** et **541 WARN → ~190** (334 `search_path` + 1 matview + 13 fonctions
DEFINER prouvées-safe). Le durcissement EXECUTE des **199** RPC `SECURITY DEFINER` est
traité **en deux temps** : la migration **#5b** revoke les **13 prouvées-safe** (triggers +
fonctions pg_cron, jamais exécutées en anon) ; les **~186 restantes** (read-path + 8
ambiguës) sont **déférées à vague-5b-full** — la revue adversariale (PR #1012) a montré
qu'en READ_ONLY (PREPROD) le backend bascule **tout** son client sur `anon` (ADR-028
Option D), donc les RPC de rendu de page DEFINER **doivent rester anon-exécutables**
(sinon smoke E2E rouge). Inclut une **anti-régression** qui empêche les 207 erreurs de
réapparaître à chaque rotation de partition.

### Tableau de fermeture

| Sévérité | Règle | Count | Traitement vague 5 |
|---|---|---:|---|
| ERROR | `rls_disabled_in_public` | 207 | **Migration #1** (REVOKE+RLS+policy sur 216 tables) → 0 |
| ERROR | `sensitive_columns_exposed` (`session_id`, CWV raw) | 6 | **Migration #1** (sous-ensemble des 216) → 0 |
| ERROR | `security_definer_view` | 2 | **Migration #2** (→ `security_invoker`) → 0 |
| WARN | `function_search_path_mutable` | 337 | **Migration #4** (`SET search_path = public`, −3 carveout) → 3 |
| WARN | `authenticated_security_definer_function_executable` | 137 | **#5b** 13 prouvés-safe (triggers+cron) ; reste read-path **déféré 5b-full** |
| WARN | `anon_security_definer_function_executable` | 62 | **#5b** (idem) ; reste **déféré 5b-full** |
| WARN | `materialized_view_in_api` | 1 | **Migration #2** (REVOKE anon) → 0 |
| WARN | `extension_in_public` | 3 | **Accepté** (rationale §6) |
| WARN | `vulnerable_postgres_version` | 1 | **Action owner** dashboard (§6) |
| INFO | `rls_enabled_no_policy` | 20 | Intentionnel (deny-all service_role) — closure optionnelle §6 |

---

## 1. Méthodologie

1. Vérité terrain advisor (security) parsée depuis l'output cached, ventilée par règle/sévérité.
2. **Modèle d'accès vérifié** (pas de déduction) :
   - `anon` **et** `authenticated` ont SELECT+INSERT+UPDATE+DELETE sur **411 tables** `public`
     (défaut Supabase `GRANT ALL`). RLS = le seul verrou.
   - **326 tables déjà sous RLS** (321 policies) + **20 en RLS-on/no-policy** → le projet
     migre déjà vers RLS ; les 216 sont la **traîne de dérive** post-2026-04-22.
   - Frontend : **0** client `@supabase/supabase-js`, **0** `.from()` / `.rpc()` direct.
     Seul usage `anon` = `account_.orders.$orderId.invoice.tsx` (PostgREST sur `___xtr_*`
     commandes — **pas** dans le périmètre des 216).
   - Backend DEV/PROD = `service_role` (BYPASSRLS). PREPROD READ_ONLY = `anon`
     (ADR-028 Option D) mais ne lit pas ces tables internes dans le smoke E2E.
   - **Tous** les scripts `/rest/v1/rpc/*` utilisent `SUPABASE_SERVICE_ROLE_KEY`
     (check-payment-tunnel, check-error-logs-5xx, wiki brand-fiche, table-check).
3. Catalogue source de vérité (`pg_class`, `pg_policies`, `pg_proc`, `pg_depend`,
   `information_schema.role_table_grants`) → génération **déterministe** des migrations
   (cross-checkée : le corps RLS hand-assemblé == regénération live, 216==216).

---

## 2. Migration #1 — RLS sur 216 tables internes (drift-tail)

`backend/supabase/migrations/20260616_vague5_enable_rls_drift_tail_internal_tables.sql`

Par table : `REVOKE ALL FROM anon, authenticated` + `ENABLE ROW LEVEL SECURITY` +
policy `<table>_service_role_all` (idempotent via `DO ... IF NOT EXISTS`). **Strictement
le pattern canonique vague 2d.** `service_role` bypasse RLS → backend intact.
Garde `lock_timeout=4s` (catalog-only, pas de réécriture ; fail-closed atomique).

**Familles** : `__seo_*` (logs, GSC/GA4/CWV + partitions, snapshots synthetic/RUM,
quality history), `__soft_404_events`, `audit_vlevel_*`, `catalog_pricing_baseline*`,
`pieces_(display|gamme_display|gamme_link)_history`, `pieces_media_img_*`,
`pieces_price_history*`, `price_import_*`, `pricing_*`, `supplier_*`.

> Ferme **213 erreurs** (207 `rls_disabled` + 6 `sensitive_columns`). Réversible :
> `ALTER TABLE … DISABLE ROW LEVEL SECURITY`.

## 3. Migration #2 — vues DEFINER → INVOKER + matview

`…_vague5_views_invoker_and_matview.sql` — `__seo_content_assets_current_v`,
`v_soft_404_demand_30d` → `security_invoker=true` + REVOKE anon/authd ;
`mv_equipementier_article_counts` → REVOKE anon/authd (matview = pas de RLS possible).
Consommateurs = backend service_role uniquement. **Ferme 2 ERROR + 1 WARN.**

## 4. Migration #3 — anti-régression (root cause)

`…_vague5_harden_partition_maintenance.sql`. 10 fonctions de maintenance créent des
partitions **sans RLS** (`hardens_rls=false`), pilotées par 11 jobs pg_cron (nuit
02:20–03:10 + mensuel) + imports pricing/supplier à la demande → chaque rotation
ré-expose une table. Fix = **1 reconcileur idempotent** (`__rls_reconcile_internal_tables`,
helper `__rls_lock_internal_table`) planifié sur **pg_cron existant** (`15 * * * *`).
Additif-only, allowlist-scopé, non anon-exécutable, `search_path` épinglé, observable
(`RAISE NOTICE` → `cron.job_run_details`). Fenêtre d'exposition d'une nouvelle
partition ≤ ~1h. *(Option 0-fenêtre : appeler le helper inline dans chaque
`maintain_*` — différée pour ne pas toucher la logique de rotation dans ce PR.)*

## 5. Migration #4 (search_path) + #5b (revoke EXECUTE prouvé-safe) ; reste DÉFÉRÉ

- **#4** `…_vague5_pin_function_search_path.sql` — `SET search_path = public` sur **334**
  fonctions/procédures non-extension sans path épinglé (337 − 3 carveout paiement/auth,
  §7). Valeur = convention projet (38/44 déjà en `public`). Sûr : toute fonction marche
  aujourd'hui sous le path par défaut (public) → l'épingler préserve la résolution. Aucun
  changement de comportement ni de privilège. **Ferme 334 WARN.**
- **#5 (REVOKE EXECUTE) — DÉFÉRÉ à vague-5b.** L'hypothèse initiale « aucun appelant
  anon » a été **réfutée par la revue adversariale (PR #1012)** : en READ_ONLY (PREPROD),
  `backend/src/database/services/supabase-base.service.ts` bascule **tout** le client
  backend sur la clé `anon` (ADR-028 Option D), donc **chaque `.rpc()` du backend tourne
  en anon** dans PREPROD. Les ~10 RPC de rendu de page `SECURITY DEFINER`
  (`get_gamme_page_data_cached`, `rm_get_page_complete_v2`, `get_homepage_data_optimized`…)
  ne sont anon-exécutables **que via le grant PUBLIC** — un `REVOKE … FROM PUBLIC` global
  les casserait (cache PREPROD froid → RPC live en anon → `permission denied` → smoke E2E
  rouge à chaque merge).
- **#5b (`…_vague5_revoke_safe_trigger_cron_execute.sql`)** revoke le sous-ensemble
  **prouvé-safe** : **13 fonctions** = 7 triggers (l'EXECUTE est sans effet sur le
  déclenchement, et PostgREST n'expose pas les trigger-functions en RPC) + 6 fonctions
  pg_cron (exécutées par le scheduler, **jamais** en anon, 0 référence backend). **vague-5b-full**
  (les ~186 restantes) doit cartographier le read-path route par route avant tout revoke —
  **non deviné** : ex. `build_vehicle_page_payload` n'a 0 référence backend mais reste un
  builder de page (read-path) → gardé. ~186 WARN restent — assumé (WARN, pas ERROR).

---

## 6. Résidu WARN/INFO

### 6a. `extension_in_public` ×3 (pg_trgm, unaccent, vector) — **ACCEPTÉ** (rationale)

Déplacer ces extensions vers un schéma `extensions` est **rejeté** :
- `vector` : des colonnes typées `vector` existent (ex. `__seo_r2_embeddings`) →
  relocalisation du type = casse de schéma à haut risque (pgvector notoirement pénible).
- `pg_trgm` / `unaccent` : leurs opérateurs sont utilisés **non-qualifiés** par les
  fonctions de recherche (`search_pieces_fts`, `immutable_unaccent`, index trigram).
  La **migration #4 vient d'épingler `search_path = public`** → déplacer ces extensions
  vers `extensions` casserait la résolution des opérateurs. **Conflit direct.**
- Bénéfice sécurité réel = faible (la surface = les fonctions, traitée par #4/#5).

→ **Risque accepté, documenté.** Condition de réévaluation : si un schéma `extensions`
dédié est introduit, il devra être ajouté au `search_path` des fonctions concernées
dans la même migration (changement coordonné, non trivial).

### 6b. `vulnerable_postgres_version` ×1 — **action owner (dashboard)**

`supabase-postgres-17.4.1.042` a des patchs en attente. Upgrade = Supabase Dashboard →
Settings → Infrastructure → Upgrade (fenêtre de maintenance, bref downtime). **Pas une
migration.** À planifier hors heures de pointe.

### 6c. `rls_enabled_no_policy` ×20 (INFO) — intentionnel

Tables write-only / sinks (`__seo_outbox_event`, `__seo_admin_job`, R2 internes,
`_archive.*`). RLS on + 0 policy = deny-all ; `service_role` bypasse → backend OK.
Closure **optionnelle** (silence l'INFO) — ajouter une policy `service_role_all` à
chacune (additif, sûr) si on veut une cohérence parfaite. Non bloquant.

---

## 7. ⚠️ Findings CRITIQUES — actions owner (NON auto-appliquées)

7 fonctions **SECURITY DEFINER anon-exécutables** touchant auth/commerce/**paiement**.
Carve-out délibéré (`.claude/rules/payments.md`) : **ni #4 (search_path) ni #5 (revoke)
ne les touchent** — `auth_email_exists`, `auth_resolve_user`, `mark_order_paid_atomic`
sont explicitement exclues de la migration #4. **Un attaquant avec la clé anon peut
aujourd'hui les invoquer en bypassant RLS** (DEFINER) — potentiellement créer/annuler/
marquer-payées des commandes. À arbitrer en priorité. Bloc owner-autorisé (revoke
EXECUTE **+** pin search_path des 3 exclues de #4) :

```sql
-- OWNER-AUTHORIZED ONLY (commerce/paiement) — appliquer après revue nominative.
-- NB : REVOKE FROM PUBLIC obligatoire (EXECUTE est accordé via PUBLIC par défaut ;
--      revoke anon/authenticated seul est INEFFICACE). + GRANT TO service_role.
REVOKE EXECUTE ON FUNCTION public.create_order_atomic(jsonb, jsonb, uuid)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_order_atomic(text, text, bigint, text)  FROM PUBLIC, anon, authenticated; -- vérifier la signature exacte
REVOKE EXECUTE ON FUNCTION public.mark_order_paid_atomic(text, text)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.append_order_event(text, text, text)           FROM PUBLIC, anon, authenticated; -- vérifier la signature exacte
REVOKE EXECUTE ON FUNCTION public.auth_email_exists(text)                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_resolve_user(text)                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_payment_tunnel_health(integer)           FROM PUBLIC, anon, authenticated; -- script monitoring = service_role, donc safe
-- puis, pour chacune : GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO service_role;
-- + épingler le search_path des 3 fonctions exclues de la migration #4 :
ALTER FUNCTION public.auth_email_exists(text)            SET search_path = public;
ALTER FUNCTION public.auth_resolve_user(text)            SET search_path = public;
ALTER FUNCTION public.mark_order_paid_atomic(text, text) SET search_path = public;
```

> ⚠️ **NB read-path PREPROD** : avant de revoke ces 7 (ou tout DEFINER), vérifier qu'aucune
> n'est invoquée par le backend-en-anon (READ_ONLY/PREPROD) sur une route smokée — sinon
> re-GRANT à anon. `check_payment_tunnel_health` = script monitoring service_role, safe.

> Signatures exactes à confirmer :
> `SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname IN
> ('create_order_atomic','cancel_order_atomic','mark_order_paid_atomic','append_order_event',
> 'auth_email_exists','auth_resolve_user','check_payment_tunnel_health');`

---

## 8. Runbook — apply owner-gated (DB partagée DEV/PREPROD/PROD)

> Les migrations ne sont **pas** auto-appliquées à la DB partagée (cf.
> `.claude/rules/deployment.md` axe 4). Apply manuel réviewé.

**Ordre** : #1 (RLS) → #2 (vues) → #4 (search_path) → #5b (revoke prouvé-safe) → #3
(anti-régression en dernier). #3 dépend de l'état post-#1 (reconcile = 0 après #1).
*(vague-5b-full = read-path mapping, effort séparé.)*

**Pour chaque migration, avant apply** — smoke-test transactionnel (méthode canonique
vagues 1-4) :

```sql
BEGIN;
  \i <migration.sql>      -- ou coller le corps
  -- vérifier 0 erreur, puis les requêtes de vérification en pied de fichier
ROLLBACK;                 -- valide la syntaxe + l'idempotence sans rien changer
```

**Apply** : `mcp__supabase__apply_migration` (trace d'audit) **ou** apply manuel SSH.
**Après chaque apply** : exécuter le bloc « Post-apply verification » du fichier.

**Validation finale** : `get_advisors(security)` →
- ERROR : 215 → **0**
- WARN : 541 → **~190** (#5b 13 prouvés-safe fermés ; ~186 RPC read-path déférés 5b-full + 3 carveout §7 + 3 ext §6a + 1 pg §6b)

**Rollback** : chaque fichier porte son bloc ROLLBACK (DISABLE RLS / RESET search_path /
GRANT EXECUTE / unschedule+DROP). `main` est branch-protected — jamais de force-push.

---

## 9. Coverage manifest (anti-overclaim)

| Item | État |
|---|---|
| 215 ERROR | **Migrations préparées + lintées** (#1+#2, non appliquées) |
| ~350/541 WARN | **Migrations préparées** (#4 search_path 334 + #2 matview 1 + #5b 13 prouvés-safe) |
| ~190 WARN restants | ~186 RPC read-path **déférés vague-5b-full** (mapping read-path PREPROD) · 3 carveout (§7) · 3 ext (§6a) · 1 pg (§6b) |
| Revue adversariale (passe 1) | 1 BLOQUANT (#5 → déféré) + 1 HAUTE (#4 carveout → exclu) **corrigés** |
| Re-revue adversariale (passe 2) | **APPROVE** (0 BLOQUANT/HAUTE) ; 2 SUGGESTION corrigées : #5b self-assert `prorettype=trigger` (fail-closed) + #3 reconcileur escalade no-silent-fallback (échec systémique → cron job rouge) |
| 20 INFO | Intentionnel (closure optionnelle §6c) |
| Anti-régression rotation | Migration #3 (pg_cron reconcileur) |
| Smoke-test live (BEGIN/ROLLBACK) | **NON exécuté** (psql refusé par garde ; à faire à l'apply) |
| Apply à la DB | **NON fait** (owner-gated, DB partagée) |
| Findings paiement/commerce | **Signalés, non touchés** (payments.md) |

**Non vérifié / hors périmètre** : comportement runtime exact de chaque RPC sous service_role
(supposé inchangé car privilèges service_role intacts) ; parité PREPROD↔PROD à l'apply.
