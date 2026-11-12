/**
 * 🧠 Knowledge Graph Controller - AI-COS v2.8.0
 *
 * API REST pour le Knowledge Graph et le Reasoning Engine
 *
 * Admin only (`AuthenticatedGuard` + `IsAdminGuard`). The module is not
 * registered in `AppModule` (disabled 2026-02-02, experimental); the boundary
 * is declared here so that registering it again cannot open these routes.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { KgService } from './kg.service';
import { KgDataService } from './kg-data.service';
import {
  CreateKgNodeDto,
  UpdateKgNodeDto,
  CreateKgEdgeDto,
  UpdateKgEdgeDto,
  DiagnoseInput,
  KgNodeType,
  KgEdgeType,
} from './kg.types';

@Controller('api/knowledge-graph')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class KgController {
  private readonly logger = new Logger(KgController.name);

  constructor(
    private readonly kgService: KgService,
    private readonly kgDataService: KgDataService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // DIAGNOSTIC ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Diagnostic multi-symptômes
   *
   * POST /api/knowledge-graph/diagnose
   * Body: { observables: ["fumée noire", "perte puissance"], vehicleId?: "xxx" }
   */
  @Post('diagnose')
  @HttpCode(HttpStatus.OK)
  async diagnose(@Body() input: DiagnoseInput) {
    this.logger.log(
      `🔍 Diagnose request with ${input.observables?.length || 0} observables`,
    );
    return this.kgService.diagnose(input);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATS ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Statistiques du graphe
   *
   * GET /api/knowledge-graph/stats
   */
  @Get('stats')
  async getStats() {
    return this.kgDataService.getStats();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NODE ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Créer un node
   *
   * POST /api/knowledge-graph/nodes
   */
  @Post('nodes')
  @HttpCode(HttpStatus.CREATED)
  async createNode(@Body() dto: CreateKgNodeDto) {
    return this.kgDataService.createNode(dto);
  }

  /**
   * Créer plusieurs nodes
   *
   * POST /api/knowledge-graph/nodes/batch
   */
  @Post('nodes/batch')
  @HttpCode(HttpStatus.CREATED)
  async createNodes(@Body() nodes: CreateKgNodeDto[]) {
    return this.kgDataService.createNodes(nodes);
  }

  /**
   * Récupérer un node par ID
   *
   * GET /api/knowledge-graph/nodes/:id
   */
  @Get('nodes/:id')
  async getNode(@Param('id') id: string) {
    return this.kgDataService.getNode(id);
  }

  /**
   * Lister les nodes par type
   *
   * GET /api/knowledge-graph/nodes?type=Observable&limit=50&offset=0
   */
  @Get('nodes')
  async getNodes(
    @Query('type') type?: KgNodeType,
    @Query('limit') limit = '100',
    @Query('offset') offset = '0',
  ) {
    if (type) {
      return this.kgDataService.getNodesByType(
        type,
        parseInt(limit, 10),
        parseInt(offset, 10),
      );
    }
    // Default: return stats if no type specified
    return this.kgDataService.getStats();
  }

  /**
   * Rechercher des nodes
   *
   * GET /api/knowledge-graph/nodes/search?q=fumée&type=Observable
   */
  @Get('nodes/search')
  async searchNodes(
    @Query('q') query: string,
    @Query('type') type?: KgNodeType,
    @Query('limit') limit = '50',
  ) {
    return this.kgDataService.searchNodes(query, type, parseInt(limit, 10));
  }

  /**
   * Mettre à jour un node
   *
   * PUT /api/knowledge-graph/nodes/:id
   */
  @Put('nodes/:id')
  async updateNode(@Param('id') id: string, @Body() dto: UpdateKgNodeDto) {
    return this.kgDataService.updateNode(id, dto);
  }

  /**
   * Supprimer un node (soft delete)
   *
   * DELETE /api/knowledge-graph/nodes/:id
   */
  @Delete('nodes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNode(@Param('id') id: string) {
    await this.kgDataService.deleteNode(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Créer une edge
   *
   * POST /api/knowledge-graph/edges
   */
  @Post('edges')
  @HttpCode(HttpStatus.CREATED)
  async createEdge(@Body() dto: CreateKgEdgeDto) {
    return this.kgDataService.createEdge(dto);
  }

  /**
   * Créer plusieurs edges
   *
   * POST /api/knowledge-graph/edges/batch
   */
  @Post('edges/batch')
  @HttpCode(HttpStatus.CREATED)
  async createEdges(@Body() edges: CreateKgEdgeDto[]) {
    return this.kgDataService.createEdges(edges);
  }

  /**
   * Récupérer une edge par ID
   *
   * GET /api/knowledge-graph/edges/:id
   */
  @Get('edges/:id')
  async getEdge(@Param('id') id: string) {
    return this.kgDataService.getEdge(id);
  }

  /**
   * Récupérer les edges sortantes d'un node
   *
   * GET /api/knowledge-graph/edges/outgoing/:nodeId?type=CAUSES
   */
  @Get('edges/outgoing/:nodeId')
  async getOutgoingEdges(
    @Param('nodeId') nodeId: string,
    @Query('type') type?: KgEdgeType,
  ) {
    return this.kgDataService.getOutgoingEdges(nodeId, type);
  }

  /**
   * Récupérer les edges entrantes d'un node
   *
   * GET /api/knowledge-graph/edges/incoming/:nodeId?type=CAUSES
   */
  @Get('edges/incoming/:nodeId')
  async getIncomingEdges(
    @Param('nodeId') nodeId: string,
    @Query('type') type?: KgEdgeType,
  ) {
    return this.kgDataService.getIncomingEdges(nodeId, type);
  }

  /**
   * Mettre à jour une edge
   *
   * PUT /api/knowledge-graph/edges/:id
   */
  @Put('edges/:id')
  async updateEdge(@Param('id') id: string, @Body() dto: UpdateKgEdgeDto) {
    return this.kgDataService.updateEdge(id, dto);
  }

  /**
   * Supprimer une edge (soft delete)
   *
   * DELETE /api/knowledge-graph/edges/:id
   */
  @Delete('edges/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEdge(@Param('id') id: string) {
    await this.kgDataService.deleteEdge(id);
  }
}
