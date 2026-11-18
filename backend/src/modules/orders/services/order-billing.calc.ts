/**
 * Mandat BM — calcul pur de la facture d'une commande (aucune E/S).
 *
 * Montants en centimes entiers ; la base stocke du texte « 12.34 ».
 * Les commandes récentes n'ont que des montants TTC (HT et TVA vides en base,
 * mesuré le 2026-11-17) : le HT est dérivé du TTC au taux `DEFAULT_TVA_RATE`,
 * l'autorité tarifaire existante (aucun taux inventé ici). La TVA de chaque
 * bloc (pièces, consigne, port, ajustements) = TTC − HT arrondi au centime.
 * Ce mode d'arrondi et la TVA sur la consigne sont des questions ouvertes pour
 * le comptable (docs/facturation/mentions-facture-a-valider.md).
 */
import { DEFAULT_TVA_RATE } from '../../pricing';
import { centimesDuTexte, texteDesCentimes } from './orders.service';

/** Lecture « 12.3 » → 1230 (vide → 0, illisible → null) : helper existant. */
const centsFromText = centimesDuTexte;

/** 1230 → « 12.30 », -500 → « -5.00 » (lignes de réduction). */
export function textFromCents(cents: number): string {
  return cents < 0 ? `-${texteDesCentimes(-cents)}` : texteDesCentimes(cents);
}

/** HT dérivé d'un TTC en centimes, arrondi au centime. */
export function htFromTtc(ttcCents: number, rate = DEFAULT_TVA_RATE): number {
  const ht = Math.round(Math.abs(ttcCents) / (1 + rate));
  return ttcCents < 0 ? -ht : ht;
}

export interface BillingOrderRow {
  ord_id: string;
  ord_cst_id: string;
  ord_cba_id?: string | null;
  ord_cda_id?: string | null;
  ord_amount_ttc: string | null;
  ord_deposit_ttc: string | null;
  ord_shipping_fee_ttc: string | null;
  ord_total_ttc: string | null;
}

export interface BillingLineRow {
  orl_id: string;
  orl_pg_id?: string | null;
  orl_pg_name?: string | null;
  orl_pm_name?: string | null;
  orl_art_ref?: string | null;
  orl_art_quantity?: string | null;
  orl_art_price_sell_unit_ttc?: string | null;
  orl_art_price_sell_ttc?: string | null;
  orl_art_deposit_unit_ttc?: string | null;
  orl_art_deposit_ttc?: string | null;
}

export interface BillingAdjustmentRow {
  opa_kind: 'reduction' | 'supplement';
  opa_amount_ttc_cents: number;
  opa_reason: string;
  opa_supplement_ord_id?: string | null;
}

/** Commande de supplément payée (enfant `ord_parent`) et ses lignes. */
export interface PaidSupplement {
  order: BillingOrderRow;
  lines: BillingLineRow[];
}

export interface InvoiceLineDraft {
  invl_pg_id: string | null;
  invl_pg_name: string;
  invl_pm_name: string | null;
  invl_art_ref: string | null;
  invl_art_quantity: string;
  invl_art_price_sell_unit_ht: string;
  invl_art_price_sell_unit_ttc: string;
  invl_art_price_sell_ht: string;
  invl_art_price_sell_ttc: string;
  invl_art_deposit_unit_ht: string;
  invl_art_deposit_unit_ttc: string;
  invl_art_deposit_ht: string;
  invl_art_deposit_ttc: string;
}

export interface InvoiceDraft {
  invoice: {
    inv_ord_id: string;
    inv_cst_id: string;
    inv_cba_id: string | null;
    inv_cda_id: string | null;
    inv_amount_ht: string;
    inv_amount_ttc: string;
    inv_deposit_ht: string;
    inv_deposit_ttc: string;
    inv_shipping_fee_ht: string;
    inv_shipping_fee_ttc: string;
    inv_total_ht: string;
    inv_total_ttc: string;
    inv_tva: string;
    inv_info: string;
  };
  lines: InvoiceLineDraft[];
  /** Montant TTC attendu à l'encaissement de la commande d'origine. */
  expectedCaptureCents: number;
  totalTtcCents: number;
}

