/**
 * AudioCacheService — S3-backed cache for TTS audio files.
 *
 * Stores metadata in __video_audio_cache table (Supabase).
 * Key = SHA256(text + voice + speed) → avoids redundant OpenAI API calls.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface AudioCacheEntry {
  url: string;
  durationSecs: number | null;
  voice: string;
  speed: number;
  charCount: number;
}

@Injectable()
export class AudioCacheService extends SupabaseBaseService {
  protected override readonly logger = new Logger(AudioCacheService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Get cached audio entry by hash key.
   */
  async get(cacheKey: string): Promise<AudioCacheEntry | null> {
    const { data, error } = await this.client
      .from('__video_audio_cache')
      .select('url, duration_secs, voice, speed, char_count')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) return null;

    return {
      url: data.url as string,
      durationSecs: data.duration_secs as number | null,
      voice: data.voice as string,
      speed: data.speed as number,
      charCount: data.char_count as number,
    };
  }

  /**
   * Store a cache entry.
   */
  async set(cacheKey: string, entry: AudioCacheEntry): Promise<void> {
    const { error } = await this.client.from('__video_audio_cache').upsert(
      {
        cache_key: cacheKey,
        url: entry.url,
        duration_secs: entry.durationSecs,
        voice: entry.voice,
        speed: entry.speed,
        char_count: entry.charCount,
      },
      { onConflict: 'cache_key' },
    );

    if (error) {
      this.logger.warn(`AudioCache set error (non-fatal): ${error.message}`);
    }
  }
}
