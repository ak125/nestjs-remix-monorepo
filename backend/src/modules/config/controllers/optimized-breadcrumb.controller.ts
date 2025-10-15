import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  OptimizedBreadcrumbService,
  BreadcrumbItem,
} from '../services/optimized-breadcrumb.service';

interface UpdateBreadcrumbDto {
  breadcrumbs: BreadcrumbItem[];
}

@Controller('api/breadcrumb')
export class OptimizedBreadcrumbController {
  private readonly logger = new Logger(OptimizedBreadcrumbController.name);

  constructor(private readonly breadcrumbService: OptimizedBreadcrumbService) {}

  /**
   * Récupérer le fil d'Ariane d'une page
   * GET /api/breadcrumb/:path
   */
  @Get(':path(*)')
  async getBreadcrumbs(
    @Param('path') path: string,
    @Query('lang') lang?: string,
  ): Promise<{ success: boolean; data: BreadcrumbItem[] }> {
    try {
      this.logger.log(`Récupération breadcrumb pour: ${path}`);

      const breadcrumbs = await this.breadcrumbService.getBreadcrumbs(
        path,
        lang,
      );

      return {
        success: true,
        data: breadcrumbs,
      };
    } catch (error) {
      this.logger.error(`Erreur récupération breadcrumb pour ${path}:`, error);
      throw new HttpException(
        "Erreur lors de la récupération du fil d'Ariane",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Générer le Schema.org pour le breadcrumb
   * GET /api/breadcrumb/:path/schema
   */
  @Get('schema/:path(*)')
  async getBreadcrumbSchema(
    @Param('path') path: string,
    @Query('lang') lang?: string,
  ): Promise<{ success: boolean; data: any }> {
    try {
      this.logger.log(`Génération schema breadcrumb pour: ${path}`);

      const breadcrumbs = await this.breadcrumbService.getBreadcrumbs(
        path,
        lang,
      );
      const schema =
        this.breadcrumbService.generateBreadcrumbSchema(breadcrumbs);

      return {
        success: true,
        data: schema,
      };
    } catch (error) {
      this.logger.error(
        `Erreur génération schema breadcrumb pour ${path}:`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la génération du schema breadcrumb',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mettre à jour le breadcrumb d'une page
   * POST /api/breadcrumb/:path
   */
  @Post(':path(*)')
  async updateBreadcrumb(
    @Param('path') path: string,
    @Body() updateData: UpdateBreadcrumbDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Mise à jour breadcrumb pour: ${path}`);

      await this.breadcrumbService.updateBreadcrumb(
        path,
        updateData.breadcrumbs,
      );

      return {
        success: true,
        message: "Fil d'Ariane mis à jour avec succès",
      };
    } catch (error) {
      this.logger.error(`Erreur mise à jour breadcrumb pour ${path}:`, error);
      throw new HttpException(
        "Erreur lors de la mise à jour du fil d'Ariane",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer la configuration du breadcrumb
   * GET /api/breadcrumb/config
   */
  @Get('config')
  async getBreadcrumbConfig(
    @Query('lang') lang?: string,
  ): Promise<{ success: boolean; data: any }> {
    try {
      this.logger.log(`Récupération configuration breadcrumb`);

      const config = await this.breadcrumbService.getBreadcrumbConfig(lang);

      return {
        success: true,
        data: config,
      };
    } catch (error) {
      this.logger.error('Erreur récupération configuration breadcrumb:', error);
      throw new HttpException(
        'Erreur lors de la récupération de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Invalider le cache du breadcrumb
   * POST /api/breadcrumb/cache/clear
   */
  @Post('cache/clear')
  async clearCache(
    @Body('path') path?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(
        `Invalidation cache breadcrumb${path ? ` pour: ${path}` : ''}`,
      );

      await this.breadcrumbService.clearCache(path);

      return {
        success: true,
        message: 'Cache invalidé avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur invalidation cache breadcrumb:', error);
      throw new HttpException(
        "Erreur lors de l'invalidation du cache",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
