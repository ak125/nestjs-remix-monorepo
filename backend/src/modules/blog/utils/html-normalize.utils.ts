/**
 * HTML normalization utilities for R3 Guide sections.
 * Ported from frontend/app/components/blog/conseil/section-config.tsx.
 * These run server-side so the frontend receives pre-normalized HTML.
 */

// --- Anchor generation ---

/** Generate a URL-safe anchor from a title (NFD normalize, slugify). */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// --- Step HTML normalization (S4_DEPOSE / S4_REPOSE) ---

/** Converts legacy dash-list format (- text<br>) into <ol><li> for step-prose CSS. */
export function normalizeStepHtml(html: string): string {
  if (html.includes('<ol>')) return html;

  const lines = html
    .split(/<br\s*\/?>/gi)
    .map((l) => l.trim())
    .filter(Boolean);
  const dashLines = lines.filter((l) => /^[-–—]\s/.test(l));

  if (dashLines.length < 3) return html;

  const items = lines
    .map((line) => {
      if (/^[-–—]\s/.test(line)) {
        return `<li>${line.replace(/^[-–—]\s*/, '')}</li>`;
      }
      return `</ol><p class="text-xs text-gray-500 mt-1 mb-2">${line}</p><ol>`;
    })
    .join('\n');

  return `<ol>${items}</ol>`.replace(/<ol>\s*<\/ol>/g, '');
}

// --- Danger HTML normalization (S5) ---

/** Converts legacy dash-list format (- text<br>) into <ul><li> for danger-prose CSS. */
export function normalizeDangerHtml(html: string): string {
  if (html.includes('<ul>')) return html;

  const lines = html
    .split(/<br\s*\/?>/gi)
    .map((l) => l.trim())
    .filter(Boolean);
  const dashLines = lines.filter((l) => /^[-–—]\s/.test(l));

  if (dashLines.length < 2) return html;

  const items = lines
    .map((line) => {
      if (/^[-–—]\s/.test(line)) {
        return `<li>${line.replace(/^[-–—]\s*/, '')}</li>`;
      }
      return `</ul><p class="text-xs text-red-700 mt-1 mb-2">${line}</p><ul>`;
    })
    .join('\n');

  return `<ul>${items}</ul>`.replace(/<ul>\s*<\/ul>/g, '');
}

// --- Word deduplication ---

/** Remove accidental consecutive word duplicates: "km km" → "km", "le le" → "le". */
export function deduplicateWords(html: string): string {
  // Only match outside HTML tags — replace word-space-same-word patterns
  return html.replace(/\b(\w{2,})\s+\1\b/gi, '$1');
}

// --- Canonical section order ---

export const CANONICAL_ORDER: Record<string, number> = {
  S1: 10,
  S2: 20,
  S3: 30,
  S4_DEPOSE: 40,
  S4_REPOSE: 50,
  S6: 55,
  S5: 60,
  S_GARAGE: 65,
  S2_DIAG: 67,
  S7: 80,
  S8: 85,
  META: 99,
};

// --- Reading time ---

/** Calculate reading time from section HTML content. */
export function calcReadingTime(sections: Array<{ html: string }>): number {
  const totalText = sections
    .map((s) => s.html.replace(/<[^>]+>/g, ''))
    .join(' ');
  const words = totalText.split(/\s+/).filter((w) => w.length > 0).length;
  return Math.max(1, Math.ceil(words / 200));
}

// --- Difficulty derivation ---

export function deriveDifficulty(
  sections: Array<{ sectionType: string | null; html: string }>,
): {
  difficulty: 'facile' | 'moyen' | 'difficile' | null;
  durationMin: number | null;
  safetyLevel: 'faible' | 'moyen' | 'élevé' | null;
} {
  const depose = sections.find((s) => s.sectionType === 'S4_DEPOSE');
  const hasS5 = sections.some((s) => s.sectionType === 'S5');

  if (!depose) {
    return {
      difficulty: null,
      durationMin: null,
      safetyLevel: hasS5 ? 'moyen' : 'faible',
    };
  }

  // html is already normalized at this point (normalizeStepHtml applied)
  const stepCount = (depose.html.match(/<li>/gi) || []).length;
  const difficulty =
    stepCount <= 4 ? 'facile' : stepCount <= 8 ? 'moyen' : 'difficile';
  const durationMin = Math.max(stepCount * 5, 30); // minimum 30 min pour toute dépose
  const safetyLevel = hasS5 ? 'élevé' : 'moyen';

  // Si S5 (risques/erreurs) existe et difficulté calculée = facile → relever à moyen
  if (hasS5 && difficulty === 'facile') {
    return {
      difficulty: 'moyen',
      durationMin: Math.max(durationMin, 45),
      safetyLevel,
    };
  }

  return { difficulty, durationMin, safetyLevel };
}
