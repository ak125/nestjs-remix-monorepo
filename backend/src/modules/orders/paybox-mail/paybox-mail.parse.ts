/**
 * Mandat BT (2026-11-17) — analyse stricte des mails Paybox reçus sur contact@.
 *
 * Fonctions pures, sans I/O. Un format non reconnu n'est jamais deviné :
 * l'analyse rend `{ ok: false, reason }` et l'appelant ignore, compte et
 * signale le message.
 *
 * Données client : le numéro de carte masqué (`trs_ticket_pan`, ligne qui suit
 * le numéro de commerçant dans la version texte) et la ligne « Email client »
 * ne sont jamais extraits, rendus ni stockés. Le parseur HTML ne lit que les
 * id listés dans `TICKET_IDS` ; le parseur texte lit des positions fixes et
 * n'accède pas à celle de la carte.
 *
 * Montants en centimes ; heures de Paris converties en UTC.
 */

export const PAYBOX_TICKET_SENDER = 'noreply@paybox.com';
export const PAYBOX_TPE_SENDER = 'tpeweb@paybox.com';
export const PAYBOX_SENDERS = [PAYBOX_TICKET_SENDER, PAYBOX_TPE_SENDER];

/** Sujets comparés après réduction des espaces (le sujet réel en contient plusieurs). */
export const TICKET_SUBJECT = 'AUTO PIECE EQ.@ : Ticket paiement';
export const TELECOLLECTE_SUBJECT =
  'PayBox system (compte rendu de telecollecte)';
export const HEARTBEAT_SUBJECT = 'Compte rendu de teleparametrage';

/** Numéro de commerçant Paybox d'AutoMecanik, lu sur les tickets et télécollectes. */
export const PAYBOX_MERCHANT_NUMBER = '5259250';

export const TICKET_ACCEPTED_TITLE = 'PAIEMENT ACCEPTÉ';
export const TICKET_OP_TYPE = 'DEBIT VADS @';

export type MessageKind = 'ticket' | 'telecollecte' | 'heartbeat';

export interface ParsedTicket {
  kind: 'ticket';
  accepted: boolean;
  orderRef: string | null;
  amountCents: number | null;
  authNumber: string | null;
  /** Heure d'autorisation (UTC, ISO). */
  authorizedAt: string;
}

export interface ParsedTelecollecte {
  kind: 'telecollecte';
  remiseNumber: string;
  fileNumber: string;
  purchaseCount: number;
  purchaseCents: number;
  refundCount: number;
  refundCents: number;
  cancelCount: number;
  cancelCents: number;
  /** Heure de la télécollecte (UTC, ISO). */
  collectedAt: string;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

// ── Outils ──────────────────────────────────────────────────────────────────

export function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Adresse exacte de l'en-tête From (`Nom <a@b>` ou `a@b`), en minuscules ; null si ambiguë. */
export function senderAddress(
  fromHeader: string | null | undefined,
): string | null {
  if (!fromHeader) return null;
  const angled = fromHeader.match(/<([^<>\s]+@[^<>\s]+)>/g);
  if (angled) {
    if (angled.length !== 1) return null;
    return angled[0].slice(1, -1).toLowerCase();
  }
  const bare = fromHeader.trim();
  return /^[^\s<>@]+@[^\s<>@]+$/.test(bare) ? bare.toLowerCase() : null;
}

/** Type du message d'après l'expéditeur exact et le sujet exact ; null sinon. */
export function classifyMessage(
  fromHeader: string | null | undefined,
  subject: string | null | undefined,
): MessageKind | null {
  const from = senderAddress(fromHeader);
  const subj = normalizeSpaces(subject ?? '');
  if (from === PAYBOX_TICKET_SENDER && subj === TICKET_SUBJECT) return 'ticket';
  if (from === PAYBOX_TPE_SENDER && subj === TELECOLLECTE_SUBJECT)
    return 'telecollecte';
  if (from === PAYBOX_TPE_SENDER && subj === HEARTBEAT_SUBJECT)
    return 'heartbeat';
  return null;
}

/**
 * Le premier en-tête Authentication-Results (posé par le serveur de réception)
 * atteste-t-il que le message vient de paybox.com ? DKIM signé par paybox.com
 * (ou un sous-domaine), ou DMARC aligné sur paybox.com.
 */
export function isPayboxAuthenticated(
  authenticationResults: string | null | undefined,
): boolean {
  if (!authenticationResults) return false;
  const v = authenticationResults.toLowerCase();
  // Domaine terminé par un séparateur : « paybox.com.evil.test » ne passe pas.
  const dkim =
    /\bdkim=pass\b[^;]*\bheader\.(?:d|i)=@?(?:[a-z0-9-]+\.)*paybox\.com(?=[\s;)]|$)/.test(
      v,
    );
  const dmarc =
    /\bdmarc=pass\b[^;]*\bheader\.from=(?:[a-z0-9-]+\.)*paybox\.com(?=[\s;)]|$)/.test(
      v,
    );
  return dkim || dmarc;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  eacute: 'é',
  Eacute: 'É',
  egrave: 'è',
  Egrave: 'È',
  agrave: 'à',
  Agrave: 'À',
  rsquo: '’',
  lsquo: '‘',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code =
        e[1] === 'x' || e[1] === 'X'
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/** Texte comparable : NFC, apostrophes droites, espaces réduits. */
function clean(s: string): string {
  return normalizeSpaces(
    decodeEntities(s).normalize('NFC').replace(/[’‘]/g, "'"),
  );
}

