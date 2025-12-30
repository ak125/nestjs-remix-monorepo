/**
 * 🧠 Knowledge Graph Data Service - AI-COS v2.8.0
 *
 * CRUD operations pour les nodes et edges du Knowledge Graph
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import {
  KgNode,
  KgEdge,
  CreateKgNodeDto,
  UpdateKgNodeDto,
  CreateKgEdgeDto,
  UpdateKgEdgeDto,
  KgNodeType,
  KgEdgeType,
  KgStats,
} from './kg.types';

@Injectable()
export class KgDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(KgDataService.name);

  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('🧠 KgDataService initialized');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NODE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Créer un nouveau node
   */
  async createNode(dto: CreateKgNodeDto): Promise<KgNode | null> {
    const result = await this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('kg_nodes')
        .insert({
          node_type: dto.node_type,
          node_label: dto.node_label,
          node_alias: dto.node_alias,
          node_category: dto.node_category,
          node_data: dto.node_data || {},
          confidence: dto.confidence ?? 1.0,
          sources: dto.sources || [],
          validation_status: dto.validation_status || 'pending',
          created_by: dto.created_by || 'system',
        })
        .select()
        .single();

      if (error) throw error;
      return data as KgNode;
    }, 'createNode');

    return result;
  }

  /**
   * Récupérer un node par ID
   */
  async getNode(nodeId: string): Promise<KgNode | null> {
    const result = await this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('kg_nodes')
        .select('*')
        .eq('node_id', nodeId)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as KgNode;
    }, 'getNode');

    return result;
  }

  /**
   * Rechercher des nodes par type
   */
  async getNodesByType(
    nodeType: KgNodeType,
    limit = 100,
    offset = 0,
  ): Promise<KgNode[]> {
    const result = await this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('kg_nodes')
        .select('*')
        .eq('node_type', nodeType)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data as KgNode[];
    }, 'getNodesByType');

    return result || [];
  }

  /**
   * Rechercher des nodes par label (full-text search)
   */
  async searchNodes(
    query: string,
    nodeType?: KgNodeType,
    limit = 50,
  ): Promise<KgNode[]> {
    const result = await this.executeWithRetry(async () => {
      let queryBuilder = this.supabase
        .from('kg_nodes')
        .select('*')
        .eq('is_active', true)
        .ilike('node_label', `%${query}%`)
        .limit(limit);

      if (nodeType) {
        queryBuilder = queryBuilder.eq('node_type', nodeType);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      return data as KgNode[];
    }, 'searchNodes');

    return result || [];
  }

  /**
   * Mettre à jour un node
   */
  async updateNode(
    nodeId: string,
    dto: UpdateKgNodeDto,
  ): Promise<KgNode | null> {
    const result = await this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('kg_nodes')
        .update(dto)
        .eq('node_id', nodeId)
        .select()
        .single();

      if (error) throw error;
      return data as KgNode;
    }, 'updateNode');

    return result;
  }

  /**
   * Soft delete d'un node
   */
  async deleteNode(nodeId: string): Promise<boolean> {
    const result = await this.executeWithRetry(async () => {
      const { error } = await this.supabase
        .from('kg_nodes')
        .update({ is_active: false })
        .eq('node_id', nodeId);

      if (error) throw error;
      return true;
    }, 'deleteNode');

    return result || false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Créer une nouvelle edge
   */
  async createEdge(dto: CreateKgEdgeDto): Promise<KgEdge | null> {
    const result = await this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('kg_edges')
        .insert({
          source_node_id: dto.source_node_id,
          target_node_id: dto.target_node_id,
          edge_type: dto.edge_type,
          weight: dto.weight ?? 1.0,
          is_bidirectional: dto.is_bidirectional ?? false,
          confidence: dto.confidence ?? 1.0,
          evidence: dto.evidence || {},
          sources: dto.sources || [],
          created_by: dto.created_by || 'system',
        })
        .select()
        .single();

      if (error) throw error;
      return data as KgEdge;
    }, 'createEdge');

    return result;
  }

  /**
   * Récupérer une edge par ID
   */
  async getEdge(edgeId: string): Promise<KgEdge | null> {
    const result = await this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('kg_edges')
        .select('*')
        .eq('edge_id', edgeId)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as KgEdge;
    }, 'getEdge');

    return result;
  }

  /**
   * Récupérer les edges sortantes d'un node
   */
  async getOutgoingEdges(
    nodeId: string,
    edgeType?: KgEdgeType,
  ): Promise<KgEdge[]> {
    const result = await this.executeWithRetry(async () => {
      let queryBuilder = this.supabase
        .from('kg_edges')
        .select('*')
        .eq('source_node_id', nodeId)
        .eq('is_active', true);

      if (edgeType) {
        queryBuilder = queryBuilder.eq('edge_type', edgeType);
      }

      const { data, error } = await queryBuilder.order('confidence', {
        ascending: false,
      });
      if (error) throw error;
      return data as KgEdge[];
    }, 'getOutgoingEdges');

    return result || [];
  }

  /**
   * Récupérer les edges entrantes d'un node
   */
  async getIncomingEdges(
    nodeId: string,
    edgeType?: KgEdgeType,
  ): Promise<KgEdge[]> {
    const result = await this.executeWithRetry(async () => {
      let queryBuilder = this.supabase
        .from('kg_edges')
        .select('*')
        .eq('target_node_id', nodeId)
        .eq('is_active', true);

      if (edgeType) {
        queryBuilder = queryBuilder.eq('edge_type', edgeType);
      }

      const { data, error } = await queryBuilder.order('confidence', {
        ascending: false,
      });
      if (error) throw error;
      return data as KgEdge[];
    }, 'getIncomingEdges');

    return result || [];
  }

  /**
   * Mettre à jour une edge
   */
  async updateEdge(
    edgeId: string,
    dto: UpdateKgEdgeDto,
  ): Promise<KgEdge | null> {
    const result = await this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('kg_edges')
        .update(dto)
        .eq('edge_id', edgeId)
        .select()
        .single();

      if (error) throw error;
      return data as KgEdge;
    }, 'updateEdge');

    return result;
  }

  /**
   * Soft delete d'une edge
   */
  async deleteEdge(edgeId: string): Promise<boolean> {
    const result = await this.executeWithRetry(async () => {
      const { error } = await this.supabase
        .from('kg_edges')
        .update({ is_active: false })
        .eq('edge_id', edgeId);

      if (error) throw error;
      return true;
    }, 'deleteEdge');

    return result || false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Créer plusieurs nodes en une fois
   */
  async createNodes(nodes: CreateKgNodeDto[]): Promise<KgNode[]> {
    const result = await this.executeWithRetry(async () => {
      const insertData = nodes.map((dto) => ({
        node_type: dto.node_type,
        node_label: dto.node_label,
        node_alias: dto.node_alias,
        node_category: dto.node_category,
        node_data: dto.node_data || {},
        confidence: dto.confidence ?? 1.0,
        sources: dto.sources || [],
        validation_status: dto.validation_status || 'pending',
        created_by: dto.created_by || 'system',
      }));

      const { data, error } = await this.supabase
        .from('kg_nodes')
        .insert(insertData)
        .select();

      if (error) throw error;
      return data as KgNode[];
    }, 'createNodes');

    return result || [];
  }

  /**
   * Créer plusieurs edges en une fois
   */
  async createEdges(edges: CreateKgEdgeDto[]): Promise<KgEdge[]> {
    const result = await this.executeWithRetry(async () => {
      const insertData = edges.map((dto) => ({
        source_node_id: dto.source_node_id,
        target_node_id: dto.target_node_id,
        edge_type: dto.edge_type,
        weight: dto.weight ?? 1.0,
        is_bidirectional: dto.is_bidirectional ?? false,
        confidence: dto.confidence ?? 1.0,
        evidence: dto.evidence || {},
        sources: dto.sources || [],
        created_by: dto.created_by || 'system',
      }));

      const { data, error } = await this.supabase
        .from('kg_edges')
        .insert(insertData)
        .select();

      if (error) throw error;
      return data as KgEdge[];
    }, 'createEdges');

    return result || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtenir les statistiques du graphe
   */
  async getStats(): Promise<KgStats> {
    const result = await this.executeWithRetry(async () => {
      // Count nodes by type
      const { data: nodesData, error: nodesError } = await this.supabase
        .from('kg_nodes')
        .select('node_type')
        .eq('is_active', true);

      if (nodesError) throw nodesError;

      // Count edges by type
      const { data: edgesData, error: edgesError } = await this.supabase
        .from('kg_edges')
        .select('edge_type, confidence')
        .eq('is_active', true);

      if (edgesError) throw edgesError;

      // Count cache hits
      const { data: cacheData, error: cacheError } = await this.supabase
        .from('kg_reasoning_cache')
        .select('hit_count');

      if (cacheError) throw cacheError;

      const nodesByType: Record<string, number> = {};
      nodesData?.forEach((n) => {
        nodesByType[n.node_type] = (nodesByType[n.node_type] || 0) + 1;
      });

      const edgesByType: Record<string, number> = {};
      let totalConfidence = 0;
      edgesData?.forEach((e) => {
        edgesByType[e.edge_type] = (edgesByType[e.edge_type] || 0) + 1;
        totalConfidence += e.confidence || 0;
      });

      const totalHits =
        cacheData?.reduce((sum, c) => sum + (c.hit_count || 0), 0) || 0;
      const cacheCount = cacheData?.length || 0;

      return {
        totalNodes: nodesData?.length || 0,
        totalEdges: edgesData?.length || 0,
        nodesByType: nodesByType as Record<KgNodeType, number>,
        edgesByType: edgesByType as Record<KgEdgeType, number>,
        avgConfidence:
          edgesData?.length > 0 ? totalConfidence / edgesData.length : 0,
        cacheHitRate: cacheCount > 0 ? totalHits / cacheCount : 0,
        lastUpdated: new Date().toISOString(),
      };
    }, 'getStats');

    return (
      result || {
        totalNodes: 0,
        totalEdges: 0,
        nodesByType: {} as Record<KgNodeType, number>,
        edgesByType: {} as Record<KgEdgeType, number>,
        avgConfidence: 0,
        cacheHitRate: 0,
        lastUpdated: new Date().toISOString(),
      }
    );
  }
}
