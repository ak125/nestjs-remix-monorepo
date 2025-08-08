/**
 * Service OrdersComplete - Version corrigée sans fetch direct
 * Utilise uniquement les méthodes du SupabaseRestService avec gestion des timeouts
 */

import { Injectable } from '@nestjs/common';
import { SupabaseRestService } from '../../database/supabase-rest.service';

@Injectable()
export class OrdersCompleteServiceFixed {
  constructor(private readonly supabaseService: SupabaseRestService) {}

  /**
   * Récupérer les commandes avec toutes les relations (version Context7)
   */
  async getOrdersWithAllRelations(
    page: number = 1,
    limit: number = 10,
    filters: any = {},
  ) {
    try {
      console.log(
        `🔍 OrdersCompleteService.getOrdersWithAllRelations: page=${page}, limit=${limit}`,
        filters,
      );

      // Utiliser la méthode du service avec timeout intégré
      const result = await this.supabaseService.getOrdersWithAllRelations(
        page,
        limit,
        filters,
      );

      return {
        success: true,
        orders: result.orders || [],
        total: result.total || 0,
        page,
        limit,
      };
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des commandes complètes:',
        error,
      );
      return {
        success: false,
        orders: [],
        total: 0,
        page,
        limit,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer une commande complète par ID (version Context7)
   * Note: Utilise getOrdersWithAllRelations pour récupérer toutes et filtre côté application
   */
  async getCompleteOrderById(orderId: string): Promise<any> {
    try {
      console.log(`🔍 Récupération commande complète: ${orderId}`);

      // Récupérer toutes les commandes et filtrer localement
      // TODO: Améliorer quand une méthode getOrderById sera disponible dans SupabaseRestService
      const result = await this.supabaseService.getOrdersWithAllRelations(
        1,
        100,
      );

      if (!result.orders || result.orders.length === 0) {
        return null;
      }

      // Filtrer par ID côté application
      const order = result.orders.find((o) => o.ord_id === orderId);

      return order || null;
    } catch (error) {
      console.error(
        'Erreur lors de la récupération de la commande complète:',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * Méthodes privées - toutes utilisent maintenant le SupabaseRestService
   */
  private async getCustomerBillingAddress(addressId: string): Promise<any> {
    try {
      const address =
        await this.supabaseService.getCustomerBillingAddress(addressId);
      return address;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de l'adresse de facturation:",
        error,
      );
      return null;
    }
  }

  private async getCustomerDeliveryAddress(addressId: string): Promise<any> {
    try {
      const address =
        await this.supabaseService.getCustomerDeliveryAddress(addressId);
      return address;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de l'adresse de livraison:",
        error,
      );
      return null;
    }
  }

  private async getOrderLinesWithStatus(orderId: string): Promise<any[]> {
    try {
      const orderLines =
        await this.supabaseService.getOrderLinesWithStatus(orderId);
      return orderLines || [];
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des lignes de commande:',
        error,
      );
      return [];
    }
  }
}
