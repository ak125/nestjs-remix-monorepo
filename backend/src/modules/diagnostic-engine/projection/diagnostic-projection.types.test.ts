/**
 * `CONFLICT_REASONS` (ordre d'évaluation du resolver) et le CHECK
 * `__diag_projection_conflicts.reason` portent le même ensemble : une raison
 * absente du CHECK ferait échouer l'apply en base, une raison absente du code
 * serait morte.
 *
 * @see backend/supabase/migrations/20261010_diag_link_provenance.sql
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFLICT_REASONS } from './diagnostic-projection.types';

const MIGRATIONS_DIR = join(__dirname, '../../../../supabase/migrations');
const MIGRATION = '20261010_diag_link_provenance.sql';
const REASON_CHECK =
  /reason\s+text\s+NOT\s+NULL\s+CHECK\s*\(\s*reason\s+IN\s*\(([^)]*)\)\s*\)/i;

describe('CONFLICT_REASONS ↔ CHECK __diag_projection_conflicts.reason', () => {
  it(`only ${MIGRATION} defines the reason CHECK`, () => {
    const defining = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .filter((file) => {
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
        return (
          sql.includes('__diag_projection_conflicts') && REASON_CHECK.test(sql)
        );
      });
    expect(defining).toEqual([MIGRATION]);
  });

  it('same set of reasons, no duplicate', () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, MIGRATION), 'utf8');
    const match = REASON_CHECK.exec(sql);
    expect(match).not.toBeNull();
    const inSql = [
      ...(match as RegExpExecArray)[1].matchAll(/'([a-z_]+)'/g),
    ].map((quoted) => quoted[1]);
    expect(new Set(CONFLICT_REASONS).size).toBe(CONFLICT_REASONS.length);
    expect(new Set(inSql).size).toBe(inSql.length);
    expect([...inSql].sort()).toEqual([...CONFLICT_REASONS].sort());
  });
});
