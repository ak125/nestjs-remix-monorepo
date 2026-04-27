import {
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  Optional,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Cache } from 'cache-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { R1ContentFromRagService } from '../services/r1-content-from-rag.service';
import { R1KeywordPlanBatchService } from '../services/r1-keyword-plan-batch.service';

interface CoverageRow {
  role: string;
  label: string;
  count: number;
  total: number;
  pct: number;
}

const TEMPLATES_DIR = '/opt/automecanik/rag/scripts/tools/kp_templates';
const RAG_GAMMES_DIR = `${RAG_KNOWLEDGE_PATH}/gammes`;
const ALL_ROLES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];

@Controller('api/admin/keyword-planner')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminKeywordPlannerController {
  private readonly logger = new Logger(AdminKeywordPlannerController.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly r1BatchService?: R1KeywordPlanBatchService,
    @Optional() private readonly r1ContentFromRag?: R1ContentFromRagService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = createClient(url!, key!);
  }

  /**
   * GET /api/admin/keyword-planner/coverage
   * Returns KP coverage per role + gammes list with per-role flags.
   */
  @Get('coverage')
  async coverage() {
    this.logger.log('GET /api/admin/keyword-planner/coverage');

    // 1. Active gammes (source of truth — sgpg_pg_id is VARCHAR in DB)
    const { data: guideRows } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_pg_id');
    const activeIds = (guideRows ?? []).map(
      (r: { sgpg_pg_id: string | number }) => Number(r.sgpg_pg_id),
    );
    const totalGammes = activeIds.length || 221;

    // 2. Gamme names (pg_id is INTEGER — pass numbers)
    const { data: pgRows } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .in('pg_id', activeIds);
    const pgMap = new Map(
      (pgRows ?? []).map(
        (r: { pg_id: number; pg_alias: string; pg_name: string }) => [
          Number(r.pg_id),
          r,
        ],
      ),
    );

    // 2b. Catalog hierarchy: catalog_gamme + catalog_family (2 separate queries)
    // Returns famille_parent, famille_sort (parent order), gamme_sort (order within family)
    const familyMap = new Map<
      number,
      {
        famille: string;
        famille_parent: string;
        famille_sort: number;
        gamme_sort: number;
      }
    >();
    const familySet = new Set<string>();
    try {
      const { data: cgRows } = await this.supabase
        .from('catalog_gamme')
        .select('mc_pg_id, mc_mf_id, mc_mf_prime, mc_sort');
      const allFamilyIds = new Set<string>();
      for (const r of cgRows ?? []) {
        if (r.mc_mf_id) allFamilyIds.add(String(r.mc_mf_id));
        if (r.mc_mf_prime) allFamilyIds.add(String(r.mc_mf_prime));
      }
      const { data: famRows } = await this.supabase
        .from('catalog_family')
        .select('mf_id, mf_name, mf_sort')
        .in('mf_id', [...allFamilyIds]);
      const famInfoMap = new Map(
        (famRows ?? []).map(
          (f: { mf_id: string; mf_name: string; mf_sort: string | number }) => [
            String(f.mf_id),
            { name: f.mf_name, sort: Number(f.mf_sort) || 999 },
          ],
        ),
      );
      for (const r of cgRows ?? []) {
        const pgId = Number(r.mc_pg_id);
        if (!familyMap.has(pgId)) {
          const fam = famInfoMap.get(String(r.mc_mf_id))?.name ?? '';
          const parentInfo = famInfoMap.get(String(r.mc_mf_prime));
          const parent = parentInfo?.name ?? fam;
          const parentSort = parentInfo?.sort ?? 999;
          const gammeSort = Number(r.mc_sort) || 999;
          familyMap.set(pgId, {
            famille: fam,
            famille_parent: parent,
            famille_sort: parentSort,
            gamme_sort: gammeSort,
          });
          if (parent) familySet.add(parent);
        }
      }
    } catch {
      /* catalog tables may not exist */
    }

    // 3. Coverage from __seo_keyword_results ONLY (Claude Chrome imports)
    // Old __seo_r*_keyword_plan tables are ignored (mostly empty shells from batch RPC)
    const roleLabels: Record<string, string> = {
      R1: 'Router',
      R2: 'Product',
      R3: 'Conseils',
      R4: 'Reference',
      R5: 'Diagnostic',
      R6: 'Guide Achat',
      R7: 'Brand',
      R8: 'Vehicle',
    };

    const kpSets: Record<string, Set<number>> = {};
    for (const role of Object.keys(roleLabels)) {
      kpSets[role] = new Set();
    }

    const kwCountMap = new Map<
      number,
      { total: number; byRole: Record<string, number> }
    >();
    let totalKeywords = 0;
    let lastImportDate: string | null = null;
    try {
      const { data: kwRows } = await this.supabase
        .from('__seo_keyword_results')
        .select('pg_id, role, created_at');
      for (const row of kwRows ?? []) {
        const pid = Number(row.pg_id);
        const role = String(row.role);
        // Count per gamme
        const entry = kwCountMap.get(pid) ?? { total: 0, byRole: {} };
        entry.total++;
        entry.byRole[role] = (entry.byRole[role] ?? 0) + 1;
        kwCountMap.set(pid, entry);
        totalKeywords++;
        if (!lastImportDate || row.created_at > lastImportDate) {
          lastImportDate = row.created_at;
        }
        // Coverage: mark role as covered for this gamme
        if (kpSets[role]) {
          kpSets[role].add(pid);
        }
      }
    } catch {
      /* table may not exist yet */
    }

    // 4b. Fallback: also check old KP tables for coverage
    const oldTables: [string, string, string][] = [
      ['R1', '__seo_r1_keyword_plan', 'rkp_pg_id'],
      ['R3', '__seo_r3_keyword_plan', 'skp_pg_id'],
      ['R4', '__seo_r4_keyword_plan', 'r4kp_pg_id'],
      ['R5', '__seo_r5_keyword_plan', 'rkp_pg_id'],
      ['R6', '__seo_r6_keyword_plan', 'r6kp_pg_id'],
    ];
    for (const [role, table, col] of oldTables) {
      try {
        const { data } = await this.supabase.from(table).select(col);
        for (const r of data ?? []) {
          const pid = Number((r as unknown as Record<string, unknown>)[col]);
          if (pid) kpSets[role].add(pid);
        }
      } catch {
        /* old table may not exist */
      }
    }

    const coverage: CoverageRow[] = Object.entries(roleLabels).map(
      ([role, label]) => {
        const count = kpSets[role]?.size ?? 0;
        return {
          role,
          label,
          count,
          total: totalGammes,
          pct: Math.round((count / totalGammes) * 100),
        };
      },
    );

    // 5. RAG status: check file existence + web ingest jobs
    // 5a. RAG files on disk
    const ragFileSet = new Set<string>();
    try {
      const ragDir = path.join(RAG_GAMMES_DIR);
      const files = fs.readdirSync(ragDir);
      for (const f of files) {
        if (f.endsWith('.md')) ragFileSet.add(f.replace('.md', ''));
      }
    } catch {
      /* dir may not exist */
    }

    // 5b. Web ingest jobs (gammes_detected from __rag_web_ingest_jobs)
    const ingestedSet = new Set<string>();
    const ingestCountMap = new Map<string, number>();
    try {
      const { data: jobRows } = await this.supabase
        .from('__rag_web_ingest_jobs')
        .select('gammes_detected, status')
        .eq('status', 'done');
      for (const row of jobRows ?? []) {
        const detected = row.gammes_detected;
        if (Array.isArray(detected)) {
          for (const slug of detected) {
            ingestedSet.add(slug);
            ingestCountMap.set(slug, (ingestCountMap.get(slug) ?? 0) + 1);
          }
        }
      }
    } catch {
      /* table may not exist */
    }

    // 6. Gammes with per-role flags + keyword counts + family + RAG status
    const gammes = activeIds.map((pid: number) => {
      const pg = pgMap.get(Number(pid));
      const kw = kwCountMap.get(pid);
      const fam = familyMap.get(pid);
      const alias = pg?.pg_alias ?? '';
      const hasRagFile = ragFileSet.has(alias);
      const hasIngest = ingestedSet.has(alias);
      // rag_status: ingested > file_only > none
      const ragStatus = hasIngest
        ? 'ingested'
        : hasRagFile
          ? 'file_only'
          : 'none';
      return {
        pg_id: pid,
        pg_alias: alias,
        pg_name: pg?.pg_name ?? `Gamme #${pid}`,
        famille: fam?.famille ?? '',
        famille_parent: fam?.famille_parent ?? 'Non classé',
        famille_sort: fam?.famille_sort ?? 999,
        gamme_sort: fam?.gamme_sort ?? 999,
        has_r1: kpSets['R1']?.has(pid) ?? false,
        has_r3: kpSets['R3']?.has(pid) ?? false,
        has_r4: kpSets['R4']?.has(pid) ?? false,
        has_r5: kpSets['R5']?.has(pid) ?? false,
        has_r6: kpSets['R6']?.has(pid) ?? false,
        kw_count: kw?.total ?? 0,
        kw_by_role: kw?.byRole ?? {},
        rag_status: ragStatus as 'ingested' | 'file_only' | 'none',
        ingest_count: ingestCountMap.get(alias) ?? 0,
      };
    });
    gammes.sort(
      (
        a: { famille_sort: number; gamme_sort: number; pg_name: string },
        b: { famille_sort: number; gamme_sort: number; pg_name: string },
      ) =>
        a.famille_sort - b.famille_sort ||
        a.gamme_sort - b.gamme_sort ||
        a.pg_name.localeCompare(b.pg_name),
    );

    const fullyCoveredCount = gammes.filter(
      (g) => g.has_r1 && g.has_r3 && g.has_r6,
    ).length;

    const ragIngested = gammes.filter(
      (g) => g.rag_status === 'ingested',
    ).length;
    const ragFileOnly = gammes.filter(
      (g) => g.rag_status === 'file_only',
    ).length;
    const ragNone = gammes.filter((g) => g.rag_status === 'none').length;

    return {
      coverage,
      gammes,
      totalGammes,
      totalKeywords,
      lastImportDate,
      fullyCoveredCount,
      families: [...familySet].sort(),
      rag: {
        ingested: ragIngested,
        file_only: ragFileOnly,
        none: ragNone,
        pct_ingested: Math.round((ragIngested / totalGammes) * 100),
      },
    };
  }

  /**
   * GET /api/admin/keyword-planner/import-history
   * Returns recent import batches grouped by gamme+role.
   */
  @Get('import-history')
  async importHistory() {
    this.logger.log('GET /api/admin/keyword-planner/import-history');
    try {
      const { data } = await this.supabase.rpc('get_keyword_import_history');
      if (data) return { history: data };
    } catch {
      /* RPC may not exist, fallback to raw query */
    }

    // Fallback: client-side grouping
    const { data: rows } = await this.supabase
      .from('__seo_keyword_results')
      .select('pg_id, pg_alias, role, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    const groups = new Map<
      string,
      {
        pg_id: number;
        pg_alias: string;
        role: string;
        kw_count: number;
        imported_at: string;
      }
    >();
    for (const r of rows ?? []) {
      const key = `${r.pg_id}-${r.role}`;
      const entry = groups.get(key);
      if (entry) {
        entry.kw_count++;
      } else {
        groups.set(key, {
          pg_id: r.pg_id,
          pg_alias: r.pg_alias || '',
          role: r.role,
          kw_count: 1,
          imported_at: r.created_at,
        });
      }
    }
    const history = [...groups.values()]
      .sort((a, b) => b.imported_at.localeCompare(a.imported_at))
      .slice(0, 50);

    return { history };
  }

  /**
   * GET /api/admin/keyword-planner/keywords-for-content
   * Returns prioritized keywords for content injection (H1, H2, meta, body).
   * Used by content-gen skill to auto-integrate KW into generated content.
   *
   * Query params: pg_id (required), role (optional, defaults to all)
   */
  @Get('keywords-for-content')
  async keywordsForContent(
    @Query('pg_id') pgIdStr: string,
    @Query('role') role?: string,
  ) {
    const pgId = Number(pgIdStr);
    if (!pgId) return { error: 'pg_id requis' };

    // Fetch from __seo_keyword_results
    let query = this.supabase
      .from('__seo_keyword_results')
      .select('kw, intent, vol, role')
      .eq('pg_id', pgId);
    if (role) query = query.eq('role', role);

    const { data: rows } = await query.order('vol', { ascending: true }); // HIGH first (alphabetically)

    if (!rows || rows.length === 0) {
      return { pg_id: pgId, role: role || 'all', keywords: [], source: 'none' };
    }

    // Prioritize: HIGH > MED > LOW, group by usage
    const volOrder: Record<string, number> = { HIGH: 0, MED: 1, LOW: 2 };
    const sorted = [...rows].sort(
      (a, b) => (volOrder[a.vol] ?? 2) - (volOrder[b.vol] ?? 2),
    );

    // Build structured output for content injection
    const forH1 = sorted.filter((k) => k.vol === 'HIGH').slice(0, 3);
    const forH2 = sorted
      .filter((k) => k.vol === 'HIGH' || k.vol === 'MED')
      .slice(0, 8);
    const forMeta = sorted.filter((k) => k.vol === 'HIGH').slice(0, 5);
    const forBody = sorted.filter((k) => k.vol !== 'LOW').slice(0, 15);
    const forFaq = sorted.filter((k) => k.intent === 'paa').slice(0, 6);

    return {
      pg_id: pgId,
      role: role || 'all',
      source: '__seo_keyword_results',
      total: rows.length,
      injection: {
        h1: forH1.map((k) => k.kw),
        h2: forH2.map((k) => k.kw),
        meta_title: forMeta.map((k) => k.kw),
        meta_description: forMeta.map((k) => k.kw),
        body: forBody.map((k) => k.kw),
        faq: forFaq.map((k) => k.kw),
      },
      all_keywords: sorted.map((k) => ({
        kw: k.kw,
        intent: k.intent,
        vol: k.vol,
        role: k.role,
      })),
    };
  }

  /**
   * GET /api/admin/keyword-planner/audit?pg_id=7
   * Returns KW integration audit for a gamme: which KW are in H1/H2/body/meta.
   */
  @Get('audit')
  async audit(@Query('pg_id') pgIdStr: string) {
    const pgId = Number(pgIdStr);
    if (!pgId) return { error: 'pg_id requis' };

    // 1. Get KW
    const { data: kwRows } = await this.supabase
      .from('__seo_keyword_results')
      .select('kw, intent, vol, role')
      .eq('pg_id', pgId);
    if (!kwRows || kwRows.length === 0) {
      return { pg_id: pgId, total_kw: 0, message: 'Aucun KW importé' };
    }

    // 2. Get SEO content
    const { data: seoRows } = await this.supabase
      .from('__seo_gamme')
      .select('sg_h1, sg_title, sg_descrip, sg_content')
      .eq('sg_pg_id', String(pgId));
    const seo = seoRows?.[0] ?? ({} as Record<string, string | null>);
    const allText = [
      seo.sg_h1 ?? '',
      seo.sg_title ?? '',
      seo.sg_descrip ?? '',
      seo.sg_content ?? '',
    ]
      .join(' ')
      .toLowerCase();

    // 3. Check each KW — fuzzy matching: all significant words must be present
    const STOP_WORDS = new Set([
      'à',
      'a',
      'de',
      'du',
      'des',
      'le',
      'la',
      'les',
      'un',
      'une',
      'en',
      'et',
      'ou',
      'pour',
      'par',
      'sur',
      'est',
      'ce',
      'que',
      'qui',
      'au',
      'aux',
      'son',
      'sa',
      'ses',
      'mon',
      'ma',
      'mes',
      'd',
      'l',
      "d'",
      "l'",
      'votre',
      'quel',
      'quelle',
    ]);

    function kwMatchesFuzzy(kw: string, text: string): boolean {
      // Extract significant words from the KW (2+ chars, not stop words)
      const words = kw
        .toLowerCase()
        .replace(/['']/g, "'")
        .split(/[\s\-:,;.!?()]+/)
        .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
      if (words.length === 0) return false;
      // All significant words must be in the text
      return words.every((w) => text.includes(w));
    }

    const results = kwRows.map(
      (k: { kw: string; intent: string; vol: string; role: string }) => {
        // For navigational KW (vehicle-specific), don't expect in body
        const isNav =
          k.intent === 'navigational' &&
          /\b(renault|peugeot|citro|dacia|volkswagen|bmw|fiat|golf|clio|megane)\b/i.test(
            k.kw,
          );
        const found = kwMatchesFuzzy(k.kw, allText);
        return {
          kw: k.kw,
          intent: k.intent,
          vol: k.vol,
          role: k.role,
          found,
          skipped: isNav,
          location: found
            ? kwMatchesFuzzy(k.kw, (seo.sg_h1 ?? '').toLowerCase())
              ? 'H1'
              : kwMatchesFuzzy(k.kw, (seo.sg_title ?? '').toLowerCase())
                ? 'title'
                : kwMatchesFuzzy(k.kw, (seo.sg_descrip ?? '').toLowerCase())
                  ? 'description'
                  : 'body'
            : null,
        };
      },
    );

    // 4. Compute scores
    const byVol = (v: string) => results.filter((r) => r.vol === v);
    const score = (items: typeof results) => {
      const relevant = items.filter((r) => !r.skipped);
      if (relevant.length === 0) return { total: 0, found: 0, pct: 100 };
      const found = relevant.filter((r) => r.found).length;
      return {
        total: relevant.length,
        found,
        pct: Math.round((found / relevant.length) * 100),
      };
    };

    const highScore = score(byVol('HIGH'));
    const medScore = score(byVol('MED'));
    const lowScore = score(byVol('LOW'));

    // Maillage check
    const content = seo.sg_content ?? '';
    const maillage = {
      r3: content.includes('/blog-pieces-auto/'),
      r4: content.includes('/reference-auto/'),
      r6: content.includes('/guide-achat/'),
    };

    const globalScore = Math.round(
      highScore.pct * 0.5 + medScore.pct * 0.35 + lowScore.pct * 0.15,
    );

    const auditResult: Record<string, unknown> = {
      pg_id: pgId,
      total_kw: kwRows.length,
      score: globalScore,
      high: highScore,
      med: medScore,
      low: lowScore,
      maillage,
      h1: seo.sg_h1,
      title: seo.sg_title,
      missing_high: results
        .filter((r) => r.vol === 'HIGH' && !r.found && !r.skipped)
        .map((r) => r.kw),
      missing_med: results
        .filter((r) => r.vol === 'MED' && !r.found && !r.skipped)
        .map((r) => r.kw),
      outgoing_present: (() => {
        const contentLower = (seo.sg_content ?? '').toLowerCase();
        let count = 0;
        try {
          // Count links in sg_content that point to /pieces/
          const matches = contentLower.match(/href="\/pieces\//g);
          count = matches?.length ?? 0;
        } catch {
          /* */
        }
        return count;
      })(),
      outgoing_total: 0,
      incoming_total: 0,
      details: results,
    };

    // Fetch link counts from __seo_gamme_links
    try {
      const { count: outCount } = await this.supabase
        .from('__seo_gamme_links')
        .select('id', { count: 'exact', head: true })
        .eq('source_pg_id', pgId);
      const { count: inCount } = await this.supabase
        .from('__seo_gamme_links')
        .select('id', { count: 'exact', head: true })
        .eq('target_pg_id', pgId);
      auditResult.outgoing_total = outCount ?? 0;
      auditResult.incoming_total = inCount ?? 0;
    } catch {
      /* table may not exist */
    }

    return auditResult;
  }

  /**
   * POST /api/admin/cache/invalidate?pg_id=7
   * Invalidate Redis RPC cache for a gamme after content update.
   */
  @Post('cache-invalidate')
  async cacheInvalidate(@Query('pg_id') pgIdStr: string) {
    const pgId = Number(pgIdStr);
    if (!pgId) return { error: 'pg_id requis' };

    const keys = [`gamme:rpc:v2:${pgId}`, `gamme:rpc:v2:stale:${pgId}`];
    let deleted = 0;
    for (const key of keys) {
      try {
        await this.cacheManager?.del(key);
        deleted++;
      } catch {
        /* key may not exist */
      }
    }
    this.logger.log(`Cache invalidated for pg_id=${pgId} (${deleted} keys)`);
    return { pg_id: pgId, keys_deleted: deleted, message: 'Cache invalidé' };
  }

  /**
   * GET /api/admin/keyword-planner/maillage?pg_id=7
   * Returns outgoing + incoming links for a gamme.
   */
  @Get('maillage')
  async maillage(@Query('pg_id') pgIdStr: string) {
    const pgId = Number(pgIdStr);
    if (!pgId) return { error: 'pg_id requis' };

    // Outgoing links
    const { data: outgoing } = await this.supabase
      .from('__seo_gamme_links')
      .select('target_pg_id, relation, anchor_text, context, source_origin')
      .eq('source_pg_id', pgId);

    // Incoming links
    const { data: incoming } = await this.supabase
      .from('__seo_gamme_links')
      .select('source_pg_id, relation, anchor_text, context, source_origin')
      .eq('target_pg_id', pgId);

    // Get sg_content to check which links are already present
    const { data: seoRows } = await this.supabase
      .from('__seo_gamme')
      .select('sg_content')
      .eq('sg_pg_id', String(pgId));
    const content = (seoRows?.[0]?.sg_content ?? '').toLowerCase();

    // Resolve pg names
    const allPgIds = [
      ...(outgoing ?? []).map((r) => r.target_pg_id),
      ...(incoming ?? []).map((r) => r.source_pg_id),
    ];
    const { data: pgRows } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .in('pg_id', allPgIds);
    const pgMap = new Map(
      (pgRows ?? []).map(
        (r: { pg_id: number; pg_alias: string; pg_name: string }) => [
          r.pg_id,
          r,
        ],
      ),
    );

    const outLinks = (outgoing ?? []).map((r) => {
      const pg = pgMap.get(r.target_pg_id);
      const href = `/pieces/${pg?.pg_alias}-${r.target_pg_id}.html`;
      return {
        pg_id: r.target_pg_id,
        pg_name: pg?.pg_name ?? `#${r.target_pg_id}`,
        pg_alias: pg?.pg_alias ?? '',
        relation: r.relation,
        anchor_text: r.anchor_text,
        context: r.context,
        present_in_content: content.includes(href.toLowerCase()),
      };
    });

    const inLinks = (incoming ?? []).map((r) => {
      const pg = pgMap.get(r.source_pg_id);
      return {
        pg_id: r.source_pg_id,
        pg_name: pg?.pg_name ?? `#${r.source_pg_id}`,
        pg_alias: pg?.pg_alias ?? '',
        relation: r.relation,
        anchor_text: r.anchor_text,
        present_in_source: false, // Would need to query each source's sg_content
      };
    });

    return {
      pg_id: pgId,
      outgoing: outLinks,
      incoming: inLinks,
      outgoing_present: outLinks.filter((l) => l.present_in_content).length,
      outgoing_total: outLinks.length,
      incoming_total: inLinks.length,
    };
  }

  /**
   * POST /api/admin/keyword-planner/generate-content
   * Triggers content generation using imported keywords.
   * Returns command to run + summary of what will be generated.
   */
  @Post('generate-content')
  async generateContent(
    @Body() body: { pg_id: number; pg_alias?: string; roles?: string[] },
  ) {
    const pgId = Number(body.pg_id);
    if (!pgId) return { error: 'pg_id requis' };

    // Check how many KW exist
    const { data: kwRows } = await this.supabase
      .from('__seo_keyword_results')
      .select('role, vol')
      .eq('pg_id', pgId);

    const kwCount = kwRows?.length ?? 0;
    if (kwCount === 0) {
      return {
        error: `Aucun mot-cle importe pour pg_id=${pgId}. Importez d'abord.`,
      };
    }

    // Group by role
    const byRole: Record<string, { total: number; high: number }> = {};
    for (const r of kwRows ?? []) {
      if (!byRole[r.role]) byRole[r.role] = { total: 0, high: 0 };
      byRole[r.role].total++;
      if (r.vol === 'HIGH') byRole[r.role].high++;
    }

    const rolesAvailable = Object.keys(byRole);
    const targetRoles = body.roles?.length
      ? body.roles.filter((r) => rolesAvailable.includes(r))
      : rolesAvailable;

    if (targetRoles.length === 0) {
      return {
        error: `Roles demandes (${body.roles?.join(',')}) n'ont pas de KW importes. Roles disponibles: ${rolesAvailable.join(',')}`,
      };
    }

    const alias = body.pg_alias || '';
    const roleFlags = targetRoles.map((r) => `--${r.toLowerCase()}`).join(' ');

    return {
      message: `${kwCount} KW disponibles pour ${targetRoles.length} role(s). Lancez : /content-gen ${alias} ${roleFlags}`,
      pg_id: pgId,
      pg_alias: alias,
      kw_total: kwCount,
      roles_ready: targetRoles,
      roles_detail: byRole,
      command: `/content-gen ${alias} ${roleFlags}`,
    };
  }

  /**
   * POST /api/admin/keyword-planner/generate
   * Generates prompt(s) for a gamme + role(s).
   */
  @Post('generate')
  async generate(@Body() body: { pg_id: number; roles?: string[] }) {
    const { pg_id, roles = ALL_ROLES } = body;
    this.logger.log(`POST generate pg_id=${pg_id} roles=${roles.join(',')}`);

    // 1. Resolve gamme
    const { data: pgRow } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_id', pg_id)
      .single();
    if (!pgRow) return { error: `Gamme #${pg_id} non trouvee` };

    // 2. Load purchase guide
    const { data: guideRow } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('*')
      .eq('sgpg_pg_id', String(pg_id))
      .single();

    // 3. Load aggregates
    const { data: aggRow } = await this.supabase
      .from('gamme_aggregates')
      .select(
        'products_total, top_brands, demand_level, difficulty_level, priority_score, intent_type, content_depth, vehicle_coverage',
      )
      .eq('ga_pg_id', pg_id)
      .single();

    // 4. Load RAG file
    const ragData = this.loadRag(pgRow.pg_alias);

    // 5. Build context
    const ctx = this.buildContext(pgRow, guideRow ?? {}, aggRow ?? {}, ragData);

    // 6. Render each role
    const results = roles.map((role) => {
      const tplFile = path.join(
        TEMPLATES_DIR,
        `${role.toLowerCase()}_template.txt`,
      );
      if (!fs.existsSync(tplFile)) {
        return {
          role,
          error: `Template ${role.toLowerCase()}_template.txt manquant`,
          prompt: null,
        };
      }
      let tpl = fs.readFileSync(tplFile, 'utf-8');
      // Simple Jinja2 {{ var }} replacement
      for (const [key, val] of Object.entries(ctx)) {
        const replacement =
          typeof val === 'string' ? val : JSON.stringify(val ?? '');
        tpl = tpl.replace(
          new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'),
          replacement,
        );
      }
      return { role, prompt: tpl, chars: tpl.length, error: null };
    });

    return { pg_id, pg_name: pgRow.pg_name, pg_alias: pgRow.pg_alias, results };
  }

  /**
   * POST /api/admin/keyword-planner/import
   * Import keywords from Claude Chrome JSON into __seo_keyword_results.
   * Supports batch: pg_id can be in each keyword entry OR passed globally.
   * If both, keyword-level pg_id takes priority.
   */
  // ── Validation rules (applied at import) ──

  /** Competitor brand names — never useful for on-page SEO */
  private static readonly COMPETITOR_BLACKLIST = [
    'oscaro',
    'norauto',
    'carter cash',
    'mister auto',
    'feu vert',
    'leclerc',
    'amazon',
    'ebay',
    'yakarouler',
    'autodoc',
    'rockauto',
    'cdiscount',
    'euromaster',
    'speedy',
    'midas',
    'point s',
  ];

  /** Intent boundaries per role — keywords with wrong intent are flagged */
  private static readonly INTENT_RULES: Record<
    string,
    { allowed: string[]; forbidden_patterns: string[] }
  > = {
    R1: {
      allowed: ['transactional', 'navigational', 'paa', 'long_tail'],
      forbidden_patterns: [
        'comment changer',
        'tutoriel',
        'etape',
        'couple de serrage',
        'demontage',
        'symptome',
        'panne',
        'bruit',
        'vibration',
        'voyant',
        'code obd',
        "guide d'achat",
        'comparatif qualite',
        'quel choisir',
        'meilleur',
        'meilleure marque',
        'vs',
      ],
    },
    R3: {
      allowed: ['how_to', 'informational', 'diagnostic_light', 'paa'],
      forbidden_patterns: [
        'acheter',
        'commander',
        'en stock',
        'ajouter au panier',
        'prix',
        'livraison',
        'promotion',
        'bon plan',
        'code promo',
      ],
    },
    R4: {
      allowed: ['definitional', 'informational', 'paa'],
      forbidden_patterns: [
        'acheter',
        'prix',
        'tutoriel',
        'etape',
        'symptome',
        'diagnostic',
        "guide d'achat",
        'meilleur',
        'comparatif',
      ],
    },
    R5: {
      allowed: ['diagnostic', 'informational', 'paa'],
      forbidden_patterns: ['acheter', 'prix', 'commander', 'tutoriel', 'etape'],
    },
    R6: {
      allowed: [
        'buying_decision',
        'comparison',
        'informational',
        'paa',
        'commercial',
      ],
      forbidden_patterns: [
        'couple de serrage',
        'cle dynamometrique',
        'purge',
        'depose',
        'repose',
        'etape 1',
        'etape 2',
        'outillage requis',
        'code obd',
      ],
    },
    R7: {
      allowed: ['brand_search', 'brand_trust', 'navigational', 'paa'],
      forbidden_patterns: [
        'tutoriel',
        'comment changer',
        'etapes montage',
        'diagnostic',
        'symptome',
        'panne',
        'code obd',
      ],
    },
    R8: {
      allowed: ['vehicle_search', 'vehicle_maintenance', 'navigational', 'paa'],
      forbidden_patterns: [
        'tutoriel detaille',
        'comment changer',
        'diagnostic approfondi',
        'code defaut',
        'definition',
        "qu'est-ce que",
        "guide d'achat",
        'meilleur',
        'comparatif',
      ],
    },
  };

  @Post('import')
  async importKeywords(
    @Body()
    body: {
      pg_id?: number;
      pg_alias?: string;
      keywords: Array<{
        pg_id?: number;
        kw: string;
        intent: string;
        vol?: string;
        role: string;
      }>;
      dry_run?: boolean;
    },
  ) {
    const { keywords, dry_run } = body;
    const globalPgId = body.pg_id;
    const globalAlias = body.pg_alias || '';

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return { error: 'keywords array vide ou invalide', imported: 0 };
    }

    this.logger.log(
      `POST import global_pg_id=${globalPgId ?? 'auto'} keywords=${keywords.length} dry_run=${dry_run ?? false}`,
    );

    // Resolve pg_alias map
    const allPgIds = [
      ...new Set(
        keywords
          .map((k) => k.pg_id ?? globalPgId)
          .filter((id): id is number => id != null),
      ),
    ];
    let aliasMap = new Map<number, string>();
    if (allPgIds.length > 0) {
      const { data: pgRows } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_alias')
        .in('pg_id', allPgIds);
      aliasMap = new Map(
        (pgRows ?? []).map((r: { pg_id: number; pg_alias: string }) => [
          r.pg_id,
          r.pg_alias,
        ]),
      );
    }

    // ── Pipeline de validation (5 étapes) ──
    const validRoles = new Set([
      'R1',
      'R2',
      'R3',
      'R4',
      'R5',
      'R6',
      'R7',
      'R8',
    ]);
    const validVols = new Set(['HIGH', 'MED', 'LOW']);
    const errors: string[] = [];
    const rejected: Array<{ kw: string; reason: string }> = [];
    const warnings: Array<{ kw: string; reason: string }> = [];

    // Step 1: Basic validation (pg_id, kw, role)
    const step1 = keywords.filter((kw, i) => {
      const pgId = kw.pg_id ?? globalPgId;
      if (!pgId) {
        errors.push(`#${i}: pg_id manquant`);
        return false;
      }
      if (!kw.kw || typeof kw.kw !== 'string' || kw.kw.trim().length < 2) {
        errors.push(`#${i}: kw manquant ou trop court`);
        return false;
      }
      if (!validRoles.has(kw.role)) {
        errors.push(`#${i}: role "${kw.role}" invalide`);
        return false;
      }
      return true;
    });

    // Step 2: Normalize (trim, lowercase for dedup, accent normalization)
    const step2 = step1.map((kw) => {
      const pgId = kw.pg_id ?? globalPgId!;
      return {
        pg_id: pgId,
        pg_alias: aliasMap.get(pgId) || globalAlias,
        role: kw.role,
        kw: kw.kw.trim(),
        kw_normalized: kw.kw
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // strip accents
          .replace(/['']/g, "'"),
        intent: kw.intent || 'unknown',
        vol: validVols.has(kw.vol ?? '') ? kw.vol! : 'MED',
        source: 'claude_chrome',
      };
    });

    // Step 3: Reject competitors
    const step3 = step2.filter((kw) => {
      const lower = kw.kw_normalized;
      const competitor =
        AdminKeywordPlannerController.COMPETITOR_BLACKLIST.find((c) =>
          lower.includes(c),
        );
      if (competitor) {
        rejected.push({ kw: kw.kw, reason: `concurrent: ${competitor}` });
        return false;
      }
      return true;
    });

    // Step 4: Dedup (same role + normalized kw = duplicate)
    const seen = new Set<string>();
    const step4 = step3.filter((kw) => {
      const key = `${kw.pg_id}:${kw.role}:${kw.kw_normalized}`;
      if (seen.has(key)) {
        rejected.push({ kw: kw.kw, reason: 'doublon' });
        return false;
      }
      seen.add(key);
      return true;
    });

    // Step 5: Intent boundary check (warn, don't reject)
    const step5 = step4.map((kw) => {
      const rules = AdminKeywordPlannerController.INTENT_RULES[kw.role];
      if (rules) {
        const lower = kw.kw_normalized;
        const forbidden = rules.forbidden_patterns.find((p) =>
          lower.includes(
            p
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, ''),
          ),
        );
        if (forbidden) {
          warnings.push({
            kw: kw.kw,
            reason: `intent suspect pour ${kw.role}: contient "${forbidden}"`,
          });
        }
      }
      // Remove internal field
      const { kw_normalized: _, ...rest } = kw;
      return rest;
    });

    const clean = step5;

    // Stats par gamme
    const byGamme = new Map<number, { roles: Set<string>; count: number }>();
    for (const k of clean) {
      const entry = byGamme.get(k.pg_id) ?? { roles: new Set(), count: 0 };
      entry.roles.add(k.role);
      entry.count++;
      byGamme.set(k.pg_id, entry);
    }
    const gammeStats = [...byGamme.entries()].map(([pgId, s]) => ({
      pg_id: pgId,
      pg_alias: aliasMap.get(pgId) || '',
      roles: [...s.roles],
      count: s.count,
    }));

    if (dry_run) {
      return {
        dry_run: true,
        valid: clean.length,
        rejected: rejected.length,
        rejected_details: rejected.slice(0, 20),
        warnings: warnings.slice(0, 20),
        gammes: gammeStats,
        errors: errors.slice(0, 10),
        sample: clean.slice(0, 5),
        quality: {
          input: keywords.length,
          after_validation: step1.length,
          after_competitors: step3.length,
          after_dedup: step4.length,
          after_intent_check: step5.length,
          reject_rate: Math.round((rejected.length / keywords.length) * 100),
          warning_rate: Math.round((warnings.length / keywords.length) * 100),
        },
      };
    }

    // Delete existing keywords for each pg_id + role touched
    for (const [pgId, s] of byGamme) {
      for (const role of s.roles) {
        await this.supabase
          .from('__seo_keyword_results')
          .delete()
          .eq('pg_id', pgId)
          .eq('role', role);
      }
    }

    // Insert in batches of 100
    let imported = 0;
    for (let i = 0; i < clean.length; i += 100) {
      const batch = clean.slice(i, i + 100);
      const { error } = await this.supabase
        .from('__seo_keyword_results')
        .insert(batch);
      if (error) {
        errors.push(`Batch ${i}: ${error.message}`);
      } else {
        imported += batch.length;
      }
    }

    return {
      imported,
      total: clean.length,
      gammes: gammeStats,
      rejected: rejected.length,
      rejected_details: rejected.slice(0, 20),
      warnings: warnings.slice(0, 20),
      errors,
      quality: {
        input: keywords.length,
        after_validation: step1.length,
        after_competitors: step3.length,
        after_dedup: step4.length,
        final: clean.length,
        reject_rate: Math.round((rejected.length / keywords.length) * 100),
      },
    };
  }

  /**
   * POST /api/admin/keyword-planner/batch-r1
   * 0-LLM batch generation of R1 keyword plans.
   * Generates deterministic KP from RAG + R3 anti-cannib + vehicles DB.
   */
  @Post('batch-r1')
  async batchR1(
    @Body() body: { limit?: number; minR3Score?: number; dryRun?: boolean },
  ) {
    if (!this.r1BatchService) {
      return { error: 'R1KeywordPlanBatchService not available' };
    }
    const limit = Math.min(body.limit ?? 50, 200);
    this.logger.log(
      `POST batch-r1 limit=${limit} minR3Score=${body.minR3Score ?? 70} dryRun=${body.dryRun ?? false}`,
    );
    return this.r1BatchService.batchGenerate({
      limit,
      minR3Score: body.minR3Score,
      dryRun: body.dryRun,
    });
  }

  /**
   * POST /api/admin/keyword-planner/generate-from-rag
   * Génère le contenu éditorial R1 (sg_content) directement depuis le RAG enrichi.
   * 0-LLM, template-based, écrit en DB + invalide le cache.
   */
  @Post('generate-from-rag')
  async generateFromRag(
    @Body() body: { pg_id: number; pg_alias: string; dry_run?: boolean },
  ) {
    if (!this.r1ContentFromRag) {
      return { error: 'R1ContentFromRagService not available' };
    }

    const { pg_id, pg_alias, dry_run = false } = body;
    this.logger.log(
      `POST generate-from-rag pg_id=${pg_id} alias=${pg_alias} dryRun=${dry_run}`,
    );

    // Récupérer le nom de la gamme
    const { data: gamme } = await this.supabase
      .from('pieces_gamme')
      .select('pg_name')
      .eq('pg_id', pg_id)
      .single();

    if (!gamme) {
      return { error: 'Gamme not found', pg_id };
    }

    const pgName = gamme.pg_name as string;

    // Générer le contenu depuis le RAG (virtual merge: .md + docs DB)
    const result = await this.r1ContentFromRag.generate(pg_alias, pgName);

    if (result.charCount === 0) {
      return {
        error: 'No RAG data available for this gamme',
        pg_alias,
        quality: 'minimal',
      };
    }

    if (dry_run) {
      return {
        status: 'dry_run',
        pg_alias,
        pgName,
        charCount: result.charCount,
        h2Count: result.h2Count,
        quality: result.quality,
        ragFieldsUsed: result.ragFieldsUsed,
        preview: result.html.slice(0, 500),
      };
    }

    // Vérifier le contenu existant (anti-régression : ne pas rétrécir)
    const { data: existing } = await this.supabase
      .from('__seo_gamme')
      .select('sg_content')
      .eq('sg_pg_id', String(pg_id))
      .single();

    const existingLen = existing?.sg_content?.length ?? 0;
    if (existingLen > result.charCount && existingLen > 3000) {
      return {
        error: `Anti-regression: existing content (${existingLen} chars) > generated (${result.charCount} chars). Use --force to override.`,
        pg_alias,
        existingLen,
        generatedLen: result.charCount,
      };
    }

    // Écrire en DB
    const { error: writeError } = await this.supabase
      .from('__seo_gamme')
      .upsert(
        {
          sg_pg_id: String(pg_id),
          sg_content: result.html,
          sg_updated_at: new Date().toISOString(),
        },
        { onConflict: 'sg_pg_id' },
      );

    if (writeError) {
      return { error: `DB write failed: ${writeError.message}`, pg_alias };
    }

    // Invalider le cache Redis
    try {
      if (this.cacheManager) {
        await this.cacheManager.del(`gamme:resp:v2:${pg_id}`);
        await this.cacheManager.del(`gamme:rpc:v2:${pg_id}`);
      }
    } catch {
      this.logger.warn(`Cache invalidation failed for pg_id=${pg_id}`);
    }

    this.logger.log(
      `[R1-CONTENT] Written ${result.charCount} chars for ${pg_alias} (quality=${result.quality})`,
    );

    return {
      status: 'written',
      pg_alias,
      pgName,
      charCount: result.charCount,
      h2Count: result.h2Count,
      quality: result.quality,
      ragFieldsUsed: result.ragFieldsUsed,
    };
  }

  /**
   * POST /api/admin/keyword-planner/batch-generate-from-rag
   * Batch : génère le contenu R1 pour les top N gammes.
   * Mode dry_run par défaut (preview sans écriture).
   */
  @Post('batch-generate-from-rag')
  async batchGenerateFromRag(
    @Body()
    body: {
      limit?: number;
      dry_run?: boolean;
      min_quality?: 'minimal' | 'standard' | 'rich';
      offset?: number;
    },
  ) {
    if (!this.r1ContentFromRag) {
      return { error: 'R1ContentFromRagService not available' };
    }

    const limit = Math.min(body.limit ?? 10, 50);
    const dryRun = body.dry_run ?? true;
    const minQuality = body.min_quality ?? 'standard';
    const offset = body.offset ?? 0;

    this.logger.log(
      `POST batch-generate-from-rag limit=${limit} dryRun=${dryRun} minQuality=${minQuality} offset=${offset}`,
    );

    // Récupérer les gammes triées par produits (top N)
    const { data: gammes, error: fetchErr } = await this.supabase
      .from('gamme_aggregates')
      .select('ga_pg_id, products_total')
      .order('products_total', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fetchErr || !gammes) {
      return { error: `Failed to fetch gammes: ${fetchErr?.message}` };
    }

    // Résoudre les alias
    const pgIds = gammes.map((g) => g.ga_pg_id);
    const { data: pgRows } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .in('pg_id', pgIds)
      .eq('pg_display', '1');

    if (!pgRows) return { error: 'Failed to resolve gamme aliases' };

    const pgMap = new Map(pgRows.map((r) => [r.pg_id, r]));

    const results: Array<{
      pg_id: number;
      pg_alias: string;
      pg_name: string;
      charCount: number;
      h2Count: number;
      quality: string;
      fields: number;
      status:
        | 'written'
        | 'skipped_quality'
        | 'skipped_regression'
        | 'dry_run'
        | 'error';
      reason?: string;
    }> = [];

    for (const agg of gammes) {
      const pg = pgMap.get(agg.ga_pg_id);
      if (!pg) continue;

      const pgId = pg.pg_id as number;
      const pgAlias = pg.pg_alias as string;
      const pgName = pg.pg_name as string;

      try {
        const gen = await this.r1ContentFromRag.generate(pgAlias, pgName);

        // Quality gate
        const qualityRank = { minimal: 0, standard: 1, rich: 2 };
        if ((qualityRank[gen.quality] ?? 0) < (qualityRank[minQuality] ?? 1)) {
          results.push({
            pg_id: pgId,
            pg_alias: pgAlias,
            pg_name: pgName,
            charCount: gen.charCount,
            h2Count: gen.h2Count,
            quality: gen.quality,
            fields: gen.ragFieldsUsed.length,
            status: 'skipped_quality',
            reason: `quality=${gen.quality} < min=${minQuality}`,
          });
          continue;
        }

        if (dryRun) {
          results.push({
            pg_id: pgId,
            pg_alias: pgAlias,
            pg_name: pgName,
            charCount: gen.charCount,
            h2Count: gen.h2Count,
            quality: gen.quality,
            fields: gen.ragFieldsUsed.length,
            status: 'dry_run',
          });
          continue;
        }

        // Anti-regression check
        const { data: existing } = await this.supabase
          .from('__seo_gamme')
          .select('sg_content')
          .eq('sg_pg_id', String(pgId))
          .single();

        const existingLen = existing?.sg_content?.length ?? 0;
        if (existingLen > gen.charCount && existingLen > 3000) {
          results.push({
            pg_id: pgId,
            pg_alias: pgAlias,
            pg_name: pgName,
            charCount: gen.charCount,
            h2Count: gen.h2Count,
            quality: gen.quality,
            fields: gen.ragFieldsUsed.length,
            status: 'skipped_regression',
            reason: `existing=${existingLen} > generated=${gen.charCount}`,
          });
          continue;
        }

        // Write
        await this.supabase.from('__seo_gamme').upsert(
          {
            sg_pg_id: String(pgId),
            sg_content: gen.html,
            sg_updated_at: new Date().toISOString(),
          },
          { onConflict: 'sg_pg_id' },
        );

        // Cache invalidation
        try {
          if (this.cacheManager) {
            await this.cacheManager.del(`gamme:resp:v2:${pgId}`);
          }
        } catch {
          /* silent */
        }

        results.push({
          pg_id: pgId,
          pg_alias: pgAlias,
          pg_name: pgName,
          charCount: gen.charCount,
          h2Count: gen.h2Count,
          quality: gen.quality,
          fields: gen.ragFieldsUsed.length,
          status: 'written',
        });
      } catch (err) {
        results.push({
          pg_id: pgId,
          pg_alias: pgAlias,
          pg_name: pgName,
          charCount: 0,
          h2Count: 0,
          quality: 'minimal',
          fields: 0,
          status: 'error',
          reason: String(err),
        });
      }
    }

    const summary = {
      total: results.length,
      written: results.filter((r) => r.status === 'written').length,
      dry_run: results.filter((r) => r.status === 'dry_run').length,
      skipped_quality: results.filter((r) => r.status === 'skipped_quality')
        .length,
      skipped_regression: results.filter(
        (r) => r.status === 'skipped_regression',
      ).length,
      errors: results.filter((r) => r.status === 'error').length,
      avg_chars: Math.round(
        results.reduce((s, r) => s + r.charCount, 0) / (results.length || 1),
      ),
    };

    return { summary, results };
  }

  // ── Private helpers ──

  private loadRag(slug: string): Record<string, unknown> {
    const filePath = path.join(RAG_GAMMES_DIR, `${slug}.md`);
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.startsWith('---')) return {};
    const parts = content.split('---', 3);
    if (parts.length < 3) return {};
    try {
      return (yaml.load(parts[1]) as Record<string, unknown>) ?? {};
    } catch {
      return {};
    }
  }

  private nested(obj: unknown, ...keys: string[]): unknown {
    let cur = obj;
    for (const k of keys) {
      if (cur && typeof cur === 'object' && k in cur) {
        cur = (cur as Record<string, unknown>)[k];
      } else {
        return '';
      }
    }
    return cur ?? '';
  }

  private sj(val: unknown): string {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    return JSON.stringify(val, null, 2);
  }

  /** Format top_brands as readable one-liner: "BOSCH (2333), ATE (9), FTE (47)" */
  private formatBrands(raw: unknown): string {
    if (!Array.isArray(raw)) return '[non renseigne]';
    return (
      raw
        .map(
          (b: { name?: string; count?: number }) =>
            `${b.name ?? '?'} (${b.count ?? 0})`,
        )
        .join(', ') || '[non renseigne]'
    );
  }

  /** Dedup selection_criteria: remove v4-* duplicates */
  private dedupCriteria(raw: unknown): string {
    if (!Array.isArray(raw)) return '[non renseigne]';
    const seen = new Set<string>();
    const clean = raw.filter((item: { key?: string; label?: string }) => {
      const label = (item.label ?? '')
        .replace(/\*\*/g, '')
        .trim()
        .toLowerCase();
      if (!label || seen.has(label)) return false;
      seen.add(label);
      return true;
    });
    return clean.length > 0
      ? clean
          .map(
            (c: { label?: string }) =>
              `- ${(c.label ?? '').replace(/\*\*/g, '')}`,
          )
          .join('\n')
      : '[non renseigne]';
  }

  /** Parse value to array (handles JSON strings, arrays, nulls) */
  private toArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* ignore */
      }
    }
    return [];
  }

  /** Dedup any string array or array of objects (case-insensitive) */
  private dedupArray(raw: unknown): string {
    const arr = this.toArray(raw);
    if (arr.length === 0) return '[non renseigne]';
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const item of arr) {
      const text =
        typeof item === 'string'
          ? item.trim()
          : typeof item === 'object' && item
            ? String(
                (item as Record<string, unknown>).label ??
                  (item as Record<string, unknown>).axis ??
                  JSON.stringify(item),
              )
            : String(item);
      const key = text.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      lines.push(`- ${text}`);
    }
    return lines.length > 0 ? lines.join('\n') : '[non renseigne]';
  }

  /** Format symptoms as bullet list (skip empty entries) */
  private formatSymptoms(raw: unknown): string {
    if (!Array.isArray(raw) || raw.length === 0) return '[non renseigne]';
    const lines = raw
      .map((s: string | { label?: string }) =>
        typeof s === 'string' ? s.trim() : (s.label ?? '').trim(),
      )
      .filter((s: string) => s.length > 0)
      .map((s: string) => `- ${s}`);
    return lines.length > 0 ? lines.join('\n') : '[non renseigne]';
  }

  /** Fallback: return first non-empty value or placeholder */
  private fallback(...values: string[]): string {
    for (const v of values) {
      if (v && v !== '""' && v !== '[]' && v !== '{}' && v !== 'null') return v;
    }
    return '[non renseigne]';
  }

  /** Data quality score: count filled critical fields out of 7 */
  private dataQuality(ctx: Record<string, string>): string {
    const critical = [
      'intro_role',
      'symptoms',
      'selection_criteria',
      'compatibility_axes',
      'interest_nuggets',
      'anti_mistakes',
      'cost_range',
    ];
    const empty = '[non renseigne]';
    const filled = critical.filter((k) => ctx[k] && ctx[k] !== empty);
    const missing = critical.filter((k) => !ctx[k] || ctx[k] === empty);
    const score = filled.length;
    const level = score >= 6 ? 'RICHE' : score >= 4 ? 'PARTIEL' : 'INSUFFISANT';
    const lines = [`- Richesse : ${score}/7 champs renseignes (${level})`];
    if (missing.length > 0)
      lines.push(`- Champs manquants : ${missing.join(', ')}`);
    if (level === 'INSUFFISANT')
      lines.push(
        '- Action : KP de base uniquement, sections concernees seront generiques',
      );
    else if (level === 'PARTIEL')
      lines.push(
        '- Action : generer un KP solide, utiliser des termes generiques pour les champs manquants',
      );
    return lines.join('\n');
  }

  private buildContext(
    info: Record<string, unknown>,
    guide: Record<string, unknown>,
    agg: Record<string, unknown>,
    rag: Record<string, unknown>,
  ): Record<string, string> {
    const g = (k: string) => this.sj(guide[k]);
    const r = (...keys: string[]) => this.sj(this.nested(rag, ...keys));

    // Build context with smart formatting and fallbacks
    const ctx: Record<string, string> = {
      gamme_name: String(info.pg_name ?? ''),
      pg_id: String(info.pg_id ?? 0),
      pg_alias: String(info.pg_alias ?? ''),

      // Guide data — cleaned
      intro_role: this.fallback(g('sgpg_intro_role'), r('domain', 'role')),
      intro_title: g('sgpg_intro_title') || '[non renseigne]',
      symptoms: this.formatSymptoms(guide.sgpg_symptoms),
      selection_criteria: this.dedupCriteria(guide.sgpg_selection_criteria),
      cost_range: this.fallback(g('sgpg_risk_cost_range'), '[non renseigne]'),
      risk_explanation: g('sgpg_risk_explanation') || '[non renseigne]',
      risk_consequences: g('sgpg_risk_consequences') || '[non renseigne]',
      faq: g('sgpg_faq') || '[non renseigne]',
      brands_guide: g('sgpg_brands_guide') || '[non renseigne]',
      when_pro: g('sgpg_when_pro') || '[non renseigne]',
      how_to_choose: g('sgpg_how_to_choose') || '[non renseigne]',
      h1_override: g('sgpg_h1_override') || '[non renseigne]',
      micro_seo_block: g('sgpg_micro_seo_block') || '',
      anti_mistakes: g('sgpg_anti_mistakes') || '[non renseigne]',

      // Fallback chain: DB → RAG for pieces liées (deduped)
      sync_parts: this.dedupArray(
        this.nested(rag, 'domain', 'related_parts') ||
          this.nested(rag, 'domain', 'cross_gammes') ||
          guide.sgpg_intro_sync_parts,
      ),
      compatibility_axes: this.dedupArray(
        guide.sgpg_compatibility_axes ||
          this.nested(rag, 'selection', 'criteria'),
      ),
      interest_nuggets: g('sgpg_interest_nuggets') || '[non renseigne]',
      decision_tree: g('sgpg_decision_tree') || '[non renseigne]',
      use_cases: g('sgpg_use_cases') || '[non renseigne]',

      // Aggregates — formatted
      products_total: String(agg.products_total ?? 0),
      top_brands: this.formatBrands(agg.top_brands),
      demand_level: String(agg.demand_level ?? '?'),
      difficulty_level: String(agg.difficulty_level ?? '?'),
      priority_score: String(agg.priority_score ?? 0),
      intent_type: String(agg.intent_type ?? '?'),
      content_depth: String(agg.content_depth ?? '?'),
      vehicle_coverage: String(agg.vehicle_coverage ?? '?'),

      // RAG evidence
      rag_domain_role: r('domain', 'role') || '[non renseigne]',
      rag_must_be_true: r('domain', 'must_be_true') || '[non renseigne]',
      rag_must_not_contain:
        r('domain', 'must_not_contain') || '[non renseigne]',
      rag_confusion_with: r('domain', 'confusion_with') || '[non renseigne]',
      rag_related_parts: r('domain', 'related_parts') || '[non renseigne]',
      rag_norms: r('domain', 'norms') || '[non renseigne]',
      rag_cross_gammes: r('domain', 'cross_gammes') || '[non renseigne]',
      rag_diagnostic_symptoms: r('diagnostic', 'symptoms') || '[non renseigne]',
      rag_diagnostic_causes: r('diagnostic', 'causes') || '[non renseigne]',
      rag_maintenance: r('maintenance', 'interval') || '[non renseigne]',

      existing_kp: 'aucun',
      mode: 'creation',
    };

    // Add quality indicator
    ctx.data_quality = this.dataQuality(ctx);

    return ctx;
  }
}
