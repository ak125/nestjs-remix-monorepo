/**
 * Mandat BM — calcul de la facture et rendu PDF (fonctions pures).
 *
 * Verrouille : montants réels (lignes, consigne, port), réduction en ligne
 * négative avec son motif, supplément payé avec son motif, refus d'une
 * commande dont les montants ne sont pas ceux de ses lignes, HT dérivé du
 * TTC au taux DEFAULT_TVA_RATE ; PDF valide (en-tête, table xref exacte),
 * identité vendeur identique au pied de facture publié.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BillingCalcError,
  buildInvoiceDraft,
  expectedCaptureCents,
  htFromTtc,
  textFromCents,
  type BillingLineRow,
  type BillingOrderRow,
  paymentVoidOf,
} from '../../src/modules/orders/services/order-billing.calc';
import {
  SELLER_IDENTITY_LINES,
  pdfString,
  renderInvoicePdf,
} from '../../src/modules/orders/services/invoice-pdf';

const order: BillingOrderRow = {
  ord_id: 'ORD-1',
  ord_cst_id: '81500',
  ord_cba_id: '10',
  ord_cda_id: '11',
  ord_amount_ttc: '100.00',
  ord_deposit_ttc: '20.00',
  ord_shipping_fee_ttc: '9.90',
  ord_total_ttc: '129.90',
};
const lines: BillingLineRow[] = [
  {
    orl_id: 'ORD-1-L001',
    orl_pg_id: '402',
    orl_pg_name: 'Plaquettes de frein',
    orl_pm_name: 'BOSCH',
    orl_art_ref: '0 986 494 001',
    orl_art_quantity: '2',
    orl_art_price_sell_unit_ttc: '30.00',
    orl_art_price_sell_ttc: '60.00',
    orl_art_deposit_unit_ttc: '0',
    orl_art_deposit_ttc: '',
  },
  {
    orl_id: 'ORD-1-L002',
    orl_pg_name: 'Étrier',
    orl_pm_name: 'TRW',
    orl_art_ref: 'BHN123',
    orl_art_quantity: '1',
    orl_art_price_sell_unit_ttc: '40',
    orl_art_price_sell_ttc: '40.00',
    orl_art_deposit_unit_ttc: '20.00',
    orl_art_deposit_ttc: '20.00',
  },
];

describe('order-billing.calc', () => {
  it('HT dérivé du TTC au taux en vigueur, signe conservé', () => {
    expect(htFromTtc(12000)).toBe(10000);
    expect(htFromTtc(990)).toBe(825);
    expect(htFromTtc(-1200)).toBe(-1000);
    expect(textFromCents(-500)).toBe('-5.00');
  });

  it('montant à encaisser = total − réductions (le supplément est encaissé à part)', () => {
    expect(
      expectedCaptureCents(order, [
        { opa_kind: 'reduction', opa_amount_ttc_cents: 1500, opa_reason: 'x' },
        { opa_kind: 'supplement', opa_amount_ttc_cents: 999, opa_reason: 'y' },
      ]),
    ).toBe(12990 - 1500);
  });

  it('facture sans ajustement : montants réels de la commande', () => {
    const d = buildInvoiceDraft({
      order,
      lines,
      adjustments: [],
      paidSupplements: [],
      capturedCents: 12990,
    });
    expect(d.invoice).toMatchObject({
      inv_ord_id: 'ORD-1',
      inv_cst_id: '81500',
      inv_amount_ttc: '100.00',
      inv_amount_ht: '83.33',
      inv_deposit_ttc: '20.00',
      inv_deposit_ht: '16.67',
      inv_shipping_fee_ttc: '9.90',
      inv_shipping_fee_ht: '8.25',
      inv_total_ttc: '129.90',
      inv_total_ht: '108.25',
      inv_tva: '21.65',
    });
    expect(d.invoice.inv_info).toContain('129,90 € TTC');
    expect(d.invoice.inv_info).toContain('Aucun ajustement');
    expect(d.lines).toHaveLength(2);
    expect(d.lines[1]).toMatchObject({
      invl_art_price_sell_unit_ttc: '40.00',
      invl_art_deposit_ttc: '20.00',
    });
  });

  it('réduction : ligne négative avec motif, total réduit, motif dans les mentions', () => {
    const d = buildInvoiceDraft({
      order,
      lines,
      adjustments: [
        {
          opa_kind: 'reduction',
          opa_amount_ttc_cents: 1500,
          opa_reason: 'Pièce équivalente moins chère',
        },
      ],
      paidSupplements: [],
      capturedCents: 11490,
    });
    const last = d.lines[d.lines.length - 1];
    expect(last.invl_pg_name).toBe('Réduction : Pièce équivalente moins chère');
    expect(last.invl_art_price_sell_ttc).toBe('-15.00');
    expect(d.invoice.inv_total_ttc).toBe('114.90');
    expect(d.expectedCaptureCents).toBe(11490);
    expect(d.invoice.inv_info).toContain(
      'réduction 15,00 € TTC — Pièce équivalente moins chère',
    );
  });

  it('supplément payé : ses lignes portent le motif, le total l’inclut', () => {
    const d = buildInvoiceDraft({
      order,
      lines,
      adjustments: [
        {
          opa_kind: 'supplement',
          opa_amount_ttc_cents: 1250,
          opa_reason: 'Référence plus chère',
          opa_supplement_ord_id: 'ORD-2',
        },
      ],
      paidSupplements: [
        {
          order: { ...order, ord_id: 'ORD-2', ord_total_ttc: '12.50' },
          lines: [
            {
              orl_id: 'ORD-2-L001',
              orl_pg_name: 'Supplément : Référence plus chère',
              orl_art_quantity: '1',
              orl_art_price_sell_unit_ttc: '12.50',
              orl_art_price_sell_ttc: '12.50',
            },
          ],
        },
      ],
      capturedCents: 12990,
    });
    expect(d.lines[2].invl_pg_name).toBe(
      'Supplément (commande ORD-2) : Référence plus chère',
    );
    expect(d.invoice.inv_total_ttc).toBe('142.40');
    expect(d.expectedCaptureCents).toBe(12990);
    expect(d.invoice.inv_info).toContain(
      'supplément 12,50 € TTC (commande ORD-2)',
    );
  });

  it.each([
    ['sans ligne', { lines: [] as BillingLineRow[] }],
    ['total ≠ lignes + port', { order: { ...order, ord_total_ttc: '130.00' } }],
    ['pièces ≠ lignes', { order: { ...order, ord_amount_ttc: '99.00' } }],
    [
      'montant illisible',
      { lines: [{ ...lines[0], orl_art_price_sell_ttc: '60,00' }] },
    ],
  ])('refuse : %s', (_l, patch) => {
    expect(() =>
      buildInvoiceDraft({
        order,
        lines,
        adjustments: [],
        paidSupplements: [],
        capturedCents: 12990,
        ...patch,
      }),
    ).toThrow(BillingCalcError);
  });

  it('refuse un total facturé nul', () => {
    expect(() =>
      buildInvoiceDraft({
        order: {
          ...order,
          ord_amount_ttc: '10.00',
          ord_deposit_ttc: '0',
          ord_shipping_fee_ttc: '0',
          ord_total_ttc: '10.00',
        },
        lines: [
          {
            orl_id: 'L',
            orl_art_quantity: '1',
            orl_art_price_sell_unit_ttc: '10',
            orl_art_price_sell_ttc: '10',
          },
        ],
        adjustments: [
          {
            opa_kind: 'reduction',
            opa_amount_ttc_cents: 1000,
            opa_reason: 'x',
          },
        ],
        paidSupplements: [],
        capturedCents: 0,
      }),
    ).toThrow(BillingCalcError);
  });
});

describe('invoice-pdf', () => {
  const draft = buildInvoiceDraft({
    order,
    lines,
    adjustments: [
      {
        opa_kind: 'reduction',
        opa_amount_ttc_cents: 1500,
        opa_reason: 'Geste (commercial)',
      },
    ],
    paidSupplements: [],
    capturedCents: 11490,
  });
  const pdf = renderInvoicePdf({
    invoiceNumber: 'F2026-000001',
    invoiceDate: '2026-11-17 18:00:00',
    orderId: 'ORD-1',
    orderDate: '2026-11-10T09:00:00Z',
    shippedAt: '2026-11-17T17:00:00Z',
    paidAt: '2026-11-10T09:05:00Z',
    buyerLines: ['Léa Dupont', '1 rue de l’Église', '75001 Paris', 'France'],
    lines: draft.lines,
    totals: {
      amountHt: draft.invoice.inv_amount_ht,
      depositHt: draft.invoice.inv_deposit_ht,
      shippingHt: draft.invoice.inv_shipping_fee_ht,
      totalHt: draft.invoice.inv_total_ht,
      tva: draft.invoice.inv_tva,
      totalTtc: draft.invoice.inv_total_ttc,
      depositTtc: draft.invoice.inv_deposit_ttc,
      shippingTtc: draft.invoice.inv_shipping_fee_ttc,
    },
    info: draft.invoice.inv_info,
  });
  const text = pdf.toString('latin1');

  it('est un PDF 1.4 terminé par %%EOF', () => {
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('table xref : chaque décalage pointe sur « n 0 obj »', () => {
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = text
      .slice(startxref)
      .split('\n')
      .filter((l) => / 00000 n $/.test(l))
      .map((l) => Number(l.slice(0, 10)));
    expect(entries.length).toBeGreaterThan(4);
    entries.forEach((offset, i) => {
      expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(
        `${i + 1} 0 obj`,
      );
    });
  });

  it('contient numéro, totaux, motif d’ajustement et identité vendeur', () => {
    expect(text).toContain(pdfString('FACTURE N° F2026-000001'));
    expect(text).toContain(pdfString('Réduction : Geste (commercial)'));
    expect(text).toContain(pdfString('114,90 €'));
    expect(text).toContain(pdfString('TVA 20 %'));
    for (const l of SELLER_IDENTITY_LINES) expect(text).toContain(pdfString(l));
  });

  it('encode €, apostrophe typographique et parenthèses', () => {
    expect(pdfString('€')).toBe('\x80');
    expect(pdfString('l’É')).toBe('l\x92\xc9');
    expect(pdfString('a(b)c\\')).toBe('a\\(b\\)c\\\\');
    expect(pdfString('日')).toBe('?');
  });

  it('identité vendeur = pied de facture publié (frontend)', () => {
    const tsx = readFileSync(
      join(
        __dirname,
        '../../../frontend/app/routes/account_.orders.$orderId.invoice.tsx',
      ),
      'utf8',
    );
    for (const l of SELLER_IDENTITY_LINES) expect(tsx).toContain(l);
  });

  it('pagine une longue facture sans perdre de ligne', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      ...draft.lines[0],
      invl_art_ref: `REF${i}`,
    }));
    const long = renderInvoicePdf({
      ...{
        invoiceNumber: 'F2026-000002',
        invoiceDate: '2026-11-17',
        orderId: 'ORD-1',
        orderDate: null,
        shippedAt: null,
        paidAt: null,
        buyerLines: [],
        info: '',
      },
      lines: many,
      totals: {
        amountHt: '0.00',
        depositHt: '0.00',
        shippingHt: '0.00',
        totalHt: '0.00',
        tva: '0.00',
        totalTtc: '0.00',
        depositTtc: '0.00',
        shippingTtc: '0.00',
      },
    }).toString('latin1');
    expect(Number(/\/Count (\d+)/.exec(long)![1])).toBeGreaterThan(1);
    expect(long).toContain('(REF0)');
    expect(long).toContain('(REF79)');
  });
});

// Complément BM n° 2 (2026-11-18) : paiement annulé ou remboursé dans Paybox.
describe('paymentVoidOf', () => {
  it.each([
    [null],
    [undefined],
    [{ ocs_state: 'authorized' }],
    [{ ocs_state: 'captured' }],
  ])('aucune marque : %p', (row) => {
    expect(paymentVoidOf(row)).toBeNull();
  });

  it.each([
    ['cancelled', 'Paiement annulé'],
    ['refunded', 'Remboursée — ne pas expédier'],
  ])('%s ⇒ « %s », relevé et source rendus', (state, label) => {
    expect(
      paymentVoidOf({
        ocs_state: state,
        ocs_checked_at: '2026-11-18T12:00:00Z',
        ocs_source: 'manual',
      }),
    ).toEqual({
      state,
      label,
      checkedAt: '2026-11-18T12:00:00Z',
      source: 'manual',
    });
  });
});
