import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { SuppliersModernService } from './suppliers-modern.service';
import { SuppliersService } from './suppliers.service';
import {
  CreateSupplierDto,
  SupplierFilters,
  validateSupplierFilters,
} from './dto';

/**
 * SuppliersModernController - Controller moderne avec validation Zod
 * ✅ Aligné sur l'architecture des autres modules
 * ✅ Utilise la validation Zod
 * ✅ Suit les standards du projet (orders, messages, users)
 * ✅ Utilise seulement les méthodes disponibles dans le service
 */
@Controller('api/suppliers/modern')
export class SuppliersModernController {
  private readonly logger = new Logger(SuppliersModernController.name);

  constructor(
    private readonly suppliersModernService: SuppliersModernService,
    private readonly suppliersService: SuppliersService,
  ) {}

  /**
   * Obtenir tous les fournisseurs avec filtres et validation
   */
  @Get()
  async findAll(@Query() query: any) {
    try {
      // Construire les filtres avec valeurs par défaut
      const filters: SupplierFilters = {
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 10,
        search: query.search,
        isActive: query.isActive ? query.isActive === 'true' : undefined,
        country: query.country,
        hasEmail: query.hasEmail ? query.hasEmail === 'true' : undefined,
        hasWebsite: query.hasWebsite ? query.hasWebsite === 'true' : undefined,
      };

      // Validation des filtres
      const validatedFilters = validateSupplierFilters(filters);

      const result = await this.suppliersModernService.getSuppliers(
        validatedFilters,
      );

      return {
        success: true,
        data: result,
        message: 'Fournisseurs récupérés avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des fournisseurs:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Obtenir un fournisseur par ID
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    try {
      const supplier = await this.suppliersModernService.getSupplierById(id);

      if (!supplier) {
        throw new NotFoundException('Fournisseur non trouvé');
      }

      return {
        success: true,
        data: supplier,
        message: 'Fournisseur récupéré avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du fournisseur ${id}:`,
        error,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Créer un nouveau fournisseur avec validation Zod
   */
  @Post()
  async create(@Body() createSupplierDto: CreateSupplierDto) {
    try {
      // La validation est faite dans le service moderne
      const supplier = await this.suppliersModernService.createSupplier(
        createSupplierDto,
      );

      return {
        success: true,
        data: supplier,
        message: 'Fournisseur créé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur lors de la création du fournisseur:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test du service fournisseurs
   */
  @Get('test/service')
  async testService() {
    try {
      const testResult = await this.suppliersModernService.testSuppliersService();

      return {
        success: true,
        data: testResult,
        message: 'Test du service moderne terminé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur lors du test du service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
