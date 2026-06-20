/**
 * TtsService — Text-to-Speech via Microsoft Neural voices over the **Azure Speech REST API**.
 *
 * SECURITY (revival 2026-06-20): the previous implementation used `msedge-tts` +
 * `edge-tts-universal`, which transitively pulled a vulnerable `axios` (critical SSRF CVE) and
 * led to the whole MediaFactory module being deleted (#7468868f2). House convention is `fetch`,
 * not axios. This rewrite uses **native `fetch`** against the official Azure Speech REST endpoint
 * with the SAME Microsoft Neural voices (`fr-FR-HenriNeural`, …) — **zero new npm dependency,
 * zero axios, zero WebSocket**. Provider is config-gated: disabled unless `AZURE_SPEECH_KEY` is
 * set (mirrors the Groq `script-generator` guard). The S3/MinIO upload is also `fetch`-based.
 *
 * Called from dashboard: POST /api/admin/video/productions/:briefId/generate-audio
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { AudioCacheService } from './audio-cache.service';

export type TtsVoice = 'onyx' | 'nova' | 'alloy' | 'echo' | 'shimmer' | 'fable';

// Map legacy OpenAI voice names to Microsoft Neural TTS voices (French).
// Valid for both the legacy edge-tts path AND the Azure Speech REST API (same voice catalog).
const VOICE_MAP: Record<TtsVoice, string> = {
  onyx: 'fr-FR-HenriNeural', // Masculin, grave, documentaire
  nova: 'fr-FR-DeniseNeural', // Feminin, chaleureuse
  alloy: 'fr-FR-AlainNeural', // Masculin, neutre
  echo: 'fr-FR-EloiseNeural', // Feminin, jeune
  shimmer: 'fr-FR-DeniseNeural', // Fallback feminin
  fable: 'fr-FR-HenriNeural', // Fallback masculin
};

// Map speed (0.5-2.0) to SSML prosody rate format (e.g. '-10%', '+20%') — identical on Azure.
function speedToRate(speed: number): string {
  const pct = Math.round((speed - 1.0) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

// Minimal XML escaping for SSML payload (defense against malformed/injected text).
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface GenerateAudioInput {
  briefId: string;
  text: string;
  voice?: TtsVoice;
  speed?: number;
  regenerate?: boolean;
}

export interface GenerateAudioResult {
  audioUrl: string;
  durationSecs: number | null;
  cached: boolean;
  costChars: number;
  voice: TtsVoice;
  speed: number;
  model: string;
}

@Injectable()
export class TtsService extends SupabaseBaseService {
  protected override readonly logger = new Logger(TtsService.name);

  private readonly defaultVoice: TtsVoice;
  private readonly defaultSpeed: number;
  private readonly enabled: boolean;
  private readonly azureKey: string;
  private readonly azureRegion: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly audioCache: AudioCacheService,
  ) {
    super(cfg);

    this.defaultVoice = (cfg.get<string>('TTS_VOICE') || 'onyx') as TtsVoice;
    this.defaultSpeed = parseFloat(cfg.get<string>('TTS_SPEED') || '0.9');
    this.azureKey = cfg.get<string>('AZURE_SPEECH_KEY') ?? '';
    this.azureRegion =
      cfg.get<string>('AZURE_SPEECH_REGION') ?? 'francecentral';
    // Off by default unless explicitly enabled AND a key is present (fetch-only, no axios).
    this.enabled =
      cfg.get<string>('TTS_ENABLED') !== 'false' && this.azureKey !== '';
  }

  /**
   * Generate TTS audio from text using Microsoft Neural voices via Azure Speech REST (fetch).
   * Returns cached version if same text+voice+speed already exists.
   */
  async generateAudio(input: GenerateAudioInput): Promise<GenerateAudioResult> {
    if (!this.enabled) {
      throw new BadRequestException(
        'TTS désactivé : configurer AZURE_SPEECH_KEY (fetch-only, sans axios) ou TTS_ENABLED=false.',
      );
    }

    const voice = input.voice || this.defaultVoice;
    const speed = input.speed ?? this.defaultSpeed;
    const text = input.text.trim();

    if (!text) {
      throw new BadRequestException('Text is empty — cannot generate TTS');
    }

    const costChars = text.length;

    // Compute cache key = SHA256(text + voice + speed)
    const cacheKey = this.computeCacheKey(text, voice, speed);

    // Check cache (unless regenerate=true)
    if (!input.regenerate) {
      const cached = await this.audioCache.get(cacheKey);
      if (cached) {
        this.logger.log(
          `[TTS] Cache hit for ${input.briefId} (key=${cacheKey.slice(0, 12)}...)`,
        );

        await this.updateProductionAudio(
          input.briefId,
          cached.url,
          voice,
          speed,
        );

        return {
          audioUrl: cached.url,
          durationSecs: cached.durationSecs,
          cached: true,
          costChars,
          voice,
          speed,
          model: 'azure-neural',
        };
      }
    }

    // Generate via Azure Speech REST (fetch, native — no axios / no WebSocket).
    const azureVoice = VOICE_MAP[voice] || 'fr-FR-HenriNeural';
    const rate = speedToRate(speed);

    this.logger.log(
      `[TTS] Generating audio for ${input.briefId}: ${costChars} chars, voice=${azureVoice}, rate=${rate}`,
    );

    const buffer = await this.synthesizeAzure(text, azureVoice, rate);

    if (buffer.length === 0) {
      throw new Error('Azure Speech returned empty audio');
    }

    // Upload to S3/MinIO via Supabase Storage-compatible endpoint (fetch + AWS SigV4).
    const s3Path = `tts/${cacheKey}.mp3`;
    const audioUrl = await this.uploadToStorage(s3Path, buffer);

    // Estimate duration (rough: ~150 words/min at speed=1.0)
    const wordCount = text.split(/\s+/).length;
    const estimatedDurationSecs = Math.round(((wordCount / 150) * 60) / speed);

    await this.audioCache.set(cacheKey, {
      url: audioUrl,
      durationSecs: estimatedDurationSecs,
      voice: azureVoice,
      speed,
      charCount: costChars,
    });

    await this.updateProductionAudio(input.briefId, audioUrl, voice, speed);

    this.logger.log(
      `[TTS] Generated ${s3Path} (~${estimatedDurationSecs}s) for ${input.briefId}`,
    );

    return {
      audioUrl,
      durationSecs: estimatedDurationSecs,
      cached: false,
      costChars,
      voice,
      speed,
      model: 'azure-neural',
    };
  }

  /**
   * Synthesize speech via the Azure Speech REST API using native fetch.
   * Same Microsoft Neural voice catalog as the legacy edge-tts path. No npm dependency.
   */
  private async synthesizeAzure(
    text: string,
    azureVoice: string,
    rate: string,
  ): Promise<Buffer> {
    const endpoint = `https://${this.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const ssml =
      `<speak version='1.0' xml:lang='fr-FR'>` +
      `<voice name='${azureVoice}'>` +
      `<prosody rate='${rate}'>${escapeXml(text)}</prosody>` +
      `</voice></speak>`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.azureKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'automecanik-media-factory',
        },
        body: ssml,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(
          `Azure Speech error (${res.status}): ${errText.slice(0, 200)}`,
        );
      }

      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } finally {
      clearTimeout(timeout);
    }
  }

  private computeCacheKey(text: string, voice: string, speed: number): string {
    return createHash('sha256')
      .update(`${text}|${voice}|${speed}`)
      .digest('hex');
  }

  private async updateProductionAudio(
    briefId: string,
    audioUrl: string,
    voice: TtsVoice,
    speed: number,
  ): Promise<void> {
    const { error } = await this.client
      .from('__video_productions')
      .update({
        master_audio_url: audioUrl,
        tts_voice: voice,
        tts_speed: speed,
        updated_at: new Date().toISOString(),
      })
      .eq('brief_id', briefId);

    if (error) {
      this.logger.error(`updateProductionAudio error: ${error.message}`);
    }
  }

  /**
   * Upload audio to S3/MinIO using native fetch + AWS Signature V4 (no axios, no node:http).
   */
  private async uploadToStorage(path: string, buffer: Buffer): Promise<string> {
    const endpoint =
      this.cfg.get<string>('S3_ENDPOINT') ?? 'http://localhost:9000';
    const accessKey = this.cfg.get<string>('S3_ACCESS_KEY');
    const secretKey = this.cfg.get<string>('S3_SECRET_KEY');
    const region = this.cfg.get<string>('S3_REGION') ?? 'eu-central-1';
    const bucket =
      this.cfg.get<string>('S3_BUCKET_NAME') ?? 'automecanik-renders';

    if (!accessKey || !secretKey) {
      throw new Error('S3_ACCESS_KEY / S3_SECRET_KEY required for MinIO');
    }

    const url = new URL(`/${bucket}/${path}`, endpoint);
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8);
    const amzDate = `${dateStamp}T${now
      .toISOString()
      .replace(/[-:]/g, '')
      .slice(9, 15)}Z`;
    const contentHash = createHash('sha256').update(buffer).digest('hex');

    const headers: Record<string, string> = {
      Host: url.host,
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(buffer.length),
      'x-amz-content-sha256': contentHash,
      'x-amz-date': amzDate,
    };

    // AWS Signature V4
    const signedHeaderKeys = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort();
    const signedHeaders = signedHeaderKeys.join(';');
    const headerLookup = new Map(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const canonicalHeaders =
      signedHeaderKeys.map((k) => `${k}:${headerLookup.get(k)}`).join('\n') +
      '\n';

    const canonicalRequest = [
      'PUT',
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      contentHash,
    ].join('\n');

    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const hmac = (key: Buffer | string, data: string) =>
      createHmac('sha256', key).update(data).digest();
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), 's3'),
      'aws4_request',
    );
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    headers['Authorization'] =
      `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: new Uint8Array(buffer),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(
          `MinIO PUT failed (${res.status}): ${body.slice(0, 200)}`,
        );
      }
      return `${endpoint}/${bucket}/${path}`;
    } finally {
      clearTimeout(timeout);
    }
  }
}
