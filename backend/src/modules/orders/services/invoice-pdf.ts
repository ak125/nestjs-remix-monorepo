/**
 * Mandat BM — PDF de facture, écrit à la main (PDF 1.4, police standard
 * Helvetica, encodage WinAnsi). Aucune dépendance ajoutée : le dépôt n'a pas
 * de bibliothèque PDF et `package.json` est un fichier réservé.
 *
 * Mentions : seules figurent celles dont la valeur a une source dans le
 * dépôt (pied de facture publié, `SELLER_IDENTITY_LINES`) ou dans la commande.
 * La liste complète des mentions légales et leurs questions ouvertes sont dans
 * docs/facturation/mentions-facture-a-valider.md, pour validation par le
 * département 18 et le comptable. Rien n'est inventé ici.
 */
import type { InvoiceLineDraft } from './order-billing.calc';
import { DEFAULT_TVA_RATE } from '../../pricing/services/pricing-formula.service';

/**
 * Identité du vendeur, recopiée mot pour mot du pied de facture déjà publié
 * (frontend/app/routes/account_.orders.$orderId.invoice.tsx). Un test vérifie
 * que les deux copies restent identiques.
 */
export const SELLER_IDENTITY_LINES = [
  'AUTO PIECES EQUIPEMENTS',
  '184 AVENUE ARISTIDE BRIAND 93320 LES PAVILLONS SOUS BOIS',
  'TEL 0177695892 SASU au capital de 10000 euro',
  'RCS Bobigny siret 82049999400010 N° tva FR58820499994 CODE APE4531Z',
  'WWW.AUTOMECANIK.COM',
] as const;

export interface InvoicePdfInput {
  invoiceNumber: string;
  invoiceDate: string;
  orderId: string;
  orderDate: string | null;
  shippedAt: string | null;
  paidAt: string | null;
  buyerLines: string[];
  lines: InvoiceLineDraft[];
  totals: {
    amountHt: string;
    depositHt: string;
    shippingHt: string;
    totalHt: string;
    tva: string;
    totalTtc: string;
    depositTtc: string;
    shippingTtc: string;
  };
  info: string;
}

/** Caractères Unicode hors Latin-1 présents en français → code WinAnsi. */
const WIN_ANSI: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  '„': 0x84,
  '…': 0x85,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '–': 0x96,
  '—': 0x97,
  œ: 0x9c,
  Œ: 0x8c,
  Ÿ: 0x9f,
};

/** Texte → octets WinAnsi échappés pour une chaîne PDF `( … )`. */
export function pdfString(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 63;
    let byte: number;
    if (WIN_ANSI[ch] !== undefined) byte = WIN_ANSI[ch];
    else if (code === 0x09) byte = 0x20;
    else if (code >= 0x20 && code <= 0x7e) byte = code;
    else if (code >= 0xa0 && code <= 0xff) byte = code;
    else byte = 0x3f; // « ? » : caractère non représentable
    const c = String.fromCharCode(byte);
    out += c === '\\' || c === '(' || c === ')' ? `\\${c}` : c;
  }
  return out;
}

function euro(text: string): string {
  return `${text.replace('.', ',')} €`;
}

function frDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(
    iso.includes('T') || iso.includes(' ')
      ? iso.replace(' ', 'T')
      : `${iso}T00:00:00`,
  );
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

interface TextOp {
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  text: string;
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const LINE_H = 13;

/** Découpe une ligne trop longue (largeur approximative Helvetica). */
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      out.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) out.push(cur);
  return out;
}

