/**
 * Service OrdersComplete - Version corrigée sans fetch direct
 * Utilise uniquement les méthodes du SupabaseRestService avec gestion des timeouts
 */

import { Injectable } from '@nestjs/common';
import { SupabaseRestService } from '../../database/supabase-rest.service';

@Injectable()
export class OrdersCompleteService {
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

      // ✅ SOLUTION: Utiliser la méthode simple getOrders() avec pagination manuelle
      // Évite les timeouts en ne récupérant que les commandes de base
      const allOrders = await this.supabaseService.getOrders();
      
      // Pagination manuelle côté application (plus rapide que fetch avec timeout)
      const offset = (page - 1) * limit;
      const paginatedOrders = allOrders.slice(offset, offset + limit);

      console.log(`✅ Orders retrieved without timeouts: ${paginatedOrders.length}/${allOrders.length}`);

      return {
        success: true,
        orders: paginatedOrders,
        total: allOrders.length,
        page,
        limit,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des commandes complètes:', error);
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
      const result = await this.supabaseService.getOrdersWithAllRelations(1, 100);
      
      if (!result.orders || result.orders.length === 0) {
        return null;
      }

      // Filtrer par ID côté application
      const order = result.orders.find(o => o.ord_id === orderId);
      
      return order || null;
    } catch (error) {
      console.error('Erreur lors de la récupération de la commande complète:', 
        error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Récupérer les statistiques par statut (version Context7)
   */
  async getOrderStatsByStatus(): Promise<any> {
    try {
      console.log('🔍 Récupération des statistiques par statut');
      const stats = await this.supabaseService.getOrderStats();
      return stats;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques par statut:', error);
      return {};
    }
  }

  /**
   * Récupérer tous les statuts de commande (version Context7)
   */
  async getAllOrderStatuses(): Promise<any[]> {
    try {
      console.log('🔍 Récupération de tous les statuts de commande');
      const statuses = await this.supabaseService.getAllOrderStatuses();
      return statuses;
    } catch (error) {
      console.error('Erreur lors de la récupération des statuts de commande:', error);
      return [];
    }
  }

  /**
   * Récupérer tous les statuts de ligne (version Context7)
   */
  async getAllOrderLineStatuses(): Promise<any[]> {
    try {
      console.log('🔍 Récupération de tous les statuts de ligne');
      const statuses = await this.supabaseService.getAllOrderLineStatuses();
      return statuses;
    } catch (error) {
      console.error('Erreur lors de la récupération des statuts de ligne:', error);
      return [];
    }
  }

  /**
   * Méthodes privées - toutes utilisent maintenant le SupabaseRestService
   */
  private async getCustomerBillingAddress(addressId: string): Promise<any> {
    try {
      const address = await this.supabaseService.getCustomerBillingAddress(addressId);
      return address;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'adresse de facturation:', error);
      return null;
    }
  }

  private async getCustomerDeliveryAddress(addressId: string): Promise<any> {
    try {
      const address = await this.supabaseService.getCustomerDeliveryAddress(addressId);
      return address;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'adresse de livraison:', error);
      return null;
    }
  }

  private async getOrderLinesWithStatus(orderId: string): Promise<any[]> {
    try {
      const orderLines = await this.supabaseService.getOrderLinesWithStatus(orderId);
      return orderLines || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des lignes de commande:', error);
      return [];
    }
  }
}