/** Centimes depuis « 12.34 » (point, deux décimales) ; null sinon. */
export function centsFromAmount(text: string): number | null {
  const m = text.match(/^(\d{1,9})\.(\d{2})$/);
  return m ? Number(m[1]) * 100 + Number(m[2]) : null;
}

// ── Heures de Paris ─────────────────────────────────────────────────────────

const PARIS = 'Europe/Paris';
const parisParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function parisFields(epochMs: number) {
  const p: Record<string, number> = {};
  for (const part of parisParts.formatToParts(new Date(epochMs))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return p as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

function parisOffsetMs(epochMs: number): number {
  const f = parisFields(epochMs);
  const asUtc = Date.UTC(
    f.year,
    f.month - 1,
    f.day,
    f.hour,
    f.minute,
    f.second,
  );
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

/**
 * Heure murale de Paris → instant UTC (ISO). Heure inexistante (passage à
 * l'heure d'été) : null. Heure ambiguë (retour à l'heure d'hiver) : la
 * première occurrence.
 */
export function parisLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): string | null {
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  // Les deux décalages possibles autour de l'instant ; on garde le plus tôt qui retombe sur l'heure murale.
  const candidates = [
    ...new Set([
      parisOffsetMs(wall - 864e5 / 2),
      parisOffsetMs(wall + 864e5 / 2),
    ]),
  ]
    .map((off) => wall - off)
    .sort((a, b) => a - b);
  for (const t of candidates) {
    if (t + parisOffsetMs(t) === wall) return new Date(t).toISOString();
  }
  return null;
}

/** Date calendaire de Paris (AAAA-MM-JJ) d'un instant. */
export function parisDate(iso: string | Date): string {
  const f = parisFields(new Date(iso).getTime());
  return `${f.year}-${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}`;
}

/** AAAA-MM-JJ + n jours (calendrier, sans fuseau). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// ── Ticket ──────────────────────────────────────────────────────────────────

/** Seuls id HTML lus. `trs_ticket_pan` n'y figure pas et n'est jamais lu. */
const TICKET_IDS = [
  'ticketTitle',
  'trs_ticket_date',
  'trs_ticket_num_commercant',
  'trs_ticket_op_type',
  'trs_ticket_numauto',
  'trs_ticket_montant',
  'trs_ticket_refcmd',
] as const;
type TicketId = (typeof TICKET_IDS)[number];

function htmlElementText(html: string, id: TicketId): string | null {
  const re = new RegExp(
    `<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\bid\\s*=\\s*["']${id}["'][^>]*>([\\s\\S]*?)</\\1\\s*>`,
    'g',
  );
  const found = [...html.matchAll(re)];
  if (found.length !== 1) return null;
  return clean(found[0][2].replace(/<[^>]*>/g, ' '));
}

interface TicketFields {
  title: string;
  date: string;
  merchant: string;
  opType: string | null;
  numauto: string | null;
  montant: string | null;
  refcmd: string | null;
}

function ticketFieldsFromHtml(html: string): TicketFields | null {
  const v = Object.fromEntries(
    TICKET_IDS.map((id) => [id, htmlElementText(html, id)]),
  ) as Record<TicketId, string | null>;
  if (!v.ticketTitle || !v.trs_ticket_date || !v.trs_ticket_num_commercant)
    return null;
  return {
    title: v.ticketTitle,
    date: v.trs_ticket_date,
    merchant: v.trs_ticket_num_commercant,
    opType: v.trs_ticket_op_type,
    numauto: v.trs_ticket_numauto,
    montant: v.trs_ticket_montant,
    refcmd: v.trs_ticket_refcmd,
  };
}

/**
 * Version texte, positions fixes (lignes non vides) :
 * 0 titre · 1 « Merci de votre confiance. » · 2 AUTOMECANIK.COM · 3 CARTE BANCAIRE ·
 * 4 marque · 5 banque · 6 date · 7 AUTO PIECE EQ.@ · 8 site · 9 commerçant ·
 * 10 carte (jamais lue) · 11 remise · 12 type · 13 autorisation · 14 montant ·
 * 15 commande · 16 MERCI ET A BIENTOT.
 */
function ticketFieldsFromText(text: string): TicketFields | null {
  const lines = text
    .split(/\r?\n/)
    .map(clean)
    .filter((l) => l.length > 0);
  if (lines.length < 17) return null;
  const at = (i: number) => lines[i];
  if (
    at(1) !== 'Merci de votre confiance.' ||
    at(3) !== 'CARTE BANCAIRE' ||
    at(7) !== 'AUTO PIECE EQ.@' ||
    at(16) !== 'MERCI ET A BIENTOT.'
  ) {
    return null;
  }
  return {
    title: at(0),
    date: at(6),
    merchant: at(9),
    opType: at(12),
    numauto: at(13),
    montant: at(14),
    refcmd: at(15),
  };
}

function ticketFromFields(f: TicketFields): ParseResult<ParsedTicket> {
  if (f.merchant !== PAYBOX_MERCHANT_NUMBER)
    return { ok: false, reason: 'commerçant inattendu' };
  const d = f.date.match(/^Le (\d{2})\/(\d{2})\/(\d{4}) à (\d{2}):(\d{2})$/);
  if (!d) return { ok: false, reason: 'date du ticket illisible' };
  const authorizedAt = parisLocalToUtc(+d[3], +d[2], +d[1], +d[4], +d[5]);
  if (!authorizedAt) return { ok: false, reason: 'date du ticket invalide' };

  const ref =
    f.refcmd?.match(/^NUMERO DE COMMANDE : (ORD-\d{13}-\d{3})$/)?.[1] ?? null;
  const auth =
    f.numauto?.match(/^NUMERO D'AUTORISATION : (\d{6})$/)?.[1] ?? null;
  const amountText =
    f.montant?.match(/^MONTANT : (\d+\.\d{2}) EUR$/)?.[1] ?? null;
  const amountCents = amountText ? centsFromAmount(amountText) : null;

  if (f.title !== TICKET_ACCEPTED_TITLE) {
    // Tout autre titre = non accepté ; les champs lisibles sont gardés, les autres nuls.
    return {
      ok: true,
      value: {
        kind: 'ticket',
        accepted: false,
        orderRef: ref,
        amountCents,
        authNumber: auth,
        authorizedAt,
      },
    };
  }
  if (f.opType !== TICKET_OP_TYPE)
    return { ok: false, reason: "type d'opération inattendu" };
  if (!ref) return { ok: false, reason: 'numéro de commande illisible' };
  if (!auth) return { ok: false, reason: "numéro d'autorisation illisible" };
  if (amountCents == null) return { ok: false, reason: 'montant illisible' };
  return {
    ok: true,
    value: {
      kind: 'ticket',
      accepted: true,
      orderRef: ref,
      amountCents,
      authNumber: auth,
      authorizedAt,
    },
  };
}

/** Ticket de paiement : id HTML d'abord, repli sur la version texte. */
export function parseTicket(body: {
  html?: string | null;
  text?: string | null;
}): ParseResult<ParsedTicket> {
  const fromHtml = body.html ? ticketFieldsFromHtml(body.html) : null;
  const fields =
    fromHtml ?? (body.text ? ticketFieldsFromText(body.text) : null);
  if (!fields) return { ok: false, reason: 'gabarit de ticket non reconnu' };
  return ticketFromFields(fields);
}

// ── Télécollecte ────────────────────────────────────────────────────────────

/** Texte brut d'un HTML : balises de bloc et <br> → sauts de ligne. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|td|li|h\d|table)\s*>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  );
}

/** Séquence exacte des lignes non vides ; `null` = valeur libre non lue. */
const TELECOLLECTE_LINES: Array<string | RegExp | null> = [
  'TELECOLLECTE DE',
  /^L'APPLICATION \S+$/,
  null, // banque
  /^le (\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/,
  /^\d{14}$/, // SIRET
  /^\d+$/,
  PAYBOX_MERCHANT_NUMBER,
  /^\d+$/,
  /^REMISE Nro: ?(\d+)$/,
  /^FICHIER Nro: ?(\d+)$/,
  'NBR TRANSACTIONS:',
  /^Achats: ?(\d+)$/,
  /^Dont différés: ?(\d+)$/i,
  /^Rembt: ?(\d+)$/,
  /^Annulées: ?(\d+)$/,
  /^Abandon: ?(\d+)$/,
  'MONTANT EN EUR',
  /^Achats: ?(\d+\.\d{2})$/,
  /^Dont différés: ?(\d+\.\d{2})$/i,
  /^Rembt: ?(\d+\.\d{2})$/,
  /^Annulées: ?(\d+\.\d{2})$/,
  'TRANSMISSION REUSSIE',
  'TICKET A CONSERVER',
  'MERCI ET A BIENTOT.',
];

/** Compte rendu de télécollecte : séquence stricte, « TRANSMISSION REUSSIE » exigé. */
export function parseTelecollecte(body: {
  html?: string | null;
  text?: string | null;
}): ParseResult<ParsedTelecollecte> {
  const raw = body.text ?? (body.html ? htmlToText(body.html) : null);
  if (!raw) return { ok: false, reason: 'corps vide' };
  const lines = raw
    .split(/\r?\n/)
    .map(clean)
    .filter((l) => l.length > 0);
  if (lines.length !== TELECOLLECTE_LINES.length)
    return { ok: false, reason: 'gabarit de télécollecte non reconnu' };

  const groups: string[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const rule = TELECOLLECTE_LINES[i];
    if (rule === null) {
      groups.push([]);
      continue;
    }
    if (typeof rule === 'string') {
      if (lines[i] !== rule)
        return { ok: false, reason: `ligne ${i + 1} inattendue` };
      groups.push([]);
      continue;
    }
    const m = lines[i].match(rule);
    if (!m) return { ok: false, reason: `ligne ${i + 1} inattendue` };
    groups.push(m.slice(1));
  }
  const [dd, mm, yyyy, hh, mi, ss] = groups[3].map(Number);
  const collectedAt = parisLocalToUtc(yyyy, mm, dd, hh, mi, ss);
  if (!collectedAt)
    return { ok: false, reason: 'date de télécollecte invalide' };
  const cents = (i: number) => centsFromAmount(groups[i][0]);
  const amounts = [cents(17), cents(19), cents(20)];
  if (amounts.some((a) => a == null))
    return { ok: false, reason: 'montant illisible' };
  return {
    ok: true,
    value: {
      kind: 'telecollecte',
      remiseNumber: groups[8][0],
      fileNumber: groups[9][0],
      purchaseCount: Number(groups[11][0]),
      purchaseCents: amounts[0]!,
      refundCount: Number(groups[13][0]),
      refundCents: amounts[1]!,
      cancelCount: Number(groups[14][0]),
      cancelCents: amounts[2]!,
      collectedAt,
    },
  };
}
