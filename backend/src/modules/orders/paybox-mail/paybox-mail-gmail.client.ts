/**
 * Mandat BT (2026-11-17) — lecteur Gmail de contact@, lecture seule.
 *
 * Jeton dédié `PAYBOX_MAIL_GMAIL_REFRESH_TOKEN`, jamais `GMAIL_REFRESH_TOKEN`
 * (jeton d'envoi de MailService). Client OAuth : `GMAIL_CLIENT_ID` /
 * `GMAIL_CLIENT_SECRET`, réutilisés : ils n'accordent rien seuls, la portée
 * est portée par le jeton et vérifiée avant chaque passage (`assertReadonly`).
 *
 * Seules opérations exposées : lister des id selon une requête, lire les
 * en-têtes d'un message, lire le corps d'un message. Aucune modification
 * (libellé, lu/non lu, corbeille) n'est possible par cette classe.
 */
import { google, type gmail_v1 } from 'googleapis';

export const GMAIL_READONLY_SCOPE =
  'https://www.googleapis.com/auth/gmail.readonly';

export class PayboxMailScopeError extends Error {}

export interface MailHeaders {
  id: string;
  internalDate: string;
  from: string | null;
  subject: string | null;
  /** Premier en-tête Authentication-Results (serveur de réception). */
  authenticationResults: string | null;
}

export interface MailBody {
  html: string | null;
  text: string | null;
}

export interface PayboxMailbox {
  assertReadonly(): Promise<void>;
  listIds(query: string, max: number): Promise<string[]>;
  headers(id: string): Promise<MailHeaders>;
  body(id: string): Promise<MailBody>;
}

/** Portées refusées : toute portée autre que gmail.readonly, ou aucune. */
export function checkScopes(scopes: string[] | undefined): void {
  const list = scopes ?? [];
  const extra = list.filter((s) => s !== GMAIL_READONLY_SCOPE);
  if (!list.includes(GMAIL_READONLY_SCOPE) || extra.length > 0) {
    throw new PayboxMailScopeError(
      `Jeton refusé : portées ${list.length ? list.join(' ') : '(aucune)'} ; seule ${GMAIL_READONLY_SCOPE} est admise`,
    );
  }
}

function header(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
) {
  const h = (headers ?? []).find(
    (x) => x.name?.toLowerCase() === name.toLowerCase(),
  );
  return h?.value ?? null;
}

function charsetOf(part: gmail_v1.Schema$MessagePart): string {
  const ct = header(part.headers ?? undefined, 'Content-Type') ?? '';
  return (
    ct.match(/charset\s*=\s*"?([^";\s]+)"?/i)?.[1]?.toLowerCase() ?? 'utf-8'
  );
}

function decodePart(part: gmail_v1.Schema$MessagePart): string | null {
  const data = part.body?.data;
  if (!data) return null;
  const bytes = Buffer.from(data, 'base64url');
  try {
    return new TextDecoder(charsetOf(part)).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** Premier text/html et premier text/plain de l'arbre MIME (pièces jointes ignorées). */
export function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined,
): MailBody {
  const out: MailBody = { html: null, text: null };
  const walk = (p: gmail_v1.Schema$MessagePart | undefined) => {
    if (!p) return;
    if (p.filename) return;
    if (p.mimeType === 'text/html' && out.html === null)
      out.html = decodePart(p);
    else if (p.mimeType === 'text/plain' && out.text === null)
      out.text = decodePart(p);
    for (const c of p.parts ?? []) walk(c);
  };
  walk(payload);
  return out;
}

export class GmailPayboxMailbox implements PayboxMailbox {
  private readonly auth;
  private readonly gmail: gmail_v1.Gmail;

  constructor(cfg: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }) {
    this.auth = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret);
    this.auth.setCredentials({ refresh_token: cfg.refreshToken });
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
  }

  async assertReadonly(): Promise<void> {
    const { token } = await this.auth.getAccessToken();
    if (!token) throw new PayboxMailScopeError("Jeton d'accès non obtenu");
    const info = await this.auth.getTokenInfo(token);
    checkScopes(info.scopes);
  }

  async listIds(query: string, max: number): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: Math.min(100, max - ids.length),
        pageToken,
      });
      for (const m of res.data.messages ?? []) if (m.id) ids.push(m.id);
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken && ids.length < max);
    return ids;
  }

  async headers(id: string): Promise<MailHeaders> {
    const res = await this.gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Authentication-Results'],
    });
    const h = res.data.payload?.headers ?? undefined;
    return {
      id,
      internalDate: new Date(Number(res.data.internalDate ?? 0)).toISOString(),
      from: header(h, 'From'),
      subject: header(h, 'Subject'),
      authenticationResults: header(h, 'Authentication-Results'),
    };
  }

  async body(id: string): Promise<MailBody> {
    const res = await this.gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full',
    });
    return extractBody(res.data.payload ?? undefined);
  }
}
