import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { RawAcquisitionClientService } from './raw-acquisition-client.service';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));
const execute = execFile as unknown as jest.Mock;
const id = 'a'.repeat(64);
const receipt = {
  id,
  action: 'RECEIVED',
  destination: 'raw',
  raw_path: `recycled/admin-submissions/${id}.md`,
  content_hash: `sha256:${'b'.repeat(64)}`,
  status: 'to_verify',
  retrievable: false,
  duplicate: false,
};
const doc = {
  title: 'Filtre',
  content: 'Contenu technique soumis.',
  source: 'manual/filtre',
};

function client(configured = true) {
  return new RawAcquisitionClientService({
    get: (name: string) =>
      configured
        ? {
            RAW_ACQUISITION_SCRIPT:
              '/trusted/raw/_scripts/auto-capture-runner.py',
            RAW_GITLEAKS_BIN: '/trusted/bin/gitleaks',
            RAW_FFPROBE_BIN: '/trusted/bin/ffprobe',
          }[name]
        : undefined,
  } as unknown as ConfigService);
}

function result(output: unknown, error: unknown = null) {
  const end = jest.fn();
  execute.mockImplementation((_cmd, _args, _opts, callback) => {
    callback(
      error,
      typeof output === 'string' ? output : JSON.stringify(output),
      '',
    );
    return { stdin: { on: jest.fn(), end } };
  });
  return end;
}

beforeEach(() => execute.mockReset());

describe('RAW acquisition boundary', () => {
  it('passes declared material over stdin and strips browser authority', async () => {
    const end = result(receipt);
    expect(
      await client().receiveDocument({
        ...doc,
        truth_level: 'L1',
        retrievable: true,
        decision: { proposed: { status: 'active' } },
        fingerprint: 'forged',
      }),
    ).toEqual(receipt);
    expect(JSON.parse(end.mock.calls[0][0])).toEqual(doc);
    expect(execute.mock.calls[0][0]).toBe('/usr/bin/timeout');
    expect(execute.mock.calls[0][1]).toEqual([
      '--kill-after=5s',
      '220s',
      'python3',
      '/trusted/raw/_scripts/auto-capture-runner.py',
      '--submission-stdin',
      '--commit',
      '--json',
    ]);
    expect(execute.mock.calls[0][2].env).not.toHaveProperty(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    expect(execute.mock.calls[0][2]).not.toHaveProperty('shell');
  });

  it('refuses an unavailable producer without a fallback', async () => {
    await expect(client(false).receiveDocument(doc)).rejects.toMatchObject({
      status: 503,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('validates before invoking the producer', async () => {
    await expect(
      client().receiveDocument({ ...doc, content: null }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      client().receiveDocument({ ...doc, content: 'é'.repeat(600_000) }),
    ).rejects.toMatchObject({ status: 400 });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    'not-json',
    { ...receipt, retrievable: true },
    { ...receipt, status: 'active' },
    { ...receipt, action: 'PLAN' },
    { ...receipt, raw_path: '../escape.md' },
    { ...receipt, id: 'c'.repeat(64) },
  ])(
    'rejects malformed or authority-bearing producer receipts: %p',
    async (output) => {
      result(output);
      await expect(client().receiveDocument(doc)).rejects.toMatchObject({
        status: 503,
      });
    },
  );

  it('distinguishes a material rejection from producer failure', async () => {
    result(
      { action: 'ERROR', destination: 'raw', error: 'ValueError' },
      { code: 1 },
    );
    await expect(client().receiveDocument(doc)).rejects.toMatchObject({
      status: 422,
    });
    result(
      { action: 'ERROR', destination: 'raw', error: 'FileNotFoundError' },
      { code: 1 },
    );
    await expect(client().receiveDocument(doc)).rejects.toMatchObject({
      status: 503,
    });
  });

  it('never treats a timed-out process as a successful receipt', async () => {
    result(receipt, { killed: true, code: 1 });
    await expect(client().receiveDocument(doc)).rejects.toMatchObject({
      status: 503,
    });
  });

  it('keeps duplicate identity in the receipt', async () => {
    result({ ...receipt, duplicate: true });
    expect(await client().receiveDocument(doc)).toMatchObject({
      id,
      duplicate: true,
      retrievable: false,
    });
  });
});

const mediaReceipt = {
  ...receipt,
  raw_path: `sources/auto-captures/media/${id}.md`,
  media_path: `sources/media/${'c'.repeat(64)}.mp4`,
  media_hash: `sha256:${'c'.repeat(64)}`,
  ext: 'mp4',
  size_bytes: 1000,
  duration_sec: 1,
};

describe('RAW direct video boundary', () => {
  it('routes only source declarations to the native media producer', async () => {
    const end = result(mediaReceipt);
    expect(
      await client().receiveVideo({
        url: 'https://www.bosch.com/video.mp4',
        gamme: 'freinage',
        retrievable: true,
      }),
    ).toEqual(mediaReceipt);
    expect(JSON.parse(end.mock.calls[0][0])).toEqual({
      url: 'https://www.bosch.com/video.mp4',
      gamme: 'freinage',
    });
    expect(execute.mock.calls[0][1]).toContain('--video-stdin');
    expect(execute.mock.calls[0][2].env).toEqual({
      PATH: process.env.PATH,
      LANG: 'C.UTF-8',
      RAW_GITLEAKS_BIN: '/trusted/bin/gitleaks',
      RAW_FFPROBE_BIN: '/trusted/bin/ffprobe',
    });
  });

  it('refuses a missing media inspector before spawning a process', async () => {
    const service = new RawAcquisitionClientService({
      get: (name: string) =>
        name === 'RAW_FFPROBE_BIN' ? undefined : '/trusted/producer',
    } as unknown as ConfigService);
    await expect(
      service.receiveVideo({ url: 'https://www.bosch.com/video.mp4' }),
    ).rejects.toMatchObject({ status: 503 });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    { ...mediaReceipt, media_path: '../escape.mp4' },
    { ...mediaReceipt, media_hash: `sha256:${'d'.repeat(64)}` },
    { ...mediaReceipt, duration_sec: 601 },
    { ...mediaReceipt, size_bytes: 64 * 1024 * 1024 + 1 },
    { ...mediaReceipt, raw_path: receipt.raw_path },
    { ...mediaReceipt, retrievable: true },
  ])('rejects an inconsistent media receipt', async (output) => {
    result(output);
    await expect(
      client().receiveVideo({ url: 'https://www.bosch.com/video.mp4' }),
    ).rejects.toMatchObject({ status: 503 });
  });
});
