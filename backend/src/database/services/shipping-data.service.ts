import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { ConfigService } from '@nestjs/config';

/**
 * 🚚 SERVICE DE DONNÉES DE LIVRAISON
 *
 * Service spécialisé pour la gestion des données de livraison
 * Suit l'architecture modulaire mise en place
 *
 * Responsabilités:
 * - Gestion des zones de livraison
 * - Tarifs et méthodes de livraison
 * - Agents de livraison
 */
@Injectable()
export class ShippingDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(ShippingDataService.name);

  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('ShippingDataService initialized');
  }

  /**
   * Récupère les tarifs de livraison pour une zone
   */
  async getShippingRates(zone: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_delivery_agent?zone=eq.${zone}&select=*`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des tarifs', error);
      return [];
    }
  }

  /**
   * Récupère les méthodes de livraison disponibles pour une zone
   */
  async getAvailableMethods(zone: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_delivery_agent?zone=eq.${zone}&active=eq.true&select=id,name,description,base_price,estimated_days,logo_url&order=base_price.asc`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des méthodes', error);
      return [];
    }
  }

  /**
   * Récupère un agent de livraison par ID
   */
  async getDeliveryAgent(agentId: number): Promise<any | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_delivery_agent?id=eq.${agentId}&select=*`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data[0] || null;
    } catch (error) {
      this.logger.error("Erreur lors de la récupération de l'agent", error);
      return null;
    }
  }

  /**
   * Met à jour les tarifs d'un agent de livraison
   */
  async updateShippingRates(agentId: number, updates: any): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_delivery_agent?id=eq.${agentId}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify(updates),
        },
      );

      return response.ok;
    } catch (error) {
      this.logger.error('Erreur lors de la mise à jour des tarifs', error);
      return false;
    }
  }
}
