import { crc32, deflateRawSync } from 'node:zlib';
import {
  GOLDA_ARCHIVE_LIMITS,
  GoldaArchiveError,
  extractGoldaTariffCsv,
} from '../golda-tariff-archive';

const CSV = Buffer.from(
  'Code_marque;Ref\r\nTSTA;X100\r\nTSTA;X200\r\n',
  'latin1',
);

interface Member {
  name?: string;
  data?: Buffer;
  method?: number;
  flags?: number;
  /** Declared CRC / sizes, when a test lies about them. */
  crc?: number;
  size?: number;
  /** High byte of "version made by" (3 = Unix) and the Unix mode it carries. */
  madeBy?: number;
  mode?: number;
  /** Local header values, when a test makes them disagree with the central directory. */
  localName?: string;
  localMethod?: number;
  localFlags?: number;
  localCrc?: number;
  localCompSize?: number;
  localSize?: number;
}

interface ZipOpts {
  leading?: Buffer;
  comment?: string;
  trailing?: Buffer;
}

/** A zip built byte by byte (no zip library in the repo). */
function zip(members: Member[] = [{}], o: ZipOpts = {}): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = o.leading?.length ?? 0;
  for (const m of members) {
    const name = Buffer.from(m.name ?? 'TARIF_TSTA.csv', 'latin1');
    const data = m.data ?? CSV;
    const method = m.method ?? 8;
    const body = method === 8 ? deflateRawSync(data) : data;
    const crc = m.crc ?? crc32(data);
    const size = m.size ?? data.length;
    const flags = m.flags ?? 0;
    const localName = Buffer.from(
      m.localName ?? name.toString('latin1'),
      'latin1',
    );

    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0);
    loc.writeUInt16LE(20, 4);
    loc.writeUInt16LE(m.localFlags ?? flags, 6);
    loc.writeUInt16LE(m.localMethod ?? method, 8);
    loc.writeUInt32LE(m.localCrc ?? crc, 14);
    loc.writeUInt32LE(m.localCompSize ?? body.length, 18);
    loc.writeUInt32LE(m.localSize ?? size, 22);
    loc.writeUInt16LE(localName.length, 26);
    const local = Buffer.concat([loc, localName, body]);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(((m.madeBy ?? 0) << 8) | 20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(flags, 8);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(size, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(((m.mode ?? 0) << 16) >>> 0, 38);
    cen.writeUInt32LE(offset, 42);

    locals.push(local);
    centrals.push(Buffer.concat([cen, name]));
    offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  const comment = Buffer.from(o.comment ?? '', 'latin1');
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(members.length, 8);
  eocd.writeUInt16LE(members.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(comment.length, 20);
  return Buffer.concat([
    o.leading ?? Buffer.alloc(0),
    ...locals,
    cd,
    eocd,
    comment,
    o.trailing ?? Buffer.alloc(0),
  ]);
}

const refuses = (z: Uint8Array, msg: RegExp, limits = GOLDA_ARCHIVE_LIMITS) => {
  expect(() => extractGoldaTariffCsv(z, limits)).toThrow(GoldaArchiveError);
  expect(() => extractGoldaTariffCsv(z, limits)).toThrow(msg);
};

describe('extractGoldaTariffCsv — accepted shape', () => {
  it('extracts the single deflated CSV member', () => {
    expect(extractGoldaTariffCsv(zip())).toEqual({
      name: 'TARIF_TSTA.csv',
      bytes: CSV,
    });
  });

  it('extracts a stored (uncompressed) member', () => {
    expect(extractGoldaTariffCsv(zip([{ method: 0 }])).bytes).toEqual(CSV);
  });

  it('reads a Uint8Array view that does not start at offset 0', () => {
    const z = zip();
    const host = new Uint8Array(z.length + 7);
    host.set(z, 3);
    expect(extractGoldaTariffCsv(host.subarray(3, 3 + z.length)).bytes).toEqual(
      CSV,
    );
  });

  it('accepts a Unix regular-file mode, and ignores the mode of a non-Unix zip', () => {
    expect(
      extractGoldaTariffCsv(zip([{ madeBy: 3, mode: 0o100644 }])).name,
    ).toBe('TARIF_TSTA.csv');
    expect(
      extractGoldaTariffCsv(zip([{ madeBy: 0, mode: 0o120777 }])).name,
    ).toBe('TARIF_TSTA.csv');
  });
});

describe('extractGoldaTariffCsv — anything else throws GoldaArchiveError', () => {
  it('a buffer too short to be a zip, or not a zip', () => {
    refuses(Buffer.alloc(10), /too short/);
    refuses(Buffer.alloc(200), /no end-of-central-directory/);
  });

  it('two members', () => {
    refuses(zip([{}, { name: 'B.csv' }]), /expected one member, found 2/);
  });

  it('an archive comment, or bytes after the end record', () => {
    refuses(zip([{}], { comment: 'x' }), /no end-of-central-directory/);
    refuses(
      zip([{}], { trailing: Buffer.from('xx') }),
      /no end-of-central-directory/,
    );
  });

  it('bytes before the first member', () => {
    refuses(
      zip([{}], { leading: Buffer.from('PK junk') }),
      /data before the first member/,
    );
  });

  it('a member name that is a path or not a .csv file', () => {
    for (const name of [
      'dir/TARIF.csv',
      '../TARIF.csv',
      '.TARIF.csv',
      'TARIF.txt',
      'TARIF.csv.exe',
    ])
      refuses(zip([{ name }]), /not a plain \.csv file name/);
  });

  it('an encrypted member, or one with a data descriptor', () => {
    refuses(zip([{ flags: 0x0001 }]), /encrypted/);
    refuses(zip([{ flags: 0x0040 }]), /encrypted/);
    refuses(zip([{ flags: 0x0008 }]), /data descriptor/);
  });

  it('a compression method other than deflate or stored', () => {
    refuses(zip([{ method: 12 }]), /compression method 12/);
  });

  it('a Unix member that is not a regular file (symbolic link, directory)', () => {
    refuses(zip([{ madeBy: 3, mode: 0o120777 }]), /not a regular file/);
    refuses(zip([{ madeBy: 3, mode: 0o040755 }]), /not a regular file/);
  });

  it('a local header that disagrees with the central directory', () => {
    const crc = crc32(CSV);
    for (const local of [
      { localFlags: 0x0800 },
      { localMethod: 0 },
      { localCrc: (crc ^ 1) >>> 0 },
      { localCompSize: deflateRawSync(CSV).length + 1 },
      { localSize: CSV.length + 1 },
    ])
      refuses(zip([local]), /disagree/);
    refuses(zip([{ localName: 'TARIF_TSTB.csv' }]), /names differ/);
  });

  it('a CRC-32 that does not match the content', () => {
    refuses(zip([{ crc: (crc32(CSV) ^ 1) >>> 0 }]), /CRC-32 mismatch/);
  });

  it('a declared size that is not the inflated size', () => {
    // Over by 2+ bytes: inflate stops at its cap; over by 1 or short: the length check.
    refuses(
      zip([{ size: CSV.length - 2 }]),
      /does not inflate within its declared size/,
    );
    refuses(zip([{ size: CSV.length - 1 }]), /inflated size differs/);
    refuses(zip([{ size: CSV.length + 1 }]), /inflated size differs/);
    refuses(
      zip([{ method: 0, size: CSV.length + 1 }]),
      /stored member sizes differ/,
    );
  });

  it('a member over the size limit or the compression ratio limit', () => {
    refuses(zip(), /larger than 10 bytes/, { maxBytes: 10, maxRatio: 100 });
    const bomb = Buffer.alloc(1_000_000, 0x41);
    expect(bomb.length / deflateRawSync(bomb).length).toBeGreaterThan(100);
    refuses(zip([{ data: bomb }]), /compression ratio over the limit/);
  });
});

describe('extractGoldaTariffCsv — each structural guard refuses on its own', () => {
  const EOCD = 22;
  /** A copy of the valid zip with one change; `e` and `c` are its end record and directory offsets. */
  const edit = (f: (z: Buffer, e: number, c: number) => void): Buffer => {
    const z = zip();
    const e = z.length - EOCD;
    f(z, e, z.readUInt32LE(e + 16));
    return z;
  };

  it('the unchanged copy is accepted, so each refusal below comes from its one edit', () => {
    expect(extractGoldaTariffCsv(edit(() => undefined)).bytes).toEqual(CSV);
  });

  it('a multi-disk archive or member', () => {
    refuses(
      edit((z, e) => z.writeUInt16LE(1, e + 4)),
      /multi-disk archive/,
    );
    refuses(
      edit((z, e) => z.writeUInt16LE(1, e + 6)),
      /multi-disk archive/,
    );
    refuses(
      edit((z, _e, c) => z.writeUInt16LE(1, c + 34)),
      /multi-disk member/,
    );
  });

  it('zip64 sentinels in the end record or in the member', () => {
    refuses(
      edit((z, e) => z.writeUInt16LE(0xffff, e + 10)),
      /zip64 archive/,
    );
    refuses(
      edit((z, e) => z.writeUInt32LE(0xffffffff, e + 12)),
      /zip64 archive/,
    );
    refuses(
      edit((z, e) => z.writeUInt32LE(0xffffffff, e + 16)),
      /zip64 archive/,
    );
    for (const at of [20, 24, 42])
      refuses(
        edit((z, _e, c) => z.writeUInt32LE(0xffffffff, c + at)),
        /zip64 member/,
      );
  });

  it('a comment length with no comment bytes', () => {
    refuses(
      edit((z, e) => z.writeUInt16LE(5, e + 20)),
      /archive comment/,
    );
  });

  it('a central directory offset off by one', () => {
    for (const delta of [1, -1])
      refuses(
        edit((z, e, c) => z.writeUInt32LE(c + delta, e + 16)),
        /central directory does not end at the end record/,
      );
  });

  it('a zeroed central directory or local header signature', () => {
    refuses(
      edit((z, _e, c) => z.writeUInt32LE(0, c)),
      /bad central directory signature/,
    );
    refuses(
      edit((z) => z.writeUInt32LE(0, 0)),
      /bad local header signature/,
    );
  });

  it('a central directory longer than its one entry', () => {
    const z = zip();
    const e = z.length - EOCD;
    const padded = Buffer.concat([
      z.subarray(0, e),
      Buffer.alloc(4),
      z.subarray(e),
    ]);
    padded.writeUInt32LE(z.readUInt32LE(e + 12) + 4, e + 4 + 12);
    refuses(padded, /central directory holds more than one entry/);
  });

  it('a byte between the member data and the directory, or an unaccounted local extra field', () => {
    const z = zip();
    const c = z.readUInt32LE(z.length - EOCD + 16);
    const gap = Buffer.concat([
      z.subarray(0, c),
      Buffer.alloc(1),
      z.subarray(c),
    ]);
    gap.writeUInt32LE(c + 1, gap.length - EOCD + 16);
    refuses(gap, /member data does not end at the central directory/);
    refuses(
      edit((b) => b.writeUInt16LE(1, 28)),
      /member data does not end at the central directory/,
    );
  });
});

describe('extractGoldaTariffCsv — a central directory shorter than one entry', () => {
  it('throws GoldaArchiveError, never a RangeError from reading past the buffer', () => {
    for (const len of [4, 10, 23, 45]) {
      const z = zip();
      const e = z.length - 22;
      z.writeUInt32LE(len, e + 12);
      z.writeUInt32LE(e - len, e + 16);
      z.writeUInt32LE(0x02014b50, e - len);
      refuses(z, /central directory shorter than one entry/);
    }
  });
});
