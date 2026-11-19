/**
 * Validateur commun d'une adresse électronique reçue en entrée.
 *
 * Ordre des contrôles, à ne pas inverser :
 *  1. type : seule une chaîne est examinée ;
 *  2. longueur : au plus {@link EMAIL_MAX_LENGTH} caractères ;
 *  3. format : règle historique du backend, inchangée.
 *
 * Le format n'est donc jamais évalué sur une valeur qui n'est pas une chaîne
 * ou qui dépasse la borne. Le validateur ne normalise rien (ni `trim`, ni
 * minuscules) : chaque appelant garde sa propre normalisation.
 */

/**
 * Longueur maximale d'une adresse acheminable : 256 octets pour le chemin
 * SMTP, chevrons compris (RFC 5321 §4.5.3.1.3), soit 254 caractères.
 */
export const EMAIL_MAX_LENGTH = 254;

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length > EMAIL_MAX_LENGTH) return false;
  return EMAIL_FORMAT.test(value);
}
