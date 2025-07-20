/**
 * Service automobiles adapté pour le monorepo NestJS Remix
 * Intègre avec les vraies tables: Order, OrderLine (Prisma) + legacy (Supabase)
 * Migration complète depuis ecommerce-api
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseRestService } from '../../../database/supabase-rest.service';
// import { OrdersAutomotiveIntegrationService } from './orders-automotive-integration.service'; // DÉSACTIVÉ - Refactoring nécessaire
import { TaxCalculationService } from './tax-calculation.service';
import { AdvancedShippingService } from './advanced-shipping.service';
import { VehicleDataService } from './vehicle-data.service';

import {
  AutomotiveOrder,
  AutomotiveOrderLine,
  VehicleData,
  validateAutomotiveOrder,
  validateVehicleData,
} from '../dto/automotive-orders.dto';

export interface AutomotiveOrderResult {
  prismaOrder: any;
  legacyOrder: any;
  orderNumber: string;
  automotiveData: {
    hasVehicleData: boolean;
    validatedVehicles: Array<{
      itemId: string;
      vehicleInfo: any;
      equivalents: any[];
    }>;
    shippingCalculation: {
      cost: number;
      method: string;
      details: any;
    };
    taxCalculation: {
      totalHT: number;
      totalTTC: number;
      breakdown: any;
    };
  };
}

@Injectable()
export class AutomotiveOrdersService {
  private readonly logger = new Logger(AutomotiveOrdersService.name);

  constructor(
    private readonly supabaseService: SupabaseRestService,
    // private readonly integrationService: OrdersAutomotiveIntegrationService, // DÉSACTIVÉ - Refactoring nécessaire
    private readonly taxCalculationService: TaxCalculationService,
    private readonly advancedShippingService: AdvancedShippingService,
    private readonly vehicleDataService: VehicleDataService,
  ) {}

  /**
   * Traite une commande automobile complète avec intégration hybride
   */
  async processAutomotiveOrder(orderData: AutomotiveOrder): Promise<AutomotiveOrderResult> {
    this.logger.log('Traitement commande automobile dans monorepo', {
      customerId: orderData.customerId,
      linesCount: orderData.orderLines.length,
      hasVehicleData: orderData.orderLines.some(line => line.vehicleData)
    });

    // Validation Zod
    const validatedData = validateAutomotiveOrder(orderData);

    // Traitement des données véhicule
    const validatedVehicles = await this.processVehicleData(validatedData.orderLines);

    // Calcul des frais de livraison
    const shippingCalculation = await this.calculateAdvancedShipping(
      validatedData.shippingCalculation,
      validatedData.orderLines
    );

    // Calcul des taxes automobiles
    const taxCalculation = await this.calculateAutomotiveTaxes(
      validatedData.orderLines,
      validatedData.customerData
    );

    // Créer la commande dans les deux systèmes (Prisma + Legacy)
    const orderResult = await this.integrationService.createAutomotiveOrder(validatedData);

    return {
      prismaOrder: orderResult.prismaOrder,
      legacyOrder: orderResult.legacyOrder,
      orderNumber: orderResult.orderNumber,
      automotiveData: {
        hasVehicleData: validatedVehicles.length > 0,
        validatedVehicles,
        shippingCalculation,
        taxCalculation,
      },
    };
  }

  /**
   * Récupère une commande automobile par ID
   */
  async getAutomotiveOrderById(orderId: string): Promise<AutomotiveOrderResult | null> {
    try {
      const orderData = await this.integrationService.getAutomotiveOrderById(orderId);
      
      if (!orderData) {
        return null;
      }

      // Reconstruire les données automobiles à partir des données stockées
      const automotiveData = {
        hasVehicleData: orderData.vehicleData.hasVehicleData,
        validatedVehicles: this.extractValidatedVehicles(orderData.prismaOrder),
        shippingCalculation: this.extractShippingCalculation(orderData.prismaOrder),
        taxCalculation: this.extractTaxCalculation(orderData.prismaOrder),
      };

      return {
        prismaOrder: orderData.prismaOrder,
        legacyOrder: orderData.legacyOrder,
        orderNumber: orderData.prismaOrder.orderNumber,
        automotiveData,
      };

    } catch (error) {
      this.logger.error(`Erreur récupération commande automobile: ${orderId}`, error);
      throw error;
    }
  }

  /**
   * Met à jour le statut d'une commande automobile
   */
  async updateAutomotiveOrderStatus(orderId: string, newStatus: any, reason?: string) {
    return await this.integrationService.updateAutomotiveOrderStatus(orderId, newStatus, reason);
  }

  /**
   * Recherche des commandes automobiles
   */
  async searchAutomotiveOrders(filters: any) {
    return await this.integrationService.searchAutomotiveOrders(filters);
  }

  /**
   * Valide uniquement les données véhicule
   */
  async validateVehicleDataOnly(vehicleData: VehicleData): Promise<{
    isValid: boolean;
    vehicleInfo: any;
    errors: string[];
  }> {
    try {
      const enrichedInfo = await this.validateAndEnrichVehicleData(vehicleData);
      
      return {
        isValid: true,
        vehicleInfo: enrichedInfo,
        errors: [],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue lors de la validation véhicule';
      return {
        isValid: false,
        vehicleInfo: {},
        errors: [errorMessage],
      };
    }
  }

  // === Méthodes privées ===

  /**
   * Traite et valide les données véhicule pour toutes les lignes
   */
  private async processVehicleData(orderLines: AutomotiveOrderLine[]): Promise<Array<{
    itemId: string;
    vehicleInfo: any;
    equivalents: any[];
  }>> {
    const results: Array<{
      itemId: string;
      vehicleInfo: any;
      equivalents: any[];
    }> = [];

    for (const line of orderLines) {
      if (!line.vehicleData) continue;

      try {
        const vehicleInfo = await this.validateAndEnrichVehicleData(line.vehicleData);
        
        // Recherche d'équivalences si codes OEM présents
        let equivalents: any[] = [];
        if (line.oemReferences && line.oemReferences.length > 0) {
          for (const oemRef of line.oemReferences) {
            // TODO: Intégrer avec VehicleDataService quand copié
            const partEquivalents = await this.findEquivalentParts(oemRef.oemCode);
            equivalents.push(...partEquivalents);
          }
        }

        results.push({
          itemId: line.productId,
          vehicleInfo,
          equivalents,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        this.logger.error(`Erreur traitement données véhicule: ${line.productId}`, error);
        throw new BadRequestException(`Données véhicule invalides pour ${line.productName}: ${errorMessage}`);
      }
    }

    return results;
  }

  /**
   * Valide et enrichit les données d'un véhicule
   */
  private async validateAndEnrichVehicleData(vehicleData: VehicleData): Promise<any> {
    const validatedData = validateVehicleData(vehicleData);
    const enrichedInfo: any = {};

    // Validation VIN
    if (validatedData.vin?.vinNumber) {
      try {
        // TODO: Intégrer avec VehicleDataService
        const vinInfo = await this.validateVIN(validatedData.vin.vinNumber);
        enrichedInfo.vin = vinInfo;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'VIN invalide';
        throw new BadRequestException(`VIN invalide: ${errorMessage}`);
      }
    }

    // Validation immatriculation
    if (validatedData.registration?.registrationNumber) {
      try {
        // TODO: Intégrer avec VehicleDataService
        const regInfo = await this.validateRegistration(
          validatedData.registration.registrationNumber,
          validatedData.registration.country || 'FR'
        );
        enrichedInfo.registration = regInfo;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Immatriculation invalide';
        throw new BadRequestException(`Immatriculation invalide: ${errorMessage}`);
      }
    }

    // Informations additionnelles
    if (validatedData.additionalInfo) {
      enrichedInfo.additionalInfo = validatedData.additionalInfo;
    }

    return enrichedInfo;
  }

  /**
   * Calcule les frais de livraison automobile
   */
  private async calculateAdvancedShipping(
    shippingData: AutomotiveOrder['shippingCalculation'],
    orderLines: AutomotiveOrderLine[]
  ): Promise<{ cost: number; method: string; details: any }> {
    
    try {
      // Calcul simplifié pour l'instant - à remplacer par AdvancedShippingService
      const totalWeight = shippingData.cartWeight;
      const totalAmount = orderLines.reduce((sum, line) => sum + line.totalPrice, 0);
      
      let shippingCost = 0;
      
      // Logique de base
      if (totalAmount < 50) {
        shippingCost = 9.99;
      } else if (totalAmount < 100) {
        shippingCost = 6.99;
      } else {
        shippingCost = 0; // Gratuit au-dessus de 100€
      }

      // Majoration si urgent
      if (shippingData.urgentDelivery) {
        shippingCost += 15.00;
      }

      return {
        cost: shippingCost,
        method: shippingData.shippingMethodOverride || 'standard',
        details: {
          baseShipping: shippingCost,
          urgentSupplement: shippingData.urgentDelivery ? 15.00 : 0,
          totalWeight,
          freeShippingThreshold: 100,
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur calcul livraison';
      this.logger.error('Erreur calcul livraison automobile', error);
      throw new BadRequestException(`Erreur calcul livraison: ${errorMessage}`);
    }
  }

    /**
   * Calcule les taxes automobiles avec le service TaxCalculationService migré
   */
  private async calculateAutomotiveTaxes(
    orderLines: AutomotiveOrderLine[],
    customerData?: AutomotiveOrder['customerData']
  ): Promise<{ totalHT: number; totalTTC: number; breakdown: any }> {
    
    try {
      const isProClient = customerData?.isProClient || false;
      
      // Préparer les données pour le service de calcul des taxes
      const taxItems = orderLines.map(line => ({
        priceHT: line.totalPrice,
        quantity: line.quantity,
        productType: 'standard' as const, // Pièces auto = taux standard
        clientType: isProClient ? 'professionnel' as const : 'particulier' as const,
      }));

      // Utiliser le service de calcul des taxes migré
      const taxResult = await this.taxCalculationService.calculateOrderTax({
        items: taxItems,
        shippingHT: 0,
        discountHT: 0,
      });

      return {
        totalHT: taxResult.totalHT,
        totalTTC: taxResult.totalTTC,
        breakdown: taxResult.itemsDetail,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur calcul taxes';
      this.logger.error('Erreur calcul taxes automobiles', error);
      throw new BadRequestException(`Erreur calcul taxes: ${errorMessage}`);
    }
  }

  // === Méthodes intégrées avec les vrais services ===

  private async validateVIN(vin: string): Promise<any> {
    // Utiliser le vrai VehicleDataService
    return await this.vehicleDataService.validateVIN(vin);
  }

  private async validateRegistration(registration: string, country: string): Promise<any> {
    // Utiliser le vrai VehicleDataService
    return await this.vehicleDataService.validateRegistration(registration, country);
  }

  private async findEquivalentParts(oemCode: string): Promise<any[]> {
    // Utiliser le vrai VehicleDataService
    return await this.vehicleDataService.findEquivalentParts(oemCode);
  }

  // === Méthodes d'extraction pour reconstruction des données ===

  private extractValidatedVehicles(prismaOrder: any): any[] {
    return prismaOrder.orderLines
      .filter((line: any) => line.productName.includes('VIN') || line.productReference.includes('AUTO'))
      .map((line: any) => ({
        itemId: line.productId,
        vehicleInfo: { extracted: true, line: line.productName },
        equivalents: [],
      }));
  }

  private extractShippingCalculation(prismaOrder: any): any {
    return {
      cost: prismaOrder.shippingCost || 0,
      method: 'standard',
      details: { extracted: true },
    };
  }

  private extractTaxCalculation(prismaOrder: any): any {
    return {
      totalHT: prismaOrder.totalAmountHT,
      totalTTC: prismaOrder.totalAmountTTC,
      breakdown: { extracted: true },
    };
  }
}