export class BillingCalcError extends Error {}

function cents(value: unknown, where: string): number {
  const c = centsFromText(value);
  if (c === null) {
    throw new BillingCalcError(`Montant illisible (${where}) : « ${value} »`);
  }
  return c;
}

function euro(c: number): string {
  return `${textFromCents(c).replace('.', ',')} €`;
}

/** Montant TTC encaissable sur la commande d'origine après réductions. */
export function expectedCaptureCents(
  order: BillingOrderRow,
  adjustments: BillingAdjustmentRow[],
): number {
  const total = cents(order.ord_total_ttc, `total ${order.ord_id}`);
  const reductions = adjustments
    .filter((a) => a.opa_kind === 'reduction')
    .reduce((s, a) => s + a.opa_amount_ttc_cents, 0);
  return total - reductions;
}

function lineDraft(line: BillingLineRow, label?: string): InvoiceLineDraft {
  const qty = Number(line.orl_art_quantity ?? '1');
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new BillingCalcError(`Quantité illisible (ligne ${line.orl_id})`);
  }
  const unitTtc = cents(line.orl_art_price_sell_unit_ttc, line.orl_id);
  const totalTtc = cents(line.orl_art_price_sell_ttc, line.orl_id);
  const depUnitTtc = cents(line.orl_art_deposit_unit_ttc, line.orl_id);
  const depTtc = cents(line.orl_art_deposit_ttc, line.orl_id);
  return {
    invl_pg_id: line.orl_pg_id ?? null,
    invl_pg_name: label ?? line.orl_pg_name ?? '',
    invl_pm_name: line.orl_pm_name ?? null,
    invl_art_ref: line.orl_art_ref ?? null,
    invl_art_quantity: String(qty),
    invl_art_price_sell_unit_ht: textFromCents(htFromTtc(unitTtc)),
    invl_art_price_sell_unit_ttc: textFromCents(unitTtc),
    invl_art_price_sell_ht: textFromCents(htFromTtc(totalTtc)),
    invl_art_price_sell_ttc: textFromCents(totalTtc),
    invl_art_deposit_unit_ht: textFromCents(htFromTtc(depUnitTtc)),
    invl_art_deposit_unit_ttc: textFromCents(depUnitTtc),
    invl_art_deposit_ht: textFromCents(htFromTtc(depTtc)),
    invl_art_deposit_ttc: textFromCents(depTtc),
  };
}

function adjustmentLine(label: string, ttc: number): InvoiceLineDraft {
  return {
    invl_pg_id: null,
    invl_pg_name: label,
    invl_pm_name: null,
    invl_art_ref: null,
    invl_art_quantity: '1',
    invl_art_price_sell_unit_ht: textFromCents(htFromTtc(ttc)),
    invl_art_price_sell_unit_ttc: textFromCents(ttc),
    invl_art_price_sell_ht: textFromCents(htFromTtc(ttc)),
    invl_art_price_sell_ttc: textFromCents(ttc),
    invl_art_deposit_unit_ht: '0.00',
    invl_art_deposit_unit_ttc: '0.00',
    invl_art_deposit_ht: '0.00',
    invl_art_deposit_ttc: '0.00',
  };
}

/**
 * Facture aux montants réels : lignes de la commande, port, réductions
 * (lignes négatives avec leur motif), suppléments payés (leurs lignes, avec
 * leur motif). Refuse si les montants de la commande ne sont pas ceux de ses
 * lignes : un écart non expliqué ne part pas sur une facture.
 */
