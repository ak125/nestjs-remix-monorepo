/**
 * Utilitaire de dérivation d'URL OG image (frontend).
 *
 * Résolution :
 *  1. Si pgImg fourni et valide → imgproxy 1200x630 absolu
 *  2. Si intentClass fourni → asset statique /images/og/{class}.webp
 *  3. Fallback → logo-og.webp
 *
 * @see .spec/00-canon/image-matrix-v1.md §3
 */

import { type IntentClass, OG_BASE, OG_FALLBACK } from "~/utils/og-constants";

const IMGPROXY_BASE = `${OG_BASE}/imgproxy`;

/**
 * Construit l'URL OG image absolue (1200x630, webp, q85).
 *
 * @param pgImg - chemin image gamme (ex: "/img/uploads/articles/.../disque-frein.jpg")
 * @param intentClass - intent class pour le fallback statique
 */
export function getOgImageUrl(
  pgImg?: string | null,
  intentClass?: IntentClass | null,
): string {
  // 1. Image dynamique via imgproxy
  if (pgImg && pgImg !== "no.webp" && pgImg !== "/images/pieces/default.png") {
    const sourceUrl = pgImg.startsWith("http")
      ? pgImg
      : `${OG_BASE}${pgImg.startsWith("/") ? "" : "/"}${pgImg}`;
    return `${IMGPROXY_BASE}/rs:fit:1200:630/q:85/plain/${sourceUrl}@webp`;
  }

  // 2. Asset statique par intent class
  if (intentClass) {
    return `${OG_BASE}/images/og/${intentClass}.webp`;
  }

  // 3. Fallback ultime
  return OG_FALLBACK;
}
