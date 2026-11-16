import { estVendable, type EntreeVendabilite } from './vendable';

/** Décision 51 : pri_dispo '1', ni FROZEN ni masquée, prix strictement positif. */
const base: EntreeVendabilite = {
  dispo: '1',
  etatTarif: 'ACTIVE',
  venteTtc: 12.5,
  pieceAffichee: true,
};

describe('estVendable — définition unique (décision 51)', () => {
  it('vend une ligne dispo 1, active, affichée, au prix positif', () => {
    expect(estVendable(base)).toBe(true);
  });

  it.each(['0', '2', '3', null, undefined, ''])(
    'ne vend pas pri_dispo %p',
    (dispo) => {
      expect(estVendable({ ...base, dispo })).toBe(false);
    },
  );

  it('ne vend pas une ligne gelée', () => {
    expect(estVendable({ ...base, etatTarif: 'FROZEN' })).toBe(false);
  });

  it('vend une ligne MANUAL_OVERRIDE ou sans état (aligné sur la RPC servie)', () => {
    expect(estVendable({ ...base, etatTarif: 'MANUAL_OVERRIDE' })).toBe(true);
    expect(estVendable({ ...base, etatTarif: null })).toBe(true);
  });

  it.each([false, null, undefined])(
    'ne vend pas une pièce dont piece_display vaut %p',
    (pieceAffichee) => {
      expect(estVendable({ ...base, pieceAffichee })).toBe(false);
    },
  );

  it.each([0, -1, null, undefined, '', 'abc', Number.NaN])(
    'ne vend pas au prix %p',
    (venteTtc) => {
      expect(estVendable({ ...base, venteTtc })).toBe(false);
    },
  );

  it('accepte un prix numérique transmis en texte', () => {
    expect(estVendable({ ...base, venteTtc: '9.90' })).toBe(true);
  });
});
