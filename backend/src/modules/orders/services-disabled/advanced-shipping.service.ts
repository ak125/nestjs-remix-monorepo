/**
 * Service de calcul des frais de livraison avancés adapté pour le monorepo
 * Intègre avec SupabaseRestService pour les données legacy
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseRestService } from '../../../database/supabase-rest.service';
import { z } from 'zod';

// Schemas Zod pour validation
export const ShippingCalculationParamsSchema = z.object({
  cartWeight: z.number().min(0, 'Poids du panier doit être positif'),
  zipCodeDeliveryId: z.string().min(1, 'Code postal de livraison requis'),
  cartAmount: z.number().min(0, 'Montant du panier doit être positif'),
  fraisBase: z.number().default(5.99),
  fraisSeuil: z.number().default(80),
  fraisAfterSeuil: z.number().default(0),
  cartAmountShippingIncluded: z.number().default(0),
  fraisNormalementAPayer: z.number().default(0),
});

export const validateShippingCalculationParams = (data: any) => 
  ShippingCalculationParamsSchema.parse(data);

// Types
export interface ShippingCalculationParams {
  cartWeight: number;
  zipCodeDeliveryId: string;
  cartAmount: number;
  fraisBase?: number;
  fraisSeuil?: number;
  fraisAfterSeuil?: number;
  cartAmountShippingIncluded?: number;
  fraisNormalementAPayer?: number;
}

export interface ShippingResult {
  finalShippingFee: number;
  details: {
    baseRate: number;
    weightSurcharge: number;
    zoneSurcharge: number;
    discountApplied: number;
    calculationMethod: string;
    deliveryZone: string;
    estimatedDays: number;
  };
}

export interface DeliveryZone {
  id: string;
  name: string;
  countries: string[];
  baseRate: number;
  weightMultiplier: number;
  estimatedDays: number;
}

@Injectable()
export class AdvancedShippingService {
  private readonly logger = new Logger(AdvancedShippingService.name);

  constructor(
    private readonly supabaseService: SupabaseRestService,
  ) {}

  /**
   * Point d'entrée principal pour calculer les frais de livraison
   * Reproduit la logique PHP GenerateFinalShippingFee
   */
  async calculateShippingFee(params: ShippingCalculationParams): Promise<ShippingResult> {
    this.logger.log('Calcul des frais de livraison avancés', {
      weight: params.cartWeight,
      zipCode: params.zipCodeDeliveryId,
      amount: params.cartAmount
    });

    // Validation des paramètres
    const validatedParams = validateShippingCalculationParams(params);
    
    try {
      // Étape 1: Déterminer la zone de livraison
      const deliveryZone = await this.determineDeliveryZone(validatedParams.zipCodeDeliveryId);
      
      // Étape 2: Calcul de base selon le poids
      const baseCalculation = this.calculateWeightBasedShipping(
        validatedParams.cartWeight,
        deliveryZone
      );
      
      // Étape 3: Application des règles métier (seuils, remises)
      const finalCalculation = this.applyBusinessRules(
        baseCalculation,
        validatedParams,
        deliveryZone
      );
      
      // Étape 4: Application des surcharges de zone
      const withZoneSurcharge = this.applyZoneSurcharge(
        finalCalculation,
        deliveryZone
      );

      return {
        finalShippingFee: Math.round(withZoneSurcharge.amount * 100) / 100,
        details: {
          baseRate: baseCalculation.baseRate,
          weightSurcharge: baseCalculation.weightSurcharge,
          zoneSurcharge: withZoneSurcharge.zoneSurcharge,
          discountApplied: finalCalculation.discountApplied,
          calculationMethod: 'advanced_legacy_compatible',
          deliveryZone: deliveryZone.name,
          estimatedDays: deliveryZone.estimatedDays,
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue lors du calcul';
      this.logger.error('Erreur lors du calcul des frais de livraison', error);
      throw new BadRequestException(`Erreur de calcul de livraison: ${errorMessage}`);
    }
  }

  /**
   * Détermine la zone de livraison selon le code postal
   */
  private async determineDeliveryZone(zipCode: string): Promise<DeliveryZone> {
    // En production, interroger les tables legacy via SupabaseRestService
    // pour récupérer les zones de livraison configurées
    
    // Logique simplifiée basée sur le code postal
    if (this.isFrenchZipCode(zipCode)) {
      return this.getZoneMetropolitaine();
    } else if (this.isEuropeanZipCode(zipCode)) {
      return this.getZoneEurope();
    } else {
      return this.getZoneInternational();
    }
  }

  /**
   * Calcul des frais basé sur le poids
   */
  private calculateWeightBasedShipping(weight: number, zone: DeliveryZone): {
    baseRate: number;
    weightSurcharge: number;
    total: number;
  } {
    const baseRate = zone.baseRate;
    let weightSurcharge = 0;

    // Logique de surcharge par tranche de poids
    if (weight > 5) {
      const extraWeight = weight - 5;
      const extraKilos = Math.ceil(extraWeight);
      weightSurcharge = extraKilos * zone.weightMultiplier;
    }

    return {
      baseRate,
      weightSurcharge,
      total: baseRate + weightSurcharge
    };
  }

  /**
   * Application des règles métier (seuils, remises)
   */
  private applyBusinessRules(
    baseCalculation: { total: number },
    params: ShippingCalculationParams,
    zone: DeliveryZone
  ): {
    amount: number;
    discountApplied: number;
  } {
    let amount = baseCalculation.total;
    let discountApplied = 0;

    // Règle du seuil de livraison gratuite
    if (params.cartAmount >= params.fraisSeuil!) {
      discountApplied = amount;
      amount = params.fraisAfterSeuil!;
    }

    // Règles spécifiques aux clients pro (future extension)
    // if (customerType === 'professional') { ... }

    return {
      amount,
      discountApplied
    };
  }

  /**
   * Application des surcharges de zone
   */
  private applyZoneSurcharge(
    calculation: { amount: number },
    zone: DeliveryZone
  ): {
    amount: number;
    zoneSurcharge: number;
  } {
    // Surcharge selon la zone (déjà incluse dans baseRate pour cette implémentation)
    const zoneSurcharge = 0;
    
    return {
      amount: calculation.amount + zoneSurcharge,
      zoneSurcharge
    };
  }

  /**
   * Vérifie si le code postal est français
   */
  private isFrenchZipCode(zipCode: string): boolean {
    return /^[0-9]{5}$/.test(zipCode);
  }

  /**
   * Vérifie si le code postal est européen
   */
  private isEuropeanZipCode(zipCode: string): boolean {
    // Logique simplifiée pour les codes postaux européens
    return /^[A-Z0-9\s-]{3,10}$/i.test(zipCode);
  }

  /**
   * Zone France métropolitaine
   */
  private getZoneMetropolitaine(): DeliveryZone {
    return {
      id: 'FR_METRO',
      name: 'France métropolitaine',
      countries: ['FR'],
      baseRate: 5.99,
      weightMultiplier: 1.50,
      estimatedDays: 2
    };
  }

  /**
   * Zone Europe
   */
  private getZoneEurope(): DeliveryZone {
    return {
      id: 'EUROPE',
      name: 'Europe',
      countries: ['DE', 'IT', 'ES', 'BE', 'NL', 'AT', 'PT'],
      baseRate: 12.99,
      weightMultiplier: 2.50,
      estimatedDays: 5
    };
  }

  /**
   * Zone internationale
   */
  private getZoneInternational(): DeliveryZone {
    return {
      id: 'INTERNATIONAL',
      name: 'International',
      countries: ['*'],
      baseRate: 25.99,
      weightMultiplier: 4.00,
      estimatedDays: 10
    };
  }

  /**
   * Méthodes utilitaires pour la compatibilité legacy
   */

  /**
   * Calcule les frais selon l'ancienne méthode (pour comparaison)
   */
  async calculateLegacyShippingFee(params: ShippingCalculationParams): Promise<number> {
    // Reproduction exacte de l'ancienne logique PHP si nécessaire
    const validatedParams = validateShippingCalculationParams(params);
    
    if (validatedParams.cartAmount >= validatedParams.fraisSeuil!) {
      return validatedParams.fraisAfterSeuil!;
    }
    
    return validatedParams.fraisBase!;
  }

  /**
   * Obtient les informations de transporteur pour une zone
   */
  async getCarrierInfo(zoneId: string): Promise<{
    carrierId: string;
    carrierName: string;
    trackingUrl: string;
  }> {
    // En production, interroger les tables legacy via SupabaseRestService
    
    const carriers = {
      'FR_METRO': {
        carrierId: 'CHRONOPOST',
        carrierName: 'Chronopost',
        trackingUrl: 'https://www.chronopost.fr/tracking-colis'
      },
      'EUROPE': {
        carrierId: 'DPD',
        carrierName: 'DPD Europe',
        trackingUrl: 'https://www.dpd.com/tracking'
      },
      'INTERNATIONAL': {
        carrierId: 'DHL',
        carrierName: 'DHL Express',
        trackingUrl: 'https://www.dhl.com/tracking'
      }
    };

    return carriers[zoneId as keyof typeof carriers] || carriers['INTERNATIONAL'];
  }

  /**
   * Calcule le délai de livraison estimé
   */
  async calculateEstimatedDelivery(
    zipCode: string,
    shippingMethod: string = 'standard'
  ): Promise<{
    estimatedDays: number;
    estimatedDate: Date;
  }> {
    const zone = await this.determineDeliveryZone(zipCode);
    let estimatedDays = zone.estimatedDays;

    // Ajustement selon la méthode de livraison
    if (shippingMethod === 'express') {
      estimatedDays = Math.max(1, Math.floor(estimatedDays / 2));
    } else if (shippingMethod === 'economy') {
      estimatedDays += 2;
    }

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);

    return {
      estimatedDays,
      estimatedDate
    };
  }

  /**
   * Méthode simplifiée pour compatibilité avec automotive-orders
   */
  async calculateAutomotiveShipping(params: {
    weight: number;
    destination: string;
    urgent?: boolean;
  }): Promise<{ cost: number; method: string; estimated_days: number }> {
    
    const shippingParams: ShippingCalculationParams = {
      cartWeight: params.weight,
      zipCodeDeliveryId: params.destination,
      cartAmount: 0, // Pas utilisé dans ce contexte
    };

    const result = await this.calculateShippingFee(shippingParams);
    const deliveryInfo = await this.calculateEstimatedDelivery(
      params.destination, 
      params.urgent ? 'express' : 'standard'
    );
    
    return {
      cost: result.finalShippingFee,
      method: params.urgent ? 'EXPRESS' : 'STANDARD',
      estimated_days: deliveryInfo.estimatedDays,
    };
  }
}
