/**
 * `CONFLICT_REASONS` (ordre d'évaluation du resolver) et le CHECK
 * `__diag_projection_conflicts.reason` dans sa définition la plus récente
 * portent le même ensemble : une raison absente du CHECK ferait échouer l'apply
 * en base, une raison absente du code serait morte.
 *
 * @see backend/supabase/migrations/20261010_diag_link_provenance.sql
 * @see backend/supabase/migrations/20261012_diag_projection_requires_review.sql
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFLICT_REASONS } from './diagnostic-projection.types';

const MIGRATIONS_DIR = join(__dirname, '../../../../supabase/migrations');
/** Ordre d'application : la dernière définition fait foi. */
const DEFINING = [
  '20261010_diag_link_provenance.sql',
  '20261012_diag_projection_requires_review.sql',
];
// Colonne déclarée avec son CHECK (création) ou contrainte nommée (ALTER TABLE).
const REASON_CHECK =
  /(?:reason\s+text\s+NOT\s+NULL|ADD\s+CONSTRAINT\s+__diag_projection_conflicts_reason_check)\s+CHECK\s*\(\s*reason\s+IN\s*\(([^)]*)\)\s*\)/i;

const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
const reasonsIn = (file: string) => {
  const match = REASON_CHECK.exec(read(file));
  expect(match).not.toBeNull();
  return [...(match as RegExpExecArray)[1].matchAll(/'([a-z_]+)'/g)].map(
    (quoted) => quoted[1],
  );
};

describe('CONFLICT_REASONS ↔ CHECK __diag_projection_conflicts.reason', () => {
  it('only the known migrations define the reason CHECK', () => {
    const defining = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql') && !file.endsWith('.down.sql'))
      .filter((file) => {
        const sql = read(file);
        return (
          sql.includes('__diag_projection_conflicts') && REASON_CHECK.test(sql)
        );
      })
      .sort();
    expect(defining).toEqual(DEFINING);
  });

  it('the latest definition carries the same set of reasons, no duplicate', () => {
    const inSql = reasonsIn(DEFINING[DEFINING.length - 1]);
    expect(new Set(CONFLICT_REASONS).size).toBe(CONFLICT_REASONS.length);
    expect(new Set(inSql).size).toBe(inSql.length);
    expect([...inSql].sort()).toEqual([...CONFLICT_REASONS].sort());
  });

  it('the 20261012 rollback restores the 20261010 set exactly', () => {
    const restored = reasonsIn(
      '20261012_diag_projection_requires_review.down.sql',
    );
    expect([...restored].sort()).toEqual([...reasonsIn(DEFINING[0])].sort());
    expect(restored).not.toContain('not_reviewed');
  });
});
