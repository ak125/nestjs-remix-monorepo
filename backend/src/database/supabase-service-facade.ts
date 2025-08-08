import { Injectable } from '@nestjs/common';
import { UserService } from './services/user.service';
import { OrderService } from './services/order.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service facade qui remplace le monolithe SupabaseRestService
 * Délègue les responsabilités aux services spécialisés
 */
@Injectable()
export class SupabaseServiceFacade {
  private supabaseClient: SupabaseClient;

  constructor(
    private userService: UserService,
    private orderService: OrderService,
  ) {
    // Initialiser le client Supabase avec la clé service_role pour accès complet
    this.supabaseClient = createClient(
      process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  // ================================
  // MÉTHODES UTILISATEURS
  // ================================

  async findUserByEmail(email: string) {
    return this.userService.findUserByEmail(email);
  }

  async getUserById(userId: string) {
    return this.userService.getUserById(userId);
  }

  async getAllUsers(
    page?: number,
    limit?: number,
    search?: string,
    level?: number,
  ) {
    return this.userService.getAllUsers(page, limit, search, level);
  }

  async createUser(userData: any) {
    return this.userService.createUser(userData);
  }

  async validatePassword(plainPassword: string, hashedPassword: string) {
    return this.userService.validatePassword(plainPassword, hashedPassword);
  }

  async updateUser(id: string, updates: any) {
    return this.userService.updateUser(id, updates);
  }

  async hashPassword(password: string) {
    return this.userService.hashPassword(password);
  }

  async updateUserPassword(email: string, hashedPassword: string) {
    return this.userService.updateUserPassword(email, hashedPassword);
  }

  async updateUserProfile(userId: string, updates: any) {
    return this.userService.updateUserProfile(userId, updates);
  }

  async findUserById(userId: string) {
    return this.userService.getUserById(userId);
  }

  // ================================
  // MÉTHODES COMMANDES
  // ================================

  async getOrdersWithAllRelations(
    page?: number,
    limit?: number,
    filters?: any,
  ) {
    return this.orderService.getOrdersWithAllRelations(page, limit, filters);
  }

  async getOrdersByCustomerId(customerId: string) {
    return this.orderService.getOrdersByCustomerId(customerId);
  }

  async updateOrder(orderId: string, updates: any) {
    return this.orderService.updateOrder(orderId, updates);
  }

  async createOrder(orderData: any) {
    return this.orderService.createOrder(orderData);
  }

  async deleteOrder(orderId: string) {
    return this.orderService.deleteOrder(orderId);
  }

  async getOrderStats() {
    return this.orderService.getOrderStats();
  }

  async getOrders(page?: number, limit?: number, filters?: any) {
    // Utiliser la vraie méthode du service pour récupérer les commandes
    return this.orderService.getOrdersWithAllRelations(page, limit, filters);
  }

  // ================================
  // MÉTHODES DE COMPATIBILITÉ
  // ================================

  async testConnection() {
    return this.userService.testConnection();
  }

  // Méthodes legacy pour la compatibilité - À migrer progressivement
  async findAdminByEmail(email: string) {
    return this.userService.findAdminByEmail(email);
  }

  // Méthodes pour les statuts, adresses, etc. que nous n'avons pas encore migrées
  async getOrderStatusById(_statusId: string) {
    void _statusId;
    console.warn('getOrderStatusById: Method not migrated yet');
    return null;
  }

  async getAllOrderStatuses() {
    console.warn('getAllOrderStatuses: Method not migrated yet');
    return [];
  }

  async getCustomerBillingAddress(_addressId: string) {
    void _addressId;
    console.warn('getCustomerBillingAddress: Method not migrated yet');
    return null;
  }

  async getCustomerDeliveryAddress(_addressId: string) {
    void _addressId;
    console.warn('getCustomerDeliveryAddress: Method not migrated yet');
    return null;
  }

  async getCustomerBillingAddressByCustomerId(_customerId: string) {
    void _customerId;
    console.warn(
      'getCustomerBillingAddressByCustomerId: Method not migrated yet',
    );
    return null;
  }

  async getCustomerDeliveryAddressByCustomerId(_customerId: string) {
    void _customerId;
    console.warn(
      'getCustomerDeliveryAddressByCustomerId: Method not migrated yet',
    );
    return null;
  }

  // Autres méthodes legacy...
  async getOrderLinesWithStatus(_orderId: string) {
    void _orderId;
    console.warn('getOrderLinesWithStatus: Method not migrated yet');
    return [];
  }

  async getOrderLineStatusById(_statusId: string) {
    void _statusId;
    console.warn('getOrderLineStatusById: Method not migrated yet');
    return null;
  }

  async getAllOrderLineStatuses() {
    console.warn('getAllOrderLineStatuses: Method not migrated yet');
    return [];
  }

  // Méthodes de paiement legacy
  async createLegacyPayment(_orderData: any) {
    void _orderData;
    console.warn('createLegacyPayment: Method not migrated yet');
    return null;
  }

  async getLegacyPaymentById(_orderId: string) {
    void _orderId;
    console.warn('getLegacyPaymentById: Method not migrated yet');
    return null;
  }

  async getLegacyPaymentByTransactionId(_transactionId: string) {
    void _transactionId;
    console.warn('getLegacyPaymentByTransactionId: Method not migrated yet');
    return null;
  }

  async updateLegacyPaymentStatus(_orderId: string, _status: string) {
    void _orderId;
    void _status;
    console.warn('updateLegacyPaymentStatus: Method not migrated yet');
    return null;
  }

  // Autres méthodes payment...
  async createPaymentCallback(_callbackData: any) {
    void _callbackData;
    console.warn('createPaymentCallback: Method not migrated yet');
    return null;
  }

  async getPaymentCallbacks(_orderId: string) {
    void _orderId;
    console.warn('getPaymentCallbacks: Method not migrated yet');
    return [];
  }

  async getPaymentsByOrderId(_orderId: string) {
    void _orderId;
    console.warn('getPaymentsByOrderId: Method not migrated yet');
    return [];
  }

  async updatePayment(_paymentId: string, _updates: any) {
    void _paymentId;
    void _updates;
    console.warn('updatePayment: Method not migrated yet');
    return null;
  }

  async createPaymentLog(_logData: any) {
    void _logData;
    console.warn('createPaymentLog: Method not migrated yet');
    return null;
  }

  async getPaymentLogs(_paymentId: string) {
    void _paymentId;
    console.warn('getPaymentLogs: Method not migrated yet');
    return [];
  }

  async getPaymentStats(_startDate?: string, _endDate?: string) {
    void _startDate;
    void _endDate;
    console.warn('getPaymentStats: Method not migrated yet');
    return null;
  }

  async countPaymentAttemptsByIP(_ipAddress: string, _minutes?: number) {
    void _ipAddress;
    void _minutes;
    console.warn('countPaymentAttemptsByIP: Method not migrated yet');
    return 0;
  }

  async getLegacyPaymentsByOrderId(_orderId: string) {
    void _orderId;
    console.warn('getLegacyPaymentsByOrderId: Method not migrated yet');
    return [];
  }

  async updateLegacyPayment(_paymentId: string, _updates: any) {
    void _paymentId;
    void _updates;
    console.warn('updateLegacyPayment: Method not migrated yet');
    return null;
  }

  async createLegacyPaymentCallback(_callbackData: any) {
    void _callbackData;
    console.warn('createLegacyPaymentCallback: Method not migrated yet');
    return null;
  }

  async getLegacyPaymentCallbacks(_paymentId: string) {
    void _paymentId;
    console.warn('getLegacyPaymentCallbacks: Method not migrated yet');
    return [];
  }

  async getLegacyPaymentStats(_startDate?: string, _endDate?: string) {
    void _startDate;
    void _endDate;
    console.warn('getLegacyPaymentStats: Method not migrated yet');
    return null;
  }

  async checkLegacyCustomerExists(_customerId: string) {
    void _customerId;
    console.warn('checkLegacyCustomerExists: Method not migrated yet');
    return false;
  }

  async checkLegacyOrderExists(_orderId: string) {
    void _orderId;
    console.warn('checkLegacyOrderExists: Method not migrated yet');
    return false;
  }

  // ================================
  // MÉTHODES FOURNISSEURS
  // ================================

  async getAllSuppliers(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      country?: string;
      isActive?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ) {
    // Implémentation directe simple pour éviter les erreurs d'import
    const {
      page = 1,
      limit = 20,
      search = '',
      country = '',
      isActive = true,
    } = options;

    // Données mockées pour le moment - à remplacer par vraie logique plus tard
    const mockSuppliers = [
      {
        id: '1',
        name: 'Fournisseur Auto France',
        country: 'France',
        email: 'contact@autoparts-fr.com',
        phone: '+33 1 23 45 67 89',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'European Parts Supply',
        country: 'Germany',
        email: 'info@europarts.de',
        phone: '+49 30 12345678',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];

    // Filtrage basique
    let filteredSuppliers = mockSuppliers;
    if (search) {
      filteredSuppliers = filteredSuppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.country.toLowerCase().includes(search.toLowerCase()),
      );
    }
    if (country) {
      filteredSuppliers = filteredSuppliers.filter(
        (s) => s.country.toLowerCase() === country.toLowerCase(),
      );
    }
    if (isActive !== undefined) {
      filteredSuppliers = filteredSuppliers.filter(
        (s) => s.isActive === isActive,
      );
    }

    // Pagination
    const total = filteredSuppliers.length;
    const offset = (page - 1) * limit;
    const paginatedData = filteredSuppliers.slice(offset, offset + limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSupplierById(id: string) {
    // Implémentation mockée
    if (id === '1') {
      return {
        id: '1',
        name: 'Fournisseur Auto France',
        country: 'France',
        email: 'contact@autoparts-fr.com',
        phone: '+33 1 23 45 67 89',
        address: '123 Rue de la Paix, Paris',
        isActive: true,
        rating: 4.5,
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  }

  async createSupplier(supplierData: any) {
    // Implémentation mockée
    const newSupplier = {
      id: Date.now().toString(),
      ...supplierData,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return newSupplier;
  }

  async updateSupplier(id: string, supplierData: any) {
    // Implémentation mockée
    const updatedSupplier = {
      id,
      ...supplierData,
      updatedAt: new Date().toISOString(),
    };
    return updatedSupplier;
  }

  async deleteSupplier(id: string) {
    // Implémentation mockée
    return { success: true, id };
  }

  async getSupplierStats() {
    // Implémentation mockée
    return {
      totalSuppliers: 2,
      activeSuppliers: 2,
      inactiveSuppliers: 0,
      avgRating: 4.5,
    };
  }

  // ================================
  // MÉTHODES GÉNÉRIQUES POUR REQUÊTES DIRECTES
  // ================================

  /**
   * Méthode générique pour faire des requêtes directes à Supabase
   */
  async queryTable(
    tableName: string,
    options: {
      select?: string;
      eq?: Record<string, any>;
      filter?: Record<string, any>;
      limit?: number;
      single?: boolean;
    } = {},
  ) {
    try {
      let query = this.supabaseClient
        .from(tableName)
        .select(options.select || '*');

      if (options.eq) {
        Object.entries(options.eq).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (options.filter) {
        Object.entries(options.filter).forEach(([key, value]) => {
          query = query.filter(key, 'eq', value);
        });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.single) {
        return await query.single();
      }

      return await query;
    } catch (error) {
      console.error(`Erreur requête table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Accès direct au client Supabase pour cas complexes
   */
  get client(): SupabaseClient {
    return this.supabaseClient;
  }

  // ================================
  // MÉTHODES MESSAGES
  // ================================

  async listMessages(
    options: {
      page?: number;
      limit?: number;
      filters?: {
        staffId?: string;
        customerId?: string;
        orderId?: string;
        status?: 'open' | 'closed' | 'all';
      };
    } = {},
  ) {
    const { page = 1, limit = 20, filters } = options;
    const offset = (page - 1) * limit;
    let query: any = this.supabaseClient
      .from('___xtr_msg')
      .select('*', { count: 'exact' })
      .order('msg_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters?.staffId) query = query.eq('msg_cnfa_id', filters.staffId);
    if (filters?.customerId) query = query.eq('msg_cst_id', filters.customerId);
    if (filters?.orderId) query = query.eq('msg_ord_id', filters.orderId);
    if (filters?.status === 'open') query = query.eq('msg_open', '1');
    if (filters?.status === 'closed') query = query.eq('msg_close', '1');

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { messages: data || [], total: count || 0 };
  }

  async fetchMessageById(messageId: string) {
    const { data, error } = await this.supabaseClient
      .from('___xtr_msg')
      .select('*')
      .eq('msg_id', messageId)
      .single();

    if (error) return null;
    return data || null;
  }

  async createMessageRecord(message: any) {
    const { error } = await this.supabaseClient
      .from('___xtr_msg')
      .insert(message);
    if (error) throw new Error(error.message);
    return message;
  }

  async closeMessageRecord(messageId: string) {
    const { error } = await this.supabaseClient
      .from('___xtr_msg')
      .update({ msg_close: '1', msg_open: '0' })
      .eq('msg_id', messageId);
    if (error) throw new Error(error.message);
    return true;
  }

  async getMessageStats() {
    const { count: total } = await this.supabaseClient
      .from('___xtr_msg')
      .select('*', { count: 'exact', head: true });

    const { count: open } = await this.supabaseClient
      .from('___xtr_msg')
      .select('*', { count: 'exact', head: true })
      .eq('msg_open', '1');

    const { count: closed } = await this.supabaseClient
      .from('___xtr_msg')
      .select('*', { count: 'exact', head: true })
      .eq('msg_close', '1');

    return {
      total: total || 0,
      open: open || 0,
      closed: closed || 0,
    };
  }
}
