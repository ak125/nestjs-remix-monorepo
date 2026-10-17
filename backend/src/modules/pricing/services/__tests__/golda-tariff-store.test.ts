import type { GoldaPublication } from '../golda-portal';
import {
  GoldaStoreError,
  goldaSlugFromTitle,
  goldaSourceLine,
  goldaZipFileName,
  indexGoldaStore,
  planGoldaStore,
  type GoldaSourceFile,
} from '../golda-tariff-store';

const DL = (idt: number, idv: number, format = 'csv') =>
  `https://www.golda.fr/tarifs/download.php?idt=${idt}&idv=${idv}&format=${format}&type=tavi&protect=nomdp`;

const line = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    source: 'golda',
    url: DL(7, 11),
    http_status: 200,
    html: false,
    fetched_at: '2026-03-02T10:00:00.000Z',
    sha256: 'a'.repeat(64),
    ...over,
  });

const src = (path: string, ...lines: string[]): GoldaSourceFile => ({
  path,
  content: lines.join('\n') + '\n',
});

const DIR = 'marque-a/2026-03-01/complet';
const SRC = `${DIR}/SOURCE.jsonl`;

const pub = (over: Partial<GoldaPublication> = {}): GoldaPublication => ({
  kind: 'tavi',
  applicationDate: '2026-03-01',
  firstPublished: '2026-02-15',
  lastUpdated: null,
  completCount: 2,
  csv: { idt: 7, idv: 11, protect: 'nomdp', access: 'public' },
  ...over,
});

const TITLE = 'MARQUE A - Tarif Public';
const none = () => false;
const only =
  (...dirs: string[]) =>
  (d: string) =>
    dirs.includes(d);

describe('indexGoldaStore', () => {
  it('indexes a CSV download by fiche, version and folder', () => {
    const idx = indexGoldaStore([src(SRC, line())]);
    expect([...idx.slugsByIdt]).toEqual([[7, new Set(['marque-a'])]]);
    expect([...idx.idtsBySlug]).toEqual([['marque-a', new Set([7])]]);
    expect(idx.versions).toEqual([
      {
        dir: DIR,
        idt: 7,
        idv: 11,
        fetchedAt: '2026-03-02T10:00:00.000Z',
        lastUpdated: undefined,
      },
    ]);
  });

  it('keeps the recorded fiche update date: a day, or null', () => {
    const idx = indexGoldaStore([
      src(SRC, line({ golda_last_updated: '2026-02-20' })),
      src(
        'marque-a/2026-03-01/complet-v12/SOURCE.jsonl',
        line({ golda_last_updated: null }),
      ),
    ]);
    expect(idx.versions.map((v) => v.lastUpdated)).toEqual([
      '2026-02-20',
      null,
    ]);
  });

  it('ignores Excel and document lines, failed downloads and blank lines', () => {
    const idx = indexGoldaStore([
      src(
        SRC,
        line({ url: DL(7, 11, 'xls') }),
        line({ url: 'https://www.golda.fr/doc/notice.pdf' }),
        line({ url: undefined }),
        line({ http_status: 404 }),
        line({ html: true }),
        '   ',
      ),
      // A folder outside <slug>/<date>/<variant> is fine when it holds no CSV download.
      src('_doc/SOURCE.jsonl', line({ url: DL(7, 11, 'xls') })),
    ]);
    expect(idx.versions).toEqual([]);
    expect(idx.slugsByIdt.size).toBe(0);
  });

  it.each([
    ['a line that is not JSON', src(SRC, '{oops'), /SOURCE\.jsonl:1: not JSON/],
    ['a JSON array', src(SRC, line(), '[]'), /SOURCE\.jsonl:2: not an object/],
    ['a JSON null', src(SRC, 'null'), /not an object/],
    [
      'a CSV download in the wrong folder',
      src('marque-a/SOURCE.jsonl', line()),
      /outside <slug>/,
    ],
    [
      'a CSV download in a folder with capitals',
      src('Marque-A/2026-03-01/complet/SOURCE.jsonl', line()),
      /outside <slug>/,
    ],
    [
      'a CSV download in an underscore folder',
      src('_doc/2026-03-01/complet/SOURCE.jsonl', line()),
      /outside <slug>/,
    ],
    [
      'a date-only fetched_at',
      src(SRC, line({ fetched_at: '2026-03-02' })),
      /ISO instant/,
    ],
    [
      'a missing fetched_at',
      src(SRC, line({ fetched_at: undefined })),
      /ISO instant/,
    ],
    [
      'an upper-case sha256',
      src(SRC, line({ sha256: 'A'.repeat(64) })),
      /bad sha256/,
    ],
    [
      'a short sha256',
      src(SRC, line({ sha256: 'a'.repeat(63) })),
      /bad sha256/,
    ],
    [
      'a French-format update date',
      src(SRC, line({ golda_last_updated: '20/02/2026' })),
      /golda_last_updated/,
    ],
    [
      'a numeric update date',
      src(SRC, line({ golda_last_updated: 5 })),
      /golda_last_updated/,
    ],
  ])('throws on %s', (_why, file, msg) => {
    expect(() => indexGoldaStore([file])).toThrow(GoldaStoreError);
    expect(() => indexGoldaStore([file])).toThrow(msg);
  });
});

