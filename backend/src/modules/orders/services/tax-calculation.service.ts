/**
 * Service de calcul des taxes avancé adapté pour le monorepo
 * Reproduit la logique complexe du legacy PHP pour la gestion HT/TTC
 * Intègre avec SupabaseRestService pour les vraies tables legacy
 * Basé sur la fiche technique orders_FICHE_TECHNIQUE.md
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseRestService } from '../../../database/supabase-rest.service';
import { z } from 'zod';

// Schémas Zod pour la validation des calculs de taxes
const TaxConfigSchema = z.object({
  globalSiteTva: z.number().min(0).max(100).default(20), // TVA par défaut 20%
  globalSiteTvaCoeff: z.number().min(1).default(1.2), // Coefficient TVA (1 + taux)
  globalSiteCurrencyChar: z.string().default('€'),
  isProClient: z.boolean().default(false), // Client professionnel ou particulier
});

const TaxCalculationInputSchema = z.object({
  priceHT: z.number().min(0),
  quantity: z.number().int().min(1),
  customTaxRate: z.number().min(0).max(100).optional(),
  productType: z.enum(['standard', 'reduced', 'exempt']).default('standard'),
  clientType: z.enum(['particulier', 'professionnel']).default('particulier'),
});

const OrderTaxCalculationSchema = z.object({
  items: z.array(TaxCalculationInputSchema).min(1),
  shippingHT: z.number().min(0).default(0),
  discountHT: z.number().min(0).default(0),
  config: TaxConfigSchema.optional(),
});

// Types inférés
type TaxConfig = z.infer<typeof TaxConfigSchema>;
type TaxCalculationInput = z.infer<typeof TaxCalculationInputSchema>;
type OrderTaxCalculation = z.infer<typeof OrderTaxCalculationSchema>;

export interface TaxCalculationResult {
  // Prix unitaires
  priceHT: number;
  priceTTC: number;
  taxAmount: number;
  
  // Prix totaux (quantité incluse)
  totalHT: number;
  totalTTC: number;
  totalTaxAmount: number;
  
  // Informations
  taxRate: number;
  quantity: number;
}

export interface OrderTaxResult {
  // Sous-totaux marchandises
  subtotalHT: number;
  subtotalTTC: number;
  subtotalTaxAmount: number;
  
  // Frais de port
  shippingHT: number;
  shippingTTC: number;
  shippingTaxAmount: number;
  
  // Remises
  discountHT: number;
  discountTTC: number;
  discountTaxAmount: number;
  
  // Totaux finaux
  totalHT: number;
  totalTTC: number;
  totalTaxAmount: number;
  
  // Détail par article
  itemsDetail: TaxCalculationResult[];
  
  // Configuration appliquée
  config: TaxConfig;
  currency: string;
}

@Injectable()
export class TaxCalculationService {
  private readonly logger = new Logger(TaxCalculationService.name);
  
  constructor(
    private readonly supabaseService: SupabaseRestService,
  ) {}
  
  /**
   * Configuration par défaut des taxes (reproduit GlobalSiteTva du legacy)
   */
  private readonly defaultConfig: TaxConfig = {
    globalSiteTva: 20,
    globalSiteTvaCoeff: 1.2,
    globalSiteCurrencyChar: '€',
    isProClient: false,
  };

  /**
   * Taux de TVA par type de produit (France)
   */
  private readonly taxRatesByProductType = {
    standard: 20, // Taux normal
    reduced: 5.5, // Taux réduit (livres, alimentation, etc.)
    exempt: 0, // Exonéré
  };

  /**
   * Calculer les taxes pour un article
   * Reproduit la logique PHP : Prix_vente_ttc, Prix_euro_ht, etc.
   */
  calculateItemTax(input: TaxCalculationInput, config?: Partial<TaxConfig>): TaxCalculationResult {
    // Validation et configuration
    const validatedInput = TaxCalculationInputSchema.parse(input);
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // Déterminer le taux de TVA
    const taxRate = validatedInput.customTaxRate ?? 
                   this.taxRatesByProductType[validatedInput.productType];
    
    const taxCoeff = 1 + (taxRate / 100);
    
    // Calculs de base (reproduit la logique legacy)
    const priceHT = validatedInput.priceHT;
    const priceTTC = priceHT * taxCoeff;
    const taxAmount = priceTTC - priceHT;
    
    // Calculs avec quantité
    const totalHT = priceHT * validatedInput.quantity;
    const totalTTC = priceTTC * validatedInput.quantity;
    const totalTaxAmount = taxAmount * validatedInput.quantity;
    
    return {
      priceHT: this.roundCurrency(priceHT),
      priceTTC: this.roundCurrency(priceTTC),
      taxAmount: this.roundCurrency(taxAmount),
      totalHT: this.roundCurrency(totalHT),
      totalTTC: this.roundCurrency(totalTTC),
      totalTaxAmount: this.roundCurrency(totalTaxAmount),
      taxRate,
      quantity: validatedInput.quantity,
    };
  }

  /**
   * Calculer les taxes pour une commande complète
   * Reproduit la logique PHP : amcnkCart_total_amount, tvatotale, etc.
   * Intègre avec les vraies tables ___xtr_order
   */
  async calculateOrderTax(orderData: OrderTaxCalculation): Promise<OrderTaxResult> {
    this.logger.log('Calcul des taxes pour commande', {
      itemsCount: orderData.items.length,
      shippingHT: orderData.shippingHT,
      discountHT: orderData.discountHT
    });

    // Validation
    const validatedOrder = OrderTaxCalculationSchema.parse(orderData);
    
    // Récupérer la configuration depuis les tables legacy si disponible
    const legacyConfig = await this.getTaxConfigFromLegacyTables();
    const config = { ...this.defaultConfig, ...legacyConfig, ...validatedOrder.config };
    
    // Calculer chaque article
    const itemsDetail = validatedOrder.items.map(item => 
      this.calculateItemTax(item, config)
    );
    
    // Sous-totaux marchandises
    const subtotalHT = itemsDetail.reduce((sum, item) => sum + item.totalHT, 0);
    const subtotalTTC = itemsDetail.reduce((sum, item) => sum + item.totalTTC, 0);
    const subtotalTaxAmount = itemsDetail.reduce((sum, item) => sum + item.totalTaxAmount, 0);
    
    // Frais de port (TVA standard)
    const shippingTaxRate = this.taxRatesByProductType.standard;
    const shippingTaxCoeff = 1 + (shippingTaxRate / 100);
    const shippingHT = validatedOrder.shippingHT;
    const shippingTTC = shippingHT * shippingTaxCoeff;
    const shippingTaxAmount = shippingTTC - shippingHT;
    
    // Remises (proportionnelles sur HT et TVA)
    const discountHT = validatedOrder.discountHT;
    const discountRatio = discountHT / (subtotalHT || 1);
    const discountTaxAmount = subtotalTaxAmount * discountRatio;
    const discountTTC = discountHT + discountTaxAmount;
    
    // Totaux finaux (reproduit amcnkCart_total du legacy)
    const totalHT = subtotalHT + shippingHT - discountHT;
    const totalTaxAmount = subtotalTaxAmount + shippingTaxAmount - discountTaxAmount;
    const totalTTC = totalHT + totalTaxAmount;
    
    const result = {
      // Sous-totaux marchandises
      subtotalHT: this.roundCurrency(subtotalHT),
      subtotalTTC: this.roundCurrency(subtotalTTC),
      subtotalTaxAmount: this.roundCurrency(subtotalTaxAmount),
      
      // Frais de port
      shippingHT: this.roundCurrency(shippingHT),
      shippingTTC: this.roundCurrency(shippingTTC),
      shippingTaxAmount: this.roundCurrency(shippingTaxAmount),
      
      // Remises
      discountHT: this.roundCurrency(discountHT),
      discountTTC: this.roundCurrency(discountTTC),
      discountTaxAmount: this.roundCurrency(discountTaxAmount),
      
      // Totaux finaux
      totalHT: this.roundCurrency(totalHT),
      totalTTC: this.roundCurrency(totalTTC),
      totalTaxAmount: this.roundCurrency(totalTaxAmount),
      
      // Détails
      itemsDetail,
      config,
      currency: config.globalSiteCurrencyChar,
    };

    // Log pour debugging avec les vraies données
    this.logger.debug('Calcul taxes terminé', {
      subtotalHT: result.subtotalHT,
      totalTTC: result.totalTTC,
      taxAmount: result.totalTaxAmount
    });

    return result;
  }

  /**
   * Récupère la configuration des taxes depuis les tables legacy
   * Utilise SupabaseRestService pour interroger les vraies tables
   */
  async getTaxConfigFromLegacyTables(): Promise<Partial<TaxConfig>> {
    try {
      // Pour l'instant, utiliser les valeurs par défaut
      // En production, implémenter la récupération depuis les vraies tables de configuration
      
      this.logger.debug('Utilisation de la configuration par défaut des taxes');
      
      return {
        globalSiteTva: 20,
        globalSiteTvaCoeff: 1.2,
        globalSiteCurrencyChar: '€',
      };
    } catch (error) {
      this.logger.warn('Impossible de récupérer la config taxes depuis les tables legacy', error);
      return {};
    }
  }

  /**
   * Convertir un prix TTC en HT (utile pour l'import de données legacy)
   */
  convertTTCtoHT(priceTTC: number, taxRate: number = 20): number {
    const taxCoeff = 1 + (taxRate / 100);
    return this.roundCurrency(priceTTC / taxCoeff);
  }

  /**
   * Convertir un prix HT en TTC
   */
  convertHTtoTTC(priceHT: number, taxRate: number = 20): number {
    const taxCoeff = 1 + (taxRate / 100);
    return this.roundCurrency(priceHT * taxCoeff);
  }

  /**
   * Obtenir la configuration de TVA pour un client
   * Reproduit la logique PHP connectedclt_is_pro
   * Intègre avec les vraies tables clients
   */
  async getTaxConfigForClient(
    clientId: string, 
    clientType: 'particulier' | 'professionnel' = 'particulier'
  ): Promise<TaxConfig> {
    try {
      // Récupérer les infos client depuis les vraies tables
      const clientInfo = await this.supabaseService.getUserById(clientId);
      
      const isProClient = clientInfo?.cst_is_pro === '1' || clientType === 'professionnel';
      
      const baseConfig = await this.getTaxConfigFromLegacyTables();
      
      return {
        ...this.defaultConfig,
        ...baseConfig,
        isProClient,
      };
    } catch (error) {
      this.logger.warn(`Erreur récupération config client ${clientId}`, error);
      return {
        ...this.defaultConfig,
        isProClient: clientType === 'professionnel',
      };
    }
  }

  /**
   * Valider la cohérence d'un calcul de taxes
   * Reproduit les vérifications du legacy PHP
   */
  validateTaxCalculation(result: OrderTaxResult): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Vérifier que HT + TVA = TTC (à 0.01€ près)
    const calculatedTTC = result.totalHT + result.totalTaxAmount;
    const difference = Math.abs(calculatedTTC - result.totalTTC);
    
    if (difference > 0.01) {
      errors.push(`Incohérence HT + TVA ≠ TTC (écart: ${difference.toFixed(2)}€)`);
    }
    
    // Vérifier que les totaux sont positifs
    if (result.totalTTC < 0) {
      errors.push('Le total TTC ne peut pas être négatif');
    }
    
    // Vérifier la cohérence des sous-totaux
    const itemsTotal = result.itemsDetail.reduce((sum, item) => sum + item.totalTTC, 0);
    const expectedTotal = itemsTotal + result.shippingTTC - result.discountTTC;
    const totalDifference = Math.abs(expectedTotal - result.totalTTC);
    
    if (totalDifference > 0.01) {
      errors.push(`Incohérence dans le calcul des totaux (écart: ${totalDifference.toFixed(2)}€)`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sauvegarde du calcul de taxes dans les tables legacy
   * Compatible avec la structure ___xtr_order
   */
  async saveTaxCalculationToLegacy(
    orderId: string, 
    result: OrderTaxResult
  ): Promise<void> {
    try {
      // Mettre à jour la commande avec les totaux calculés
      await this.supabaseService.updateOrder(orderId, {
        ord_amount_ht: result.subtotalHT.toString(),
        ord_shipping_fee_ht: result.shippingHT.toString(),
        ord_total_ht: result.totalHT.toString(),
        ord_tva: result.totalTaxAmount.toString(),
        ord_amount_ttc: result.subtotalTTC.toString(),
        ord_shipping_fee_ttc: result.shippingTTC.toString(),
        ord_total_ttc: result.totalTTC.toString(),
      });

      this.logger.log(`Calcul de taxes sauvegardé pour commande ${orderId}`, {
        totalHT: result.totalHT,
        totalTTC: result.totalTTC,
        tva: result.totalTaxAmount
      });
    } catch (error) {
      this.logger.error(`Erreur sauvegarde taxes commande ${orderId}`, error);
      throw error;
    }
  }

  /**
   * Arrondir une valeur monétaire à 2 décimales
   * Reproduit les arrondis du legacy PHP
   */
  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Formater un montant avec la devise
   */
  formatAmount(amount: number, currency: string = '€'): string {
    return `${amount.toFixed(2)} ${currency}`;
  }

  /**
   * Obtenir un résumé fiscal pour l'affichage
   * Reproduit l'affichage legacy amcnkCart_total_amount, etc.
   */
  getTaxSummary(result: OrderTaxResult): {
    display: {
      subtotalHT: string;
      subtotalTTC: string;
      shippingTTC: string;
      discountTTC: string;
      totalTTC: string;
    };
    breakdown: {
      taxByRate: Array<{
        rate: number;
        baseHT: number;
        taxAmount: number;
      }>;
    };
  } {
    const currency = result.currency;
    
    // Regrouper les taxes par taux
    const taxByRate = new Map<number, { baseHT: number; taxAmount: number }>();
    
    result.itemsDetail.forEach(item => {
      const existing = taxByRate.get(item.taxRate) || { baseHT: 0, taxAmount: 0 };
      existing.baseHT += item.totalHT;
      existing.taxAmount += item.totalTaxAmount;
      taxByRate.set(item.taxRate, existing);
    });
    
    return {
      display: {
        subtotalHT: this.formatAmount(result.subtotalHT, currency),
        subtotalTTC: this.formatAmount(result.subtotalTTC, currency),
        shippingTTC: this.formatAmount(result.shippingTTC, currency),
        discountTTC: this.formatAmount(result.discountTTC, currency),
        totalTTC: this.formatAmount(result.totalTTC, currency),
      },
      breakdown: {
        taxByRate: Array.from(taxByRate.entries()).map(([rate, amounts]) => ({
          rate,
          baseHT: this.roundCurrency(amounts.baseHT),
          taxAmount: this.roundCurrency(amounts.taxAmount),
        })),
      },
    };
  }

  /**
   * Méthodes utilitaires pour la compatibilité avec les vraies tables
   */

  /**
   * Récupère les taux de TVA configurés dans les tables legacy
   */
  async getLegacyTaxRates(): Promise<Record<string, number>> {
    try {
      // Pour l'instant, utiliser les taux par défaut
      // En production, implémenter la récupération depuis les vraies tables
      
      this.logger.debug('Utilisation des taux de TVA par défaut');
      
      return { ...this.taxRatesByProductType };
    } catch (error) {
      this.logger.warn('Impossible de récupérer les taux TVA legacy', error);
      return this.taxRatesByProductType;
    }
  }

  /**
   * Exports pour validation Zod
   */
  validateTaxCalculationInput(data: any): TaxCalculationInput {
    return TaxCalculationInputSchema.parse(data);
  }

  validateOrderTaxCalculation(data: any): OrderTaxCalculation {
    return OrderTaxCalculationSchema.parse(data);
  }
}