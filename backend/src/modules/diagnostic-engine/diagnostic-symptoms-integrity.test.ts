import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiagnosticEngineController } from './diagnostic-engine.controller';
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';

const freinage = {
  id: 1,
  active: true,
  slug: 'freinage',
  label: 'Freinage',
  description: null,
};
const bruit = {
  id: 10,
  active: true,
  slug: 'bruit-freinage',
  label: 'Bruit au freinage',
  description: 'Grincement ou sifflement.',
  system_id: 1,
  signal_mode: 'symptom',
  urgency: 'haute',
};

function fixture(
  system: { data: unknown; error: null | { code: string; message: string } },
  symptoms: unknown[] = [],
) {
  const service = Object.create(
    DiagnosticEngineDataService.prototype,
  ) as DiagnosticEngineDataService;
  const systemQuery = {
    select: jest.fn(() => systemQuery),
    eq: jest.fn(() => systemQuery),
    single: jest.fn(async () => system),
  };
  const symptomQuery = {
    select: jest.fn(() => symptomQuery),
    eq: jest.fn(() => symptomQuery),
    order: jest.fn(async () => ({ data: symptoms, error: null })),
  };
  const from = jest.fn((table: string) =>
    table === '__diag_system' ? systemQuery : symptomQuery,
  );
  Object.assign(service, {
    supabase: { from },
    logger: { warn: jest.fn(), error: jest.fn() },
  });
  const controller = new DiagnosticEngineController(
    {} as never,
    service,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { controller, from };
}
const found = (data: unknown) => ({ data, error: null });
const missing = {
  data: null,
  error: { code: 'PGRST116', message: 'no rows' },
};

describe('symptoms lookup contract', () => {
  test.each([undefined, ''])(
    'rejects a missing system parameter (%p) with 400 before any query',
    async (system) => {
      const f = fixture(found(freinage));
      await expect(f.controller.getSymptoms(system)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(f.from).not.toHaveBeenCalled();
    },
  );

  test('rejects an unknown or inactive system with 404, not an empty list', async () => {
    const f = fixture(missing, [bruit]);
    await expect(f.controller.getSymptoms('inconnu')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(f.from).not.toHaveBeenCalledWith('__diag_symptom');
  });

  test('does not turn a reference outage into a 404', async () => {
    const f = fixture({
      data: null,
      error: { code: '57014', message: 'canceling statement' },
    });
    const call = f.controller.getSymptoms('freinage');
    await expect(call).rejects.toThrow('Diagnostic system unavailable');
    await expect(call).rejects.not.toBeInstanceOf(NotFoundException);
  });

  test('returns the active symptoms of a known system', async () => {
    const f = fixture(found(freinage), [bruit]);
    await expect(f.controller.getSymptoms('freinage')).resolves.toEqual({
      success: true,
      system: 'freinage',
      count: 1,
      symptoms: [
        {
          slug: 'bruit-freinage',
          label: 'Bruit au freinage',
          description: 'Grincement ou sifflement.',
          urgency: 'haute',
        },
      ],
    });
  });

  test('an empty list only means a known system without active symptoms', async () => {
    const f = fixture(found(freinage), []);
    await expect(f.controller.getSymptoms('freinage')).resolves.toEqual({
      success: true,
      system: 'freinage',
      count: 0,
      symptoms: [],
    });
  });
});
