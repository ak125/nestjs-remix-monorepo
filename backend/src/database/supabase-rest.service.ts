import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { debugConfiguration } from '../debug-config';

export interface User {
  cst_id: string;
  cst_mail: string;
  cst_pswd: string;
  cst_fname?: string;
  cst_name?: string;
  cst_civility?: string;
  cst_address?: string;
  cst_zip_code?: string;
  cst_city?: string;
  cst_country?: string;
  cst_tel?: string;
  cst_gsm?: string;
  cst_is_pro: string;
  cst_rs?: string;
  cst_siret?: string;
  cst_activ: string;
  cst_level?: number;
  cst_is_cpy?: string;
}

// Interface pour la table ___xtr_order (structure complète)
export interface Order {
  ord_id: string;
  ord_cst_id: string;
  ord_cba_id: string;
  ord_cda_id: string;
  ord_date: string;
  ord_amount_ht: string;
  ord_deposit_ht: string;
  ord_shipping_fee_ht: string;
  ord_total_ht: string;
  ord_tva: string;
  ord_amount_ttc: string;
  ord_deposit_ttc: string;
  ord_shipping_fee_ttc: string;
  ord_total_ttc: string;
  ord_is_pay: string;
  ord_date_pay: string;
  ord_da_id: string;
  ord_info: string;
  ord_dept_id: string;
  ord_ords_id: string;
  ord_parent: string;
  ord_link: string;
  ord_link_type: string;
}

// Interface pour les lignes de commande basée sur la table ___xtr_order_line
export interface OrderLine {
  orl_id: string;
  orl_ord_id: string;
  orl_pg_id: string;
  orl_pg_name: string;
  orl_pm_id: string;
  orl_pm_name: string;
  orl_art_ref: string;
  orl_art_ref_clean: string;
  orl_art_price_buy_unit_public_ht: string;
  orl_art_price_buy_unit_public_ttc: string;
  orl_art_price_buy_discount: string;
  orl_art_price_buy_unit_ht: string;
  orl_art_price_buy_unit_ttc: string;
  orl_art_price_sell_margin: string;
  orl_art_price_sell_unit_ht: string;
  orl_art_price_sell_unit_ttc: string;
  orl_art_deposit_unit_ht: string;
  orl_art_deposit_unit_ttc: string;
  orl_art_quantity: string;
  orl_art_price_buy_ht: string;
  orl_art_price_buy_ttc: string;
  orl_art_price_sell_ht: string;
  orl_art_price_sell_ttc: string;
  orl_art_deposit_ht: string;
  orl_art_deposit_ttc: string;
  orl_spl_id: string;
  orl_spl_name: string;
  orl_spl_date: string;
  orl_spl_price_buy_unit_ht: string;
  orl_spl_price_buy_unit_ttc: string;
  orl_spl_price_buy_ht: string;
  orl_spl_price_buy_ttc: string;
  orl_website_url: string;
  orl_orls_id: string;
  orl_equiv_id: string;
}

// Interface pour les statuts de commande basée sur la table ___xtr_order_status
export interface OrderStatus {
  ords_id: string;
  ords_named: string;
  ords_action: string;
  ords_color: string;
  ords_dept_id: string;
}

// Interface pour les statuts des lignes de commande basée sur la table ___xtr_order_line_status
export interface OrderLineStatus {
  orls_id: string;
  orls_name: string;
  orls_action: string;
  orls_color: string;
  orls_dept_id: string;
}

// Interface pour les adresses de facturation client basée sur la table ___xtr_customer_billing_address
export interface CustomerBillingAddress {
  cba_id: string;
  cba_cst_id: string;
  cba_mail: string;
  cba_civility: string;
  cba_name: string;
  cba_fname: string;
  cba_address: string;
  cba_zip_code: string;
  cba_city: string;
  cba_country: string;
  cba_tel: string;
  cba_gsm: string;
}

