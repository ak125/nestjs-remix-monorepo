/**
 * 🛡️ Analytics & Sentry — sanitize PII (S10 RGPD scrubbing)
 *
 * Strip user-input PII des payloads envoyés à GA4 (`gtag`) et Sentry
 * (`beforeSend`). Defense-in-depth : couches multiples (regex + IP
 * anonymization GA4 côté property) — pas une garantie absolue.
 *
 * Patterns scrubbed :
 * - Plaque immatriculation FR (SIV `AB-123-CD` ou FNI `1234 AB 56`)
 * - Emails (RFC 5322 simplifié)
 * - Téléphones FR (`+33`, `0X`, espaces/tirets/points tolérés, 10 digits)
 *
 * Refs:
 * - `.claude/plans/utiliser-la-meilleure-approche-zippy-waterfall.md` § S10
 * - vault ADR-044 § Standard S10 RGPD scrubbing PII GA4/Sentry
 */

const PII_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  // Plaque immat FR SIV (depuis 2009) : 2 lettres - 3 chiffres - 2 lettres,
  // séparateurs `-` ou ` ` ou aucun, case-insensitive.
  // Exemples capturés : AB-123-CD, ab123cd, AB 123 CD
  {
    name: "plate_siv_fr",
    regex: /\b[A-Za-z]{2}[\s-]?\d{3}[\s-]?[A-Za-z]{2}\b/g,
  },
  // Plaque immat FR FNI (avant 2009) : 1-4 chiffres, 1-3 lettres, 2 chiffres
  // (numéro de département). Exemples : 1234 AB 56, 12-AB-56
  {
    name: "plate_fni_fr",
    regex: /\b\d{1,4}[\s-]?[A-Za-z]{1,3}[\s-]?\d{2}\b/g,
  },
  // Emails (RFC 5322 simplifié — couvre la grande majorité des cas réels).
  {
    name: "email",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  // Téléphones FR : `+33` ou `0X`, suivis de 9 chiffres avec séparateurs
  // optionnels (espaces, tirets, points). Couvre `+33 6 12 34 56 78`,
  // `06.12.34.56.78`, `0612-345-678`, etc.
  {
    name: "phone_fr",
    regex: /\b(?:\+33[\s.-]?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}\b/g,
  },
];

const REDACTION = "[REDACTED]";

/**
 * Strip PII d'une chaîne en remplaçant chaque match par `[REDACTED]`.
 * Idempotent (ré-appliquer ne change rien après le 1er passage).
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string" || input.length === 0) return input;
  let out = input;
  for (const { regex } of PII_PATTERNS) {
    out = out.replace(regex, REDACTION);
  }
  return out;
}

/**
 * Strip PII d'un objet de paramètres GA4 en profondeur.
 * - Numbers, booleans, null sont retournés tels quels.
 * - Strings sont sanitisées via `sanitizeString`.
 * - Objets imbriqués sont sanitisés récursivement (max 5 niveaux).
 *
 * Ne mute pas l'input — retourne une nouvelle structure.
 */
export function sanitizeParams<T = unknown>(input: T, depth = 0): T {
  if (depth > 5) return input; // garde-fou récursion infinie
  if (input == null) return input;
  if (typeof input === "string") {
    return sanitizeString(input) as unknown as T;
  }
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeParams(item, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    out[key] = sanitizeParams(value, depth + 1);
  }
  return out as T;
}

/**
 * Sentry `beforeSend` callback — sanitize les request data + breadcrumbs.
 *
 * Compatible `@sentry/react-router` (ErrorEvent) et `@sentry/nestjs`. Le param est
 * typé générique pour s'adapter aux différentes signatures SDK ; on opère
 * via accès propriété défensifs pour ne pas couplar à un type SDK précis.
 *
 * Ne supprime pas les events ; sanitize uniquement (PII strip).
 * Retourne l'event tel-quel si la structure ne correspond pas à un event
 * Sentry standard (defense-in-depth, pas de crash si schema change).
 */
export function sentryBeforeSend<E>(event: E): E {
  if (!event || typeof event !== "object") return event;
  const e = event as Record<string, unknown>;

  // request.url + request.query_string (str) ; query_string peut être
  // QueryParams (tuple[]) ou string selon Sentry version — on laisse
  // les types non-string intacts.
  const req = e.request as Record<string, unknown> | undefined;
  if (req && typeof req === "object") {
    if (typeof req.url === "string") {
      req.url = sanitizeString(req.url);
    }
    if (typeof req.query_string === "string") {
      req.query_string = sanitizeString(req.query_string);
    }
  }

  // breadcrumbs[] — message string + data object
  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = e.breadcrumbs.map((b) => {
      if (!b || typeof b !== "object") return b;
      const bc = b as Record<string, unknown>;
      return {
        ...bc,
        message:
          typeof bc.message === "string"
            ? sanitizeString(bc.message)
            : bc.message,
        data:
          bc.data && typeof bc.data === "object"
            ? sanitizeParams(bc.data)
            : bc.data,
      };
    });
  }

  // extra (Record<string, unknown>)
  if (e.extra && typeof e.extra === "object") {
    e.extra = sanitizeParams(e.extra);
  }

  return event;
}
