/**
 * R1 Image Normalizer — fonction pure de sélection déterministe.
 *
 * Priorité par slot :
 *  1. selected=true + approved + image_url → prioritaire
 *  2. approved + image_url (sans selected) → fallback
 *  3. Plus récent gagne si même priorité
 *
 * Retourne une seule image par slot + heroImagePath séparé.
 *
 * Shape de sortie : see frontend/app/types/r1-images.types.ts (R1ImageItem)
 */

const HERO_SLOT_IDS = ['HERO', 'HERO_PRODUCT', 'HERO_EDITORIAL'];

export interface RawR1ImageRow {
  rip_slot_id: string;
  rip_image_url: string;
  rip_alt_text: string | null;
  rip_caption: string | null;
  rip_aspect_ratio: string | null;
  rip_selected: boolean;
  rip_updated_at: string;
}

export interface NormalizedR1Image {
  slot: string;
  path: string;
  alt: string;
  caption: string | null;
  aspect: string;
}

export interface NormalizeResult {
  heroImagePath: string | null;
  images: NormalizedR1Image[];
}

export function normalizeR1Images(
  rows: RawR1ImageRow[],
  options?: { pgId?: number; logger?: { warn: (msg: string) => void } },
): NormalizeResult {
  if (!rows || rows.length === 0) {
    return { heroImagePath: null, images: [] };
  }

  const pgId = options?.pgId;
  const log = options?.logger;

  // Tri déterministe : selected d'abord, puis plus récent
  const sorted = [...rows].sort((a, b) => {
    if (a.rip_selected !== b.rip_selected) return a.rip_selected ? -1 : 1;
    return (
      new Date(b.rip_updated_at).getTime() -
      new Date(a.rip_updated_at).getTime()
    );
  });

  // Une seule image par slot (premier candidat = meilleur)
  const slotMap = new Map<string, RawR1ImageRow>();
  const slotCounts = new Map<string, number>();

  for (const img of sorted) {
    slotCounts.set(img.rip_slot_id, (slotCounts.get(img.rip_slot_id) ?? 0) + 1);

    if (!slotMap.has(img.rip_slot_id)) {
      slotMap.set(img.rip_slot_id, img);
    }
  }

  // P1.7 — Observabilité : log anomalies uniquement
  if (log) {
    for (const [slot, count] of slotCounts) {
      if (count > 1) {
        log.warn(
          `[R1-IMG] pg_id=${pgId} slot=${slot}: ${count} candidates, kept most recent`,
        );
      }
    }
  }

  let heroImagePath: string | null = null;
  const images: NormalizedR1Image[] = [];

  for (const img of slotMap.values()) {
    const uploadPath = img.rip_image_url.match(/\/uploads\/(.+)$/)?.[1];
    if (!uploadPath) continue;

    if (HERO_SLOT_IDS.includes(img.rip_slot_id)) {
      heroImagePath = uploadPath;
    }

    images.push({
      slot: img.rip_slot_id,
      path: uploadPath,
      alt: img.rip_alt_text ?? '',
      caption: img.rip_caption ?? null,
      aspect: img.rip_aspect_ratio ?? '4:3',
    });
  }

  // P1.7 — Observabilité : DB rows non exploitables
  if (log && rows.length > 0 && images.length === 0) {
    log.warn(`[R1-IMG] pg_id=${pgId}: ${rows.length} DB rows, 0 exploitable`);
  }

  return { heroImagePath, images };
}
