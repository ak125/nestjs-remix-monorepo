import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { z } from 'zod';

const submissionSchema = z.object({
  title: z.string().trim().min(1).max(1000),
  content: z.string().min(1).max(900_000),
  source: z.string().trim().min(1).max(2000),
  source_url: z.string().max(4000).optional(),
  domain: z.string().max(200).optional(),
  category: z.string().max(200).optional(),
});

const receiptSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  action: z.literal('RECEIVED'),
  destination: z.literal('raw'),
  raw_path: z.string().regex(/^recycled\/admin-submissions\/[a-f0-9]{64}\.md$/),
  content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  status: z.literal('to_verify'),
  retrievable: z.literal(false),
  duplicate: z.boolean(),
});

const videoSchema = z.object({
  url: z.string().trim().min(1).max(4000),
  gamme: z.string().max(200).optional(),
  type: z.string().max(200).optional(),
});

const videoReceiptSchema = receiptSchema.extend({
  raw_path: z
    .string()
    .regex(/^sources\/auto-captures\/media\/[a-f0-9]{64}\.md$/),
  media_path: z.string(),
  media_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  ext: z.enum(['mp4', 'mov', 'webm', 'mkv']),
  size_bytes: z
    .number()
    .int()
    .positive()
    .max(64 * 1024 * 1024),
  duration_sec: z.number().positive().max(600),
});

export type RawVideoAcquisitionReceipt = z.infer<typeof videoReceiptSchema>;
export type RawAcquisitionReceipt = z.infer<typeof receiptSchema>;

/**
 * Calls the RAW-owned producer. No DB writes and no consumer fallback.
 * The deployment must provide the producer script and its secret scanner;
 * AUTOMECANIK_RAW_PATH remains a consumer setting, never a writable destination.
 */
@Injectable()
export class RawAcquisitionClientService {
  constructor(private readonly config: ConfigService) {}

  async receiveDocument(input: unknown): Promise<RawAcquisitionReceipt> {
    // Only declared source material crosses this boundary. A browser-provided
    // decision, truth level, fingerprint or retrievable flag has no authority.
    const parsed = submissionSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException('Invalid RAW document submission');
    }
    const body = JSON.stringify(parsed.data);
    if (Buffer.byteLength(body, 'utf8') > 1024 * 1024) {
      throw new BadRequestException('RAW document submission is too large');
    }
    const decoded = await this.invokeProducer(body, '--submission-stdin');
    const receipt = receiptSchema.safeParse(decoded);
    if (
      !receipt.success ||
      receipt.data.raw_path !==
        `recycled/admin-submissions/${receipt.data.id}.md`
    ) {
      throw new ServiceUnavailableException('Invalid RAW acquisition receipt');
    }
    return receipt.data;
  }

  async receiveVideo(input: unknown): Promise<RawVideoAcquisitionReceipt> {
    const parsed = videoSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException('Invalid RAW video submission');
    }
    const decoded = await this.invokeProducer(
      JSON.stringify(parsed.data),
      '--video-stdin',
    );
    const receipt = videoReceiptSchema.safeParse(decoded);
    if (
      !receipt.success ||
      receipt.data.raw_path !==
        `sources/auto-captures/media/${receipt.data.id}.md` ||
      receipt.data.media_path !==
        `sources/media/${receipt.data.media_hash.slice(7)}.${receipt.data.ext}`
    ) {
      throw new ServiceUnavailableException('Invalid RAW video receipt');
    }
    return receipt.data;
  }

  private async invokeProducer(
    body: string,
    mode: '--submission-stdin' | '--video-stdin',
  ): Promise<unknown> {
    const script = this.config.get<string>('RAW_ACQUISITION_SCRIPT');
    const scanner = this.config.get<string>('RAW_GITLEAKS_BIN');
    const probe = this.config.get<string>('RAW_FFPROBE_BIN');
    if (mode === '--video-stdin' && (!probe || !isAbsolute(probe))) {
      throw new ServiceUnavailableException(
        'RAW media inspector is not configured',
      );
    }
    if (!script || !isAbsolute(script) || !scanner || !isAbsolute(scanner)) {
      throw new ServiceUnavailableException(
        'RAW acquisition producer is not configured',
      );
    }

    const output = await new Promise<{
      stdout: string;
      code: string | number | null;
    }>((resolve, reject) => {
      const child = execFile(
        '/usr/bin/timeout',
        [
          '--kill-after=5s',
          '220s',
          'python3',
          script,
          mode,
          '--commit',
          '--json',
        ],
        {
          encoding: 'utf8',
          // GNU timeout owns the subprocess group and terminates descendants.
          // Network 90s + probe 12s + scanner 15s + manifests 60s fit inside it.
          timeout: 240_000,
          maxBuffer: 64 * 1024,
          // The producer does not inherit database, GitHub or application tokens.
          env: {
            PATH: process.env.PATH,
            LANG: 'C.UTF-8',
            RAW_GITLEAKS_BIN: scanner,
            ...(mode === '--video-stdin' ? { RAW_FFPROBE_BIN: probe } : {}),
          },
        },
        (error, stdout) => {
          if (error && (error.killed || error.code !== 1)) {
            reject(
              new ServiceUnavailableException(
                'RAW acquisition producer is unavailable',
              ),
            );
            return;
          }
          resolve({ stdout, code: error?.code ?? 0 });
        },
      );
      child.stdin?.on('error', () => {
        reject(
          new ServiceUnavailableException(
            'RAW acquisition producer input failed',
          ),
        );
      });
      child.stdin?.end(body);
    });

    let decoded: unknown;
    try {
      decoded = JSON.parse(output.stdout);
    } catch {
      throw new ServiceUnavailableException('Invalid RAW acquisition receipt');
    }
    if (output.code !== 0) {
      const refusal = z
        .object({
          action: z.literal('ERROR'),
          destination: z.literal('raw'),
          error: z.string(),
        })
        .safeParse(decoded);
      if (refusal.success && refusal.data.error === 'ValueError') {
        throw new UnprocessableEntityException(
          'RAW rejected the submitted source material',
        );
      }
      throw new ServiceUnavailableException(
        'RAW acquisition could not be completed',
      );
    }
    return decoded;
  }
}
