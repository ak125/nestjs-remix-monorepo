/**
 * Tests purs — classification des erreurs d'ingestion.
 */
import {
  classifyIngestionError,
  IngestionDbError,
  IngestionSchemaError,
  isSystemicIngestionError,
} from './ingestion-error-classifier';

describe('classifyIngestionError', () => {
  it('HTTP Gaxios : 429 et 403 quota → quota ; 401/403 → auth ; 5xx → network', () => {
    expect(classifyIngestionError({ status: 429, message: 'x' })).toBe(
      'quota_exceeded',
    );
    expect(
      classifyIngestionError({
        response: {
          status: 403,
          data: { error: { errors: [{ reason: 'quotaExceeded' }] } },
        },
      }),
    ).toBe('quota_exceeded');
    expect(classifyIngestionError({ status: 403, message: 'denied' })).toBe(
      'auth_failure',
    );
    expect(classifyIngestionError({ status: 401 })).toBe('auth_failure');
    expect(classifyIngestionError({ status: 503 })).toBe('network');
  });

  it('gRPC (GA4) : 8 → quota, 7/16 → auth, 14/4 → network', () => {
    expect(
      classifyIngestionError({ code: 8, message: 'RESOURCE_EXHAUSTED' }),
    ).toBe('quota_exceeded');
    expect(classifyIngestionError({ code: 7 })).toBe('auth_failure');
    expect(classifyIngestionError({ code: 16 })).toBe('auth_failure');
    expect(classifyIngestionError({ code: 14 })).toBe('network');
    expect(classifyIngestionError({ code: 4 })).toBe('network');
  });

  it('codes système et message en dernier recours', () => {
    expect(classifyIngestionError({ code: 'ECONNRESET' })).toBe('network');
    expect(classifyIngestionError(new Error('socket hang up'))).toBe('network');
    expect(classifyIngestionError(new Error('invalid_grant'))).toBe(
      'auth_failure',
    );
    expect(classifyIngestionError(new Error('boom'))).toBe('unknown');
  });

  it('Supabase : table/colonne absente ou partition manquante → schema_drift ; contrainte → db_constraint', () => {
    expect(
      classifyIngestionError(
        new IngestionDbError(
          't',
          '42703',
          'column commit_version does not exist',
        ),
      ),
    ).toBe('schema_drift');
    expect(
      classifyIngestionError(
        new IngestionDbError('t', 'PGRST205', 'not found'),
      ),
    ).toBe('schema_drift');
    expect(
      classifyIngestionError(
        new IngestionDbError(
          't',
          '23514',
          'no partition of relation found for row',
        ),
      ),
    ).toBe('schema_drift');
    expect(
      classifyIngestionError(
        new IngestionDbError('t', '23505', 'duplicate key'),
      ),
    ).toBe('db_constraint');
    expect(classifyIngestionError(new IngestionSchemaError('drift'))).toBe(
      'schema_drift',
    );
  });

  it('classes systémiques = quota, auth, schéma', () => {
    expect(isSystemicIngestionError('quota_exceeded')).toBe(true);
    expect(isSystemicIngestionError('auth_failure')).toBe(true);
    expect(isSystemicIngestionError('schema_drift')).toBe(true);
    expect(isSystemicIngestionError('network')).toBe(false);
    expect(isSystemicIngestionError('db_constraint')).toBe(false);
    expect(isSystemicIngestionError('unknown')).toBe(false);
  });
});
