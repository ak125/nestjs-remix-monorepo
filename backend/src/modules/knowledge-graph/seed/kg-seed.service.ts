/**
 * 🧠 Knowledge Graph Seed Service - AI-COS v2.8.0
 *
 * Service pour peupler le Knowledge Graph avec les données initiales
 */

import { Injectable, Logger } from '@nestjs/common';
import { KgDataService } from '../kg-data.service';
import { CreateKgEdgeDto } from '../kg.types';
import {
  ALL_NODES,
  SYMPTOM_FAULT_MAPPING,
  FAULT_ACTION_MAPPING,
  FAULT_PART_MAPPING,
} from './kg-seed-data';

interface SeedResult {
  nodesCreated: number;
  edgesCreated: number;
  errors: string[];
  duration: number;
}

@Injectable()
export class KgSeedService {
  private readonly logger = new Logger(KgSeedService.name);

  constructor(private readonly kgDataService: KgDataService) {}

  /**
   * Exécute le seeding complet du Knowledge Graph
   */
  async seedAll(): Promise<SeedResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let nodesCreated = 0;
    let edgesCreated = 0;

    this.logger.log('🌱 Starting Knowledge Graph seed...');

    try {
      // 1. Créer tous les nodes
      this.logger.log(`📦 Creating ${ALL_NODES.length} nodes...`);
      const createdNodes = await this.kgDataService.createNodes(ALL_NODES);
      nodesCreated = createdNodes.length;
      this.logger.log(`✅ Created ${nodesCreated} nodes`);

      // 2. Créer un map alias → node_id pour les edges
      const nodeMap = new Map<string, string>();
      for (const node of createdNodes) {
        if (node.node_alias) {
          nodeMap.set(node.node_alias, node.node_id);
        }
      }

      // 3. Créer les edges Symptom → Fault (CAUSES)
      const symptomFaultEdges = await this.createEdgesFromMapping(
        SYMPTOM_FAULT_MAPPING,
        nodeMap,
        'CAUSES',
      );
      edgesCreated += symptomFaultEdges.created;
      if (symptomFaultEdges.errors.length > 0) {
        errors.push(...symptomFaultEdges.errors);
      }

      // 4. Créer les edges Fault → Action (DIAGNOSED_BY)
      const faultActionEdges = await this.createEdgesFromMapping(
        FAULT_ACTION_MAPPING,
        nodeMap,
        'DIAGNOSED_BY',
      );
      edgesCreated += faultActionEdges.created;
      if (faultActionEdges.errors.length > 0) {
        errors.push(...faultActionEdges.errors);
      }

      // 5. Créer les edges Fault → Part (FIXED_BY)
      const faultPartEdges = await this.createEdgesFromMapping(
        FAULT_PART_MAPPING,
        nodeMap,
        'FIXED_BY',
      );
      edgesCreated += faultPartEdges.created;
      if (faultPartEdges.errors.length > 0) {
        errors.push(...faultPartEdges.errors);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `🎉 Seed completed in ${duration}ms: ${nodesCreated} nodes, ${edgesCreated} edges`,
      );

      return {
        nodesCreated,
        edgesCreated,
        errors,
        duration,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Seed failed: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        nodesCreated,
        edgesCreated,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Crée les edges à partir d'un mapping [source_alias, target_alias, weight, confidence]
   */
  private async createEdgesFromMapping(
    mapping: Array<[string, string, number, number]>,
    nodeMap: Map<string, string>,
    edgeType: 'CAUSES' | 'DIAGNOSED_BY' | 'FIXED_BY',
  ): Promise<{ created: number; errors: string[] }> {
    const edges: CreateKgEdgeDto[] = [];
    const errors: string[] = [];

    for (const [sourceAlias, targetAlias, weight, confidence] of mapping) {
      const sourceId = nodeMap.get(sourceAlias);
      const targetId = nodeMap.get(targetAlias);

      if (!sourceId) {
        errors.push(`Source node not found: ${sourceAlias}`);
        continue;
      }
      if (!targetId) {
        errors.push(`Target node not found: ${targetAlias}`);
        continue;
      }

      edges.push({
        source_node_id: sourceId,
        target_node_id: targetId,
        edge_type: edgeType,
        weight,
        confidence,
        sources: ['seed-data'],
        created_by: 'seed',
      });
    }

    if (edges.length === 0) {
      return { created: 0, errors };
    }

    try {
      const createdEdges = await this.kgDataService.createEdges(edges);
      this.logger.log(`✅ Created ${createdEdges.length} ${edgeType} edges`);
      return { created: createdEdges.length, errors };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to create ${edgeType} edges: ${errorMsg}`);
      return { created: 0, errors };
    }
  }

  /**
   * Vérifie si le graphe est déjà peuplé
   */
  async isSeeded(): Promise<boolean> {
    const stats = await this.kgDataService.getStats();
    return stats.totalNodes > 0;
  }

  /**
   * Supprime toutes les données (pour reset)
   * ATTENTION: Opération destructive !
   */
  async reset(): Promise<void> {
    this.logger.warn('⚠️ Resetting Knowledge Graph...');
    // Note: Les tables utilisent soft delete, donc on devrait
    // implémenter une vraie suppression si nécessaire
    this.logger.log('Reset not implemented - use SQL directly');
  }
}
