"""Real PG17 counter-proofs. Runs only in its own network-isolated Docker fixture.

No shared database URL is accepted. The native projection migration is applied;
the legacy outbox fixture reproduces the 13 columns inventoried read-only on
2026-09-12 (its original CREATE TABLE is absent from this checkout).
Run: python3 scripts/seo-projection/test_block_outbox_transaction.py
"""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import time
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "backend/supabase/migrations"
CANDIDATE = MIGRATIONS / "20260912212340_seo_projection_block_outbox.sql"
REFRESH_ACK = MIGRATIONS / "20260912231807_seo_projection_refresh_ack.sql"
NATIVE = MIGRATIONS / "20260619_adr059_pr6_seo_projection_schema.sql"

LEGACY_FIXTURE = """
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.__rag_change_events (
 rce_id serial PRIMARY KEY, rce_created_at timestamptz NOT NULL DEFAULT now(),
 rce_processed_at timestamptz, rce_rag_source text NOT NULL,
 rce_gamme_aliases text[] NOT NULL DEFAULT '{}', rce_old_hash text,
 rce_new_hash text NOT NULL, rce_diff_sections text[] NOT NULL DEFAULT '{}',
 rce_impacted_roles text[] NOT NULL DEFAULT '{}',
 rce_merge_mode text NOT NULL DEFAULT 'append_only',
 rce_jobs_enqueued integer NOT NULL DEFAULT 0,
 rce_status text NOT NULL DEFAULT 'pending', rce_error text
);
ALTER TABLE public.__rag_change_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON public.__rag_change_events
 FOR ALL TO service_role USING (true) WITH CHECK (true);
INSERT INTO public.__rag_change_events (rce_rag_source,rce_new_hash,rce_status)
 VALUES ('legacy-fixture', 'legacy-hash', 'done');
"""


def literal(value):
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dict):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    return "'" + value.replace("'", "''") + "'"


class BlockOutboxTransactionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.container = 'codex-block-outbox-test-' + uuid.uuid4().hex[:12]
        subprocess.run([
            'docker', 'run', '--detach', '--name', cls.container, '--network', 'none',
            '--memory', '384m', '--cpus', '1', '--tmpfs', '/var/lib/postgresql/data',
            '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine'
        ], check=True, capture_output=True, text=True)
        cls.addClassCleanup(subprocess.run, ['docker', 'rm', '-f', cls.container],
                            check=True, capture_output=True)
        for _ in range(100):
            result = subprocess.run(['docker', 'exec', cls.container, 'pg_isready', '-U', 'postgres'],
                                    capture_output=True)
            if result.returncode == 0 and subprocess.run(
                ['docker', 'exec', cls.container, 'cat', '/proc/1/comm'],
                capture_output=True, text=True, check=True
            ).stdout.strip() == 'postgres':
                break
            time.sleep(.1)
        else:
            raise RuntimeError('Ephemeral PostgreSQL did not become ready')
        cls.sql(LEGACY_FIXTURE)
        cls.sql(NATIVE.read_text())
        cls.sql(CANDIDATE.read_text())
        cls.sql(CANDIDATE.read_text())
        cls.sql(REFRESH_ACK.read_text())
        cls.sql(REFRESH_ACK.read_text())
        # Reproduce service_role table/sequence access without bypassing RLS.
        cls.sql('GRANT USAGE ON SCHEMA public TO service_role; '
                'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; '
                'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;')
        print('EPHEMERAL_DATABASE=' + cls.sql('SELECT version()').stdout.strip(), flush=True)
        print('CONTAINER=' + cls.container + ' network=none tmpfs=true ports=none', flush=True)

    @classmethod
    def sql(cls, query, *, check=True, app='outbox-test'):
        result = subprocess.run([
            'docker', 'exec', '-i', '-e', 'PGAPPNAME=' + app, cls.container,
            'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'
        ], input=query, text=True, capture_output=True, timeout=25)
        if check and result.returncode:
            raise AssertionError(result.stderr)
        return result

    def setUp(self):
        self.block = 'fixture:' + uuid.uuid4().hex
        self.entity = self.block + ':entity'
        self.old = str(uuid.uuid4())
        self.run = str(uuid.uuid4())
        self.next_run = str(uuid.uuid4())
        self.sql(f"""
        INSERT INTO public.__seo_projection_runs
          (run_id,trigger_kind,exports_snapshot_hash,exports_snapshot_uri)
          VALUES ('{self.run}','manual','fixture-snapshot','fixture://snapshot'),
                 ('{self.next_run}','manual','fixture-next','fixture://next');
        INSERT INTO public.__seo_entity_facts (entity_id,entity_type,slug)
          VALUES ('{self.entity}','vehicle','fixture');
        INSERT INTO public.__seo_content_blocks (block_id,entity_id,role,block_kind)
          VALUES ('{self.block}','{self.entity}','R8_VEHICLE','known_issues');
        INSERT INTO public.__seo_content_block_versions
          (version_id,block_id,status,source_type,confidence_base,content_hash,content)
          VALUES ('{self.old}','{self.block}','active','wiki',0.8,'H1','{{"text":"original"}}');
        UPDATE public.__seo_content_blocks SET active_version_id='{self.old}' WHERE block_id='{self.block}';
        """)

    def command(self, **changes):
        args = dict(block=self.block, entity=self.entity, role='R8_VEHICLE', run=self.run,
                    version=self.old, event=None, operation='replace', source='wiki:fixture/source',
                    hash='H2', content={'text': 'replacement'}, confidence=.9, source_type='sourced')
        args.update(changes)
        return ('SET ROLE service_role; SELECT row_to_json(t) FROM '
                'public.transition_seo_projection_block(' +
                ','.join(literal(v) for v in args.values()) + ') t;')

    def transition(self, **changes):
        return json.loads(self.sql(self.command(**changes)).stdout)

    def state(self):
        # Sequence gaps on rollback are normal PostgreSQL behavior; only durable rows are compared.
        return self.sql("SELECT jsonb_build_object(" + ','.join(
            f"'{table}',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM public.{table} t)"
            for table in ['__seo_content_blocks', '__seo_content_block_versions', '__rag_change_events']
        ) + ')').stdout

    def reject(self, error, **changes):
        before = self.state()
        result = self.sql(self.command(**changes), check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(error, result.stderr)
        self.assertEqual(before, self.state(), 'Rejected transition changed durable rows')

    def test_replace_is_atomic_and_retains_history(self):
        event = self.transition()
        self.assertFalse(event['replayed'])
        self.assertNotEqual(event['active_version_id'], self.old)
        state = json.loads(self.state())
        versions = [v for v in state['__seo_content_block_versions'] if v['block_id'] == self.block]
        self.assertEqual(len(versions), 2)
        self.assertEqual(next(v for v in versions if v['version_id'] == self.old)['content'], {'text': 'original'})
        self.assertEqual(next(v for v in versions if v['version_id'] == self.old)['status'], 'deprecated')
        row = next(e for e in state['__rag_change_events'] if e['rce_id'] == event['event_id'])
        self.assertEqual((row['rce_old_hash'], row['rce_new_hash'], row['rce_status']), ('H1', 'H2', 'pending'))
        self.assertEqual(row['rce_impacted_roles'], ['R8_VEHICLE'])
        self.assertEqual(row['rce_diff_sections'], ['known_issues'])
        self.assertEqual(row['rce_new_version_id'], event['active_version_id'])
        self.assertEqual(row['rce_run_id'], self.run)
        self.assertEqual(next(v for v in versions if v['version_id'] == event['active_version_id'])['source_type'], 'sourced')
        self.assertIsNone(row['rce_processed_at'])
        self.assertEqual(row['rce_jobs_enqueued'], 0)

    def test_withdrawal_clears_only_pointer_and_keeps_content(self):
        result = self.transition(operation='withdraw', hash=None, content=None, confidence=None, source_type=None)
        self.assertIsNone(result['active_version_id'])
        state = json.loads(self.state())
        versions = [v for v in state['__seo_content_block_versions'] if v['block_id'] == self.block]
        self.assertEqual(len(versions), 1)
        self.assertEqual(versions[0]['content'], {'text': 'original'})
        self.assertEqual(versions[0]['status'], 'deprecated')
        row = next(e for e in state['__rag_change_events'] if e['rce_id'] == result['event_id'])
        self.assertEqual(row['rce_operation'], 'withdraw')
        self.assertIsNone(row['rce_new_hash'])
        self.assertEqual(row['rce_old_version_id'], self.old)

    def test_exact_replay_has_no_effect(self):
        first = self.transition()
        before = self.state()
        second = self.transition()
        self.assertTrue(second['replayed'])
        self.assertEqual(first['event_id'], second['event_id'])
        self.assertEqual(before, self.state())

    def test_modified_replay_is_rejected(self):
        self.transition()
        self.reject('BLOCK_TRANSITION_REPLAY_MISMATCH', content={'text': 'tampered'})

    def test_replay_after_withdrawal_never_resurrects(self):
        first = self.transition()
        self.transition(run=self.next_run, version=first['active_version_id'], event=first['event_id'],
                        operation='withdraw', hash=None, content=None, confidence=None, source_type=None)
        before = self.state()
        replay = self.transition()
        self.assertTrue(replay['replayed'])
        self.assertIsNone(replay['active_version_id'])
        self.assertEqual(before, self.state())

    def test_stale_version_and_stale_predecessor_rejected(self):
        first = self.transition()
        self.reject('STALE_BLOCK_TRANSITION', run=self.next_run)
        self.reject('STALE_BLOCK_TRANSITION', run=self.next_run, version=first['active_version_id'], hash='H3')
        second = self.transition(run=self.next_run, version=first['active_version_id'], event=first['event_id'], hash='H3')
        self.assertNotEqual(first['active_version_id'], second['active_version_id'])

    def test_missing_snapshot_cannot_mutate(self):
        self.sql(f"UPDATE public.__seo_projection_runs SET exports_snapshot_uri=NULL WHERE run_id='{self.run}'")
        self.reject('MISSING_RUN_SNAPSHOT')

    def test_failed_run_cannot_mutate(self):
        self.sql(f"UPDATE public.__seo_projection_runs SET status='failed' WHERE run_id='{self.run}'")
        self.reject('MISSING_RUN_SNAPSHOT')

    def test_scope_and_unknown_identity_are_rejected(self):
        self.reject('BLOCK_SCOPE_MISMATCH', role='R3_CONSEILS')
        self.reject('BLOCK_SCOPE_MISMATCH', entity=self.entity + '-other')
        self.reject('UNKNOWN_BLOCK', block=self.block + '-missing')

    def test_null_invalid_and_withdrawal_payloads_are_rejected(self):
        self.reject('INVALID_BLOCK_TRANSITION', operation=None)
        self.reject('INVALID_BLOCK_TRANSITION', version=None)
        self.reject('INVALID_BLOCK_TRANSITION', operation='delete')
        self.reject('INVALID_REPLACEMENT_CONTENT', content=None)
        self.reject('INVALID_REPLACEMENT_CONTENT', confidence=2)
        self.reject('WITHDRAWAL_MUST_NOT_SUPPLY_NEW_CONTENT', operation='withdraw')

    def test_regression_and_unchanged_hash_do_not_promote(self):
        self.reject('BLOCK_TRANSITION_WOULD_REGRESS', confidence=.7)
        self.reject('UNCHANGED_BLOCK_CONTENT', hash='H1')

    def test_outbox_failure_rolls_back_version_and_pointer(self):
        self.sql(f"""CREATE FUNCTION public.fixture_outbox_failure() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN IF NEW.rce_block_id = '{self.block}' THEN RAISE EXCEPTION 'SIMULATED_OUTBOX_FAILURE'; END IF;
          RETURN NEW; END $$;
          CREATE TRIGGER fixture_outbox_failure BEFORE INSERT ON public.__rag_change_events
          FOR EACH ROW EXECUTE FUNCTION public.fixture_outbox_failure();""")
        try:
            self.reject('SIMULATED_OUTBOX_FAILURE')
        finally:
            self.sql('DROP TRIGGER fixture_outbox_failure ON public.__rag_change_events; DROP FUNCTION public.fixture_outbox_failure();')

    def test_competing_transactions_wait_and_only_one_wins(self):
        self.sql(f"""CREATE FUNCTION public.fixture_outbox_delay() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN IF NEW.rce_block_id = '{self.block}' THEN PERFORM pg_sleep(3); END IF;
          RETURN NEW; END $$;
          CREATE TRIGGER fixture_outbox_delay BEFORE INSERT ON public.__rag_change_events
          FOR EACH ROW EXECUTE FUNCTION public.fixture_outbox_delay();""")
        def await_wait(app, wait):
            for _ in range(100):
                if self.sql(f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{app}' AND {wait}").stdout.strip() == '1':
                    return
                time.sleep(.02)
            self.fail('Expected real concurrent wait was not observed: ' + app)
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                first = pool.submit(self.sql, self.command(), check=False, app='transition-first')
                await_wait('transition-first', "wait_event='PgSleep'")
                second = pool.submit(self.sql, self.command(run=self.next_run, hash='H3'), check=False, app='transition-second')
                await_wait('transition-second', "wait_event_type='Lock'")
                self.assertEqual(first.result().returncode, 0)
                result = second.result()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('STALE_BLOCK_TRANSITION', result.stderr)
            count = self.sql(f"SELECT count(*) FROM public.__rag_change_events WHERE rce_block_id='{self.block}'").stdout.strip()
            self.assertEqual(count, '1')
        finally:
            self.sql('DROP TRIGGER fixture_outbox_delay ON public.__rag_change_events; DROP FUNCTION public.fixture_outbox_delay();')

    def test_legacy_null_hash_still_rejected(self):
        before = self.state()
        result = self.sql("INSERT INTO public.__rag_change_events(rce_rag_source,rce_new_hash) VALUES ('legacy-null',NULL)", check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('rag_change_events_block_transition_check', result.stderr)
        self.assertEqual(before, self.state())

    def test_event_references_prevent_loss_of_audit_history(self):
        self.transition()
        before = self.state()
        for query in (
            f"DELETE FROM public.__seo_projection_runs WHERE run_id='{self.run}'",
            f"DELETE FROM public.__seo_content_block_versions WHERE version_id='{self.old}'",
            f"DELETE FROM public.__seo_content_blocks WHERE block_id='{self.block}'",
        ):
            result = self.sql(query, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('foreign key constraint', result.stderr)
            self.assertEqual(before, self.state())

    def test_new_request_after_withdrawal_cannot_reactivate_old_version(self):
        first = self.transition(operation='withdraw', hash=None, content=None, confidence=None, source_type=None)
        self.reject('STALE_BLOCK_TRANSITION', run=self.next_run, event=first['event_id'])

    def test_privileges_are_service_role_only(self):
        signature = 'public.transition_seo_projection_block(text,text,text,uuid,uuid,bigint,text,text,text,jsonb,double precision,text)'
        for role, expected in [('anon', 'f'), ('authenticated', 'f'), ('service_role', 't')]:
            actual = self.sql(f"SELECT has_function_privilege('{role}','{signature}','EXECUTE')").stdout.strip()
            self.assertEqual(actual, expected)
        actual = self.sql("SELECT prosecdef FROM pg_proc WHERE oid='" + signature + "'::regprocedure").stdout.strip()
        self.assertEqual(actual, 'f')

    def test_migration_reapply_preserves_populated_history(self):
        self.transition()
        before = self.state()
        self.sql(CANDIDATE.read_text())
        self.assertEqual(before, self.state())
        indexes = self.sql("SELECT bool_and(indisvalid) FROM pg_index WHERE indexrelid IN ('public.idx_rce_block_run_transition'::regclass,'public.idx_rce_block_transition_head'::regclass)").stdout.strip()
        self.assertEqual(indexes, 't')


    def refresh(self):
        return [json.loads(row) for row in self.sql(
            'SET ROLE service_role; SELECT row_to_json(t) FROM public.refresh_seo_projection_mvs() t'
        ).stdout.splitlines()]

    def event_row(self, event_id):
        return json.loads(self.sql(f"SELECT row_to_json(t) FROM public.__rag_change_events t WHERE rce_id={event_id}").stdout)

    def wait_for(self, app, predicate):
        for _ in range(100):
            if self.sql(f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{app}' AND {predicate}").stdout.strip() == '1':
                return
            time.sleep(.03)
        self.fail(f'{app} never reached {predicate}')

    def test_refresh_ack_preserves_global_status_and_exact_response(self):
        event = self.transition()['event_id']
        before = self.event_row(event)
        self.assertEqual(self.refresh(), [
            {'view_name': 'mv_seo_entity_facts_current', 'refreshed': True},
            {'view_name': 'mv_seo_content_blocks_current', 'refreshed': True}])
        after = self.event_row(event)
        self.assertIsNotNone(after['rce_projection_refreshed_at'])
        for key in before:
            if key != 'rce_projection_refreshed_at':
                self.assertEqual(before[key], after[key], key)
        self.assertEqual(self.sql(f"SELECT content_hash FROM public.mv_seo_content_blocks_current WHERE block_id='{self.block}'").stdout.strip(), 'H2')
        self.refresh()
        self.assertEqual(self.event_row(event), after)
        self.assertEqual(self.sql("SELECT rce_projection_refreshed_at IS NULL FROM public.__rag_change_events WHERE rce_rag_source='legacy-fixture'").stdout.strip(), 't')

    def test_refresh_ack_withdrawal_removes_projection_only(self):
        self.refresh()
        event = self.transition(operation='withdraw', hash=None, content=None, confidence=None, source_type=None)['event_id']
        self.refresh()
        self.assertIsNotNone(self.event_row(event)['rce_projection_refreshed_at'])
        self.assertEqual(self.sql(f"SELECT count(*) FROM public.mv_seo_content_blocks_current WHERE block_id='{self.block}'").stdout.strip(), '0')
        self.assertEqual(self.sql(f"SELECT content->>'text' FROM public.__seo_content_block_versions WHERE version_id='{self.old}'").stdout.strip(), 'original')

    def test_refresh_ack_failure_rolls_back_both_views(self):
        # A facts change makes rollback of the first MV observable too.
        fact = str(uuid.uuid4())
        self.sql(f"""
        INSERT INTO public.__seo_entity_fact_versions
          (version_id,entity_id,status,source_type,confidence_base,content_hash,facts)
          VALUES ('{fact}','{self.entity}','active','wiki',0.8,'F1','{{}}');
        UPDATE public.__seo_entity_facts SET active_version_id='{fact}' WHERE entity_id='{self.entity}';
        """)
        self.refresh()
        self.sql(f"UPDATE public.__seo_entity_facts SET slug='changed' WHERE entity_id='{self.entity}'")
        event = self.transition()['event_id']
        self.sql(f"""
        CREATE FUNCTION public.fixture_ack_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.rce_block_id='{self.block}' AND NEW.rce_projection_refreshed_at IS NOT NULL THEN
            RAISE EXCEPTION 'injected ACK failure';
          END IF;
          RETURN NEW;
        END $$;
        CREATE TRIGGER fixture_ack_failure BEFORE UPDATE ON public.__rag_change_events
          FOR EACH ROW EXECUTE FUNCTION public.fixture_ack_failure();
        """)
        try:
            result = self.sql('SET ROLE service_role; SELECT * FROM public.refresh_seo_projection_mvs()', check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('injected ACK failure', result.stderr)
            self.assertIsNone(self.event_row(event)['rce_projection_refreshed_at'])
            self.assertEqual(self.sql(f"SELECT content_hash FROM public.mv_seo_content_blocks_current WHERE block_id='{self.block}'").stdout.strip(), 'H1')
            self.assertEqual(self.sql(f"SELECT slug FROM public.mv_seo_entity_facts_current WHERE entity_id='{self.entity}'").stdout.strip(), 'fixture')
        finally:
            self.sql('DROP TRIGGER fixture_ack_failure ON public.__rag_change_events; DROP FUNCTION public.fixture_ack_failure()')
        self.refresh()
        self.assertIsNotNone(self.event_row(event)['rce_projection_refreshed_at'])
        self.assertEqual(self.sql(f"SELECT slug FROM public.mv_seo_entity_facts_current WHERE entity_id='{self.entity}'").stdout.strip(), 'changed')

    def test_refresh_ack_leaves_events_committed_during_refresh_pending(self):
        first = self.transition()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            holder = pool.submit(self.sql,
                'BEGIN; REFRESH MATERIALIZED VIEW public.mv_seo_entity_facts_current; SELECT pg_sleep(4); COMMIT', app='ack-mv-lock')
            self.wait_for('ack-mv-lock', "wait_event='PgSleep'")
            refresh = pool.submit(self.sql, 'SET ROLE service_role; SELECT * FROM public.refresh_seo_projection_mvs()', app='ack-refresh')
            self.wait_for('ack-refresh', "wait_event_type='Lock'")
            second = self.transition(run=self.next_run, version=first['active_version_id'], event=first['event_id'], hash='H3')
            holder.result()
            refresh.result()
        self.assertIsNotNone(self.event_row(first['event_id'])['rce_projection_refreshed_at'])
        self.assertIsNone(self.event_row(second['event_id'])['rce_projection_refreshed_at'])
        self.refresh()
        self.assertIsNotNone(self.event_row(second['event_id'])['rce_projection_refreshed_at'])

    def test_refresh_ack_does_not_ack_late_commit_with_lower_sequence_id(self):
        lower_command = self.command()
        # A different block can commit while the first transition is uncommitted.
        self.setUp()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            lower = pool.submit(self.sql, 'BEGIN; ' + lower_command + ' SELECT pg_sleep(4); COMMIT', app='ack-late-commit')
            self.wait_for('ack-late-commit', "wait_event='PgSleep'")
            higher = self.transition()['event_id']
            self.refresh()
            lower_id = json.loads(lower.result().stdout.splitlines()[0])['event_id']
        self.assertLess(lower_id, higher)
        self.assertIsNotNone(self.event_row(higher)['rce_projection_refreshed_at'])
        self.assertIsNone(self.event_row(lower_id)['rce_projection_refreshed_at'])
        self.refresh()
        self.assertIsNotNone(self.event_row(lower_id)['rce_projection_refreshed_at'])

    def test_refresh_ack_privileges_and_migration_reapply(self):
        event = self.transition()['event_id']
        self.refresh()
        before = self.state()
        self.sql(REFRESH_ACK.read_text())
        self.assertEqual(before, self.state())
        self.assertIsNotNone(self.event_row(event)['rce_projection_refreshed_at'])
        for role, expected in [('anon', 'f'), ('authenticated', 'f'), ('service_role', 't')]:
            self.assertEqual(self.sql(f"SELECT has_function_privilege('{role}','public.refresh_seo_projection_mvs()','EXECUTE')").stdout.strip(), expected)
        self.assertEqual(self.sql("SELECT indisvalid FROM pg_index WHERE indexrelid='public.idx_rce_projection_refresh_pending'::regclass").stdout.strip(), 't')
        self.assertEqual(self.sql("SELECT prosecdef FROM pg_proc WHERE oid='public.refresh_seo_projection_mvs()'::regprocedure").stdout.strip(), 't')


if __name__ == '__main__':
    unittest.main(verbosity=2)
