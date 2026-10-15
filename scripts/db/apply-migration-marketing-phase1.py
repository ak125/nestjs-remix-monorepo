#!/usr/bin/env python3
"""
ADR-036 Phase 1 — Apply migration `20260430_marketing_layer_phase1.sql`.

Pourquoi Python et pas MCP :
  - Règle utilisateur : utiliser Python au lieu de MCP pour les migrations DB
  - psycopg2 direct (port 5432) = pas de statement_timeout pooler 60s
  - Contrôle fin du flow (BEGIN/COMMIT, error handling, tests post-apply)

Mode :
  --dry-run    : lit le SQL, vérifie connexion, imprime le plan, ne modifie rien
  --apply      : applique la migration en transaction unique (BEGIN/COMMIT du SQL)
  --verify     : vérifie post-apply (tables existent, indexes présents, seed inséré)
  --test-negative : lance les 5 tests négatifs (CHECK constraints) — doivent FAIL
  --prepare-brief-social FILE : écrit un prérequis ciblé, hors ligne, sans appliquer
  --prepare-brief-social-migration FILE : même contrat, transaction gérée par le runner

Attention : --apply rejoue TOUT Phase1, dont quatre règles de relance actives.
IF NOT EXISTS ne vérifie pas la conformité d'un objet déjà présent. Ce runner
historique ne réconcilie pas les deux registres et --test-negative écrit des
fixtures : ne pas les utiliser comme contrôle en lecture seule du schéma partagé.
Préparation ciblée : voir backend/supabase/migrations/README.md, section Phase1.

Usage :
  python3 scripts/db/apply-migration-marketing-phase1.py --dry-run
  python3 scripts/db/apply-migration-marketing-phase1.py --apply
  python3 scripts/db/apply-migration-marketing-phase1.py --verify
  python3 scripts/db/apply-migration-marketing-phase1.py --test-negative
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = REPO_ROOT / "backend" / ".env"
PROJECT_REF = "cxpojprgwgubzjyqzmoq"

MIGRATION_PATH = (
    REPO_ROOT
    / "backend"
    / "supabase"
    / "migrations"
    / "20260430_marketing_layer_phase1.sql"
)


def connect():
    # Keep offline preparation/help independent from secrets and DB dependencies.
    import psycopg2
    from dotenv import load_dotenv

    load_dotenv(ENV_PATH)
    password = os.environ.get("SUPABASE_DB_PASSWORD")
    if not password:
        raise RuntimeError("SUPABASE_DB_PASSWORD missing in env")
    print(f"[connect] {PROJECT_REF}.supabase.co:5432 (direct, non-pooler)")
    conn = psycopg2.connect(
        host=f"db.{PROJECT_REF}.supabase.co", port=5432, dbname="postgres",
        user="postgres", password=password, sslmode="require",
        application_name="adr036-phase1-migration", connect_timeout=10,
    )
    return conn


def brief_social_sql(source: str) -> str:
    """Prepare only the reviewed missing-brief case; never mark Phase 1 applied.

    Hash UTF-8 text after universal-newline normalization so Git CRLF checkout
    does not change the approved source. A source change requires fresh review.
    """
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
    if digest != "b498fd24ab534abfffe0c55011c1af14a1a675fda627a06db7a39a47b04a7e8b":
        raise ValueError("Canonical Phase 1 source changed; review before preparing")
    brief = source[source.index("CREATE TABLE IF NOT EXISTS public.__marketing_brief"):
                   source.index("-- ── 2.")]
    return f"""-- REVIEW ARTIFACT ONLY: missing brief + Social Hub ACL prerequisite.
-- Source: 20260430_marketing_layer_phase1.sql (brief section only).
-- Source SHA256 (UTF-8/LF): {digest}
-- No migration ledger write: this is NOT the complete historical migration.
-- Execute only with an approved target and a client that stops on error.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
BEGIN
  IF NOT pg_try_advisory_xact_lock(88442211) THEN
    RAISE EXCEPTION 'Migration runner lock busy';
  END IF;
  IF to_regclass('public.__marketing_brief') IS NOT NULL
     OR to_regprocedure('public.fn_marketing_brief_updated_at()') IS NOT NULL THEN
    RAISE EXCEPTION 'Brief already exists or partial schema: inspect, do not replay';
  END IF;
  IF to_regclass('public.__marketing_social_posts') IS NULL THEN
    RAISE EXCEPTION 'Social posts prerequisite missing';
  END IF;
