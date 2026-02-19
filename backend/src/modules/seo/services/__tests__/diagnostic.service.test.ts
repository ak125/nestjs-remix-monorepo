/**
 * Unit tests for DiagnosticService.refreshFromRag()
 *
 * Validates the R5_diagnostic pipeline:
 * - No RAG file → skipped + NO_DIAGNOSTIC_RAG_DOC
 * - Observable not found → skipped + OBSERVABLE_NOT_FOUND
 * - RAG with <2 symptoms & <2 causes → confidence 0.65
 * - RAG with >=2 symptoms & >=2 causes → confidence 0.85
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as fs from 'fs';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => ''),
}));

jest.mock('@nestjs/common', () => ({
  Injectable: () => () => undefined,
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('../../../../database/services/supabase-base.service', () => ({
  SupabaseBaseService: class {
    protected supabase: any;
    protected logger: any = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    constructor(..._args: any[]) {}
  },
}));

jest.mock('../../../../security/rpc-gate/rpc-gate.service', () => ({
  RpcGateService: jest.fn(),
}));

import { DiagnosticService } from '../diagnostic.service';

// ── RAG file content fixtures ──

const RAG_RICH = `# Diagnostic freinage

## Symptômes observables

### Vibrations au freinage
- **Quand** : À haute vitesse, pédale pulsée
- **Caractéristique** : Vibration proportionnelle à la vitesse

### Grincement métallique
- **Quand** : À chaque freinage, constant
- **Caractéristique** : Son aigu métal-sur-métal

## Causes probables

### 1. Disque voilé
- **Probabilité** : 55%
- **Solution** : Remplacement par paire
- **Urgence** : Haute

### 2. Plaquettes usées
- **Probabilité** : 30%
- **Solution** : Remplacement plaquettes
- **Urgence** : Moyenne

### 3. Étrier grippé
- **Probabilité** : 15%
- **Solution** : Nettoyage ou remplacement étrier
- **Urgence** : Haute
`;

const RAG_MINIMAL = `# Diagnostic embrayage

### Vibration embrayage
- **Quand** : Au démarrage
- **Caractéristique** : Tremblement

### 1. Volant moteur
- **Probabilité** : 70%
- **Solution** : Remplacement volant moteur bi-masse
- **Urgence** : Haute
`;

const RAG_EMPTY = `# Diagnostic vide

Pas de contenu structuré ici.
`;

describe('DiagnosticService.refreshFromRag', () => {
  let service: DiagnosticService;
  let mockSupabase: any;

  beforeEach(() => {
    service = new DiagnosticService(null as any);

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      update: jest.fn().mockReturnThis(),
    };

    (service as any).supabase = mockSupabase;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return skipped + OBSERVABLE_NOT_FOUND when slug not in DB', async () => {
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'not found' },
    });

    const result = await service.refreshFromRag('non-existent-slug');

    expect(result.skipped).toBe(true);
    expect(result.updated).toBe(false);
    expect(result.flags).toContain('OBSERVABLE_NOT_FOUND');
  });

  it('should return skipped + NO_DIAGNOSTIC_RAG_DOC when no RAG file exists', async () => {
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 1,
        slug: 'bruit-moteur',
        cluster_id: 'moteur',
        symptom_description: null,
        sign_description: null,
      },
      error: null,
    });

    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const result = await service.refreshFromRag('bruit-moteur');

    expect(result.skipped).toBe(true);
    expect(result.flags).toContain('NO_DIAGNOSTIC_RAG_DOC');
  });

  it('should return skipped when RAG file has no structured sections', async () => {
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 2,
        slug: 'bruit-vide',
        cluster_id: 'vide',
        symptom_description: null,
        sign_description: null,
      },
      error: null,
    });

    (fs.existsSync as jest.Mock).mockImplementation((p: any) =>
      String(p).includes('vide'),
    );
    (fs.readFileSync as jest.Mock).mockReturnValue(RAG_EMPTY);

    const result = await service.refreshFromRag('bruit-vide');

    expect(result.skipped).toBe(true);
    expect(result.flags).toContain('NO_DIAGNOSTIC_RAG_DOC');
  });

  it('should return confidence 0.65 when RAG has <2 symptoms or <2 causes', async () => {
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 3,
        slug: 'vibration-embrayage',
        cluster_id: 'embrayage',
        symptom_description: null,
        sign_description: null,
      },
      error: null,
    });

    // update() chain succeeds
    mockSupabase.update.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    (fs.existsSync as jest.Mock).mockImplementation((p: any) =>
      String(p).includes('embrayage'),
    );
    (fs.readFileSync as jest.Mock).mockReturnValue(RAG_MINIMAL);

    const result = await service.refreshFromRag('vibration-embrayage');

    expect(result.skipped).toBe(false);
    expect(result.updated).toBe(true);
    expect(result.confidence).toBe(0.65);
    expect(result.flags).toContain('SYMPTOMS_UPDATED');
    expect(result.flags).toContain('CAUSES_UPDATED');
  });

  it('should return confidence 0.85 when RAG has >=2 symptoms and >=2 causes', async () => {
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 4,
        slug: 'vibration-freinage',
        cluster_id: 'freinage',
        symptom_description: null,
        sign_description: null,
      },
      error: null,
    });

    mockSupabase.update.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    (fs.existsSync as jest.Mock).mockImplementation((p: any) =>
      String(p).includes('freinage'),
    );
    (fs.readFileSync as jest.Mock).mockReturnValue(RAG_RICH);

    const result = await service.refreshFromRag('vibration-freinage');

    expect(result.skipped).toBe(false);
    expect(result.updated).toBe(true);
    expect(result.confidence).toBe(0.85);
    expect(result.flags).toContain('SYMPTOMS_UPDATED');
    expect(result.flags).toContain('CAUSES_UPDATED');
    expect(result.flags).toContain('ACTIONS_UPDATED');
  });

  it('should return UPDATE_FAILED when DB update fails', async () => {
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 5,
        slug: 'vibration-freinage',
        cluster_id: 'freinage',
        symptom_description: null,
        sign_description: null,
      },
      error: null,
    });

    mockSupabase.update.mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        error: { message: 'DB write error' },
      }),
    });

    (fs.existsSync as jest.Mock).mockImplementation((p: any) =>
      String(p).includes('freinage'),
    );
    (fs.readFileSync as jest.Mock).mockReturnValue(RAG_RICH);

    const result = await service.refreshFromRag('vibration-freinage');

    expect(result.skipped).toBe(false);
    expect(result.updated).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.flags).toContain('UPDATE_FAILED');
  });
});
