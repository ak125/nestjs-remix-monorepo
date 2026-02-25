import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from '../../../database/services/orders.service';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/** Raw Supabase row from ___xtr_order (all columns are TEXT) */
export interface OrderRow extends Record<string, unknown> {
  order_id?: string;
  customer_id?: string;
  status?: number;
  total?: number;
  created_at?: string;
  updated_at?: string;
}

/** Data required to create a new order */
export interface CreateOrderInput {
  customer_id: string;
  order_lines?: Record<string, unknown>[];
  billing_address?: Record<string, unknown>;
  shipping_address?: Record<string, unknown>;
  customer_note?: string;
  shipping_method?: string;
}

/** Data allowed when updating an order */
export interface UpdateOrderInput {
  status?: number;
  billing_address?: Record<string, unknown>;
  shipping_address?: Record<string, unknown>;
  customer_note?: string;
}

/** Filters for paginated order queries */
export interface OrderPaginationFilters {
  status?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Paginated result set */
export interface PaginatedOrders {
  data: OrderRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Order statistics summary */
export interface OrderStatistics {
  total_orders: number;
  total: number;
  pending_orders: number;
  completed_orders: number;
}

export interface OrderRepositoryInterface {
  findById(id: string): Promise<OrderRow | null>;
  findByCustomerId(customerId: string): Promise<OrderRow[]>;
  create(orderData: CreateOrderInput): Promise<OrderRow | null>;
  update(id: string, updateData: UpdateOrderInput): Promise<OrderRow | null>;
  delete(id: string): Promise<void>;
  findWithPagination(
    page: number,
    limit: number,
    filters?: OrderPaginationFilters,
  ): Promise<PaginatedOrders>;
}

@Injectable()
export class OrderRepository
  extends SupabaseBaseService
  implements OrderRepositoryInterface
{
  protected readonly logger = new Logger(OrderRepository.name);

  constructor(private readonly ordersService: OrdersService) {
    super();
  }

  /**
   * Trouve une commande par son ID
   */
  async findById(id: string): Promise<OrderRow | null> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select(
          `
          *,
          ___xtr_customer(*),
          ___xtr_order_status(*),
          ___xtr_order_line(*)
        `,
        )
        .eq('order_id', id)
        .single();

      if (error) {
        this.logger.error(`Error finding order by ID ${id}:`, error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error(`Failed to find order by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Trouve toutes les commandes d'un client
   */
  async findByCustomerId(customerId: string): Promise<OrderRow[]> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select(
          `
          *,
          ___xtr_order_status(*),
          ___xtr_order_line(*)
        `,
        )
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(
          `Error finding orders for customer ${customerId}:`,
          error,
        );
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error(
        `Failed to find orders for customer ${customerId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Crée une nouvelle commande
   */
  async create(orderData: CreateOrderInput): Promise<OrderRow | null> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .insert({
          ...orderData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating order:', error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to create order:', error);
      throw error;
    }
  }

  /**
   * Met à jour une commande
   */
  async update(
    id: string,
    updateData: UpdateOrderInput,
  ): Promise<OrderRow | null> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Error updating order ${id}:`, error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error(`Failed to update order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Supprime une commande
   */
  async delete(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('___xtr_order')
        .delete()
        .eq('order_id', id);

      if (error) {
        this.logger.error(`Error deleting order ${id}:`, error);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to delete order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Trouve des commandes avec pagination
   */
  async findWithPagination(
    page: number,
    limit: number,
    filters?: OrderPaginationFilters,
  ): Promise<PaginatedOrders> {
    try {
      const offset = (page - 1) * limit;

      let query = this.supabase.from('___xtr_order').select(
        `
          *,
          ___xtr_customer(*),
          ___xtr_order_status(*)
        `,
        { count: 'exact' },
      );

      // Appliquer les filtres si fournis
      if (filters) {
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.customerId) {
          query = query.eq('customer_id', filters.customerId);
        }
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        this.logger.error('Error finding orders with pagination:', error);
        throw error;
      }

      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      };
    } catch (error) {
      this.logger.error('Failed to find orders with pagination:', error);
      throw error;
    }
  }

  /**
   * Obtient les statistiques des commandes pour un client
   */
  async getOrderStatistics(customerId: string): Promise<OrderStatistics> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select('order_id, status, total')
        .eq('customer_id', customerId);

      if (error) {
        this.logger.error(
          `Error getting order statistics for customer ${customerId}:`,
          error,
        );
        throw error;
      }

      return {
        total_orders: data?.length || 0,
        total:
          data?.reduce(
            (sum: number, order: OrderRow) => sum + (Number(order.total) || 0),
            0,
          ) || 0,
        pending_orders:
          data?.filter((order: OrderRow) => order.status === 1).length || 0,
        completed_orders:
          data?.filter((order: OrderRow) => order.status === 3).length || 0,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get order statistics for customer ${customerId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Recherche des commandes par terme
   */
  async searchOrders(searchTerm: string): Promise<OrderRow[]> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select(
          `
          *,
          ___xtr_customer(*),
          ___xtr_order_status(*)
        `,
        )
        .or(
          `order_number.ilike.%${searchTerm}%,___xtr_customer.email.ilike.%${searchTerm}%,___xtr_customer.firstname.ilike.%${searchTerm}%,___xtr_customer.lastname.ilike.%${searchTerm}%`,
        )
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(
          `Error searching orders for term "${searchTerm}":`,
          error,
        );
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error(
        `Failed to search orders for term "${searchTerm}":`,
        error,
      );
      throw error;
    }
  }
}