// Interface pour les adresses de livraison client basée sur la table ___xtr_customer_delivery_address
export interface CustomerDeliveryAddress {
  cda_id: string;
  cda_cst_id: string;
  cda_mail: string;
  cda_civility: string;
  cda_name: string;
  cda_fname: string;
  cda_address: string;
  cda_zip_code: string;
  cda_city: string;
  cda_country: string;
  cda_tel: string;
  cda_gsm: string;
}

@Injectable()
export class SupabaseRestService {
  private readonly supabaseUrl: string;
  private readonly supabaseServiceKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // Debug de la configuration
    debugConfiguration(configService);
    
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    this.supabaseServiceKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '';
    this.baseUrl = `${this.supabaseUrl}/rest/v1`;

    console.log('🔧 Configuration Supabase :');
    console.log('  - SUPABASE_URL:', this.supabaseUrl);
    console.log('  - BASE_URL:', this.baseUrl);
    console.log(
      '  - SERVICE_KEY présente:',
      this.supabaseServiceKey ? 'OUI' : 'NON',
    );
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      apikey: this.supabaseServiceKey,
      Authorization: `Bearer ${this.supabaseServiceKey}`,
      Prefer: 'return=representation',
    };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    try {
      console.log(`🔍 findUserByEmail: ${email}`);
      const url = `${this.baseUrl}/___xtr_customer?cst_mail=eq.${email}&select=*`;
      console.log(`📡 URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      console.log(`📈 Response status: ${response.status}`);
      
      if (!response.ok) {
        console.error('Erreur Supabase:', response.status, response.statusText);
        return null;
      }

      const users = await response.json();
      console.log(`👥 Users found: ${users.length}`);
      console.log(`📄 Users data:`, users);
      
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Erreur lors de la recherche utilisateur:', error);
      return null;
    }
  }

  async createUser(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<User | null> {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const newUser = {
        cst_id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        cst_mail: userData.email,
        cst_pswd: hashedPassword,
        cst_fname: userData.firstName || '',
        cst_name: userData.lastName || '',
        cst_is_pro: '0',
        cst_activ: '1',
        cst_level: 1,
      };

      const response = await fetch(`${this.baseUrl}/___xtr_customer`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        console.error(
          'Erreur création utilisateur:',
          response.status,
          response.statusText,
        );
        return null;
      }

      const createdUsers = await response.json();
      return createdUsers[0];
    } catch (error) {
      console.error('Erreur lors de la création utilisateur:', error);
      return null;
    }
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      console.log('=== Validation du mot de passe ===');
      console.log('Mot de passe en clair:', plainPassword);
      console.log('Mot de passe stocké:', hashedPassword);
      
      // Vérification si le mot de passe est déjà en clair (ancien système)
      if (plainPassword === hashedPassword) {
        console.log('✅ Mot de passe en clair - correspondance directe');
        return true;
      }
      
      // Vérification avec SHA-1 (système intermédiaire)
      const sha1Hash = createHash('sha1').update(plainPassword).digest('hex');
      console.log('🔍 SHA-1 hash calculé:', sha1Hash);
      
      if (sha1Hash === hashedPassword) {
        console.log('✅ Mot de passe SHA-1 - correspondance');
        return true;
      }
      
      // Vérification avec bcrypt (nouveau système)
      const bcryptResult = await bcrypt.compare(plainPassword, hashedPassword);
      console.log('🔐 Résultat bcrypt:', bcryptResult);
      
      if (bcryptResult) {
        return true;
      }
      
      // Vérification avec Unix DES crypt (ancien système Unix)
      if (hashedPassword.length === 13) {
        console.log('🔑 Test Unix DES crypt (longueur 13)');
        try {
          const crypt = await import('unix-crypt-td-js');
          const salt = hashedPassword.substring(0, 2);
          const cryptResult = crypt.default(plainPassword, salt);
          console.log('🔍 Hash Unix DES calculé:', cryptResult);
          
          if (cryptResult === hashedPassword) {
            console.log('✅ Mot de passe Unix DES crypt - correspondance');
            return true;
          }
        } catch (cryptError) {
          console.error('Erreur Unix DES crypt:', cryptError);
        }
      }
      
      console.log('❌ Aucune correspondance trouvée');
      return false;
    } catch (error) {
      console.error('Erreur validation mot de passe:', error);
      return false;
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?cst_id=eq.${id}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify(updates),
        },
      );

      if (!response.ok) {
        console.error(
          'Erreur mise à jour utilisateur:',
          response.status,
          response.statusText,
        );
        return null;
      }

      const updatedUsers = await response.json();
      return updatedUsers[0];
    } catch (error) {
      console.error('Erreur lors de la mise à jour utilisateur:', error);
      return null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?select=count&limit=1`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      return response.ok;
    } catch (error) {
      console.error('Erreur test connexion:', error);
      return false;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    console.log('--- Début de getUserById ---');
    console.log('ID utilisateur recherché:', userId);

    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?select=*&cst_id=eq.${userId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.supabaseServiceKey,
            Authorization: `Bearer ${this.supabaseServiceKey}`,
          },
        },
      );

      if (!response.ok) {
        console.error('Erreur HTTP:', response.status, response.statusText);
        return null;
      }

      const users = await response.json();
      console.log('Utilisateurs trouvés:', users);
      
      if (users && users.length > 0) {
        const user = users[0];
        console.log('Utilisateur récupéré:', user);
        return user;
      }
      
      console.log('Aucun utilisateur trouvé avec cet ID');
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération utilisateur:', error);
      return null;
    }
  }

  async hashPassword(password: string): Promise<string> {
    console.log('--- Début de hashPassword ---');
    try {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      console.log('Mot de passe hashé avec succès');
      return hashedPassword;
    } catch (error) {
      console.error('Erreur lors du hashage du mot de passe:', error);
      throw error;
    }
  }

  async updateUserPassword(email: string, hashedPassword: string): Promise<boolean> {
    console.log('--- Début de updateUserPassword ---');
    console.log('Email:', email);

    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?cst_mail=eq.${email}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.supabaseServiceKey,
            Authorization: `Bearer ${this.supabaseServiceKey}`,
          },
          body: JSON.stringify({
            cst_pswd: hashedPassword,
          }),
        },
      );

      if (!response.ok) {
        console.error('Erreur HTTP:', response.status, response.statusText);
        return false;
      }

      console.log('Mot de passe mis à jour avec succès');
      return true;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du mot de passe:', error);
      return false;
    }
  }

  async updateUserProfile(userId: string, updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    tel?: string;
    address?: string;
    city?: string;
    zipCode?: string;
    country?: string;
  }): Promise<User | null> {
    console.log('--- Début de updateUserProfile ---');
    console.log('User ID:', userId);
    console.log('Updates:', updates);

    try {
      const updateData: any = {};

      if (updates.firstName) updateData.cst_fname = updates.firstName;
      if (updates.lastName) updateData.cst_name = updates.lastName;
      if (updates.email) updateData.cst_mail = updates.email;
      if (updates.tel) updateData.cst_tel = updates.tel;
      if (updates.address) updateData.cst_address = updates.address;
      if (updates.city) updateData.cst_city = updates.city;
      if (updates.zipCode) updateData.cst_zip_code = updates.zipCode;
      if (updates.country) updateData.cst_country = updates.country;

      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?cst_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.supabaseServiceKey,
            Authorization: `Bearer ${this.supabaseServiceKey}`,
          },
          body: JSON.stringify(updateData),
        },
      );

      if (!response.ok) {
        console.error('Erreur HTTP:', response.status, response.statusText);
        return null;
      }

      // Récupérer l'utilisateur mis à jour
      const updatedUser = await this.getUserById(userId);
      console.log('Profil mis à jour avec succès:', updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      return null;
    }
  }

  async findUserById(userId: string): Promise<User | null> {
    return await this.getUserById(userId);
  }

  // ======= MÉTHODES ORDERS COMPLÈTES AVEC TOUTES LES TABLES =======

  async getOrdersWithAllRelations(
    page: number = 1,
    limit: number = 10,
    filters?: {
      status?: string;
      customerId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ orders: any[]; total: number }> {
    try {
      console.log(`🔍 getOrdersWithAllRelations: page=${page}, limit=${limit}`);
      
      const offset = (page - 1) * limit;
      
      // Construire la requête avec tous les filtres
      let query = `${this.baseUrl}/___xtr_order?select=*`;
      
      if (filters?.status) {
        query += `&ord_ords_id=eq.${filters.status}`;
      }
      if (filters?.customerId) {
        query += `&ord_cst_id=eq.${filters.customerId}`;
      }
      if (filters?.dateFrom) {
        query += `&ord_date=gte.${filters.dateFrom}`;
      }
      if (filters?.dateTo) {
        query += `&ord_date=lte.${filters.dateTo}`;
      }
      
      query += `&order=ord_date.desc&offset=${offset}&limit=${limit}`;
      
      console.log(`📡 Query: ${query}`);
      
      const response = await fetch(query, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur Supabase:', response.status, response.statusText);
        return { orders: [], total: 0 };
      }

      const orders = await response.json();
      
      // Enrichir chaque commande avec toutes les relations
      const enrichedOrders = await Promise.all(
        orders.map(async (order: any) => {
          // Récupérer le statut de commande
          const statusDetails = await this.getOrderStatusById(order.ord_ords_id);
          
          // Récupérer les informations client
          const customer = await this.getUserById(order.ord_cst_id);
          
          // Récupérer l'adresse de facturation
          const billingAddress = await this.getCustomerBillingAddress(order.ord_cba_id);
          
          // Récupérer l'adresse de livraison
          const deliveryAddress = await this.getCustomerDeliveryAddress(order.ord_cda_id);
          
          // Récupérer les lignes de commande avec leurs statuts
          const orderLines = await this.getOrderLinesWithStatus(order.ord_id);
          
          return {
            ...order,
            statusDetails,
            customer,
            billingAddress,
            deliveryAddress,
            orderLines,
            // Calculer des statistiques
            totalLines: orderLines.length,
            totalQuantity: orderLines.reduce((sum: number, line: any) => 
              sum + parseInt(line.orl_art_quantity || '0'), 0),
          };
        })
      );

      // Compter le total (sans pagination)
      const countQuery = `${this.baseUrl}/___xtr_order?select=count`;
      const countResponse = await fetch(countQuery, {
        method: 'GET',
        headers: this.headers,
      });
      
      const countResult = await countResponse.json();
      const total = countResult[0]?.count || 0;

      console.log(`✅ Enriched orders retrieved: ${enrichedOrders.length}/${total}`);
      return {
        orders: enrichedOrders,
        total: total
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des commandes enrichies:', error);
      return { orders: [], total: 0 };
    }
  }

  async getOrderStatusById(statusId: string): Promise<OrderStatus | null> {
    try {
      const url = `${this.baseUrl}/___xtr_order_status?ords_id=eq.${statusId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération statut:', response.status);
        return null;
      }

      const statuses = await response.json();
      return statuses.length > 0 ? statuses[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération du statut:', error);
      return null;
    }
  }

  async getAllOrderStatuses(): Promise<OrderStatus[]> {
    try {
      const url = `${this.baseUrl}/___xtr_order_status?select=*&order=ords_id.asc`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération statuts:', response.status);
        return [];
      }

      const statuses = await response.json();
      return statuses;
    } catch (error) {
      console.error('Erreur lors de la récupération des statuts:', error);
      return [];
    }
  }

  async getCustomerBillingAddress(addressId: string): Promise<CustomerBillingAddress | null> {
    try {
      const url = `${this.baseUrl}/___xtr_customer_billing_address?cba_id=eq.${addressId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération adresse facturation:', response.status);
        return null;
      }

      const addresses = await response.json();
      return addresses.length > 0 ? addresses[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'adresse de facturation:', error);
      return null;
    }
  }

  async getCustomerDeliveryAddress(addressId: string): Promise<CustomerDeliveryAddress | null> {
    try {
      const url = `${this.baseUrl}/___xtr_customer_delivery_address?cda_id=eq.${addressId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération adresse livraison:', response.status);
        return null;
      }

      const addresses = await response.json();
      return addresses.length > 0 ? addresses[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'adresse de livraison:', error);
      return null;
    }
  }

  async getOrderLinesWithStatus(orderId: string): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/___xtr_order_line?orl_ord_id=eq.${orderId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération lignes commande:', response.status);
        return [];
      }

      const orderLines = await response.json();
      
      // Enrichir chaque ligne avec son statut
      const enrichedLines = await Promise.all(
        orderLines.map(async (line: any) => {
          const lineStatus = await this.getOrderLineStatusById(line.orl_orls_id);
          return {
            ...line,
            lineStatus
          };
        })
      );

      return enrichedLines;
    } catch (error) {
      console.error('Erreur lors de la récupération des lignes de commande:', error);
      return [];
    }
  }

  async getOrderLineStatusById(statusId: string): Promise<OrderLineStatus | null> {
    try {
      const url = `${this.baseUrl}/___xtr_order_line_status?orls_id=eq.${statusId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération statut ligne:', response.status);
        return null;
      }

      const statuses = await response.json();
      return statuses.length > 0 ? statuses[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération du statut de ligne:', error);
      return null;
    }
  }

  async getAllOrderLineStatuses(): Promise<OrderLineStatus[]> {
    try {
      const url = `${this.baseUrl}/___xtr_order_line_status?select=*&order=orls_id.asc`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération statuts lignes:', response.status);
        return [];
      }

      const statuses = await response.json();
      return statuses;
    } catch (error) {
      console.error('Erreur lors de la récupération des statuts de lignes:', error);
      return [];
    }
  }

  // Méthodes supplémentaires pour orders service
  async getOrdersByCustomerId(customerId: string): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/___xtr_order?ord_cst_id=eq.${customerId}&select=*&order=ord_date.desc`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération commandes client:', response.status);
        return [];
      }

      const orders = await response.json();
      return orders;
    } catch (error) {
      console.error('Erreur lors de la récupération des commandes client:', error);
      return [];
    }
  }

  async updateOrder(orderId: string, updates: any): Promise<any> {
    try {
      const url = `${this.baseUrl}/___xtr_order?ord_id=eq.${orderId}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...this.headers,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        console.error('Erreur mise à jour commande:', response.status);
        return null;
      }

      const updatedOrders = await response.json();
      return updatedOrders[0] || null;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la commande:', error);
      return null;
    }
  }

  async getOrderStats(): Promise<any> {
    try {
      // Statistiques basiques
      const totalOrdersResponse = await fetch(`${this.baseUrl}/___xtr_order?select=count`, {
        method: 'GET',
        headers: this.headers,
      });

      const totalOrders = await totalOrdersResponse.json();
      
      return {
        totalOrders: totalOrders[0]?.count || 0,
        // Ajoutez d'autres statistiques si nécessaire
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      return { totalOrders: 0 };
    }
  }

  async createOrder(orderData: any): Promise<any> {
    try {
      const url = `${this.baseUrl}/___xtr_order`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        console.error('Erreur création commande:', response.status);
        return null;
      }

      const createdOrders = await response.json();
      return createdOrders[0] || null;
    } catch (error) {
      console.error('Erreur lors de la création de la commande:', error);
      return null;
    }
  }

  async deleteOrder(orderId: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/___xtr_order?ord_id=eq.${orderId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.headers,
      });

      return response.ok;
    } catch (error) {
      console.error('Erreur lors de la suppression de la commande:', error);
      return false;
    }
  }
}
