/**
 * 🧠 Knowledge Graph Service - AI-COS v2.8.0
 *
 * Reasoning Engine pour diagnostic multi-symptômes via traversal du graphe
 *
 * Architecture:
 *   Observable["fumée noire"] ──CAUSES──► Fault["EGR encrassée"] ──FIXED_BY──► Part["Vanne EGR"]
 *
 * Scoring:
 *   Score = (symptômes matchés / total) × confiance moyenne
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { KgDataService } from './kg-data.service';
import {
  KgNode,
  DiagnoseInput,
  DiagnosticResult,
  FaultCandidate,
  ScoredFault,
  EnrichedFault,
  DiagnosticPart,
  DiagnosticAction,
  KgReasoningCache,
} from './kg.types';

@Injectable()
export class KgService extends SupabaseBaseService {
  protected readonly logger = new Logger(KgService.name);

  // Cache TTL en secondes (1 heure par défaut)
  private readonly cacheTtlSeconds = 3600;

  constructor(
    configService: ConfigService,
    private readonly kgDataService: KgDataService,
  ) {
    super(configService);
    this.logger.log('🧠 KgService (Reasoning Engine) initialized');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN DIAGNOSTIC METHOD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Diagnostic multi-symptômes via traversal du Knowledge Graph
   *
   * @example
   * const result = await kgService.diagnose({
   *   vehicleId: 'renault-clio-3-1.5-dci',
   *   observables: ['fumée noire', 'perte puissance', 'voyant moteur'],
   *   confidenceThreshold: 0.75
   * });
   * // Result: { faults: [{ faultLabel: 'EGR encrassée', score: 0.94, ... }], ... }
   */
  async diagnose(input: DiagnoseInput): Promise<DiagnosticResult> {
    const startTime = Date.now();
    const { observables, vehicleId, confidenceThreshold = 0.75 } = input;

    // Normaliser les symptômes
    const normalizedObservables = observables.map((o) =>
      o.toLowerCase().trim(),
    );

    // Vérifier le cache
    const queryHash = this.computeQueryHash(vehicleId, normalizedObservables);
    const cachedResult = await this.getCachedResult(queryHash);
    if (cachedResult) {
      this.logger.log(`📦 Cache HIT for query ${queryHash.substring(0, 8)}...`);
      await this.incrementCacheHit(queryHash);
      return {
        ...cachedResult,
        computationTimeMs: Date.now() - startTime,
      };
    }

    this.logger.log(
      `🔍 Diagnosing with ${normalizedObservables.length} observables...`,
    );

    // 1. Trouver les nodes Observable correspondants
    const observableNodes = await this.findObservableNodes(
      normalizedObservables,
    );
    this.logger.log(`Found ${observableNodes.length} Observable nodes`);

    if (observableNodes.length === 0) {
      return this.emptyResult(normalizedObservables, startTime);
    }

    // 2. Traverser le graphe: Observable → CAUSES → Fault
    const faultCandidates = await this.traverseToFaults(
      observableNodes.map((n) => n.node_id),
    );
    this.logger.log(`Found ${faultCandidates.length} fault candidates`);

    if (faultCandidates.length === 0) {
      return this.emptyResult(normalizedObservables, startTime);
    }

    // 3. Scorer chaque fault par nombre de symptômes matchés
    const scoredFaults = this.scoreFaults(
      faultCandidates,
      observableNodes,
      normalizedObservables,
    );

    // 4. Filtrer par seuil de confiance
    const filteredFaults = scoredFaults.filter(
      (f) => f.score >= confidenceThreshold,
    );

    // 5. Enrichir avec Actions et Parts
    const enrichedFaults = await this.enrichWithSolutions(filteredFaults);

    // 6. Générer l'explication
    const primaryFault = enrichedFaults[0];
    const explanation = this.generateExplanation(
      primaryFault,
      normalizedObservables,
    );

    // 7. Collecter les sources uniques
    const sources = this.collectSources(enrichedFaults);

    // 8. Identifier les symptômes non matchés
    const matchedSymptoms = primaryFault?.matchedObservables || [];
    const unmatchedSymptoms = normalizedObservables.filter(
      (o) => !matchedSymptoms.includes(o),
    );

    const result: DiagnosticResult = {
      faults: enrichedFaults,
      primaryFault,
      confidence: primaryFault?.score || 0,
      explanation,
      sources,
      matchedSymptoms,
      unmatchedSymptoms,
      computationTimeMs: Date.now() - startTime,
    };

    // 9. Mettre en cache
    await this.cacheResult(queryHash, vehicleId, normalizedObservables, result);

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: FIND OBSERVABLE NODES
  // ═══════════════════════════════════════════════════════════════════════════

  private async findObservableNodes(
    observableLabels: string[],
  ): Promise<KgNode[]> {
    const nodes: KgNode[] = [];

    for (const label of observableLabels) {
      const found = await this.kgDataService.searchNodes(
        label,
        'Observable',
        5,
      );
      if (found.length > 0) {
        // Prendre le meilleur match (premier résultat)
        nodes.push(found[0]);
      }
    }

    return nodes;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: TRAVERSE TO FAULTS
  // ═══════════════════════════════════════════════════════════════════════════

  private async traverseToFaults(
    observableNodeIds: string[],
  ): Promise<FaultCandidate[]> {
    const result = await this.executeWithRetry(async () => {
      // Utiliser la RPC function pour performance
      const { data, error } = await this.supabase.rpc(
        'kg_find_faults_from_observables',
        {
          p_observable_ids: observableNodeIds,
        },
      );

      if (error) {
        // Fallback: query directe si la RPC n'existe pas encore
        this.logger.warn(
          `RPC kg_find_faults_from_observables failed, using fallback: ${error.message}`,
        );
        return this.traverseToFaultsFallback(observableNodeIds);
      }

      return data as FaultCandidate[];
    }, 'traverseToFaults');

    return result || [];
  }

  private async traverseToFaultsFallback(
    observableNodeIds: string[],
  ): Promise<FaultCandidate[]> {
    const { data, error } = await this.supabase
      .from('kg_edges')
      .select(
        `
        edge_id,
        source_node_id,
        target_node_id,
        weight,
        confidence,
        sources,
        target:kg_nodes!target_node_id (
          node_id,
          node_label,
          node_category
        )
      `,
      )
      .in('source_node_id', observableNodeIds)
      .eq('edge_type', 'CAUSES')
      .eq('is_active', true);

    if (error) {
      this.logger.error('Fallback query failed:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      fault_id: row.target?.node_id,
      fault_label: row.target?.node_label,
      fault_category: row.target?.node_category,
      edge_weight: row.weight,
      edge_confidence: row.confidence,
      source_observable_id: row.source_node_id,
      sources: row.sources || [],
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: SCORE FAULTS
  // ═══════════════════════════════════════════════════════════════════════════

  private scoreFaults(
    faultCandidates: FaultCandidate[],
    observableNodes: KgNode[],
    originalLabels: string[],
  ): ScoredFault[] {
    // Grouper par fault_id
    const faultScores = new Map<
      string,
      {
        label: string;
        category?: string;
        matches: number;
        confidenceSum: number;
        matchedObservables: string[];
      }
    >();

    for (const candidate of faultCandidates) {
      if (!candidate.fault_id) continue;

      const current = faultScores.get(candidate.fault_id) || {
        label: candidate.fault_label,
        category: candidate.fault_category,
        matches: 0,
        confidenceSum: 0,
        matchedObservables: [],
      };

      current.matches++;
      current.confidenceSum += candidate.edge_confidence || 0;

      // Trouver le label original correspondant
      const observableNode = observableNodes.find(
        (n) => n.node_id === candidate.source_observable_id,
      );
      if (observableNode) {
        const matchedLabel = originalLabels.find((l) =>
          observableNode.node_label.toLowerCase().includes(l),
        );
        if (
          matchedLabel &&
          !current.matchedObservables.includes(matchedLabel)
        ) {
          current.matchedObservables.push(matchedLabel);
        }
      }

      faultScores.set(candidate.fault_id, current);
    }

    // Calculer les scores
    const totalSymptoms = originalLabels.length;
    const scored: ScoredFault[] = [];

    for (const [faultId, data] of faultScores) {
      const matchRatio = data.matches / totalSymptoms;
      const avgConfidence =
        data.matches > 0 ? data.confidenceSum / data.matches : 0;
      const finalScore = matchRatio * avgConfidence;

      scored.push({
        faultId,
        faultLabel: data.label,
        faultCategory: data.category,
        score: Math.round(finalScore * 100) / 100, // Arrondir à 2 décimales
        matchedSymptoms: data.matches,
        totalSymptoms,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        matchedObservables: data.matchedObservables,
      });
    }

    // Trier par score décroissant
    return scored.sort((a, b) => b.score - a.score);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: ENRICH WITH SOLUTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  private async enrichWithSolutions(
    scoredFaults: ScoredFault[],
  ): Promise<EnrichedFault[]> {
    const enriched: EnrichedFault[] = [];

    for (const fault of scoredFaults.slice(0, 5)) {
      // Limiter à top 5
      const [parts, actions] = await Promise.all([
        this.findPartsForFault(fault.faultId),
        this.findActionsForFault(fault.faultId),
      ]);

      enriched.push({
        ...fault,
        parts,
        actions,
      });
    }

    return enriched;
  }

  private async findPartsForFault(faultId: string): Promise<DiagnosticPart[]> {
    const result = await this.executeWithRetry(async () => {
      // Essayer RPC d'abord
      const { data, error } = await this.supabase.rpc(
        'kg_find_parts_for_fault',
        {
          p_fault_id: faultId,
        },
      );

      if (error) {
        // Fallback
        return this.findPartsForFaultFallback(faultId);
      }

      return (data || []).map((row: any) => ({
        partNodeId: row.part_node_id,
        partLabel: row.part_label,
        pieceId: row.piece_id,
        gammeId: row.gamme_id,
        confidence: row.edge_confidence || 1,
      }));
    }, 'findPartsForFault');

    return result || [];
  }

  private async findPartsForFaultFallback(
    faultId: string,
  ): Promise<DiagnosticPart[]> {
    const { data } = await this.supabase
      .from('kg_edges')
      .select(
        `
        confidence,
        target:kg_nodes!target_node_id (
          node_id,
          node_label,
          node_data
        )
      `,
      )
      .eq('source_node_id', faultId)
      .eq('edge_type', 'FIXED_BY')
      .eq('is_active', true);

    return (data || []).map((row: any) => ({
      partNodeId: row.target?.node_id,
      partLabel: row.target?.node_label,
      pieceId: row.target?.node_data?.piece_id,
      gammeId: row.target?.node_data?.gamme_id,
      confidence: row.confidence || 1,
    }));
  }

  private async findActionsForFault(
    faultId: string,
  ): Promise<DiagnosticAction[]> {
    const result = await this.executeWithRetry(async () => {
      const { data, error } = await this.supabase.rpc(
        'kg_find_actions_for_fault',
        {
          p_fault_id: faultId,
        },
      );

      if (error) {
        return this.findActionsForFaultFallback(faultId);
      }

      return (data || []).map((row: any) => ({
        actionNodeId: row.action_node_id,
        actionLabel: row.action_label,
        actionCategory: row.action_category,
        confidence: row.edge_confidence || 1,
      }));
    }, 'findActionsForFault');

    return result || [];
  }

  private async findActionsForFaultFallback(
    faultId: string,
  ): Promise<DiagnosticAction[]> {
    const { data } = await this.supabase
      .from('kg_edges')
      .select(
        `
        confidence,
        target:kg_nodes!target_node_id (
          node_id,
          node_label,
          node_category
        )
      `,
      )
      .eq('source_node_id', faultId)
      .eq('edge_type', 'DIAGNOSED_BY')
      .eq('is_active', true);

    return (data || []).map((row: any) => ({
      actionNodeId: row.target?.node_id,
      actionLabel: row.target?.node_label,
      actionCategory: row.target?.node_category,
      confidence: row.confidence || 1,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: GENERATE EXPLANATION
  // ═══════════════════════════════════════════════════════════════════════════

  private generateExplanation(
    primaryFault: EnrichedFault | undefined,
    observables: string[],
  ): string {
    if (!primaryFault) {
      return `Aucune panne n'a pu être identifiée avec les symptômes fournis: ${observables.join(', ')}.`;
    }

    const matchedCount = primaryFault.matchedSymptoms;
    const totalCount = primaryFault.totalSymptoms;
    const percentage = Math.round((matchedCount / totalCount) * 100);
    const confidence = Math.round(primaryFault.score * 100);

    let explanation = `${matchedCount}/${totalCount} symptômes (${percentage}%) correspondent au diagnostic "${primaryFault.faultLabel}" avec une confiance de ${confidence}%.`;

    if (primaryFault.matchedObservables.length > 0) {
      explanation += ` Symptômes identifiés: ${primaryFault.matchedObservables.join(', ')}.`;
    }

    if (primaryFault.actions.length > 0) {
      const actionLabels = primaryFault.actions.map((a) => a.actionLabel);
      explanation += ` Actions recommandées: ${actionLabels.join(', ')}.`;
    }

    if (primaryFault.parts.length > 0) {
      const partLabels = primaryFault.parts.map((p) => p.partLabel);
      explanation += ` Pièces concernées: ${partLabels.join(', ')}.`;
    }

    return explanation;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private collectSources(faults: EnrichedFault[]): string[] {
    const sources = new Set<string>();
    sources.add('Knowledge Graph');
    for (const fault of faults) {
      if (fault.matchedObservables) {
        sources.add(`${fault.matchedSymptoms} symptômes matchés`);
      }
    }
    return Array.from(sources);
  }

  private emptyResult(
    observables: string[],
    startTime: number,
  ): DiagnosticResult {
    return {
      faults: [],
      primaryFault: undefined,
      confidence: 0,
      explanation: `Aucune panne identifiée pour les symptômes: ${observables.join(', ')}. Le graphe de connaissances n'a pas de correspondance.`,
      sources: [],
      matchedSymptoms: [],
      unmatchedSymptoms: observables,
      computationTimeMs: Date.now() - startTime,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHING
  // ═══════════════════════════════════════════════════════════════════════════

  private computeQueryHash(
    vehicleId: string | undefined,
    observables: string[],
  ): string {
    const sortedObservables = [...observables].sort();
    const input = `${vehicleId || ''}:${sortedObservables.join('|')}`;
    return createHash('sha256').update(input).digest('hex');
  }

  private async getCachedResult(
    queryHash: string,
  ): Promise<DiagnosticResult | null> {
    const result = await this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('kg_reasoning_cache')
        .select('*')
        .eq('query_hash', queryHash)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) return null;

      const cached = data as KgReasoningCache;
      return {
        faults: cached.result_faults || [],
        primaryFault: cached.result_faults?.[0],
        confidence: cached.result_score || 0,
        explanation: cached.result_explanation || '',
        sources: ['Cache'],
        matchedSymptoms: cached.input_observables || [],
        unmatchedSymptoms: [],
        computationTimeMs: 0,
      };
    }, 'getCachedResult');

    return result;
  }

  private async cacheResult(
    queryHash: string,
    vehicleId: string | undefined,
    observables: string[],
    result: DiagnosticResult,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + this.cacheTtlSeconds * 1000);

    await this.executeWithRetry(async () => {
      const { error } = await this.supabase.from('kg_reasoning_cache').upsert({
        query_hash: queryHash,
        vehicle_node_id: vehicleId,
        input_observables: observables,
        result_faults: result.faults,
        result_primary_fault_id: result.primaryFault?.faultId,
        result_score: result.confidence,
        result_explanation: result.explanation,
        expires_at: expiresAt.toISOString(),
        computation_time_ms: result.computationTimeMs,
      });

      if (error) {
        this.logger.warn(`Failed to cache result: ${error.message}`);
      }
    }, 'cacheResult');
  }

  private async incrementCacheHit(queryHash: string): Promise<void> {
    await this.supabase.rpc('increment_cache_hit', { p_query_hash: queryHash });
  }
}
