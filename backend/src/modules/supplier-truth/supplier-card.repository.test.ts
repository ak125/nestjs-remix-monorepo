import {
  SUPPLIER_CARD_COLUMNS,
  SupplierCardRepository,
  SupplierIdConflictError,
} from './supplier-card.repository';

type Result = { data: unknown; error: unknown };
type Call = { table: string; ops: [string, ...unknown[]][] };

/** Client Supabase simulé : enregistre la chaîne d'appels, résout par table. */
function fakeClient(results: Record<string, Result>) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const builder: Record<string, unknown> = {};
    for (const op of [
      'select',
      'eq',
      'in',
      'order',
      'limit',
      'update',
      'insert',
      'delete',
      'maybeSingle',
    ]) {
      builder[op] = (...args: unknown[]) => {
        call.ops.push([op, ...args]);
        return builder;
      };
    }
    builder.then = (
      resolve: (r: Result) => unknown,
      reject: (e: unknown) => unknown,
    ) =>
      Promise.resolve(results[table] ?? { data: null, error: null }).then(
        resolve,
        reject,
      );
    return builder;
  };
  return { client: { from }, calls };
}

function repoWith(results: Record<string, Result>) {
  const { client, calls } = fakeClient(results);
  const repo = Object.create(
    SupplierCardRepository.prototype,
  ) as SupplierCardRepository;
  Object.defineProperty(repo, 'supabase', { value: client });
  return { repo, calls };
}

const op = (call: Call, name: string) => call.ops.find((o) => o[0] === name);

describe('SupplierCardRepository.archive (deactivateSupplier corrigé)', () => {
  it("écrit spl_status='archive' et spl_display='0', sans DELETE", async () => {
    const { repo, calls } = repoWith({
      ___xtr_supplier: { data: [{ spl_id: '71' }], error: null },
    });
    await expect(repo.archive('71', 'u-admin')).resolves.toBe(true);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.table).toBe('___xtr_supplier');
    expect(op(call, 'update')?.[1]).toMatchObject({
      spl_status: 'archive',
      spl_display: '0',
      spl_updated_by: 'u-admin',
    });
    expect(op(call, 'eq')).toEqual(['eq', 'spl_id', '71']);
    expect(op(call, 'delete')).toBeUndefined();
    // Liens marque et profils de prix non touchés.
    expect(calls.map((c) => c.table)).toEqual(['___xtr_supplier']);
  });

  it('false si aucune ligne', async () => {
    const { repo } = repoWith({ ___xtr_supplier: { data: [], error: null } });
    await expect(repo.archive('999', 'u-admin')).resolves.toBe(false);
  });
});

describe('SupplierCardRepository.getCard', () => {
  it('lit des colonnes explicites (pas de *)', async () => {
    const { repo, calls } = repoWith({
      ___xtr_supplier: { data: { spl_id: '71' }, error: null },
    });
    await repo.getCard('71');
    const selected = String(op(calls[0], 'select')?.[1]);
    expect(selected).not.toContain('*');
    expect(selected.split(', ')).toEqual([...SUPPLIER_CARD_COLUMNS]);
  });

  it('propage une erreur au lieu de renvoyer une fiche vide', async () => {
    const { repo } = repoWith({
      ___xtr_supplier: { data: null, error: { message: 'boom' } },
    });
    await expect(repo.getCard('71')).rejects.toThrow('getCard failed: boom');
  });
});

describe('SupplierCardRepository.insertCard', () => {
  it('statut a_confirmer et accès non_configure imposés', async () => {
    const { repo, calls } = repoWith({});
    await repo.insertCard(
      '72',
      { spl_name: 'X', spl_status: 'actif' },
      'u-admin',
    );
    expect(op(calls[0], 'insert')?.[1]).toMatchObject({
      spl_id: '72',
      spl_name: 'X',
      spl_status: 'a_confirmer',
      spl_access_state: 'non_configure',
      spl_updated_by: 'u-admin',
    });
  });

  it('23505 → SupplierIdConflictError', async () => {
    const { repo } = repoWith({
      ___xtr_supplier: { data: null, error: { code: '23505', message: 'dup' } },
    });
    await expect(repo.insertCard('72', {}, 'u')).rejects.toBeInstanceOf(
      SupplierIdConflictError,
    );
  });
});

describe('SupplierCardRepository.updateCard', () => {
  it('efface les deux champs de validation quand demandé', async () => {
    const { repo, calls } = repoWith({
      ___xtr_supplier: { data: [{ spl_id: '71' }], error: null },
    });
    await repo.updateCard('71', { spl_city: 'Lyon' }, 'u', true);
    expect(op(calls[0], 'update')?.[1]).toMatchObject({
      spl_city: 'Lyon',
      spl_location_validated_at: null,
      spl_location_validated_by: null,
    });
  });

  it('laisse la validation sinon', async () => {
    const { repo, calls } = repoWith({
      ___xtr_supplier: { data: [{ spl_id: '71' }], error: null },
    });
    await repo.updateCard('71', { spl_phone: null }, 'u', false);
    expect(op(calls[0], 'update')?.[1]).not.toHaveProperty(
      'spl_location_validated_by',
    );
  });
});

describe('SupplierCardRepository.listIdentities', () => {
  it('échoue au plafond de 1000 lignes (contrôle de doublon incomplet)', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      spl_id: String(i),
      spl_name: `S${i}`,
      spl_alias: null,
    }));
    const { repo } = repoWith({ ___xtr_supplier: { data: rows, error: null } });
    await expect(repo.listIdentities()).rejects.toThrow('cap reached');
  });
});

describe('SupplierCardRepository.getLinkedBrands', () => {
  it('joint les noms pieces_marque, garde les liens retirés, lit rang et livraison (DQ)', async () => {
    const { repo, calls } = repoWith({
      ___xtr_supplier_link_pm: {
        data: [
          {
            slpm_id: '1',
            slpm_pm_id: '20',
            slpm_display: '1',
            slpm_rank: '2',
            slpm_delivery_spl_id: '21',
          },
          {
            slpm_id: '2',
            slpm_pm_id: '10',
            slpm_display: '0',
            slpm_rank: null,
            slpm_delivery_spl_id: null,
          },
        ],
        error: null,
      },
      pieces_marque: {
        data: [
          { pm_id: 10, pm_name: 'BOSCH' },
          { pm_id: 20, pm_name: 'VALEO' },
        ],
        error: null,
      },
    });
    await expect(repo.getLinkedBrands('71')).resolves.toEqual([
      {
        linkId: '2',
        pmId: 10,
        brandName: 'BOSCH',
        linkDisplayed: false,
        sourceRank: null,
        deliverySplId: null,
      },
      {
        linkId: '1',
        pmId: 20,
        brandName: 'VALEO',
        linkDisplayed: true,
        sourceRank: 2,
        deliverySplId: '21',
      },
    ]);
    expect(op(calls[1], 'in')).toEqual(['in', 'pm_id', [20, 10]]);
  });
});
