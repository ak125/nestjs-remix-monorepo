/**
 * Script d'enveloppe des anciennes empreintes (mandat AP) : idempotence,
 * reprise, ligne modifiée par une connexion pendant le passage, comptes.
 *
 * @see backend/src/shared/crypto/legacy-hash-wrap.runner.ts
 */
import {
  HashRow,
  runLegacyHashWrap,
  WrapStore,
  WrapTarget,
} from '../../src/shared/crypto/legacy-hash-wrap.runner';
import { PasswordCryptoService } from '../../src/shared/crypto/password-crypto.service';
import {
  isWrapApplyConfirmed,
  parseMaxRows,
} from '../../src/workers/run-legacy-password-wrap.guard';

const CUSTOMER: WrapTarget = {
  table: '___xtr_customer',
  idColumn: 'cst_id',
  hashColumn: 'cst_pswd',
};

/** Stockage en mémoire, mêmes règles que la version PostgREST. */
class MemoryStore implements WrapStore {
  rows = new Map<string, string | null>();
  writes = 0;
  /** Appelé juste avant une écriture conditionnelle (simule une connexion). */
  beforeReplace?: (id: string) => void;

  constructor(entries: Array<[string, string | null]>) {
    for (const [id, hash] of entries) this.rows.set(id, hash);
  }

  async countTotal(): Promise<number> {
    return this.rows.size;
  }
  async countNull(): Promise<number> {
    return [...this.rows.values()].filter((h) => h === null).length;
  }
  async countMatching(_t: WrapTarget, regex: string): Promise<number> {
    const re = new RegExp(regex, 'i');
    return [...this.rows.values()].filter((h) => h !== null && re.test(h))
      .length;
  }
  async fetchCandidates(
    _t: WrapTarget,
    afterId: string | null,
    limit: number,
  ): Promise<HashRow[]> {
    return [...this.rows.entries()]
      .filter(([, h]) => h !== null && !h.startsWith('$'))
      .map(([id, hash]) => ({ id, hash }))
      .filter((r) => afterId === null || r.id > afterId)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, limit);
  }
  async replaceIfUnchanged(
    _t: WrapTarget,
    id: string,
    expected: string,
    next: string,
  ): Promise<boolean> {
    this.beforeReplace?.(id);
    if (this.rows.get(id) !== expected) return false;
    this.rows.set(id, next);
    this.writes++;
    return true;
  }
}

