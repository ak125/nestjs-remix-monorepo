/**
 * `SeoAuditSchedulerService.runAuditScript()` — seul point du module qui lance
 * un processus : le fichier du script, exécuté directement, sans argument et
 * sans interpréteur de commandes.
 */
import { isAbsolute } from 'path';
import { promisify } from 'util';
import * as childProcess from 'child_process';
import { SeoAuditSchedulerService } from './seo-audit-scheduler.service';

jest.mock('child_process', () => {
  const { promisify: actualPromisify } = jest.requireActual('util');
  // Même contrat que la fonction réelle une fois « promisifiée » :
  // résolution en `{ stdout, stderr }`.
  const execFile = Object.assign(jest.fn(), {
    [actualPromisify.custom]: jest.fn(async () => ({
      stdout: 'sortie du script',
      stderr: '',
    })),
  });
  return {
    exec: jest.fn(),
    execSync: jest.fn(),
    execFile,
    execFileSync: jest.fn(),
    spawn: jest.fn(),
    spawnSync: jest.fn(),
    fork: jest.fn(),
  };
});

// Le service ouvre une file BullMQ au démarrage du module : inutile ici.
jest.mock('bullmq', () => ({ Queue: class {}, Worker: class {} }));
jest.mock('../../../config/app.config', () => ({
  redisConnectionOptions: jest.fn(),
}));

describe('SeoAuditSchedulerService.runAuditScript', () => {
  const launchers = childProcess as unknown as Record<string, jest.Mock>;
  const directLaunch = (
    childProcess.execFile as unknown as Record<symbol, jest.Mock>
  )[promisify.custom];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exécute directement le fichier du script : chemin fixe, aucun argument, aucun shell', async () => {
    const service = new SeoAuditSchedulerService();

    const result = await service.runAuditScript();

    expect(result).toEqual({ stdout: 'sortie du script', stderr: '' });
    expect(directLaunch).toHaveBeenCalledTimes(1);

    const callArgs = directLaunch.mock.calls[0];
    const [file, options] = callArgs;
    // Deux arguments seulement : le fichier et ses options, pas de liste
    // d'arguments pour le script.
    expect(callArgs).toHaveLength(2);
    expect(isAbsolute(file)).toBe(true);
    expect(file).toMatch(/[\\/]scripts[\\/]seo-audit-weekly\.sh$/);
    // Égalité stricte : aucune option qui rétablirait un interpréteur.
    expect(options).toEqual({ maxBuffer: 10 * 1024 * 1024 });
  });

  it("n'utilise aucun autre lanceur de processus", async () => {
    await new SeoAuditSchedulerService().runAuditScript();

    for (const name of [
      'exec',
      'execSync',
      'execFileSync',
      'spawn',
      'spawnSync',
      'fork',
    ]) {
      expect(launchers[name]).not.toHaveBeenCalled();
    }
  });
});
