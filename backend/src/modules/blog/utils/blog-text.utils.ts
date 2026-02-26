import { decodeHtmlEntities } from '../../../utils/html-entities';

/**
 * Calculer le temps de lecture d'un contenu.
 * @param content - Contenu HTML ou texte
 * @returns Temps de lecture en minutes (minimum 1)
 */
export function calculateReadingTime(content: unknown): number {
  if (!content) return 1;

  const text = typeof content === 'string' ? content : JSON.stringify(content);
  const cleanText = decodeHtmlEntities(text).replace(/<[^>]*>/g, '');
  const wordsPerMinute = 200;
  const words = cleanText
    .split(/\s+/)
    .filter((word: string) => word.length > 0).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/**
 * Generer une ancre URL-safe a partir d'un titre.
 * Decode HTML, normalise les accents, ne garde que [a-z0-9-].
 */
export function generateAnchor(text: string): string {
  if (!text) return '';

  return decodeHtmlEntities(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