describe('runLegacyHashWrap', () => {
  const service = new PasswordCryptoService();
  // Anciennes empreintes calculées par le seul point légitime du service.
  const md5 = (s: string) => service.computeLegacyDigest('md5', s);
  const sha1 = (s: string) => service.computeLegacyDigest('sha1', s);
  // Mot de passe par compte, pour vérifier la connexion après enveloppe.
  const passwords: Record<string, string> = {
    a1: 'pass-a1',
    a2: 'pass-a2',
    a3: 'test123',
    a4: 'pass-a4',
  };
  let bcryptA4: string;

  const seed = async () => {
    bcryptA4 = await service.hashPassword(passwords.a4);
    return new MemoryStore([
      ['a1', sha1(passwords.a1)],
      ['a2', md5(passwords.a2)],
      ['a3', 'imx71Hl.5FQJA'], // crypt(md5('test123'), 'im10tech7')
      ['a4', bcryptA4],
      ['a5', null],
      ['a6', 'weird-format-value'],
    ]);
  };

  it('lecture seule par défaut : comptes, aucune écriture', async () => {
    const store = await seed();
    const [r] = await runLegacyHashWrap(store, service, { apply: false }, [
      CUSTOMER,
    ]);
    expect(store.writes).toBe(0);
    expect(r.before).toEqual({
      total: 6,
      null: 1,
      bcrypt: 1,
      wrapped: 0,
      md5: 1,
      sha1: 1,
      'md5-crypt': 1,
      other: 1,
    });
    expect(r.wouldWrap).toEqual({ md5: 1, sha1: 1, 'md5-crypt': 1 });
    expect(r.skippedUnknownFormat).toBe(1);
    expect(r.after).toEqual(r.before);
  });

  it('enveloppe chaque ancienne empreinte, laisse le reste, et la connexion fonctionne', async () => {
    const store = await seed();
    const [r] = await runLegacyHashWrap(
      store,
      service,
      { apply: true, batchSize: 2 },
      [CUSTOMER],
    );
    expect(r.wrapped).toEqual({ md5: 1, sha1: 1, 'md5-crypt': 1 });
    expect(r.failed).toBe(0);
    expect(r.after).toMatchObject({
      total: 6,
      null: 1,
      bcrypt: 1,
      wrapped: 3,
      md5: 0,
      sha1: 0,
      'md5-crypt': 0,
      other: 1,
    });
    expect(store.rows.get('a4')).toBe(bcryptA4);
    expect(store.rows.get('a5')).toBeNull();
    expect(store.rows.get('a6')).toBe('weird-format-value');
    for (const id of ['a1', 'a2', 'a3']) {
      const ok = await service.validatePassword(
        passwords[id],
        store.rows.get(id)!,
      );
      expect(ok).toMatchObject({ isValid: true, format: 'wrapped' });
      const ko = await service.validatePassword('wrong', store.rows.get(id)!);
      expect(ko.isValid).toBe(false);
    }
  });

  it('est idempotent : un second passage ne réécrit rien', async () => {
    const store = await seed();
    await runLegacyHashWrap(store, service, { apply: true }, [CUSTOMER]);
    const snapshot = new Map(store.rows);
    const writes = store.writes;
    const [r] = await runLegacyHashWrap(store, service, { apply: true }, [
      CUSTOMER,
    ]);
    expect(store.writes).toBe(writes);
    expect(store.rows).toEqual(snapshot);
    expect(r.wrapped).toEqual({ md5: 0, sha1: 0, 'md5-crypt': 0 });
    expect(r.scanned).toBe(1); // seule la valeur de format inconnu est relue
  });

  it('reprend après un passage borné', async () => {
    const store = await seed();
    const [first] = await runLegacyHashWrap(
      store,
      service,
      { apply: true, batchSize: 1, maxRowsPerTarget: 1 },
      [CUSTOMER],
    );
    expect(store.writes).toBe(1);
    expect(first.after?.wrapped).toBe(1);
    const [second] = await runLegacyHashWrap(store, service, { apply: true }, [
      CUSTOMER,
    ]);
    expect(store.writes).toBe(3);
    expect(second.after).toMatchObject({ wrapped: 3, md5: 0, sha1: 0 });
  });

  it('laisse intacte une ligne convertie par une connexion pendant le passage', async () => {
    const store = await seed();
    const upgradedByLogin = await service.hashPassword(passwords.a1);
    store.beforeReplace = (id) => {
      if (id === 'a1') store.rows.set('a1', upgradedByLogin);
    };
    const [r] = await runLegacyHashWrap(store, service, { apply: true }, [
      CUSTOMER,
    ]);
    expect(store.rows.get('a1')).toBe(upgradedByLogin);
    expect(r.skippedChangedConcurrently).toBe(1);
    expect(r.wrapped.sha1).toBe(0);
    expect(r.after).toMatchObject({ bcrypt: 2, wrapped: 2, sha1: 0 });
  });

  it('compte un échec d’écriture sans perdre la valeur ni arrêter le passage', async () => {
    const store = await seed();
    const original = store.replaceIfUnchanged.bind(store);
    store.replaceIfUnchanged = async (t, id, e, n) => {
      if (id === 'a2') throw new Error('network');
      return original(t, id, e, n);
    };
    const [r] = await runLegacyHashWrap(store, service, { apply: true }, [
      CUSTOMER,
    ]);
    expect(r.failed).toBe(1);
    expect(r.failedIds).toEqual(['a2']);
    expect(store.rows.get('a2')).toBe(md5(passwords.a2));
    expect(r.wrapped).toEqual({ md5: 0, sha1: 1, 'md5-crypt': 1 });
  });
});

describe('garde du script', () => {
  it('n’écrit qu’avec PASSWORD_WRAP_CONFIRM=APPLY exactement', () => {
    expect(isWrapApplyConfirmed({})).toBe(false);
    expect(isWrapApplyConfirmed({ PASSWORD_WRAP_CONFIRM: 'true' })).toBe(false);
    expect(isWrapApplyConfirmed({ PASSWORD_WRAP_CONFIRM: 'apply' })).toBe(
      false,
    );
    expect(isWrapApplyConfirmed({ PASSWORD_WRAP_CONFIRM: 'APPLY' })).toBe(true);
  });

  it('borne optionnelle par table', () => {
    expect(parseMaxRows({})).toBeUndefined();
    expect(parseMaxRows({ PASSWORD_WRAP_MAX_ROWS: '100' })).toBe(100);
    expect(() => parseMaxRows({ PASSWORD_WRAP_MAX_ROWS: '0' })).toThrow();
    expect(() => parseMaxRows({ PASSWORD_WRAP_MAX_ROWS: 'abc' })).toThrow();
  });
});
