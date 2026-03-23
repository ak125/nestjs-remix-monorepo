import { normalizeR1Images, type RawR1ImageRow } from '../r1-image-normalizer';

function makeRow(
  overrides: Partial<RawR1ImageRow> & { rip_slot_id: string },
): RawR1ImageRow {
  return {
    rip_image_url:
      'https://xxx.supabase.co/storage/v1/object/public/uploads/articles/test.webp',
    rip_alt_text: 'alt text',
    rip_caption: null,
    rip_aspect_ratio: '4:3',
    rip_selected: false,
    rip_updated_at: '2026-03-23T10:00:00Z',
    ...overrides,
  };
}

describe('normalizeR1Images', () => {
  it('1. selected+approved+url wins over non-selected on same slot', () => {
    const rows = [
      makeRow({
        rip_slot_id: 'TYPES',
        rip_selected: true,
        rip_alt_text: 'winner',
      }),
      makeRow({
        rip_slot_id: 'TYPES',
        rip_selected: false,
        rip_alt_text: 'loser',
      }),
    ];
    const result = normalizeR1Images(rows);
    expect(result.images).toHaveLength(1);
    expect(result.images[0].alt).toBe('winner');
  });

  it('2. fallback: approved without selected is still returned', () => {
    const rows = [makeRow({ rip_slot_id: 'PRICE', rip_selected: false })];
    const result = normalizeR1Images(rows);
    expect(result.images).toHaveLength(1);
    expect(result.images[0].slot).toBe('PRICE');
  });

  it('3. URL without /uploads/ path is ignored', () => {
    const rows = [
      makeRow({
        rip_slot_id: 'TYPES',
        rip_selected: true,
        rip_image_url: 'https://example.com/no-uploads-path.webp',
      }),
    ];
    const result = normalizeR1Images(rows);
    expect(result.images).toHaveLength(0);
  });

  it('4. one image per slot — 3 HERO candidates → 1 returned', () => {
    const rows = [
      makeRow({
        rip_slot_id: 'HERO',
        rip_selected: true,
        rip_alt_text: 'best',
      }),
      makeRow({
        rip_slot_id: 'HERO',
        rip_selected: false,
        rip_alt_text: 'second',
      }),
      makeRow({
        rip_slot_id: 'HERO',
        rip_selected: false,
        rip_alt_text: 'third',
      }),
    ];
    const result = normalizeR1Images(rows);
    const heroes = result.images.filter((i) => i.slot === 'HERO');
    expect(heroes).toHaveLength(1);
    expect(heroes[0].alt).toBe('best');
  });

  it('5. HERO sets heroImagePath', () => {
    const rows = [makeRow({ rip_slot_id: 'HERO', rip_selected: true })];
    const result = normalizeR1Images(rows);
    expect(result.heroImagePath).toBe('articles/test.webp');
  });

  it('6. OG does NOT set heroImagePath', () => {
    const rows = [makeRow({ rip_slot_id: 'OG', rip_selected: true })];
    const result = normalizeR1Images(rows);
    expect(result.heroImagePath).toBeNull();
    expect(result.images).toHaveLength(1);
    expect(result.images[0].slot).toBe('OG');
  });

  it('7. empty array returns empty result', () => {
    const result = normalizeR1Images([]);
    expect(result.heroImagePath).toBeNull();
    expect(result.images).toEqual([]);
  });

  it('8. most recent wins when same priority (both non-selected)', () => {
    const rows = [
      makeRow({
        rip_slot_id: 'LOCATION',
        rip_selected: false,
        rip_updated_at: '2026-03-20T10:00:00Z',
        rip_alt_text: 'older',
      }),
      makeRow({
        rip_slot_id: 'LOCATION',
        rip_selected: false,
        rip_updated_at: '2026-03-23T10:00:00Z',
        rip_alt_text: 'newer',
      }),
    ];
    const result = normalizeR1Images(rows);
    expect(result.images).toHaveLength(1);
    expect(result.images[0].alt).toBe('newer');
  });
});
