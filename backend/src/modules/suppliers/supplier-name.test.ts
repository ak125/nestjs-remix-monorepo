import {
  findSupplierDuplicates,
  normalizeSupplierKey,
  slugifySupplierAlias,
  supplierNameKeys,
  type SupplierNameEntry,
} from './supplier-name';

// Noms réels relevés au mandat CD (modele-fiche.md §c), ids réels.
const EXISTING: SupplierNameEntry[] = [
  { splId: '26', name: 'DISTRICASH (DCA)', alias: 'districash-dca' },
  { splId: '35', name: 'JACKOPARTS', alias: 'jackoparts' },
  { splId: '56', name: 'RCA', alias: 'rca' },
  { splId: '71', name: 'DCA', alias: 'dca' },
  { splId: '80', name: 'Herth+Buss', alias: 'herth-buss' },
];

describe('normalizeSupplierKey', () => {
  it('retire accents, casse et ponctuation', () => {
    expect(normalizeSupplierKey('Équipement Auto-Pièces')).toBe(
      'EQUIPEMENTAUTOPIECES',
    );
    expect(normalizeSupplierKey('Herth+Buss')).toBe('HERTHBUSS');
    expect(normalizeSupplierKey('Meat & Doria')).toBe('MEATDORIA');
  });
});

describe('supplierNameKeys', () => {
  it('donne nom entier, nom sans parenthèse, parenthèse et alias', () => {
    expect([...supplierNameKeys('DISTRICASH (DCA)', 'districash-dca')]).toEqual(
      ['DISTRICASHDCA', 'DISTRICASH', 'DCA'],
    );
  });

  it('ignore les valeurs vides', () => {
    expect(supplierNameKeys(null, '  ').size).toBe(0);
  });
});

describe('findSupplierDuplicates', () => {
  it('DCA est un doublon exact de 26 DISTRICASH (DCA) et de 71 DCA', () => {
    const m = findSupplierDuplicates('DCA', null, EXISTING);
    expect(m.filter((x) => x.kind === 'exact').map((x) => x.splId)).toEqual([
      '26',
      '71',
    ]);
  });

  it('JAKOPARTS est un voisin (une lettre) de 35 JACKOPARTS, non bloquant', () => {
    const m = findSupplierDuplicates('JAKOPARTS', null, EXISTING);
    expect(m).toEqual([
      { splId: '35', name: 'JACKOPARTS', kind: 'voisin', key: 'JAKOPARTS' },
    ]);
  });

  it('RCA France est un voisin (préfixe) de 56 RCA', () => {
    const m = findSupplierDuplicates('RCA France', null, EXISTING);
    expect(m.map((x) => [x.splId, x.kind])).toEqual([['56', 'voisin']]);
  });

  it('la ponctuation ne masque pas un doublon (Herth Buss)', () => {
    const m = findSupplierDuplicates('HERTH BUSS', null, EXISTING);
    expect(m.map((x) => [x.splId, x.kind])).toEqual([['80', 'exact']]);
  });

  it('exclut le fournisseur lui-même lors d’une mise à jour', () => {
    expect(findSupplierDuplicates('JACKOPARTS', null, EXISTING, '35')).toEqual(
      [],
    );
  });

  it('un nom sans rapport ne remonte rien', () => {
    expect(findSupplierDuplicates('BOSCH', 'bosch', EXISTING)).toEqual([]);
  });

  it('un exact passe devant les voisins', () => {
    const m = findSupplierDuplicates('RCA', null, [
      { splId: '90', name: 'RCA Pro', alias: null },
      { splId: '56', name: 'RCA', alias: null },
    ]);
    expect(m.map((x) => x.kind)).toEqual(['exact', 'voisin']);
  });
});

describe('slugifySupplierAlias', () => {
  it('suit la forme des alias existants', () => {
    expect(slugifySupplierAlias('DISTRICASH (DCA)')).toBe('districash-dca');
    expect(slugifySupplierAlias('Équipement  Pièces ')).toBe(
      'equipement-pieces',
    );
  });
});
