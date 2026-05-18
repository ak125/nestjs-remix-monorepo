/**
 * ADR-070 PR 2C' — R1 Gamme Completeness Audit Service tests
 *
 * Coverage strategy : mock Supabase client to control gammes + sections
 * returned, verify status computation + pilotV1Blocker threshold.
 *
 * Note : we extend the service to expose a protected `supabase` via a mock,
 * since the service inherits from `SupabaseBaseService`. The `auditCompleteness`
 * pure logic (count + status + threshold) is the unit under test.
 */

import {
  R1GammeCompletenessAuditService,
  R1_CRITICAL_SECTIONS_DB,
} from '../r1-gamme-completeness-audit.service';

interface FakeGammeRow {
  pg_id: number;
  pg_alias: string | null;
  pg_name: string | null;
}

interface FakeConseilRow {
  sgc_pg_id: number;
  sgc_section_type: string;
  sgc_content: string;
}

function makeFakeSupabase(
  gammes: FakeGammeRow[],
  conseilSections: FakeConseilRow[],
) {
  return {
    from(table: string) {
      if (table === 'pieces_gamme') {
        return {
          select: (_cols: string) => ({
            order: (_col: string) => ({
              range: (from: number, to: number) => {
                const slice = gammes.slice(from, to + 1);
                return Promise.resolve({ data: slice, error: null });
              },
            }),
          }),
        };
      }
      if (table === '__seo_gamme_conseil') {
        return {
          select: (_cols: string) => ({
            in: (_col: string, _values: string[]) => ({
              not: (_field: string, _op: string, _val: unknown) => ({
                range: (from: number, to: number) => {
                  const slice = conseilSections.slice(from, to + 1);
                  return Promise.resolve({ data: slice, error: null });
                },
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function createServiceWithFakeData(
  gammes: FakeGammeRow[],
  sections: FakeConseilRow[],
): R1GammeCompletenessAuditService {
  // Bypass SupabaseBaseService constructor (which validates env) by using
  // Object.create(prototype) — same pattern as r2-composition-input-snapshot.spec.ts.
  const svc = Object.create(
    R1GammeCompletenessAuditService.prototype,
  ) as R1GammeCompletenessAuditService;
  // Inject logger stub (Logger is non-public in base, we set via cast).
  (
    svc as unknown as {
      logger: { log: () => void; error: () => void; warn: () => void };
    }
  ).logger = {
    log: () => {},
    error: () => {},
    warn: () => {},
  };
  // Inject fake supabase
  (svc as unknown as { supabase: unknown }).supabase = makeFakeSupabase(
    gammes,
    sections,
  );
  return svc;
}

const fullContent = 'X'.repeat(50);

describe('R1GammeCompletenessAuditService', () => {
  it('returns status=complete when all 5 critical sections present with non-empty content', async () => {
    const gammes: FakeGammeRow[] = [
      { pg_id: 100, pg_alias: 'huile', pg_name: 'Huile' },
    ];
    const sections: FakeConseilRow[] = R1_CRITICAL_SECTIONS_DB.map((s) => ({
      sgc_pg_id: 100,
      sgc_section_type: s,
      sgc_content: fullContent,
    }));
    const svc = createServiceWithFakeData(gammes, sections);

    const report = await svc.auditCompleteness();

    expect(report.totalGammes).toBe(1);
    expect(report.completeCount).toBe(1);
    expect(report.partialCount).toBe(0);
    expect(report.missingCount).toBe(0);
    expect(report.completePercent).toBe(100);
    expect(report.pilotV1Blocker).toBe(false);
  });

  it('returns status=partial when 2/5 sections present', async () => {
    const gammes: FakeGammeRow[] = [
      { pg_id: 100, pg_alias: 'huile', pg_name: 'Huile' },
    ];
    const sections: FakeConseilRow[] = [
      { sgc_pg_id: 100, sgc_section_type: 'S1', sgc_content: fullContent },
      { sgc_pg_id: 100, sgc_section_type: 'S3', sgc_content: fullContent },
    ];
    const svc = createServiceWithFakeData(gammes, sections);

    const report = await svc.auditCompleteness();

    expect(report.partialCount).toBe(1);
    expect(report.rowsSample[0].status).toBe('partial');
    expect(report.rowsSample[0].sectionsPresentCount).toBe(2);
    expect(report.rowsSample[0].sectionsPresent.S1).toBe(true);
    expect(report.rowsSample[0].sectionsPresent.S3).toBe(true);
    expect(report.rowsSample[0].sectionsPresent.S5).toBe(false);
  });

  it('returns status=missing when 0 sections + pilotV1Blocker=true if > 30% incomplete', async () => {
    // 10 gammes : 5 missing, 5 complete → 50% incomplete → blocker
    const gammes: FakeGammeRow[] = Array.from({ length: 10 }, (_, i) => ({
      pg_id: 100 + i,
      pg_alias: `gamme${i}`,
      pg_name: `Gamme ${i}`,
    }));
    const sections: FakeConseilRow[] = [];
    for (let i = 5; i < 10; i++) {
      for (const s of R1_CRITICAL_SECTIONS_DB) {
        sections.push({
          sgc_pg_id: 100 + i,
          sgc_section_type: s,
          sgc_content: fullContent,
        });
      }
    }
    const svc = createServiceWithFakeData(gammes, sections);

    const report = await svc.auditCompleteness();

    expect(report.missingCount).toBe(5);
    expect(report.completeCount).toBe(5);
    expect(report.missingPercent).toBe(50);
    expect(report.pilotV1Blocker).toBe(true);
  });

  it('ignores sections with whitespace-only or very short content (< 10 chars)', async () => {
    const gammes: FakeGammeRow[] = [
      { pg_id: 100, pg_alias: 'huile', pg_name: 'Huile' },
    ];
    const sections: FakeConseilRow[] = [
      { sgc_pg_id: 100, sgc_section_type: 'S1', sgc_content: '   ' }, // whitespace
      { sgc_pg_id: 100, sgc_section_type: 'S3', sgc_content: 'tooshort' }, // 8 chars
      { sgc_pg_id: 100, sgc_section_type: 'S5', sgc_content: fullContent }, // valid
    ];
    const svc = createServiceWithFakeData(gammes, sections);

    const report = await svc.auditCompleteness();

    expect(report.rowsSample[0].sectionsPresentCount).toBe(1);
    expect(report.rowsSample[0].sectionsPresent.S5).toBe(true);
    expect(report.rowsSample[0].sectionsPresent.S1).toBe(false);
    expect(report.rowsSample[0].sectionsPresent.S3).toBe(false);
  });

  it('pilotV1Blocker=false when exactly 30% incomplete (boundary)', async () => {
    // 10 gammes : 3 missing, 7 complete → 30% incomplete (boundary, NOT > 30%)
    const gammes: FakeGammeRow[] = Array.from({ length: 10 }, (_, i) => ({
      pg_id: 100 + i,
      pg_alias: `gamme${i}`,
      pg_name: `Gamme ${i}`,
    }));
    const sections: FakeConseilRow[] = [];
    for (let i = 3; i < 10; i++) {
      for (const s of R1_CRITICAL_SECTIONS_DB) {
        sections.push({
          sgc_pg_id: 100 + i,
          sgc_section_type: s,
          sgc_content: fullContent,
        });
      }
    }
    const svc = createServiceWithFakeData(gammes, sections);

    const report = await svc.auditCompleteness();

    expect(report.missingCount).toBe(3);
    expect(report.completeCount).toBe(7);
    expect(report.missingPercent).toBe(30);
    expect(report.pilotV1Blocker).toBe(false); // > 30%, not >=
  });

  it('rowsSample sorts missing before partial, then partial by count ascending', async () => {
    const gammes: FakeGammeRow[] = [
      { pg_id: 100, pg_alias: 'a', pg_name: 'a' },
      { pg_id: 200, pg_alias: 'b', pg_name: 'b' },
      { pg_id: 300, pg_alias: 'c', pg_name: 'c' },
    ];
    const sections: FakeConseilRow[] = [
      // pg 100 : 4/5 (partial, count=4)
      { sgc_pg_id: 100, sgc_section_type: 'S1', sgc_content: fullContent },
      { sgc_pg_id: 100, sgc_section_type: 'S3', sgc_content: fullContent },
      { sgc_pg_id: 100, sgc_section_type: 'S5', sgc_content: fullContent },
      { sgc_pg_id: 100, sgc_section_type: 'S6', sgc_content: fullContent },
      // pg 200 : 0/5 (missing)
      // pg 300 : 2/5 (partial, count=2)
      { sgc_pg_id: 300, sgc_section_type: 'S1', sgc_content: fullContent },
      { sgc_pg_id: 300, sgc_section_type: 'S3', sgc_content: fullContent },
    ];
    const svc = createServiceWithFakeData(gammes, sections);

    const report = await svc.auditCompleteness();

    // Expected sort : pg_id=200 (missing) first, then pg_id=300 (partial count=2), then pg_id=100 (partial count=4)
    expect(report.rowsSample[0].pgId).toBe(200);
    expect(report.rowsSample[0].status).toBe('missing');
    expect(report.rowsSample[1].pgId).toBe(300);
    expect(report.rowsSample[1].sectionsPresentCount).toBe(2);
    expect(report.rowsSample[2].pgId).toBe(100);
    expect(report.rowsSample[2].sectionsPresentCount).toBe(4);
  });

  it('rowsSample respects partialMissingSampleLimit parameter', async () => {
    const gammes: FakeGammeRow[] = Array.from({ length: 100 }, (_, i) => ({
      pg_id: i + 1,
      pg_alias: `g${i}`,
      pg_name: `G${i}`,
    }));
    const sections: FakeConseilRow[] = [];
    const svc = createServiceWithFakeData(gammes, sections);

    const report = await svc.auditCompleteness(5);

    expect(report.rowsSample.length).toBe(5);
    expect(report.missingCount).toBe(100);
  });

  it('returns zero counts when no gammes exist', async () => {
    const svc = createServiceWithFakeData([], []);

    const report = await svc.auditCompleteness();

    expect(report.totalGammes).toBe(0);
    expect(report.completeCount).toBe(0);
    expect(report.partialCount).toBe(0);
    expect(report.missingCount).toBe(0);
    expect(report.completePercent).toBe(0);
    expect(report.pilotV1Blocker).toBe(false);
  });
});
