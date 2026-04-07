import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';
import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  existsSync,
  createReadStream,
  mkdirSync,
  renameSync,
} from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Response } from 'express';

const execFileAsync = promisify(execFile);

const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mkv', '.mov', '.m4v']);

export interface VideoMeta {
  hash: string;
  ext: string;
  size: number;
  url: string;
  title: string | null;
  gamme: string | null;
  type: string | null;
  usage: string | null;
  durationSec: number | null;
  sourceUrl: string | null;
  description: string | null;
}

@Injectable()
export class RagVideoManagementService {
  private readonly logger = new Logger(RagVideoManagementService.name);

  constructor(private readonly configService: ConfigService) {}

  private get videoDir(): string {
    const knowledgePath = RAG_KNOWLEDGE_PATH;
    return path.join(knowledgePath, '_raw', 'videos');
  }

  /**
   * List all videos in the RAG knowledge _raw/videos directory.
   * Reads .prompt.md sidecars for metadata (same pattern as images).
   */
  listVideos(): VideoMeta[] {
    const dir = this.videoDir;
    try {
      const files = readdirSync(dir);
      return files
        .filter((f) => {
          const ext = path.extname(f).toLowerCase();
          return VIDEO_EXTS.has(ext) && !f.endsWith('.prompt.md');
        })
        .map((f) => {
          const ext = path.extname(f).slice(1);
          const size = statSync(path.join(dir, f)).size;
          const hashOnly = f.replace(/\.[^.]+$/, '');
          const promptPath = path.join(dir, `${hashOnly}.prompt.md`);

          let title: string | null = null;
          let gamme: string | null = null;
          let type: string | null = null;
          let usage: string | null = null;
          let durationSec: number | null = null;
          let sourceUrl: string | null = null;
          let description: string | null = null;

          try {
            const raw = readFileSync(promptPath, 'utf-8');
            const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            if (fmMatch) {
              const fm = fmMatch[1];
              description = fmMatch[2].trim() || null;
              title = fm.match(/title:\s*"([^"]+)"/)?.[1] ?? null;
              gamme = fm.match(/gamme:\s*"([^"]+)"/)?.[1] ?? null;
              type = fm.match(/type:\s*"([^"]+)"/)?.[1] ?? null;
              usage = fm.match(/usage:\s*"([^"]+)"/)?.[1] ?? null;
              sourceUrl = fm.match(/source_url:\s*"([^"]+)"/)?.[1] ?? null;
              const durMatch = fm.match(/duration_sec:\s*(\d+)/);
              durationSec = durMatch ? parseInt(durMatch[1]) : null;
            }
          } catch {
            // No .prompt.md — try .json sidecar (legacy format)
            try {
              const jsonPath = path.join(dir, `${hashOnly}.json`);
              const meta = JSON.parse(readFileSync(jsonPath, 'utf-8'));
              sourceUrl = meta.source_url || null;
              title = meta.source_label || null;
            } catch {
              // No metadata at all
            }
          }

          return {
            hash: hashOnly,
            ext,
            size,
            url: `/api/rag/videos/${f}`,
            title,
            gamme,
            type,
            usage,
            durationSec,
            sourceUrl,
            description,
          };
        })
        .sort((a, b) => b.size - a.size);
    } catch {
      return [];
    }
  }

  /**
   * Stream a video file to the HTTP response.
   * Supports Range requests for seeking.
   */
  streamVideo(hashWithExt: string, res: Response): void {
    const dir = this.videoDir;
    const filePath = path.join(dir, hashWithExt);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`Video not found: ${hashWithExt}`);
    }

    const stat = statSync(filePath);
    const ext = path.extname(hashWithExt).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.mov': 'video/quicktime',
      '.m4v': 'video/mp4',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'video/mp4');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', stat.size);

    createReadStream(filePath).pipe(res);
  }

  /**
   * Delete a video and its sidecars from disk.
   */
  deleteVideo(hash: string): { deleted: true; hash: string; files: string[] } {
    const dir = this.videoDir;
    const files = readdirSync(dir);
    const videoFile = files.find(
      (f) =>
        f.startsWith(hash + '.') &&
        !f.endsWith('.prompt.md') &&
        !f.endsWith('.json'),
    );

    if (!videoFile) {
      throw new NotFoundException(`Video not found: ${hash}`);
    }

    const deleted: string[] = [];

    unlinkSync(path.join(dir, videoFile));
    deleted.push(videoFile);

    // Delete sidecars
    for (const ext of ['.prompt.md', '.json']) {
      const sidecar = `${hash}${ext}`;
      if (existsSync(path.join(dir, sidecar))) {
        unlinkSync(path.join(dir, sidecar));
        deleted.push(sidecar);
      }
    }

    this.logger.log(`Deleted RAG video: ${deleted.join(', ')}`);
    return { deleted: true, hash, files: deleted };
  }

  /**
   * Enrich .prompt.md sidecars: replace `gamme: null` with detected gamme.
   */
  enrichVideoPrompts(hashes: string[], gamme: string): number {
    const dir = this.videoDir;
    let enriched = 0;
    for (const hash of hashes) {
      const promptPath = path.join(dir, `${hash}.prompt.md`);
      try {
        let content = readFileSync(promptPath, 'utf-8');
        if (content.includes('gamme: null')) {
          content = content.replace('gamme: null', `gamme: "${gamme}"`);
          writeFileSync(promptPath, content, 'utf-8');
          enriched++;
        }
      } catch {
        // skip
      }
    }
    return enriched;
  }

  /**
   * Ingest a video from URL using yt-dlp.
   * Downloads video + extracts metadata → creates .prompt.md sidecar.
   * Returns the SHA256 hash of the downloaded file.
   */
  async ingestVideoUrl(
    url: string,
    options?: { gamme?: string; type?: string },
  ): Promise<{
    hash: string;
    title: string;
    durationSec: number;
    ext: string;
    promptMdCreated: boolean;
  }> {
    const dir = this.videoDir;
    mkdirSync(dir, { recursive: true });

    // 1. Get metadata first (no download)
    this.logger.log(`Fetching metadata for: ${url}`);
    let metadata: {
      title: string;
      duration: number;
      description: string;
      ext: string;
    };

    try {
      const { stdout } = await execFileAsync(
        'yt-dlp',
        ['--dump-json', '--no-playlist', url],
        { timeout: 60_000 },
      );
      const info = JSON.parse(stdout);
      metadata = {
        title: info.title || 'Untitled',
        duration: Math.round(info.duration || 0),
        description: (info.description || '').slice(0, 500),
        ext: info.ext || 'mp4',
      };
    } catch (err) {
      throw new BadRequestException(
        `Failed to fetch video metadata: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(`Metadata: "${metadata.title}" (${metadata.duration}s)`);

    // 2. Download video
    const tmpName = `dl_${Date.now()}`;
    const outTemplate = path.join(dir, `${tmpName}.%(ext)s`);

    try {
      await execFileAsync(
        'yt-dlp',
        [
          '--no-playlist',
          '-f',
          'mp4/best[ext=mp4]/best',
          '-o',
          outTemplate,
          url,
        ],
        { timeout: 600_000 },
      ); // 10 min max
    } catch (err) {
      throw new BadRequestException(
        `Video download failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Find the downloaded file
    const dlFiles = readdirSync(dir).filter((f) => f.startsWith(tmpName + '.'));
    if (dlFiles.length === 0) {
      throw new BadRequestException('Download produced no output file');
    }
    const dlFile = dlFiles[0];
    const dlPath = path.join(dir, dlFile);

    // 3. Compute SHA256 hash
    const fileBuffer = readFileSync(dlPath);
    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
    const ext = path.extname(dlFile).toLowerCase();
    const finalName = `${sha256}${ext}`;
    const finalPath = path.join(dir, finalName);

    // Rename to hash-based name (skip if already exists = dedup)
    if (existsSync(finalPath)) {
      unlinkSync(dlPath); // already have this video
      this.logger.log(`Video already archived: ${sha256}`);
    } else {
      renameSync(dlPath, finalPath);
      this.logger.log(
        `Video archived: ${finalName} (${fileBuffer.length} bytes)`,
      );
    }

    // 4. Generate .prompt.md sidecar
    const promptPath = path.join(dir, `${sha256}.prompt.md`);
    const promptMdCreated = !existsSync(promptPath);

    if (promptMdCreated) {
      const videoType = options?.type || this.detectVideoType(metadata.title);
      const gamme = options?.gamme || null;

      const promptContent = [
        '---',
        `hash: "${sha256}"`,
        `source_url: "${url}"`,
        `gamme: ${gamme ? `"${gamme}"` : 'null'}`,
        `type: "${videoType}"`,
        `usage: "page-gamme"`,
        `duration_sec: ${metadata.duration}`,
        `title: "${metadata.title.replace(/"/g, "'")}"`,
        `described_at: "${new Date().toISOString().slice(0, 10)}"`,
        `described_by: "yt-dlp-metadata"`,
        '---',
        '',
        `${metadata.title}`,
        '',
        metadata.description || `Video ${videoType} automobile.`,
      ].join('\n');

      writeFileSync(promptPath, promptContent, 'utf-8');
      this.logger.log(`Prompt.md created: ${sha256}.prompt.md`);
    }

    // 5. Also write legacy .json sidecar for compatibility with ingest_videos.py
    const jsonPath = path.join(dir, `${sha256}.json`);
    if (!existsSync(jsonPath)) {
      const jsonMeta = {
        sha256,
        source_label: metadata.title,
        source_url: url,
        ingested_at: new Date().toISOString(),
        size_bytes: fileBuffer.length,
      };
      writeFileSync(jsonPath, JSON.stringify(jsonMeta, null, 2), 'utf-8');
    }

    return {
      hash: sha256,
      title: metadata.title,
      durationSec: metadata.duration,
      ext: ext.slice(1),
      promptMdCreated,
    };
  }

  /**
   * Auto-detect video type from title keywords.
   */
  private detectVideoType(title: string): string {
    const t = title.toLowerCase();
    if (/tuto|comment|how.?to|changer|remplacer|monter|demonter/.test(t))
      return 'tutoriel';
    if (/diagnostic|panne|symptom|bruit|vibra/.test(t)) return 'diagnostic';
    if (/compara|vs\b|meilleur|top\s?\d/.test(t)) return 'comparatif';
    if (/test|review|avis|essai/.test(t)) return 'test';
    return 'presentation';
  }
}
