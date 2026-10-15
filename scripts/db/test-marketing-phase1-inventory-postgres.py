#!/usr/bin/env python3
"""Qualification on an owned, disposable Docker Postgres. No remote DB option.

Usage: python3 scripts/db/test-marketing-phase1-inventory-postgres.py
Requires the pinned image already present; never pulls, publishes ports or mounts
host data. All SQL targets only this test's freshly created container.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/marketing-phase1-scope'
IMAGE = 'postgres@sha256:d74eeac9a635390a49bc21bd49fccd973de707e2a53a76ac49b552b8712ec46f'
NAME = 'amk-phase1-test-' + uuid.uuid4().hex[:12]
checks = []


def command(args, *, sql=None, success=True):
    r = subprocess.run(args, input=sql, text=True, capture_output=True, timeout=90)
    if success and r.returncode:
        raise RuntimeError(f'{args[:4]}: exit {r.returncode}: {r.stderr}')
    return r


def psql(sql, *, success=True, db='postgres'):
    return command(['docker', 'exec', '-i', NAME, 'psql', '-X', '-qAt',
                    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
                    '-U', 'postgres', '-d', db], sql=sql, success=success)


def check(name, condition):
    assert condition, name
    checks.append(name)
    print('PASS ' + name, flush=True)


def inventory(sql, filename, db='postgres'):
    result = json.loads(psql(sql, db=db).stdout)
    (OUT / filename).write_text(json.dumps(result, indent=2) + '\n')
    return result


LEDGERS = """
CREATE SCHEMA infra; CREATE SCHEMA supabase_migrations;
CREATE TABLE infra.schema_migrations(id text PRIMARY KEY, checksum text,
 status text, runner text, execution_ms integer);
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text);
INSERT INTO infra.schema_migrations VALUES('20260430_marketing_layer_phase1',
 'b498fd24ab534abfffe0c55011c1af14a1a675fda627a06db7a39a47b04a7e8b',
 'applied','baseline-2026-05-16',0);
