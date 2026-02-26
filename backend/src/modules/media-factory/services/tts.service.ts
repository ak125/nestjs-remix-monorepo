/**
 * TtsService — Text-to-Speech generation via Microsoft Edge TTS (free, no API key).
 *
 * Uses edge-tts-universal for high-quality Neural TTS voices.
 * Caches by content hash to avoid redundant synthesis.
 *
 * Called from dashboard: POST /api/admin/video/productions/:briefId/generate-audio
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { EdgeTTS } from 'edge-tts-universal';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { AudioCacheService } from './audio-cache.service';

export type TtsVoice = 'onyx' | 'nova' | 'alloy' | 'echo' | 'shimmer' | 'fable';

// Map legacy OpenAI voice names to Microsoft Neural TTS voices (French)
const VOICE_MAP: Record<TtsVoice, string> = {
  onyx: 'fr-FR-HenriNeural', // Masculin, grave, documentaire
  nova: 'fr-FR-DeniseNeural', // Feminin, chaleureuse
  alloy: 'fr-FR-AlainNeural', // Masculin, neutre
  echo: 'fr-FR-EloiseNeural', // Feminin, jeune
  shimmer: 'fr-FR-DeniseNeural', // Fallback feminin
  fable: 'fr-FR-HenriNeural', // Fallback masculin
};

// Map speed (0.5-2.0) to edge-tts rate format (e.g. '-10%', '+20%')
function speedToRate(speed: number): string {
  const pct = Math.round((speed - 1.0) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
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

  constructor(
    configService: ConfigService,
    private readonly audioCache: AudioCacheService,
  ) {
    super(configService);

    this.defaultVoice = (configService.get<string>('TTS_VOICE') ||
      'onyx') as TtsVoice;
    this.defaultSpeed = parseFloat(
      configService.get<string>('TTS_SPEED') || '0.9',
    );
    this.enabled = configService.get<string>('TTS_ENABLED') !== 'false';
  }

  /**
   * Generate TTS audio from text using Microsoft Edge Neural TTS.
   * Returns cached version if same text+voice+speed already exists.
   */
  async generateAudio(input: GenerateAudioInput): Promise<GenerateAudioResult> {
    if (!this.enabled) {
      throw new BadRequestException('TTS is disabled (TTS_ENABLED=false)');
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

        // Update production with cached URL
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
          model: 'edge-tts',
        };
      }
    }

    // Generate with edge-tts
    const edgeVoice = VOICE_MAP[voice] || 'fr-FR-HenriNeural';
    const rate = speedToRate(speed);

    this.logger.log(
      `[TTS] Generating audio for ${input.briefId}: ${costChars} chars, voice=${edgeVoice}, rate=${rate}`,
    );

    const tts = new EdgeTTS(text, edgeVoice, { rate });
    const result = await tts.synthesize();

    // Read as buffer
    const arrayBuffer = await result.audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new Error('edge-tts returned empty audio');
    }

    // Upload to S3 via Supabase Storage
    const s3Path = `tts/${cacheKey}.mp3`;
    const audioUrl = await this.uploadToStorage(s3Path, buffer);

    // Estimate duration (rough: ~150 words/min at speed=1.0)
    const wordCount = text.split(/\s+/).length;
    const estimatedDurationSecs = Math.round(((wordCount / 150) * 60) / speed);

    // Store in cache
    await this.audioCache.set(cacheKey, {
      url: audioUrl,
      durationSecs: estimatedDurationSecs,
      voice: edgeVoice,
      speed,
      charCount: costChars,
    });

    // Update production with audio URL
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
      model: 'edge-tts',
    };
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

  private async uploadToStorage(path: string, buffer: Buffer): Promise<string> {
    const bucket = 'automecanik-renders';

    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (error) {
      this.logger.error(`Storage upload error: ${error.message}`);
      throw error;
    }

    const { data } = this.client.storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  }
}