describe('planGoldaStore', () => {
  const stored = (over: Record<string, unknown> = {}, path = SRC) =>
    indexGoldaStore([src(path, line(over))]);

  it('places a fiche the store has never seen under the slug of its title', () => {
    expect(planGoldaStore(indexGoldaStore([]), 7, TITLE, pub(), none)).toEqual({
      action: 'fetch',
      dir: DIR,
    });
  });

  it('uses the version folder when complet is taken, and refuses when both are', () => {
    const empty = indexGoldaStore([]);
    expect(planGoldaStore(empty, 7, TITLE, pub(), only(DIR))).toEqual({
      action: 'fetch',
      dir: 'marque-a/2026-03-01/complet-v11',
    });
    expect(
      planGoldaStore(
        empty,
        7,
        TITLE,
        pub(),
        only(DIR, 'marque-a/2026-03-01/complet-v11'),
      ),
    ).toEqual({
      action: 'conflict',
      reason: 'every candidate folder already exists',
    });
  });

  it('is present when the recorded update date equals the fiche date', () => {
    expect(
      planGoldaStore(
        stored({ golda_last_updated: null }),
        7,
        TITLE,
        pub(),
        only(DIR),
      ),
    ).toEqual({ action: 'present', dir: DIR });
    expect(
      planGoldaStore(
        stored({ golda_last_updated: '2026-02-20' }),
        7,
        TITLE,
        pub({ lastUpdated: '2026-02-20' }),
        only(DIR),
      ),
    ).toEqual({ action: 'present', dir: DIR });
  });

  it('fetches an updated publication into a dated sibling folder', () => {
    expect(
      planGoldaStore(
        stored({ golda_last_updated: null }),
        7,
        TITLE,
        pub({ lastUpdated: '2026-03-05' }),
        only(DIR),
      ),
    ).toEqual({
      action: 'fetch',
      dir: 'marque-a/2026-03-01/complet-maj-2026-03-05',
    });
  });

  it('legacy lines (no recorded update date): present only for an update strictly before the download day', () => {
    const legacy = stored();
    const plan = (lastUpdated: string | null) =>
      planGoldaStore(legacy, 7, TITLE, pub({ lastUpdated }), only(DIR));
    expect(plan(null)).toEqual({ action: 'present', dir: DIR });
    expect(plan('2026-03-01')).toEqual({ action: 'present', dir: DIR });
    // Same day as the download: the update may have come after it — fetch again.
    expect(plan('2026-03-02')).toEqual({
      action: 'fetch',
      dir: 'marque-a/2026-03-01/complet-maj-2026-03-02',
    });
    expect(plan('2026-03-10')).toEqual({
      action: 'fetch',
      dir: 'marque-a/2026-03-01/complet-maj-2026-03-10',
    });
  });

  it('refuses a changed version it cannot name, rather than reuse a folder', () => {
    // Stored with an update date, the fiche now shows none: no dated sibling to use.
    expect(
      planGoldaStore(
        stored({ golda_last_updated: '2026-02-20' }),
        7,
        TITLE,
        pub(),
        only(DIR),
      ),
    ).toEqual({
      action: 'conflict',
      reason: 'every candidate folder already exists',
    });
  });

  it('keeps the known folder of a fiche even when its title changes', () => {
    expect(
      planGoldaStore(
        stored(),
        7,
        'NOUVEAU NOM - Tarif Public',
        pub({ csv: { idt: 7, idv: 12, protect: 'nomdp', access: 'public' } }),
        only(DIR),
      ),
    ).toEqual({ action: 'fetch', dir: 'marque-a/2026-03-01/complet-v12' });
  });

  it('refuses a fiche stored under two folders', () => {
    const idx = indexGoldaStore([
      src(SRC, line()),
      src('marque-a-bis/2026-03-01/complet/SOURCE.jsonl', line()),
    ]);
    expect(planGoldaStore(idx, 7, TITLE, pub(), none)).toEqual({
      action: 'conflict',
      reason: 'fiche stored under several folders',
    });
  });

  it('refuses a folder that belongs to another fiche', () => {
    expect(
      planGoldaStore(stored({ url: DL(8, 30) }), 7, TITLE, pub(), none),
    ).toEqual({ action: 'conflict', reason: 'folder used by another fiche' });
  });

  it('refuses a title that gives no folder name', () => {
    expect(
      planGoldaStore(indexGoldaStore([]), 7, '*** - Tarif Public', pub(), none),
    ).toEqual({
      action: 'conflict',
      reason: 'title gives no folder name',
    });
  });

  it('throws for a publication without a CSV link (caller error)', () => {
    expect(() =>
      planGoldaStore(indexGoldaStore([]), 7, TITLE, pub({ csv: null }), none),
    ).toThrow('without a CSV link');
  });
});

