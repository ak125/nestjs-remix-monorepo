/**
 * Contrôleur pour les commandes automobiles - Adapté pour le monorepo
 * Gère les fonctionnalités spécifiques au secteur automobile
 * Utilise les services migrés avec SupabaseRestService
 */

import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { AutomotiveOrdersService } from '../services/automotive-orders.service';
import { TaxCalculationService } from '../services/tax-calculation.service';
import { AdvancedShippingService } from '../services/advanced-shipping.service';
import { VehicleDataService } from '../services/vehicle-data.service';

@ApiTags('automotive-orders')
@Controller('api/automotive-orders')
export class AutomotiveOrdersController {
  private readonly logger = new Logger(AutomotiveOrdersController.name);

  constructor(
    private readonly automotiveOrdersService: AutomotiveOrdersService,
    private readonly taxCalculationService: TaxCalculationService,
    private readonly advancedShippingService: AdvancedShippingService,
    private readonly vehicleDataService: VehicleDataService,
  ) {}

  @Get()
  @ApiOperation({ 
    summary: 'Obtenir les commandes automobiles',
    description: 'Récupère la liste des commandes automobiles' 
  })
  async getAutomotiveOrders() {
    return {
      success: true,
      message: 'Service automobile opérationnel',
      data: {
        version: '1.0.0',
        endpoints: ['GET /', 'POST /', 'GET /:id', 'PUT /:id/status']
      }
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Créer une commande automobile',
    description: 'Crée une nouvelle commande avec validation automobile spécifique' 
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Commande automobile créée avec succès' 
  })
  async createAutomotiveOrder(@Body() orderData: any) {
    try {
      this.logger.log('Création commande automobile', { orderData });
      
      const result = await this.automotiveOrdersService.processAutomotiveOrder(orderData);
      
      return {
        success: true,
        data: result,
        message: 'Commande automobile créée avec succès',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur création commande';
      this.logger.error('Erreur création commande automobile', error);
      throw new BadRequestException(`Erreur création commande: ${errorMessage}`);
    }
  }

  @Post(':orderId/validate-vehicle')
  @ApiOperation({ 
    summary: 'Valider les données véhicule',
    description: 'Valide VIN et/ou immatriculation d\'un véhicule' 
  })
  @ApiParam({ name: 'orderId', description: 'ID de la commande' })
  async validateVehicleData(
    @Param('orderId') orderId: string,
    @Body() vehicleData: any
  ) {
    try {
      const validation = await this.automotiveOrdersService.validateVehicleDataOnly(vehicleData);
      
      return {
        success: true,
        data: validation,
        message: 'Validation véhicule effectuée',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur validation véhicule';
      this.logger.error('Erreur validation véhicule', error);
      throw new BadRequestException(`Erreur validation: ${errorMessage}`);
    }
  }

  @Get(':orderId')
  @ApiOperation({ 
    summary: 'Récupérer une commande automobile',
    description: 'Récupère les détails d\'une commande automobile' 
  })
  @ApiParam({ name: 'orderId', description: 'ID de la commande' })
  async getAutomotiveOrder(@Param('orderId') orderId: string) {
    try {
      const order = await this.automotiveOrdersService.getAutomotiveOrderById(orderId);
      
      if (!order) {
        throw new BadRequestException('Commande introuvable');
      }
      
      return {
        success: true,
        data: order,
        message: 'Commande récupérée avec succès',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur récupération commande';
      this.logger.error('Erreur récupération commande automobile', error);
      throw new BadRequestException(`Erreur récupération: ${errorMessage}`);
    }
  }

  @Put(':orderId/status')
  @ApiOperation({ 
    summary: 'Mettre à jour le statut d\'une commande',
    description: 'Met à jour le statut d\'une commande automobile' 
  })
  @ApiParam({ name: 'orderId', description: 'ID de la commande' })
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() statusData: { status: string; reason?: string }
  ) {
    try {
      const result = await this.automotiveOrdersService.updateAutomotiveOrderStatus(
        orderId,
        statusData.status,
        statusData.reason
      );
      
      return {
        success: true,
        data: result,
        message: 'Statut mis à jour avec succès',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur mise à jour statut';
      this.logger.error('Erreur mise à jour statut', error);
      throw new BadRequestException(`Erreur mise à jour: ${errorMessage}`);
    }
  }

  @Get('vehicle/validate-vin/:vin')
  @ApiOperation({ 
    summary: 'Valider un VIN',
    description: 'Valide et décode un numéro VIN' 
  })
  @ApiParam({ name: 'vin', description: 'Numéro VIN à valider' })
  async validateVIN(@Param('vin') vin: string) {
    try {
      const result = await this.vehicleDataService.validateVIN(vin);
      
      return {
        success: true,
        data: result,
        message: 'VIN validé avec succès',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur validation VIN';
      this.logger.error('Erreur validation VIN', error);
      throw new BadRequestException(`Erreur validation VIN: ${errorMessage}`);
    }
  }

  @Get('vehicle/validate-registration')
  @ApiOperation({ 
    summary: 'Valider une immatriculation',
    description: 'Valide un numéro d\'immatriculation' 
  })
  @ApiQuery({ name: 'registration', description: 'Numéro d\'immatriculation' })
  @ApiQuery({ name: 'country', description: 'Code pays (défaut: FR)', required: false })
  async validateRegistration(
    @Query('registration') registration: string,
    @Query('country') country: string = 'FR'
  ) {
    try {
      const result = await this.vehicleDataService.validateRegistration(registration, country);
      
      return {
        success: true,
        data: { valid: result, registration, country },
        message: 'Immatriculation validée',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur validation immatriculation';
      this.logger.error('Erreur validation immatriculation', error);
      throw new BadRequestException(`Erreur validation: ${errorMessage}`);
    }
  }

  @Get('parts/equivalents/:oemCode')
  @ApiOperation({ 
    summary: 'Rechercher des pièces équivalentes',
    description: 'Trouve les pièces équivalentes pour un code OEM' 
  })
  @ApiParam({ name: 'oemCode', description: 'Code OEM de la pièce' })
  async findEquivalentParts(@Param('oemCode') oemCode: string) {
    try {
      const equivalents = await this.vehicleDataService.findEquivalentParts(oemCode);
      
      return {
        success: true,
        data: equivalents,
        message: 'Pièces équivalentes trouvées',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur recherche équivalents';
      this.logger.error('Erreur recherche pièces équivalentes', error);
      throw new BadRequestException(`Erreur recherche: ${errorMessage}`);
    }
  }

  @Post('tax/calculate')
  @ApiOperation({ 
    summary: 'Calculer les taxes d\'une commande',
    description: 'Calcule les taxes avec la logique française spécifique' 
  })
  async calculateOrderTax(@Body() taxData: any) {
    try {
      const result = await this.taxCalculationService.calculateOrderTax(taxData);
      
      return {
        success: true,
        data: result,
        message: 'Calcul taxes effectué',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur calcul taxes';
      this.logger.error('Erreur calcul taxes', error);
      throw new BadRequestException(`Erreur calcul: ${errorMessage}`);
    }
  }

  @Post('shipping/calculate')
  @ApiOperation({ 
    summary: 'Calculer les frais de livraison',
    description: 'Calcule les frais de livraison selon la zone et le poids' 
  })
  async calculateShippingFee(@Body() shippingData: any) {
    try {
      const result = await this.advancedShippingService.calculateShippingFee(shippingData);
      
      return {
        success: true,
        data: result,
        message: 'Calcul frais livraison effectué',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur calcul livraison';
      this.logger.error('Erreur calcul frais livraison', error);
      throw new BadRequestException(`Erreur calcul: ${errorMessage}`);
    }
  }
}