END;
$preflight$;
LOCK TABLE public.__marketing_social_posts IN ACCESS EXCLUSIVE MODE;
DO $social_contract$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.__marketing_social_posts'::regclass)
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
         AND tablename='__marketing_social_posts') <> 1
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
         AND tablename='__marketing_social_posts' AND policyname='service_role_all'
         AND roles=ARRAY['service_role']::name[] AND cmd='ALL'
         AND permissive='PERMISSIVE' AND qual='true' AND with_check='true') THEN
    RAISE EXCEPTION 'Social RLS contract changed; inspect consumers';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['SELECT','INSERT','UPDATE']) AS p
      WHERE NOT has_table_privilege('service_role','public.__marketing_social_posts',p)) THEN
    RAISE EXCEPTION 'Social service_role privileges missing';
  END IF;
END;
$social_contract$;
{brief}
-- Only the two reviewed roles on the existing social table. Do not revoke
-- inherited/PUBLIC grants broadly: the postcondition rejects them atomically.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.__marketing_social_posts FROM anon, authenticated;
REVOKE ALL ON public.__marketing_brief FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.__marketing_brief TO service_role;
DO $postcondition$
DECLARE r text; t text; p text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH t IN ARRAY ARRAY['__marketing_social_posts','__marketing_brief'] LOOP
      FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(r, 'public.' || t, p) THEN
          RAISE EXCEPTION 'Residual public write privilege: %.% %', r, t, p;
        END IF;
      END LOOP;
      IF has_any_column_privilege(r, 'public.' || t, 'INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'Residual public column write privilege: %.%', r, t;
      END IF;
    END LOOP;
  END LOOP;
END;
$postcondition$;
COMMIT;
"""


def brief_social_migration_sql(source: str) -> str:
    """Registered form of the same contract; SQL and ledger commit together.

    Keep the historical preparation entry point for existing isolated consumers.
    The new file must be named by `supabase migration new`, never applied by this
    generator. Its baseline guard restricts it to the observed reconciliation.
    """
    prepared = brief_social_sql(source)
    _, separator, body = prepared.partition("BEGIN;\n")
    if not separator or not body.endswith("COMMIT;\n"):
        raise ValueError("Prepared transaction boundaries changed; review generator")
    body = body.removesuffix("COMMIT;\n")
    baseline = """DO $historical_baseline$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM infra.schema_migrations
    WHERE id = '20260430_marketing_layer_phase1'
      AND status = 'applied'
      AND checksum = 'b498fd24ab534abfffe0c55011c1af14a1a675fda627a06db7a39a47b04a7e8b'
      AND runner = 'baseline-2026-05-16' AND execution_ms = 0
  ) THEN
    RAISE EXCEPTION 'Phase1 baseline differs from reviewed reconciliation; inspect before applying';
  END IF;
END;
$historical_baseline$;
"""
    body = body.replace('DO $preflight$\n', baseline + 'DO $preflight$\n', 1)
    return """-- Generated by apply-migration-marketing-phase1.py --prepare-brief-social-migration.
