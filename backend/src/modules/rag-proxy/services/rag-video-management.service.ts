import { Injectable, NotFoundException, Logger } from '@nestjs/common';
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
} from 'node:fs';
import path from 'node:path';
import type { Response } from 'express';

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
}