describe('goldaSlugFromTitle', () => {
  it.each([
    ['ACME - FREINAGE - Tarif Public', 'acme-freinage'],
    ['Équipements Électriques - tarif public  ', 'equipements-electriques'],
    ['A&B (Freinage) VL', 'a-b-freinage-vl'],
    ['  --Marque--  ', 'marque'],
    ['***', ''],
  ])('%s → %s', (title, slug) => {
    expect(goldaSlugFromTitle(title)).toBe(slug);
  });

  it('caps the length at 60 without a trailing dash', () => {
    const slug = goldaSlugFromTitle(`${'a'.repeat(59)} b`);
    expect(slug).toBe('a'.repeat(59));
    expect(goldaSlugFromTitle('x'.repeat(100))).toHaveLength(60);
  });
});

describe('goldaZipFileName', () => {
  it.each([
    ['attachment; filename="TARIF_7.zip"', 'TARIF_7.zip'],
    ['attachment; filename=TARIF.zip', 'TARIF.zip'],
    ["attachment; filename*=UTF-8''TARIF-7.ZIP", 'TARIF-7.ZIP'],
  ])('reads %s', (header, name) => {
    expect(goldaZipFileName(header)).toBe(name);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['attachment'],
    ['attachment; filename="../TARIF.zip"'],
    ['attachment; filename="dir/TARIF.zip"'],
    ['attachment; filename="TARIF 7.zip"'],
    ['attachment; filename=".TARIF.zip"'],
    ['attachment; filename="TARIF.csv"'],
    ['attachment; filename="TARIF.zip.exe"'],
  ])('refuses %s', (header) => {
    expect(goldaZipFileName(header)).toBeNull();
  });
});

describe('goldaSourceLine', () => {
  const input = {
    url: DL(7, 11),
    httpStatus: 200,
    contentType: 'application/zip',
    contentDispositionFilename: 'TARIF_7.zip',
    file: 'TARIF_7.zip',
    bytes: 1234,
    sha256: 'b'.repeat(64),
    fetchedAt: '2026-03-02T10:00:00.000Z',
    publication: pub({ lastUpdated: '2026-02-20' }),
    extractFile: 'TARIF_7.csv',
    extractSha256: 'c'.repeat(64),
  };

  it('writes one JSON line with the provenance keys in a fixed order', () => {
    const l = goldaSourceLine(input);
    expect(l.endsWith('}\n')).toBe(true);
    expect(l.split('\n')).toHaveLength(2);
    expect(Object.keys(JSON.parse(l))).toEqual([
      'source',
      'url',
      'http_status',
      'content_type',
      'content_disposition_filename',
      'file',
      'bytes',
      'sha256',
      'fetched_at',
      'html',
      'golda_application_date',
      'golda_last_updated',
      'extract_file',
      'extract_sha256',
    ]);
    expect(JSON.parse(l)).toMatchObject({
      source: 'golda',
      html: false,
      golda_application_date: '2026-03-01',
      golda_last_updated: '2026-02-20',
    });
  });

  it('round-trips: the line it writes makes the same publication present', () => {
    const idx = indexGoldaStore([src(SRC, goldaSourceLine(input).trimEnd())]);
    expect(planGoldaStore(idx, 7, TITLE, input.publication, only(DIR))).toEqual(
      {
        action: 'present',
        dir: DIR,
      },
    );
    // …and a later update of the fiche is fetched, not mistaken for it.
    expect(
      planGoldaStore(
        idx,
        7,
        TITLE,
        { ...input.publication, lastUpdated: '2026-03-04' },
        only(DIR),
      ),
    ).toEqual({
      action: 'fetch',
      dir: 'marque-a/2026-03-01/complet-maj-2026-03-04',
    });
  });
});