function layout(input: InvoicePdfInput): TextOp[][] {
  const pages: TextOp[][] = [[]];
  let y = PAGE_H - MARGIN;
  const put = (op: Omit<TextOp, 'y'>, dy = LINE_H) => {
    if (y < MARGIN + 60) {
      pages.push([]);
      y = PAGE_H - MARGIN;
    }
    pages[pages.length - 1].push({ ...op, y });
    y -= dy;
  };
  const right = (x: number, text: string, size: number) =>
    // alignement à droite approximatif (Helvetica ≈ 0,5 × corps par caractère)
    x - text.length * size * 0.5;

  SELLER_IDENTITY_LINES.forEach((l, i) =>
    put(
      { x: MARGIN, size: i === 0 ? 12 : 8, bold: i === 0, text: l },
      i === 0 ? 15 : 11,
    ),
  );
  y -= 10;
  put(
    {
      x: MARGIN,
      size: 16,
      bold: true,
      text: `FACTURE N° ${input.invoiceNumber}`,
    },
    20,
  );
  put({
    x: MARGIN,
    size: 9,
    text: `Date de facture : ${frDate(input.invoiceDate)}`,
  });
  put({
    x: MARGIN,
    size: 9,
    text: `Commande n° ${input.orderId} du ${frDate(input.orderDate)}`,
  });
  put({
    x: MARGIN,
    size: 9,
    text: `Paiement reçu le ${frDate(input.paidAt)} — expédition le ${frDate(input.shippedAt)}`,
  });
  y -= 8;
  put({ x: MARGIN, size: 10, bold: true, text: 'Facturé à' });
  for (const l of input.buyerLines.filter(Boolean))
    put({ x: MARGIN, size: 9, text: l });
  y -= 10;

  const cols = {
    ref: MARGIN,
    name: MARGIN + 90,
    qty: 360,
    unit: 440,
    total: PAGE_W - MARGIN,
  };
  put({ x: cols.ref, size: 8, bold: true, text: 'Référence' }, 0);
  put({ x: cols.name, size: 8, bold: true, text: 'Désignation' }, 0);
  put({ x: cols.qty, size: 8, bold: true, text: 'Qté' }, 0);
  put(
    {
      x: right(cols.unit + 50, 'PU TTC', 8),
      size: 8,
      bold: true,
      text: 'PU TTC',
    },
    0,
  );
  put({
    x: right(cols.total, 'Total TTC', 8),
    size: 8,
    bold: true,
    text: 'Total TTC',
  });
  for (const l of input.lines) {
    const designation = [l.invl_pm_name, l.invl_pg_name]
      .filter(Boolean)
      .join(' — ');
    const nameLines = wrap(designation, 48);
    const unit = euro(l.invl_art_price_sell_unit_ttc);
    const total = euro(l.invl_art_price_sell_ttc);
    put({ x: cols.ref, size: 8, text: truncate(l.invl_art_ref ?? '', 18) }, 0);
    put({ x: cols.qty, size: 8, text: l.invl_art_quantity }, 0);
    put({ x: right(cols.unit + 50, unit, 8), size: 8, text: unit }, 0);
    put({ x: right(cols.total, total, 8), size: 8, text: total }, 0);
    nameLines.forEach((n) => put({ x: cols.name, size: 8, text: n }, 11));
    if (l.invl_art_deposit_ttc !== '0.00') {
      put(
        {
          x: cols.name,
          size: 7,
          text: `Consigne : ${euro(l.invl_art_deposit_ttc)} TTC`,
        },
        11,
      );
    }
    y -= 2;
  }
  y -= 8;
  const rate = `${Math.round(DEFAULT_TVA_RATE * 100)} %`;
  const totals: Array<[string, string, boolean?]> = [
    ['Pièces HT', euro(input.totals.amountHt)],
    ['Consigne HT', euro(input.totals.depositHt)],
    ['Frais de port HT', euro(input.totals.shippingHt)],
    ['Total HT', euro(input.totals.totalHt), true],
    [`TVA ${rate}`, euro(input.totals.tva)],
    ['Total TTC', euro(input.totals.totalTtc), true],
  ];
  for (const [label, value, bold] of totals) {
    put({ x: 360, size: 9, bold, text: label }, 0);
    put({ x: right(cols.total, value, 9), size: 9, bold, text: value });
  }
  y -= 10;
  for (const l of wrap(input.info, 100))
    put({ x: MARGIN, size: 8, text: l }, 11);
  return pages;
}

/** Construit le PDF complet. */
export function renderInvoicePdf(input: InvoicePdfInput): Buffer {
  const pages = layout(input);
  const objects: string[] = [];
  // 1 catalogue, 2 arbre des pages, 3 Helvetica, 4 Helvetica-Bold
  const pageIds: number[] = [];
  const firstPageObj = 5;
  pages.forEach((_, i) => pageIds.push(firstPageObj + i * 2));
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((ops, i) => {
    const pageId = pageIds[i];
    const contentId = pageId + 1;
    const stream = ops
      .map(
        (o) =>
          `BT /${o.bold ? 'F2' : 'F1'} ${o.size} Tf ${o.x.toFixed(1)} ${o.y.toFixed(1)} Td (${pdfString(o.text)}) Tj ET`,
      )
      .join('\n');
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] =
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  });

  let body = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(body, 'latin1');
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    body += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}