INSERT INTO supabase_migrations.schema_migrations VALUES('20260430','marketing_layer_phase1');
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sql_path = ROOT / 'scripts/db/marketing-phase1-inventory.sql'
    query = sql_path.read_text()
    started = False
    result = {'checks': checks, 'container': NAME, 'image': IMAGE,
              'preflight_sha256': hashlib.sha256(sql_path.read_bytes()).hexdigest()}
    try:
        command(['docker', 'run', '-d', '--pull=never', '--name', NAME,
                 '--label', 'automecanik.scope=phase1-isolated-test', '--network', 'none',
                 '--memory', '512m', '--cpus', '1', '--pids-limit', '128',
                 '--tmpfs', '/var/lib/postgresql/data:rw,size=268435456',
                 '-e', 'PGDATA=/var/lib/postgresql/data/pgdata',
                 '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE])
        started = True
        for _ in range(30):
            if psql('SELECT 1', success=False).returncode == 0:
                break
            time.sleep(0.5)
        info = json.loads(command(['docker', 'inspect', NAME]).stdout)[0]
        check('network none, no published ports or host data mounts',
              info['HostConfig']['NetworkMode'] == 'none' and
              not info['HostConfig']['PortBindings'] and
              all(m['Type'] == 'tmpfs' for m in info['Mounts']))
        result['server_version'] = psql('SHOW server_version').stdout.strip()
        # Reuse the schema captured for the already-qualified admin image.
        psql((ROOT / 'output/marketing-image-isolated/captured-schema.sql').read_text())
        psql("CREATE TABLE public.___xtr_customer(id integer PRIMARY KEY,email text);"
             "INSERT INTO public.___xtr_customer VALUES(1,'SYNTHETIC-NOT-FOR-EXPORT');")
        failed = psql(query, success=False)
        check('missing ledger fails explicitly', failed.returncode != 0 and '42P01' in failed.stderr)
        psql(LEDGERS)
        before = inventory(query, 'preflight-before.json')
        check('baseline applied does not hide three missing Phase1 objects',
              before['infra_phase1_and_candidates'][0]['status'] == 'applied' and
              all(r['oid'] is None for r in before['relations']
                  if r['name'] in ('__marketing_brief', '__retention_trigger_rules')) and
              before['consent_column_present'] is False)
        check('read-only transaction and no customer record exported',
              before['transaction_read_only'] == 'on' and
              'SYNTHETIC-NOT-FOR-EXPORT' not in json.dumps(before))
        injected = query.replace('WITH wanted', 'CREATE TABLE forbidden_write(id int);\nWITH wanted', 1)
        failed = psql(injected, success=False)
        check('server rejects an injected write with SQLSTATE 25006',
              failed.returncode != 0 and '25006' in failed.stderr and
              psql("SELECT to_regclass('public.forbidden_write') IS NULL").stdout.strip() == 't')
        # Existing offline prerequisite; then the existing three SQL contracts.
        with tempfile.TemporaryDirectory() as directory:
            prepared = Path(directory) / 'brief.sql'
            command(['python3', str(ROOT / 'scripts/db/apply-migration-marketing-phase1.py'),
                     '--prepare-brief-social', str(prepared)])
            psql(prepared.read_text())
        for name in ['20261014010000_marketing_social_reviews',
                     '20261014091855_marketing_publication_preparations',
                     '20261014172953_marketing_brief_social_link']:
            psql('BEGIN;\n' + (ROOT / f'backend/supabase/migrations/{name}.sql').read_text() + '\nCOMMIT;')
        after = inventory(query, 'preflight-brief-social.json')
        check('brief and three Social Hub contracts apply in order',
              all(r['oid'] is not None for r in after['relations']
                  if r['name'] not in ('__retention_trigger_rules',)))
        check('brief-only scope leaves retention absent and customer consent untouched',
              not after['consent_column_present'] and
              next(r for r in after['relations'] if r['name']=='__retention_trigger_rules')['oid'] is None and
              psql('SELECT count(*) FROM public.___xtr_customer').stdout.strip() == '1')
        check('neither ledger is rewritten by prepared SQL',
              before['infra_phase1_and_candidates'] == after['infra_phase1_and_candidates'] and
              before['supabase_phase1_and_candidates'] == after['supabase_phase1_and_candidates'] and
              before['ledger_counts'] == after['ledger_counts'])
        check('anon and authenticated have no effective Social Hub write grants',
              all(not any(p[k] for k in ('insert','update','delete','truncate','column_write'))
                  for p in after['effective_privileges'] if p['role'] in ('anon','authenticated')
                  and p['table'] != '___xtr_customer'))
        # Deliberate drift fixture: effective column grant via an inherited role.
        psql('CREATE ROLE inventory_inherited; GRANT inventory_inherited TO authenticated;'
             'GRANT UPDATE(cta) ON public.__marketing_brief TO inventory_inherited;')
        drift = inventory(query, 'preflight-inherited-grant.json')
        check('effective inherited column privilege is visible', any(
            p['column_write'] for p in drift['effective_privileges']
            if p['table']=='__marketing_brief' and p['role']=='authenticated'))
        # Full historical replay is tested separately, not selected for shared repair.
        full = (ROOT / 'backend/supabase/migrations/20260430_marketing_layer_phase1.sql').read_text()
        psql('BEGIN;\n' + full + '\nCOMMIT;')
        check('full historical Phase1 creates four ACTIVE rules',
              psql('SELECT count(*) FROM public.__retention_trigger_rules WHERE active').stdout.strip() == '4')
        check('full Phase1 does not infer consent from an existing customer',
              psql('SELECT cst_marketing_consent_at IS NULL FROM public.___xtr_customer').stdout.strip() == 't')
        # IF NOT EXISTS is not a schema reconciler: preserve wrong type fixture.
        psql("ALTER TABLE public.___xtr_customer DROP COLUMN cst_marketing_consent_at;"
             "ALTER TABLE public.___xtr_customer ADD COLUMN cst_marketing_consent_at text NOT NULL DEFAULT 'wrong';")
        psql('BEGIN;\n' + full + '\nCOMMIT;')
        drift = inventory(query, 'preflight-wrong-consent-contract.json')
        col = next(c for c in drift['columns'] if c['name']=='cst_marketing_consent_at')
        check('preflight exposes incompatible consent type, nullability and default after replay',
              col['type']=='text' and col['not_null'] and "wrong" in col['default'])
        result['status'] = 'passed'
    finally:
        if started:
            command(['docker', 'rm', '-f', '-v', NAME])
            result['container_removed'] = command(['docker', 'inspect', NAME], success=False).returncode != 0
        (OUT / 'postgres-result.json').write_text(json.dumps(result, indent=2) + '\n')


if __name__ == '__main__':
    main()