export function buildInvoiceDraft(input: {
  order: BillingOrderRow;
  lines: BillingLineRow[];
  adjustments: BillingAdjustmentRow[];
  paidSupplements: PaidSupplement[];
  capturedCents: number;
}): InvoiceDraft {
  const { order, lines, adjustments, paidSupplements, capturedCents } = input;
  if (lines.length === 0) {
    throw new BillingCalcError(`Commande ${order.ord_id} sans ligne`);
  }

  const drafts: InvoiceLineDraft[] = [];
  let piecesTtc = 0;
  let depositTtc = 0;
  for (const l of lines) {
    drafts.push(lineDraft(l));
    piecesTtc += cents(l.orl_art_price_sell_ttc, l.orl_id);
    depositTtc += cents(l.orl_art_deposit_ttc, l.orl_id);
  }
  const shippingTtc = cents(order.ord_shipping_fee_ttc, `port ${order.ord_id}`);
  if (
    piecesTtc !== cents(order.ord_amount_ttc, `pièces ${order.ord_id}`) ||
    depositTtc !== cents(order.ord_deposit_ttc, `consigne ${order.ord_id}`) ||
    piecesTtc + depositTtc + shippingTtc !==
      cents(order.ord_total_ttc, `total ${order.ord_id}`)
  ) {
    throw new BillingCalcError(
      `Montants de la commande ${order.ord_id} différents de ses lignes : facture à établir à la main`,
    );
  }

  const notes: string[] = [];
  for (const a of adjustments.filter((x) => x.opa_kind === 'reduction')) {
    drafts.push(
      adjustmentLine(`Réduction : ${a.opa_reason}`, -a.opa_amount_ttc_cents),
    );
    piecesTtc -= a.opa_amount_ttc_cents;
    notes.push(
      `réduction ${euro(a.opa_amount_ttc_cents)} TTC — ${a.opa_reason}`,
    );
  }

  const supplementReasons = new Map(
    adjustments
      .filter((a) => a.opa_kind === 'supplement' && a.opa_supplement_ord_id)
      .map((a) => [String(a.opa_supplement_ord_id), a]),
  );
  for (const s of paidSupplements) {
    const adj = supplementReasons.get(s.order.ord_id);
    const reason = adj?.opa_reason ?? 'supplément payé';
    let supTotal = 0;
    for (const l of s.lines) {
      drafts.push(
        lineDraft(l, `Supplément (commande ${s.order.ord_id}) : ${reason}`),
      );
      piecesTtc += cents(l.orl_art_price_sell_ttc, l.orl_id);
      depositTtc += cents(l.orl_art_deposit_ttc, l.orl_id);
      supTotal +=
        cents(l.orl_art_price_sell_ttc, l.orl_id) +
        cents(l.orl_art_deposit_ttc, l.orl_id);
    }
    notes.push(
      `supplément ${euro(supTotal)} TTC (commande ${s.order.ord_id}) — ${reason}`,
    );
  }

  const totalTtc = piecesTtc + depositTtc + shippingTtc;
  if (totalTtc <= 0) {
    throw new BillingCalcError(
      `Total facturé nul ou négatif (${order.ord_id})`,
    );
  }
  const amountHt = htFromTtc(piecesTtc);
  const depositHt = htFromTtc(depositTtc);
  const shippingHt = htFromTtc(shippingTtc);
  const totalHt = amountHt + depositHt + shippingHt;

  const expected = expectedCaptureCents(order, adjustments);
  const info = [
    `Montant encaissé sur la commande : ${euro(capturedCents)} TTC`,
    notes.length ? `Ajustements : ${notes.join(' ; ')}` : 'Aucun ajustement',
  ].join('. ');

  return {
    invoice: {
      inv_ord_id: order.ord_id,
      inv_cst_id: order.ord_cst_id,
      inv_cba_id: order.ord_cba_id ?? null,
      inv_cda_id: order.ord_cda_id ?? null,
      inv_amount_ht: textFromCents(amountHt),
      inv_amount_ttc: textFromCents(piecesTtc),
      inv_deposit_ht: textFromCents(depositHt),
      inv_deposit_ttc: textFromCents(depositTtc),
      inv_shipping_fee_ht: textFromCents(shippingHt),
      inv_shipping_fee_ttc: textFromCents(shippingTtc),
      inv_total_ht: textFromCents(totalHt),
      inv_total_ttc: textFromCents(totalTtc),
      inv_tva: textFromCents(totalTtc - totalHt),
      inv_info: info,
    },
    lines: drafts,
    expectedCaptureCents: expected,
    totalTtcCents: totalTtc,
  };
}