-- Corrective migration: missing brief + existing Social Hub ACL prerequisite only.
-- Source: 20260430_marketing_layer_phase1.sql; SHA256 UTF-8/LF:
-- b498fd24ab534abfffe0c55011c1af14a1a675fda627a06db7a39a47b04a7e8b
-- Preserve the historical Phase1 baseline; this does NOT complete all its blocks.
-- Runner owns transaction and checksum ledger write. No inline BEGIN/COMMIT.
-- Select this correction ALONE before the three older pending Social Hub files.
-- No customer changes, retention seeds, provider calls or publication activation.
-- Squawk 2.52.1 reports prefer-bigint-over-int on six manual per-brief counters.
-- Preserve the exact hash-pinned Phase1 types; widening needs consumer review.
-- The generated-file identity test prevents unreviewed additions to this contract.
-- squawk-ignore-file prefer-bigint-over-int
""" + body


def cmd_prepare_brief_social(path: Path, *, registered_migration: bool = False) -> int:
    try:
        source = MIGRATION_PATH.read_text(encoding="utf-8")
        sql = brief_social_migration_sql(source) if registered_migration else brief_social_sql(source)
        with path.open("x", encoding="utf-8", newline="\n") as output:
            output.write(sql)
    except FileExistsError:
        sys.stderr.write("[FATAL] output already exists; preserve the reviewed artifact\n")
        return 1
    except (OSError, ValueError) as error:
        sys.stderr.write(f"[FATAL] {error}\n")
        return 1
    print(f"[prepared] {path} (offline; not applied; no ledger updated)")
    return 0


def cmd_dry_run() -> int:
    print(f"[dry-run] reading {MIGRATION_PATH.relative_to(REPO_ROOT)}")
    if not MIGRATION_PATH.exists():
        sys.stderr.write(f"[FATAL] migration file missing: {MIGRATION_PATH}\n")
        return 1
    sql = MIGRATION_PATH.read_text(encoding="utf-8")
    line_count = sql.count("\n")
    create_count = sql.upper().count("CREATE TABLE IF NOT EXISTS")
    alter_count = sql.upper().count("ALTER TABLE")
    index_count = sql.upper().count("CREATE INDEX IF NOT EXISTS")
    insert_count = sql.upper().count("INSERT INTO")
    print(f"[dry-run] file size: {len(sql)} bytes, {line_count} lines")
    print(f"[dry-run] CREATE TABLE IF NOT EXISTS: {create_count}")
    print(f"[dry-run] ALTER TABLE: {alter_count}")
    print(f"[dry-run] CREATE INDEX IF NOT EXISTS: {index_count}")
    print(f"[dry-run] INSERT INTO: {insert_count}")
    print()
    conn = connect()
    cur = conn.cursor()
    cur.execute("SELECT current_database(), current_user, version()")
    row = cur.fetchone()
    print(f"[dry-run] db={row[0]} user={row[1]}")
    print(f"[dry-run] postgres={row[2].split(',')[0]}")
    cur.close()
    conn.close()
    print("[dry-run] OK — connexion possible, fichier valide. Pas de modification appliquée.")
    return 0


def cmd_apply() -> int:
    """Apply the migration in a single explicit transaction.

    La migration n'a pas de BEGIN/COMMIT inline (depuis 2026-04-30, cf header SQL) :
    le caller ouvre une transaction unique, exécute le bloc multi-statements, et
    commit ou rollback. psycopg2 démarre une transaction implicite à la première
    requête (autocommit=False par défaut) ; cur.execute(sql) accepte un script
    multi-statements et tout fail intermédiaire fait remonter l'exception, qui
    déclenche le rollback dans le except.
    """
    print(f"[apply] reading {MIGRATION_PATH.relative_to(REPO_ROOT)}")
    sql = MIGRATION_PATH.read_text(encoding="utf-8")

    conn = connect()
    assert conn.autocommit is False, "expected explicit transaction (autocommit=False)"
    cur = conn.cursor()
    try:
        print("[apply] executing migration in single transaction...")
        cur.execute(sql)
        conn.commit()
        print("[apply] OK — migration applied + committed")
        return 0
    except Exception as e:
        conn.rollback()
        sys.stderr.write(f"[FATAL] migration failed (rolled back): {e}\n")
        return 1
    finally:
        cur.close()
        conn.close()


def cmd_verify() -> int:
    """Verify post-apply : tables exist, indexes present, seed inserted, RLS enabled."""
    conn = connect()
    cur = conn.cursor()
    failures = []

    # 1. Tables existent
    for tbl in ("__marketing_brief", "__retention_trigger_rules"):
        cur.execute(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=%s)",
            (tbl,),
        )
        if cur.fetchone()[0]:
            print(f"  ✓ table {tbl} exists")
        else:
            failures.append(f"table {tbl} MISSING")

    # 2. Colonne ___xtr_customer.cst_marketing_consent_at
    cur.execute(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='___xtr_customer' "
        "AND column_name='cst_marketing_consent_at')"
    )
    if cur.fetchone()[0]:
        print("  ✓ column ___xtr_customer.cst_marketing_consent_at exists")
    else:
        failures.append("column ___xtr_customer.cst_marketing_consent_at MISSING")

    # 3. Indexes
    expected_indexes = [
        "idx_marketing_brief_status_created",
        "idx_marketing_brief_business_unit_status",
        "idx_marketing_brief_agent_created",
        "idx_retention_rules_active_category",
        "idx_xtr_customer_marketing_consent",
    ]
    for idx in expected_indexes:
        cur.execute(
            "SELECT EXISTS (SELECT 1 FROM pg_indexes "
            "WHERE schemaname='public' AND indexname=%s)",
            (idx,),
        )
        if cur.fetchone()[0]:
            print(f"  ✓ index {idx} exists")
        else:
            failures.append(f"index {idx} MISSING")

    # 4. Seed retention rules (4 rows)
    cur.execute("SELECT COUNT(*) FROM public.__retention_trigger_rules WHERE active = true")
    count = cur.fetchone()[0]
    if count >= 4:
        print(f"  ✓ retention rules seed: {count} rows active (>= 4 expected)")
    else:
        failures.append(f"retention rules seed insufficient: {count}/4")

    # 5. RLS enabled
    for tbl in ("__marketing_brief", "__retention_trigger_rules"):
        cur.execute(
            "SELECT relrowsecurity FROM pg_class "
            "WHERE relname=%s AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')",
            (tbl,),
        )
        row = cur.fetchone()
        if row and row[0]:
            print(f"  ✓ RLS enabled on {tbl}")
        else:
            failures.append(f"RLS NOT enabled on {tbl}")

    cur.close()
    conn.close()

    if failures:
        print(f"\n[verify] {len(failures)} failure(s):")
        for f in failures:
            print(f"  ✗ {f}")
        return 1
    print("\n[verify] OK — all checks passed")
    return 0


def cmd_test_negative() -> int:
    """Run the 7 negative + 2 positive constraint tests.

    Each negative test is isolated : its payload satisfies every check OTHER
    than the one being asserted, so the failure can only come from the
    targeted CHECK. This makes regression-tracing trivial when a constraint
    is later loosened or tightened.
    """
    from psycopg2 import errors as pg_errors

    # HYBRID payload missing only ONE key at a time — explicit isolation per test.
    HYBRID_BASE = {
        "hybrid_reason": "client zone 93 panier abandonné",
        "target_zone": "93",
        "cta_ecommerce": "Reprenez en ligne",
        "cta_local": "Ou venez chercher en magasin",
        "conversion_goal_ecommerce": "ORDER",
        "conversion_goal_local": "VISIT",
    }

    def hybrid_payload_missing(key: str) -> str:
        import json
        clone = {k: v for k, v in HYBRID_BASE.items() if k != key}
        return json.dumps(clone).replace("'", "''")

    tests = [
        (
            "business_unit invalide",
            "INSERT INTO public.__marketing_brief "
            "(agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest) "
            "VALUES ('test_neg', 'INVALID', 'gbp', 'CALL', 'x', 'y', '{}'::jsonb, '{}'::jsonb)",
        ),
        (
            "channel social_youtube (hors canon Phase 1)",
            "INSERT INTO public.__marketing_brief "
            "(agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest) "
            "VALUES ('test_neg', 'ECOMMERCE', 'social_youtube', 'ORDER', 'x', 'y', '{}'::jsonb, '{}'::jsonb)",
        ),
        (
            "LOCAL + website_seo (incohérent)",
            "INSERT INTO public.__marketing_brief "
            "(agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest) "
            "VALUES ('test_neg', 'LOCAL', 'website_seo', 'CALL', 'x', 'y', '{}'::jsonb, '{}'::jsonb)",
        ),
        (
            "ECOMMERCE + gbp (incohérent)",
            "INSERT INTO public.__marketing_brief "
            "(agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest) "
            "VALUES ('test_neg', 'ECOMMERCE', 'gbp', 'CALL', 'x', 'y', '{}'::jsonb, '{}'::jsonb)",
        ),
        (
            "HYBRID sans hybrid_reason (autres clés présentes)",
            "INSERT INTO public.__marketing_brief "
            "(agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest) "
            f"VALUES ('test_neg', 'HYBRID', 'email', 'CALL', 'x', 'y', '{hybrid_payload_missing('hybrid_reason')}'::jsonb, '{{}}'::jsonb)",
        ),
        (
            "HYBRID sans target_zone (autres clés présentes)",
            "INSERT INTO public.__marketing_brief "
            "(agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest) "
            f"VALUES ('test_neg', 'HYBRID', 'email', 'CALL', 'x', 'y', '{hybrid_payload_missing('target_zone')}'::jsonb, '{{}}'::jsonb)",
        ),
        (
            "retention min >= max",
            "INSERT INTO public.__retention_trigger_rules "
            "(category, min_days_since_last_order, max_days_since_last_order, trigger_template) "
            "VALUES ('test_negative', 100, 50, 'test_template')",
        ),
    ]

    # Positive tests — each MUST succeed and is then cleaned up.
    import json as _json
    hybrid_full_payload = _json.dumps(HYBRID_BASE).replace("'", "''")
    positives = [
        (
            "LOCAL + gbp valide",
            "INSERT INTO public.__marketing_brief "
            "(agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest) "
            "VALUES ('test_positive', 'LOCAL', 'gbp', 'CALL', 'Appelez le 01-XX', 'commune-bondy', "
            "'{\"text\":\"Test post GBP Bondy\"}'::jsonb, "
            "'{\"final_status\":\"PARTIAL_COVERAGE\",\"scope_requested\":\"test\"}'::jsonb)",
        ),
        (
            "HYBRID + email + payload complet (6 clés)",
            "INSERT INTO public.__marketing_brief "
            "(agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest) "
            f"VALUES ('test_positive', 'HYBRID', 'email', 'CALL', 'split-cta', 'zone-93', "
            f"'{hybrid_full_payload}'::jsonb, "
            "'{\"final_status\":\"PARTIAL_COVERAGE\"}'::jsonb)",
        ),
    ]

    conn = connect()
    failures = []
    passed = 0

    # Negative tests
    for label, sql in tests:
        cur = conn.cursor()
        try:
            cur.execute(sql)
            conn.rollback()
            failures.append(f"{label}: INSERT should have failed but succeeded")
            print(f"  ✗ {label}: INSERT should have failed but succeeded")
        except (pg_errors.CheckViolation, pg_errors.IntegrityError) as e:
            conn.rollback()
            print(f"  ✓ {label}: rejected ({type(e).__name__})")
            passed += 1
        except Exception as e:
            conn.rollback()
            failures.append(f"{label}: unexpected error {type(e).__name__}: {e}")
            print(f"  ⚠ {label}: unexpected error {type(e).__name__}: {e}")
        finally:
            cur.close()

    # Positive tests — cleanup after each so the table stays empty for next run.
    for label, sql in positives:
        cur = conn.cursor()
        try:
            cur.execute(sql)
            conn.commit()
            cur.execute("DELETE FROM public.__marketing_brief WHERE agent_id = 'test_positive'")
            conn.commit()
            print(f"  ✓ {label}: accepté + nettoyé")
            passed += 1
        except Exception as e:
            conn.rollback()
            failures.append(f"{label}: failed unexpectedly: {e}")
            print(f"  ✗ {label}: {e}")
        finally:
            cur.close()

    conn.close()

    total = len(tests) + len(positives)
    print(
        f"\n[test-negative] {passed}/{total} tests passed "
        f"({len(failures)} failure(s))"
    )
    return 0 if not failures else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true")
    g.add_argument("--apply", action="store_true")
    g.add_argument("--verify", action="store_true")
    g.add_argument("--test-negative", action="store_true")
    g.add_argument("--prepare-brief-social", type=Path, metavar="FILE")
    g.add_argument("--prepare-brief-social-migration", type=Path, metavar="FILE")
    args = ap.parse_args()

    if args.prepare_brief_social:
        return cmd_prepare_brief_social(args.prepare_brief_social)
    if args.prepare_brief_social_migration:
        return cmd_prepare_brief_social(args.prepare_brief_social_migration, registered_migration=True)
    if args.dry_run:
        return cmd_dry_run()
    if args.apply:
        return cmd_apply()
    if args.verify:
        return cmd_verify()
    if args.test_negative:
        return cmd_test_negative()
    return 2


if __name__ == "__main__":
    sys.exit(main())
