import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  existsSync,
} from 'node:fs';
import path from 'node:path';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { SupabaseStorageService } from '../../upload/services/supabase-storage.service';

const VALID_TARGETS = ['pg_pic', 'pg_img', 'pg_wall', 'r3_slot'] as const;
type AssignTarget = (typeof VALID_TARGETS)[number];

const STORAGE_FOLDER = 'articles/gammes-produits/generated';

@Injectable()
export class RagImageManagementService extends SupabaseBaseService {
  constructor(
    configService: ConfigService,
    private readonly storageService: SupabaseStorageService,
  ) {
    super(configService);
  }

  /**
   * Upload a generated image to Supabase Storage.
   * Path: uploads/articles/gammes-produits/generated/{hash}.webp
   */
  async uploadGeneratedImage(
    hash: string,
    file: Express.Multer.File,
  ): Promise<{ url: string; path: string }> {
    if (!/^[a-f0-9]{16}$/.test(hash)) {
      throw new BadRequestException(
        'Invalid hash format (expected 16 hex chars)',
      );
    }

    const allowedMimes = ['image/webp', 'image/png', 'image/jpeg'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type non supporte: ${file.mimetype}. Utiliser webp, png ou jpeg.`,
      );
    }

    // Determine extension from mimetype
    const extMap: Record<string, string> = {
      'image/webp': 'webp',
      'image/png': 'png',
      'image/jpeg': 'jpg',
    };
    const ext = extMap[file.mimetype] || 'webp';
    const fileName = `${hash}.${ext}`;
    const filePath = `${STORAGE_FOLDER}/${fileName}`;

    // Upload with a stable name (overwrite if exists)
    const { data, error } = await this.supabase.storage
      .from('uploads')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '31536000',
        upsert: true,
      });

    if (error) {
      this.logger.error(`Storage upload error: ${error.message}`);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = this.supabase.storage.from('uploads').getPublicUrl(filePath);

    this.logger.log(`Generated image uploaded: ${filePath} → ${publicUrl}`);

    return { url: publicUrl, path: data.path };
  }

  /**
   * Resolve a gamme alias to the exact pg_alias in DB.
   * 1. Exact match on pieces_gamme
   * 2. Fuzzy match via pg_trgm RPC (221 active gammes only)
   * Returns null if no match found (similarity too low).
   */
  async resolveGammeAlias(
    input: string,
  ): Promise<{ resolvedAlias: string; similarity: number } | null> {
    // 1. Exact match
    const { data: exact } = await this.supabase
      .from('pieces_gamme')
      .select('pg_alias')
      .eq('pg_alias', input)
      .single();
    if (exact) return { resolvedAlias: exact.pg_alias, similarity: 1.0 };

    // 2. Trigram fuzzy match (only active gammes via RPC)
    const { data: fuzzy } = await this.supabase.rpc('resolve_gamme_alias', {
      input_alias: input,
    });
    if (fuzzy && fuzzy.length > 0 && fuzzy[0].similarity >= 0.5) {
      return {
        resolvedAlias: fuzzy[0].pg_alias,
        similarity: fuzzy[0].similarity,
      };
    }

    return null;
  }

  /**
   * Assign an uploaded image to a gamme target.
   * Auto-resolves pgAlias via resolveGammeAlias() before DB write.
   * Targets:
   * - pg_pic / pg_img / pg_wall → UPDATE pieces_gamme
   * - r3_slot → UPDATE __seo_r3_image_prompts SET rip_image_url, rip_status='approved'
   */
  async assignImage(body: {
    imageUrl: string;
    pgAlias: string;
    target: string;
    slotId?: string;
  }): Promise<{
    success: boolean;
    target: string;
    pgAlias: string;
    resolvedFrom?: string;
  }> {
    const { imageUrl, target, slotId } = body;
    let { pgAlias } = body;

    if (!VALID_TARGETS.includes(target as AssignTarget)) {
      throw new BadRequestException(
        `Target invalide: ${target}. Valides: ${VALID_TARGETS.join(', ')}`,
      );
    }

    if (!pgAlias || !imageUrl) {
      throw new BadRequestException('pgAlias et imageUrl sont requis');
    }

    // Auto-resolve alias
    const originalAlias = pgAlias;
    const resolved = await this.resolveGammeAlias(pgAlias);
    if (!resolved) {
      throw new NotFoundException(
        `Gamme introuvable: "${pgAlias}" (aucun match DB)`,
      );
    }
    pgAlias = resolved.resolvedAlias;

    const result =
      target === 'r3_slot'
        ? await this.assignToR3Slot(imageUrl, pgAlias, slotId)
        : await this.assignToPiecesGamme(
            imageUrl,
            pgAlias,
            target as 'pg_pic' | 'pg_img' | 'pg_wall',
          );

    return {
      ...result,
      ...(originalAlias !== pgAlias ? { resolvedFrom: originalAlias } : {}),
    };
  }

  private async assignToPiecesGamme(
    imageUrl: string,
    pgAlias: string,
    column: 'pg_pic' | 'pg_img' | 'pg_wall',
  ): Promise<{ success: boolean; target: string; pgAlias: string }> {
    const { data, error } = await this.supabase
      .from('pieces_gamme')
      .update({ [column]: imageUrl })
      .eq('pg_alias', pgAlias)
      .select('pg_id')
      .single();

    if (error || !data) {
      throw new NotFoundException(
        `Gamme non trouvee: ${pgAlias} (${error?.message || 'no data'})`,
      );
    }

    this.logger.log(`Image assigned: ${pgAlias}.${column} = ${imageUrl}`);
    return { success: true, target: column, pgAlias };
  }

  private async assignToR3Slot(
    imageUrl: string,
    pgAlias: string,
    slotId?: string,
  ): Promise<{ success: boolean; target: string; pgAlias: string }> {
    if (!slotId) {
      throw new BadRequestException('slotId requis pour target r3_slot');
    }

    const validSlots = [
      'HERO_IMAGE',
      'S2_SYMPTOM_IMAGE',
      'S3_SCHEMA_IMAGE',
      'S4D_SCHEMA_IMAGE',
    ];
    if (!validSlots.includes(slotId)) {
      throw new BadRequestException(
        `Slot invalide: ${slotId}. Valides: ${validSlots.join(', ')}`,
      );
    }

    const { data, error } = await this.supabase
      .from('__seo_r3_image_prompts')
      .update({
        rip_image_url: imageUrl,
        rip_status: 'approved',
      })
      .eq('rip_pg_alias', pgAlias)
      .eq('rip_slot_id', slotId)
      .select('rip_id')
      .single();

    if (error || !data) {
      throw new NotFoundException(
        `R3 slot non trouve: ${pgAlias}/${slotId} (${error?.message || 'no data'})`,
      );
    }

    this.logger.log(`R3 image assigned: ${pgAlias}/${slotId} = ${imageUrl}`);
    return { success: true, target: `r3_slot:${slotId}`, pgAlias };
  }

  /**
   * List available R3 image slots for a gamme.
   */
  async listR3Slots(pgAlias: string): Promise<
    Array<{
      rip_id: number;
      rip_slot_id: string;
      rip_section_id: string;
      rip_status: string;
      rip_image_url: string | null;
      rip_selected: boolean;
    }>
  > {
    // Auto-resolve alias
    const resolved = await this.resolveGammeAlias(pgAlias);
    const alias = resolved?.resolvedAlias || pgAlias;

    const { data, error } = await this.supabase
      .from('__seo_r3_image_prompts')
      .select(
        'rip_id, rip_slot_id, rip_section_id, rip_status, rip_image_url, rip_selected',
      )
      .eq('rip_pg_alias', alias)
      .order('rip_slot_id');

    if (error) {
      this.logger.error(`List R3 slots error: ${error.message}`);
      return [];
    }

    return data || [];
  }

  /**
   * List all images in the RAG knowledge web-images directory.
   */
  listImages(): Array<{
    hash: string;
    ext: string;
    size: number;
    url: string;
    prompt: string | null;
    gamme: string | null;
    type: string | null;
    usage: string | null;
    style: string | null;
    priority: string | null;
  }> {
    const knowledgePath = RAG_KNOWLEDGE_PATH;
    const imgDir = path.join(knowledgePath, '_raw', 'web-images');

    try {
      const files = readdirSync(imgDir);
      return files
        .filter((f) => /^[a-f0-9]{16}\.(jpg|jpeg|png|webp|gif)$/.test(f))
        .map((f) => {
          const ext = path.extname(f).slice(1);
          const size = statSync(path.join(imgDir, f)).size;
          const hashOnly = f.replace(/\.[^.]+$/, '');
          const promptPath = path.join(imgDir, `${hashOnly}.prompt.md`);

          let prompt: string | null = null;
          let gamme: string | null = null;
          let type: string | null = null;
          let usage: string | null = null;
          let style: string | null = null;
          let priority: string | null = null;

          try {
            const raw = readFileSync(promptPath, 'utf-8');
            const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            if (fmMatch) {
              const fm = fmMatch[1];
              prompt = fmMatch[2].trim();
              gamme = fm.match(/gamme:\s*"([^"]+)"/)?.[1] ?? null;
              type = fm.match(/type:\s*"([^"]+)"/)?.[1] ?? null;
              usage = fm.match(/usage:\s*"([^"]+)"/)?.[1] ?? null;
              style = fm.match(/style:\s*"([^"]+)"/)?.[1] ?? null;
              priority =
                fm.match(/priority:\s*"?([^"\n]+)"?/)?.[1]?.trim() ?? null;
            }
          } catch {
            // No .prompt.md file — fields stay null
          }

          return {
            hash: f,
            ext,
            size,
            url: `/api/rag/images/${f}`,
            prompt,
            gamme,
            type,
            usage,
            style,
            priority,
          };
        })
        .sort((a, b) => b.size - a.size);
    } catch {
      return [];
    }
  }

  /**
   * Delete a RAG image and its .prompt.md sidecar from disk.
   */
  deleteImage(hash: string): { deleted: true; hash: string; files: string[] } {
    if (!/^[a-f0-9]{16}$/.test(hash)) {
      throw new BadRequestException(
        'Invalid hash format (expected 16 hex chars)',
      );
    }

    const knowledgePath = RAG_KNOWLEDGE_PATH;
    const imgDir = path.join(knowledgePath, '_raw', 'web-images');

    const imgFile = readdirSync(imgDir).find(
      (f) => f.startsWith(hash + '.') && !f.endsWith('.prompt.md'),
    );
    if (!imgFile) {
      throw new NotFoundException(`Image not found: ${hash}`);
    }

    const deleted: string[] = [];

    unlinkSync(path.join(imgDir, imgFile));
    deleted.push(imgFile);

    const promptFile = `${hash}.prompt.md`;
    if (existsSync(path.join(imgDir, promptFile))) {
      unlinkSync(path.join(imgDir, promptFile));
      deleted.push(promptFile);
    }

    this.logger.log(`Deleted RAG image: ${deleted.join(', ')}`);
    return { deleted: true, hash, files: deleted };
  }

  /**
   * Enrich .prompt.md sidecars for newly scraped images:
   * replace `gamme: null` with the detected gamme alias.
   */
  enrichNewImagePrompts(hashes: string[], gamme: string): number {
    const knowledgePath = RAG_KNOWLEDGE_PATH;
    const imgDir = path.join(knowledgePath, '_raw', 'web-images');
    let enriched = 0;
    for (const hash of hashes) {
      const promptPath = path.join(imgDir, `${hash}.prompt.md`);
      try {
        let content = readFileSync(promptPath, 'utf-8');
        if (content.includes('gamme: null')) {
          content = content.replace('gamme: null', `gamme: "${gamme}"`);
          writeFileSync(promptPath, content, 'utf-8');
          enriched++;
        }
      } catch {
        // skip missing .prompt.md
      }
    }
    return enriched;
  }

  /**
   * Scan all .prompt.md with `gamme: null` whose source_url matches the given
   * URL exactly (not just domain), and enrich them with the detected gamme.
   * Handles orphaned images from previously failed jobs.
   */
  enrichOrphanedImagesBySourceUrl(sourceUrl: string, gamme: string): number {
    const knowledgePath = RAG_KNOWLEDGE_PATH;
    const imgDir = path.join(knowledgePath, '_raw', 'web-images');
    let enriched = 0;

    let files: string[];
    try {
      files = readdirSync(imgDir).filter((f) => f.endsWith('.prompt.md'));
    } catch {
      return 0;
    }

    for (const file of files) {
      const promptPath = path.join(imgDir, file);
      try {
        const content = readFileSync(promptPath, 'utf-8');
        if (!content.includes('gamme: null')) continue;
        // Match exact source_url (not just domain)
        const urlMatch = content.match(/source_url:\s*"([^"]+)"/);
        if (!urlMatch) continue;
        if (urlMatch[1] !== sourceUrl) continue;
        const updated = content.replace('gamme: null', `gamme: "${gamme}"`);
        writeFileSync(promptPath, updated, 'utf-8');
        enriched++;
      } catch {
        // skip unreadable
      }
    }
    return enriched;
  }

  /**
   * Bulk reassign images from one gamme to another.
   * Safety: only updates files whose current gamme matches `fromGamme`.
   */
  reassignImageGammes(
    hashes: string[],
    fromGamme: string,
    toGamme: string,
  ): { updated: number; skipped: string[] } {
    const knowledgePath = RAG_KNOWLEDGE_PATH;
    const imgDir = path.join(knowledgePath, '_raw', 'web-images');
    let updated = 0;
    const skipped: string[] = [];

    for (const hash of hashes) {
      const promptPath = path.join(imgDir, `${hash}.prompt.md`);
      try {
        let content = readFileSync(promptPath, 'utf-8');
        const pattern = `gamme: "${fromGamme}"`;
        if (!content.includes(pattern)) {
          skipped.push(hash);
          continue;
        }
        content = content.replace(pattern, `gamme: "${toGamme}"`);
        writeFileSync(promptPath, content, 'utf-8');
        updated++;
      } catch {
        skipped.push(hash);
      }
    }

    this.logger.log(
      `Reassigned ${updated}/${hashes.length} images from "${fromGamme}" to "${toGamme}" (${skipped.length} skipped)`,
    );
    return { updated, skipped };
  }
}
