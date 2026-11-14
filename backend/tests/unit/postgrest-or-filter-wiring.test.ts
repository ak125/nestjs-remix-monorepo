/**
 * Recherches publiques : le texte saisi reste une seule valeur dans le
 * filtre `.or()` envoyé à PostgREST.
 *
 * Avant correction, `frein,plaquette` coupait la condition en deux
 * (« failed to parse logic tree ») et `frein)` la fermait. Le client de base
 * est remplacé par un enregistreur ; le filtre reçu est relu avec les règles
 * de PostgREST (une valeur non citée s'arrête à `,` ou `)`, une valeur citée
 * au premier `"` non échappé, où `\x` vaut `x`).
 */
import { CatalogService } from '../../src/modules/catalog/catalog.service';
import { ProductsService } from '../../src/modules/products/products.service';

interface Condition {
  column: string;
  operator: string;
  value: string;
}

/** Découpe un filtre `.or()` en conditions, comme PostgREST le lit. */
function parseOrFilter(filter: string): Condition[] {
  const conditions: Condition[] = [];
  let i = 0;
  while (i < filter.length) {
    const head = /^([a-z_.]+)\.(eq|ilike)\./.exec(filter.slice(i));
    if (!head) throw new Error(`condition illisible à ${i} : ${filter}`);
    i += head[0].length;
    let value = '';
    if (filter[i] === '"') {
      i += 1;
      while (i < filter.length && filter[i] !== '"') {
        if (filter[i] === '\\') i += 1;
        value += filter[i];
        i += 1;
      }
      i += 1;
    } else {
      while (i < filter.length && filter[i] !== ',' && filter[i] !== ')') {
        value += filter[i];
        i += 1;
      }
    }
    conditions.push({ column: head[1], operator: head[2], value });
    if (i < filter.length) {
      if (filter[i] !== ',') throw new Error(`reste illisible : ${filter}`);
      i += 1;
    }
  }
  return conditions;
}

function recorder() {
  const filters: string[] = [];
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'then') {
          return (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(resolve);
        }
        if (property === 'single') {
          return () => Promise.resolve({ data: null, error: null });
        }
        if (property === 'or') {
          return (filter: string) => {
            filters.push(filter);
            return builder;
          };
        }
        return () => builder;
      },
    },
  );
  return { supabase: { from: () => builder }, filters };
}

function withClient<T extends object>(prototype: T) {
  const { supabase, filters } = recorder();
  const service = Object.create(prototype);
  Object.assign(service, {
    supabase,
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
  });
  return { service, filters };
}

const SEARCHES = ['frein,plaquette', 'frein)', 'a),piece_id.gt.0,(b', '50%_x'];

describe('CatalogService.searchPieces', () => {
  it.each(SEARCHES)('%p reste une seule valeur par colonne', async (q) => {
    const { service, filters } = withClient(CatalogService.prototype);
    await (service as CatalogService).searchPieces(q);

    expect(filters).toHaveLength(1);
    const literal = q.replace(/[\\%_]/g, '\\$&');
    expect(parseOrFilter(filters[0])).toEqual(
      ['piece_ref', 'piece_name', 'piece_des'].map((column) => ({
        column,
        operator: 'ilike',
        value: `%${literal}%`,
      })),
    );
  });
});

describe('ProductsService', () => {
  it.each(SEARCHES)(
    'searchProducts(%p) : une valeur par colonne',
    async (q) => {
      const { service, filters } = withClient(ProductsService.prototype);
      await (service as ProductsService).searchProducts(q);

      const literal = q.replace(/[\\%_]/g, '\\$&');
      expect(parseOrFilter(filters[0])).toEqual(
        ['piece_name', 'piece_ref'].map((column) => ({
          column,
          operator: 'ilike',
          value: `%${literal}%`,
        })),
      );
    },
  );

  it.each(['REF,1', 'REF)', 'x),piece_id.gt.(0'])(
    'findBySku(%p) compare la référence entière',
    async (sku) => {
      const { service, filters } = withClient(ProductsService.prototype);
      await (service as ProductsService).findBySku(sku);

      expect(parseOrFilter(filters[0])).toEqual(
        ['piece_ref', 'piece_ref_brut'].map((column) => ({
          column,
          operator: 'eq',
          value: sku,
        })),
      );
    },
  );
});
