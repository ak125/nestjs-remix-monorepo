/**
 * L0 — Golda tariff archive reader (pure, zero I/O, no dependency).
 *
 * A Golda CSV download is a zip holding exactly ONE `.csv` member, deflated,
 * no encryption, no data descriptor, no zip64, no archive comment. The reader
 * accepts that shape and nothing else, reading the central directory and the
 * local header and requiring them to agree byte for byte: one member, a plain
 * file name, sizes under the limits, inflated size and CRC-32 as declared.
 * A downloaded file is untrusted input: anything unexpected throws
 * `GoldaArchiveError` and nothing is extracted.
 */
import { crc32, inflateRawSync } from 'node:zlib';

export class GoldaArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoldaArchiveError';
  }
}

export interface GoldaArchiveLimits {
  /** Max inflated size of the CSV member, in bytes. */
  maxBytes: number;
  /** Max inflated / compressed size ratio. */
  maxRatio: number;
}

/** Real files: ≤ 15 MB inflated, ratio ≤ 15 — the defaults leave a wide margin. */
export const GOLDA_ARCHIVE_LIMITS: GoldaArchiveLimits = {
  maxBytes: 100 * 1024 * 1024,
  maxRatio: 100,
};

export interface GoldaCsvMember {
  name: string;
  bytes: Buffer;
}

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;
const EOCD_LEN = 22;
const CEN_LEN = 46;
const LOC_LEN = 30;
const FLAG_ENCRYPTED = 0x0001;
const FLAG_DATA_DESCRIPTOR = 0x0008;
const FLAG_STRONG_ENCRYPTION = 0x0040;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const S_IFMT = 0o170000;
const S_IFREG = 0o100000;
const MEMBER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.csv$/i;

/** Extract the single CSV member of a Golda tariff zip. */
export function extractGoldaTariffCsv(
  zip: Uint8Array,
  limits: GoldaArchiveLimits = GOLDA_ARCHIVE_LIMITS,
): GoldaCsvMember {
  const buf = Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength);
  const fail = (msg: string): never => {
    throw new GoldaArchiveError(msg);
  };
  if (buf.length < LOC_LEN + CEN_LEN + EOCD_LEN) fail('too short for a zip');

  // End of central directory: no archive comment ⇒ exactly the last 22 bytes.
  const eocd = buf.length - EOCD_LEN;
  if (buf.readUInt32LE(eocd) !== EOCD_SIG)
    fail('no end-of-central-directory record (or a trailing comment)');
  const diskNo = buf.readUInt16LE(eocd + 4);
  const cdDisk = buf.readUInt16LE(eocd + 6);
  const entriesOnDisk = buf.readUInt16LE(eocd + 8);
  const entries = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const commentLen = buf.readUInt16LE(eocd + 20);
  if (diskNo !== 0 || cdDisk !== 0) fail('multi-disk archive');
  if (entries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff)
    fail('zip64 archive');
  if (entriesOnDisk !== 1 || entries !== 1)
    fail(`expected one member, found ${entries}`);
  if (commentLen !== 0) fail('archive comment');
  if (cdOffset + cdSize !== eocd)
    fail('central directory does not end at the end record');
  if (cdSize < CEN_LEN) fail('central directory shorter than one entry');

  // Central directory: one entry, filling the whole directory.
  const c = cdOffset;
  if (buf.readUInt32LE(c) !== CEN_SIG) fail('bad central directory signature');
  const flags = buf.readUInt16LE(c + 8);
  const method = buf.readUInt16LE(c + 10);
  const crc = buf.readUInt32LE(c + 16);
  const compSize = buf.readUInt32LE(c + 20);
  const size = buf.readUInt32LE(c + 24);
  const nameLen = buf.readUInt16LE(c + 28);
  const extraLen = buf.readUInt16LE(c + 30);
  const entryCommentLen = buf.readUInt16LE(c + 32);
  const startDisk = buf.readUInt16LE(c + 34);
  const madeBy = buf.readUInt16LE(c + 4) >> 8;
  const externalAttrs = buf.readUInt32LE(c + 38);
  const localOffset = buf.readUInt32LE(c + 42);
  if (CEN_LEN + nameLen + extraLen + entryCommentLen !== cdSize)
    fail('central directory holds more than one entry');
  if (flags & (FLAG_ENCRYPTED | FLAG_STRONG_ENCRYPTION))
    fail('encrypted member');
  if (flags & FLAG_DATA_DESCRIPTOR) fail('data descriptor');
  if (method !== METHOD_DEFLATE && method !== METHOD_STORED)
    fail(`compression method ${method}`);
  if (
    compSize === 0xffffffff ||
    size === 0xffffffff ||
    localOffset === 0xffffffff
  )
    fail('zip64 member');
  if (startDisk !== 0) fail('multi-disk member');
  // Unix "made by": the high 16 bits are the file mode — refuse links, devices, directories.
  const mode = externalAttrs >>> 16;
  if (madeBy === 3 && mode !== 0 && (mode & S_IFMT) !== S_IFREG)
    fail('member is not a regular file');
  const name = buf.toString('latin1', c + CEN_LEN, c + CEN_LEN + nameLen);
  if (!MEMBER_NAME.test(name))
    fail('member name is not a plain .csv file name');

  // Local header: at offset 0, same values as the central directory, data up to the directory.
  if (localOffset !== 0) fail('data before the first member');
  if (buf.readUInt32LE(0) !== LOC_SIG) fail('bad local header signature');
  if (
    buf.readUInt16LE(6) !== flags ||
    buf.readUInt16LE(8) !== method ||
    buf.readUInt32LE(14) !== crc ||
    buf.readUInt32LE(18) !== compSize ||
    buf.readUInt32LE(22) !== size
  )
    fail('local header and central directory disagree');
  const localNameLen = buf.readUInt16LE(26);
  const localExtraLen = buf.readUInt16LE(28);
  if (
    localNameLen !== nameLen ||
    buf.toString('latin1', LOC_LEN, LOC_LEN + nameLen) !== name
  )
    fail('local and central member names differ');
  const dataStart = LOC_LEN + localNameLen + localExtraLen;
  if (dataStart + compSize !== cdOffset)
    fail('member data does not end at the central directory');

  if (size > limits.maxBytes)
    fail(`member larger than ${limits.maxBytes} bytes`);
  if (method === METHOD_STORED && compSize !== size)
    fail('stored member sizes differ');
  if (compSize === 0 ? size !== 0 : size / compSize > limits.maxRatio)
    fail('compression ratio over the limit');

  const data = buf.subarray(dataStart, dataStart + compSize);
  let bytes: Buffer;
  if (method === METHOD_STORED) bytes = Buffer.from(data);
  else {
    try {
      // One byte over the declared size makes an overlong stream throw instead of truncating.
      bytes = inflateRawSync(data, { maxOutputLength: size + 1 });
    } catch {
      return fail('member does not inflate within its declared size');
    }
  }
  if (bytes.length !== size)
    fail('inflated size differs from the declared size');
  if (crc32(bytes) !== crc) fail('CRC-32 mismatch');
  return { name, bytes };
}
