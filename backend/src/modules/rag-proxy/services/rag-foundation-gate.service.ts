import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type { FoundationGateResult } from '../types/rag-contracts.types';

/**
 * RagFoundationGateService — F1-GATE Foundation Write Lock.
 *
 * Central guard that prevents downstream phases (1.5+) from writing to
 * resources that have not passed Phase 1 ingestion validation.
 *
 * Invariant F1-LOCK:
 *   Any downstream write attempt on a resource where foundation_gate_passed != true
 *   MUST be refused, logged, and classified as a foundation lock violation.
 *
 * Allowed if gate=false: read, audit, scoring, diagnostic, preliminary classification.
 * Forbidden if gate=false: any business, editorial, or structural write.
 */
@Injectable()
export class RagFoundationGateService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    RagFoundationGateService.name,
  );

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Check the foundation gate status for a single document source.
   * Queries `__rag_knowledge` for phase1_status and foundation_gate_passed.
   */
  async checkGate(source: string): Promise<FoundationGateResult> {
    const now = new Date().toISOString();

    const { data: doc } = await this.supabase
      .from('__rag_knowledge')
      .select(
        'id, phase1_status, foundation_gate_passed, status, source_url, truth_level, fingerprint, content_hash, raw_hash',
      )
      .eq('source', source)
      .limit(1)
      .maybeSingle();

    if (!doc) {
      return {
        provenanceStatus: 'missing',
        traceabilityStatus: 'missing',
        storageStatus: 'failed',
        dbSyncStatus: 'failed',
        collisionStatus: 'clear',
        writeSafetyStatus: 'blocked',
        mutationMode: 'uncontrolled',
        foundationGatePassed: false,
        foundationGateCheckedAt: now,
        foundationGateReason: `Document not found: ${source}`,
      };
    }

    const phase1Passed = doc.phase1_status === 'passed';
    const hasProvenance = !!doc.source_url && !!doc.truth_level;
    const hasTraceability = !!doc.fingerprint || !!doc.content_hash;
    const hasStorage = doc.status === 'active' || doc.status === 'quarantine';
    const dbSynced = !!doc.id;

    const foundationGatePassed =
      phase1Passed &&
      hasProvenance &&
      hasTraceability &&
      hasStorage &&
      dbSynced;

    const reasons: string[] = [];
    if (!phase1Passed)
      reasons.push(`phase1_status=${doc.phase1_status ?? 'null'}`);
    if (!hasProvenance) reasons.push('provenance_incomplete');
    if (!hasTraceability) reasons.push('traceability_missing');
    if (!hasStorage) reasons.push(`storage_status=${doc.status}`);

    return {
      provenanceStatus: hasProvenance ? 'validated' : 'incomplete',
      traceabilityStatus: hasTraceability ? 'validated' : 'missing',
      storageStatus: hasStorage ? 'validated' : 'failed',
      dbSyncStatus: dbSynced ? 'validated' : 'failed',
      collisionStatus: 'clear',
      writeSafetyStatus: phase1Passed ? 'validated' : 'blocked',
      mutationMode: 'controlled',
      foundationGatePassed,
      foundationGateCheckedAt: now,
      foundationGateReason: foundationGatePassed
        ? undefined
        : reasons.join('; '),
    };
  }

  /**
   * Guard a single document write — throws if foundation gate not passed.
   * Every violation is logged as an architecture incident.
   */
  async guardWrite(source: string): Promise<void> {
    const gate = await this.checkGate(source);
    if (!gate.foundationGatePassed) {
      this.logger.error(
        `F1-GATE VIOLATION: write attempt on "${source}" blocked — ${gate.foundationGateReason}`,
      );
      throw new Error(
        `Foundation Write Lock: "${source}" has not passed Phase 1 (${gate.foundationGateReason})`,
      );
    }
  }

  /**
   * Guard all documents linked to a gamme (by pg_alias).
   * Returns passed=true only if ALL docs for this gamme have passed Phase 1.
   * Soft guard: does NOT throw — caller decides how to handle.
   */
  async guardWriteForGamme(
    pgAlias: string,
  ): Promise<{ passed: boolean; blockedSources: string[]; total: number }> {
    const { data: docs } = await this.supabase
      .from('__rag_knowledge')
      .select('source, phase1_status, foundation_gate_passed')
      .or(`source.like.gammes/${pgAlias}%,source.like.web/${pgAlias}%`)
      .eq('status', 'active');

    if (!docs || docs.length === 0) {
      // No docs found — allow (gamme may not have RAG docs yet)
      return { passed: true, blockedSources: [], total: 0 };
    }

    const blockedSources = docs
      .filter((d) => d.phase1_status !== 'passed')
      .map((d) => d.source);

    if (blockedSources.length > 0) {
      this.logger.warn(
        `F1-GATE: gamme "${pgAlias}" has ${blockedSources.length}/${docs.length} docs without Phase 1 validation: [${blockedSources.slice(0, 5).join(', ')}${blockedSources.length > 5 ? '...' : ''}]`,
      );
    }

    return {
      passed: blockedSources.length === 0,
      blockedSources,
      total: docs.length,
    };
  }

  /**
   * Get admissible pool status for a gamme.
   * Does NOT block — returns stats so callers can decide.
   *
   * Statuses:
   * - 'OK': admissible docs exist, downstream can proceed
   * - 'F1-POOL-EMPTY': docs exist but none are admissible
   * - 'NO_RAG_DOCS_PRESENT': no RAG docs at all (not a foundation failure)
   */
  async getAdmissiblePoolStatus(pgAlias: string): Promise<{
    status: 'OK' | 'F1-POOL-EMPTY' | 'NO_RAG_DOCS_PRESENT';
    total: number;
    admissible: number;
    blocked: number;
    blockedSources: string[];
  }> {
    const { data: docs } = await this.supabase
      .from('__rag_knowledge')
      .select('source, foundation_gate_passed, pipeline_version')
      .or(`source.like.gammes/${pgAlias}%,gamme_aliases.cs.{${pgAlias}}`)
      .eq('status', 'active');

    if (!docs || docs.length === 0) {
      return {
        status: 'NO_RAG_DOCS_PRESENT',
        total: 0,
        admissible: 0,
        blocked: 0,
        blockedSources: [],
      };
    }

    // Legacy docs (no pipeline_version) are always admissible
    const admissible = docs.filter(
      (d) => d.foundation_gate_passed === true || d.pipeline_version === null,
    );
    const blocked = docs.filter(
      (d) => d.foundation_gate_passed !== true && d.pipeline_version !== null,
    );

    const status = admissible.length > 0 ? 'OK' : 'F1-POOL-EMPTY';

    if (status === 'F1-POOL-EMPTY') {
      this.logger.warn(
        `F1-POOL-EMPTY: gamme "${pgAlias}" has ${docs.length} docs but none admissible — downstream writes blocked`,
      );
    }

    return {
      status,
      total: docs.length,
      admissible: admissible.length,
      blocked: blocked.length,
      blockedSources: blocked.map((d) => d.source),
    };
  }

  /**
   * Get gate stats for monitoring/admin dashboard (non-blocking).
   */
  async getGammeGateStats(pgAlias: string): Promise<{
    totalDocs: number;
    validatedDocs: number;
    blockedDocs: number;
    blockedSources: string[];
  }> {
    const pool = await this.getAdmissiblePoolStatus(pgAlias);
    return {
      totalDocs: pool.total,
      validatedDocs: pool.admissible,
      blockedDocs: pool.blocked,
      blockedSources: pool.blockedSources,
    };
  }
}
