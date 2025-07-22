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

// Interface pour la table ___xtr_order (structure complète) - VRAIE TABLE LEGACY
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
  // Champs pour les paiements (utilisent la colonne ord_is_pay existante)
  payment_gateway?: string; // Stocké dans ord_info (JSON)
  payment_status?: string; // Mapping: ord_is_pay (0=PENDING, 1=PAID)
  transaction_id?: string; // Stocké dans ord_info (JSON)
  payment_metadata?: any; // Stocké dans ord_info (JSON)
  ord_link: string;
  ord_link_type: string;
}

// Interface pour la table ic_postback (VRAIE TABLE LEGACY) - Callbacks de paiement
export interface PaymentCallback {
  // Colonnes existantes dans ic_postback (à vérifier avec DESCRIBE)
  id?: string;
  created_at?: string;
  data?: any; // Données du callback (JSON)
  status?: string; // Statut du callback
  reference?: string; // Référence de transaction
  amount?: number; // Montant
  currency?: string; // Devise
  gateway?: string; // Gateway utilisée (STRIPE, PAYPAL, etc.)
  order_id?: string; // ID de commande liée
  // Champs additionnels pour notre module
  action_type?: string; // Type d'action (PAYMENT_RECEIVED, REFUND, etc.)
  ip_address?: string; // IP de la requête
  user_agent?: string; // User agent
  verified?: boolean; // Signature vérifiée
  error_message?: string; // Message d'erreur si échec
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

// ================================================================
// INTERFACES POUR LES VRAIES TABLES LEGACY - MODULE PAYMENT
// ================================================================

// Interface pour backofficeplateform_commande (table principale des paiements)
export interface LegacyPaymentOrder {
  id: number;
  ord_id: number; // Référence vers ___xtr_order.ord_id
  cst_id: number; // Référence vers ___xtr_customer.cst_id
  montant_total: string; // DECIMAL montant total
  devise: string; // EUR, USD, etc.
  statut_paiement: 'EN_ATTENTE' | 'PAYE' | 'ECHEC' | 'REMBOURSE' | 'ANNULE';
  methode_paiement: 'CYBERPLUS' | 'STRIPE' | 'PAYPAL' | 'VIREMENT';
  reference_transaction: string | null;
  reference_bancaire: string | null;
  url_retour_ok: string | null;
  url_retour_nok: string | null;
  url_callback: string | null;
  donnees_meta: any | null; // JSON
  date_creation: string;
  date_modification: string;
  date_paiement: string | null;
}

// Interface pour ic_postback (callbacks et logs du système legacy)
export interface LegacyPaymentCallback {
  id: number;
  commande_id: number; // Référence vers backofficeplateform_commande.id
  type_action: string; // 'CREATION', 'INITIATION', 'CALLBACK', 'CONFIRMATION', 'ECHEC'
  gateway_source: string; // CYBERPLUS, STRIPE, PAYPAL, etc.
  transaction_externe_id: string | null;
  donnees_callback: any | null; // JSON avec les données brutes du callback
  adresse_ip: string | null;
  user_agent: string | null;
  statut_retour: string; // Statut retourné par la gateway
  montant_confirme: string | null; // Montant confirmé par la gateway
  devise_confirmee: string | null;
  signature_verifiee: boolean | null;
  date_reception: string;
  erreur_message: string | null;
}

// Interface pour la table payment (nouvelles tables si besoin)
export interface Payment {
  pay_id: string;
  pay_ord_id: string; // Référence à la commande
  pay_cst_id: string; // Référence au client

  // Informations de paiement
  pay_amount: string; // DECIMAL(10, 2) en string
  pay_currency: string;
  pay_gateway: string; // CYBERPLUS, STRIPE, PAYPAL, BANK_TRANSFER
  pay_status: string; // PENDING, PAID, FAILED, REFUNDED, SUCCESS, CANCELLED

  // Références externes
  pay_transaction_id?: string;
  pay_bank_reference?: string;

  // URLs et métadonnées
  pay_return_url?: string;
  pay_cancel_url?: string;
  pay_callback_url?: string;
  pay_metadata?: any; // JSONB

  // Dates
  pay_created_at: string;
  pay_updated_at: string;
  pay_paid_at?: string;
}

// Interface pour la table payment_log
export interface PaymentLog {
  log_id: number;
  log_pay_id?: string; // Peut être NULL pour les callbacks non associés

  // Action et données
  log_action: string; // PAYMENT_INITIATED, PAYMENT_SUCCESS, etc.
  log_data?: any; // JSONB

  // Informations de contexte
  log_ip_address?: string;
  log_user_agent?: string;

  // Date
  log_created_at: string;
}

// Enums pour les statuts de paiement
export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  SUCCESS = 'SUCCESS',
  CANCELLED = 'CANCELLED',
}

export enum PaymentGateway {
  CYBERPLUS = 'CYBERPLUS',
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum PaymentLogAction {
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_CANCELLED = 'PAYMENT_CANCELLED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  CALLBACK_RECEIVED = 'CALLBACK_RECEIVED',
  BANK_RESPONSE = 'BANK_RESPONSE',
  SIGNATURE_VALIDATION = 'SIGNATURE_VALIDATION',
  AMOUNT_VALIDATION = 'AMOUNT_VALIDATION',
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

  async updateUserPassword(
    email: string,
    hashedPassword: string,
  ): Promise<boolean> {
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

  async updateUserProfile(
    userId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      email?: string;
      tel?: string;
      address?: string;
      city?: string;
      zipCode?: string;
      country?: string;
    },
  ): Promise<User | null> {
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
    },
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
          const statusDetails = await this.getOrderStatusById(
            order.ord_ords_id,
          );

          // Récupérer les informations client
          const customer = await this.getUserById(order.ord_cst_id);

          // Récupérer l'adresse de facturation
          const billingAddress = await this.getCustomerBillingAddress(
            order.ord_cba_id,
          );

          // Récupérer l'adresse de livraison
          const deliveryAddress = await this.getCustomerDeliveryAddress(
            order.ord_cda_id,
          );

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
            totalQuantity: orderLines.reduce(
              (sum: number, line: any) =>
                sum + parseInt(line.orl_art_quantity || '0'),
              0,
            ),
          };
        }),
      );

      // Compter le total (sans pagination)
      const countQuery = `${this.baseUrl}/___xtr_order?select=count`;
      const countResponse = await fetch(countQuery, {
        method: 'GET',
        headers: this.headers,
      });

      const countResult = await countResponse.json();
      const total = countResult[0]?.count || 0;

      console.log(
        `✅ Enriched orders retrieved: ${enrichedOrders.length}/${total}`,
      );
      return {
        orders: enrichedOrders,
        total: total,
      };
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des commandes enrichies:',
        error,
      );
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

  async getCustomerBillingAddress(
    addressId: string,
  ): Promise<CustomerBillingAddress | null> {
    try {
      const url = `${this.baseUrl}/___xtr_customer_billing_address?cba_id=eq.${addressId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error(
          'Erreur récupération adresse facturation:',
          response.status,
        );
        return null;
      }

      const addresses = await response.json();
      return addresses.length > 0 ? addresses[0] : null;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de l'adresse de facturation:",
        error,
      );
      return null;
    }
  }

  async getCustomerDeliveryAddress(
    addressId: string,
  ): Promise<CustomerDeliveryAddress | null> {
    try {
      const url = `${this.baseUrl}/___xtr_customer_delivery_address?cda_id=eq.${addressId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error(
          'Erreur récupération adresse livraison:',
          response.status,
        );
        return null;
      }

      const addresses = await response.json();
      return addresses.length > 0 ? addresses[0] : null;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de l'adresse de livraison:",
        error,
      );
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
          const lineStatus = await this.getOrderLineStatusById(
            line.orl_orls_id,
          );
          return {
            ...line,
            lineStatus,
          };
        }),
      );

      return enrichedLines;
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des lignes de commande:',
        error,
      );
      return [];
    }
  }

  async getOrderLineStatusById(
    statusId: string,
  ): Promise<OrderLineStatus | null> {
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
      console.error(
        'Erreur lors de la récupération du statut de ligne:',
        error,
      );
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
      console.error(
        'Erreur lors de la récupération des statuts de lignes:',
        error,
      );
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
      console.error(
        'Erreur lors de la récupération des commandes client:',
        error,
      );
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
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updates),
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
      const totalOrdersResponse = await fetch(
        `${this.baseUrl}/___xtr_order?select=count`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

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

  /**
   * Récupérer toutes les commandes (pour les statistiques)
   */
  async getOrders(): Promise<Order[]> {
    try {
      const url = `${this.baseUrl}/___xtr_order?select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération commandes:', response.status);
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('Erreur lors de la récupération des commandes:', error);
      return [];
    }
  }

  async createOrder(orderData: any): Promise<any> {
    try {
      const url = `${this.baseUrl}/___xtr_order`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(orderData),
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

  // ================================================================
  // MÉTHODES POUR LES PAIEMENTS - VRAIES TABLES LEGACY
  // ================================================================

  /**
   * Créer un nouveau paiement via la table ___xtr_order
   */
  async createLegacyPayment(orderData: Partial<Order>): Promise<Order | null> {
    try {
      console.log('🆕 Création paiement legacy:', orderData);

      // Préparer les données pour ___xtr_order
      const orderPayload = {
        ord_cst_id: orderData.ord_cst_id,
        ord_amount_ttc: orderData.ord_amount_ttc,
        ord_total_ttc: orderData.ord_total_ttc,
        ord_is_pay: '0', // 0=PENDING, 1=PAID
        ord_date: new Date().toISOString(),
        ord_info: JSON.stringify({
          payment_gateway: orderData.payment_gateway || 'CYBERPLUS',
          payment_metadata: orderData.payment_metadata || {},
          transaction_id: orderData.transaction_id,
        }),
        ...orderData,
      };

      const url = `${this.baseUrl}/___xtr_order`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        console.error(
          'Erreur création paiement legacy:',
          response.status,
          await response.text(),
        );
        return null;
      }

      const orders = await response.json();
      return orders[0] || null;
    } catch (error) {
      console.error('Erreur lors de la création du paiement legacy:', error);
      return null;
    }
  }

  /**
   * Récupérer un paiement par ID via ___xtr_order
   */
  async getLegacyPaymentById(orderId: string): Promise<Order | null> {
    try {
      const url = `${this.baseUrl}/___xtr_order?ord_id=eq.${orderId}&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération paiement:', response.status);
        return null;
      }

      const payments = await response.json();
      return payments.length > 0 ? payments[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération du paiement:', error);
      return null;
    }
  }

  /**
   * Récupérer un paiement par ID de transaction via ___xtr_order
   */
  async getLegacyPaymentByTransactionId(
    transactionId: string,
  ): Promise<Order | null> {
    try {
      // Rechercher dans ord_info qui contient les données JSON du paiement
      const url = `${this.baseUrl}/___xtr_order?ord_info->>transaction_id=eq."${transactionId}"&select=*`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error(
          'Erreur récupération paiement par transaction:',
          response.status,
        );
        return null;
      }

      const orders = await response.json();
      return orders.length > 0 ? orders[0] : null;
    } catch (error) {
      console.error(
        'Erreur lors de la récupération du paiement par transaction:',
        error,
      );
      return null;
    }
  }

  /**
   * Mettre à jour le statut de paiement d'une commande
   */
  async updateLegacyPaymentStatus(
    orderId: string,
    status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED',
  ): Promise<Order | null> {
    try {
      const payStatus = status === 'PAID' ? '1' : '0';
      const updateData = {
        ord_is_pay: payStatus,
        ord_date_pay: status === 'PAID' ? new Date().toISOString() : null,
      };

      const url = `${this.baseUrl}/___xtr_order?ord_id=eq.${orderId}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...this.headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        console.error(
          'Erreur mise à jour statut paiement:',
          response.status,
          await response.text(),
        );
        return null;
      }

      const orders = await response.json();
      return orders[0] || null;
    } catch (error) {
      console.error(
        'Erreur lors de la mise à jour du statut de paiement:',
        error,
      );
      return null;
    }
  }

  // ================================================================
  // MÉTHODES POUR LES CALLBACKS DE PAIEMENT - TABLE ic_postback
  // ================================================================

  /**
   * Créer un callback de paiement dans ic_postback
   */
  async createPaymentCallback(
    callbackData: Partial<PaymentCallback>,
  ): Promise<PaymentCallback | null> {
    try {
      console.log('📥 Création callback paiement:', callbackData);

      const url = `${this.baseUrl}/ic_postback`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          created_at: new Date().toISOString(),
          data: callbackData.data,
          status: callbackData.status || 'RECEIVED',
          reference: callbackData.reference,
          amount: callbackData.amount,
          currency: callbackData.currency || 'EUR',
          gateway: callbackData.gateway,
          order_id: callbackData.order_id,
          action_type: callbackData.action_type || 'PAYMENT_CALLBACK',
          ip_address: callbackData.ip_address,
          user_agent: callbackData.user_agent,
          verified: callbackData.verified || false,
          error_message: callbackData.error_message,
        }),
      });

      if (!response.ok) {
        console.error(
          'Erreur création callback:',
          response.status,
          await response.text(),
        );
        return null;
      }

      const callbacks = await response.json();
      return callbacks[0] || null;
    } catch (error) {
      console.error('Erreur lors de la création du callback:', error);
      return null;
    }
  }

  /**
   * Récupérer les callbacks d'un paiement/commande
   */
  async getPaymentCallbacks(orderId: string): Promise<PaymentCallback[]> {
    try {
      const url = `${this.baseUrl}/ic_postback?order_id=eq.${orderId}&select=*&order=created_at.desc`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération callbacks:', response.status);
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('Erreur lors de la récupération des callbacks:', error);
      return [];
    }
  }

  /**
   * Récupérer les paiements d'une commande
   */
  async getPaymentsByOrderId(orderId: string): Promise<Payment[]> {
    try {
      const url = `${this.baseUrl}/payment?pay_ord_id=eq.${orderId}&select=*&order=pay_created_at.desc`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error(
          'Erreur récupération paiements commande:',
          response.status,
        );
        return [];
      }

      const payments = await response.json();
      return payments;
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des paiements de la commande:',
        error,
      );
      return [];
    }
  }

  /**
   * Mettre à jour un paiement
   */
  async updatePayment(
    paymentId: string,
    updates: Partial<Payment>,
  ): Promise<Payment | null> {
    try {
      console.log('🔄 Mise à jour paiement:', paymentId, updates);

      const url = `${this.baseUrl}/payment?pay_id=eq.${paymentId}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...this.headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        console.error(
          'Erreur mise à jour paiement:',
          response.status,
          await response.text(),
        );
        return null;
      }

      const payments = await response.json();
      return payments[0] || null;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du paiement:', error);
      return null;
    }
  }

  /**
   * Créer un log de paiement
   */
  async createPaymentLog(
    logData: Partial<PaymentLog>,
  ): Promise<PaymentLog | null> {
    try {
      const url = `${this.baseUrl}/payment_log`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(logData),
      });

      if (!response.ok) {
        console.error(
          'Erreur création log paiement:',
          response.status,
          await response.text(),
        );
        return null;
      }

      const logs = await response.json();
      return logs[0] || null;
    } catch (error) {
      console.error('Erreur lors de la création du log de paiement:', error);
      return null;
    }
  }

  /**
   * Récupérer les logs d'un paiement
   */
  async getPaymentLogs(paymentId: string): Promise<PaymentLog[]> {
    try {
      const url = `${this.baseUrl}/payment_log?log_pay_id=eq.${paymentId}&select=*&order=log_created_at.desc`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération logs paiement:', response.status);
        return [];
      }

      const logs = await response.json();
      return logs;
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des logs de paiement:',
        error,
      );
      return [];
    }
  }

  /**
   * Obtenir des statistiques de paiement
   */
  async getPaymentStats(startDate?: string, endDate?: string): Promise<any> {
    try {
      let url = `${this.baseUrl}/payment?select=pay_status,pay_amount,pay_gateway,pay_created_at`;

      const conditions = [];
      if (startDate) {
        conditions.push(`pay_created_at=gte.${startDate}`);
      }
      if (endDate) {
        conditions.push(`pay_created_at=lte.${endDate}`);
      }

      if (conditions.length > 0) {
        url += `&${conditions.join('&')}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération stats paiement:', response.status);
        return null;
      }

      const payments = await response.json();

      // Calculer les statistiques
      const stats: any = {
        total: payments.length,
        successful: payments.filter((p: Payment) =>
          ['SUCCESS', 'PAID'].includes(p.pay_status),
        ).length,
        failed: payments.filter((p: Payment) => p.pay_status === 'FAILED')
          .length,
        pending: payments.filter((p: Payment) => p.pay_status === 'PENDING')
          .length,
        cancelled: payments.filter((p: Payment) => p.pay_status === 'CANCELLED')
          .length,
        totalAmount: payments
          .filter((p: Payment) => ['SUCCESS', 'PAID'].includes(p.pay_status))
          .reduce(
            (sum: number, p: Payment) => sum + parseFloat(p.pay_amount),
            0,
          ),
        byGateway: payments.reduce((acc: any, p: Payment) => {
          acc[p.pay_gateway] = (acc[p.pay_gateway] || 0) + 1;
          return acc;
        }, {}),
      };

      stats.successRate =
        stats.total > 0
          ? ((stats.successful / stats.total) * 100).toFixed(2)
          : '0.00';

      return stats;
    } catch (error) {
      console.error(
        'Erreur lors du calcul des statistiques de paiement:',
        error,
      );
      return null;
    }
  }

  /**
   * Compter les tentatives de paiement par IP
   */
  async countPaymentAttemptsByIP(
    ipAddress: string,
    minutes: number = 60,
  ): Promise<number> {
    try {
      const sinceDate = new Date(
        Date.now() - minutes * 60 * 1000,
      ).toISOString();

      const url = `${this.baseUrl}/payment_log?log_ip_address=eq.${ipAddress}&log_action=eq.PAYMENT_INITIATED&log_created_at=gte.${sinceDate}&select=log_id`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur comptage tentatives IP:', response.status);
        return 0;
      }

      const logs = await response.json();
      return logs.length;
    } catch (error) {
      console.error('Erreur lors du comptage des tentatives par IP:', error);
      return 0;
    }
  }

  // ================================================================
  // MÉTHODES POUR LES CALLBACKS DE PAIEMENT - TABLE ic_postback
  // ================================================================

  /**
   * Créer un callback de paiement dans ic_postback

      if (!response.ok) {
        console.error('Erreur récupération paiement legacy:', response.status);
        return null;
      }

      const payments = await response.json();
      return payments.length > 0 ? payments[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération du paiement legacy:', error);
      return null;
    }
  }

  /**
   * Récupérer les paiements d'une commande ___XTR_ORDER
   */
  async getLegacyPaymentsByOrderId(
    orderId: string,
  ): Promise<LegacyPaymentOrder[]> {
    try {
      const url = `${this.baseUrl}/backofficeplateform_commande?ord_id=eq.${orderId}&select=*&order=date_creation.desc`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error(
          'Erreur récupération paiements commande legacy:',
          response.status,
        );
        return [];
      }

      const payments = await response.json();
      return payments;
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des paiements de la commande legacy:',
        error,
      );
      return [];
    }
  }

  /**
   * Mettre à jour un paiement legacy
   */
  async updateLegacyPayment(
    paymentId: string,
    updates: Partial<LegacyPaymentOrder>,
  ): Promise<LegacyPaymentOrder | null> {
    try {
      console.log('🔄 Mise à jour paiement legacy:', paymentId, updates);

      const updateData = {
        ...updates,
        date_modification: new Date().toISOString(),
      };

      const url = `${this.baseUrl}/backofficeplateform_commande?id=eq.${paymentId}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...this.headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        console.error(
          'Erreur mise à jour paiement legacy:',
          response.status,
          await response.text(),
        );
        return null;
      }

      const payments = await response.json();
      return payments[0] || null;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du paiement legacy:', error);
      return null;
    }
  }

  /**
   * Créer un callback dans ic_postback
   */
  async createLegacyPaymentCallback(
    callbackData: Partial<LegacyPaymentCallback>,
  ): Promise<LegacyPaymentCallback | null> {
    try {
      console.log('📥 Création callback legacy:', callbackData);

      const url = `${this.baseUrl}/ic_postback`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          commande_id: callbackData.commande_id,
          type_action: callbackData.type_action,
          gateway_source: callbackData.gateway_source,
          transaction_externe_id: callbackData.transaction_externe_id,
          donnees_callback: callbackData.donnees_callback,
          adresse_ip: callbackData.adresse_ip,
          user_agent: callbackData.user_agent,
          statut_retour: callbackData.statut_retour,
          montant_confirme: callbackData.montant_confirme,
          devise_confirmee: callbackData.devise_confirmee,
          signature_verifiee: callbackData.signature_verifiee,
          date_reception: new Date().toISOString(),
          erreur_message: callbackData.erreur_message,
        }),
      });

      if (!response.ok) {
        console.error(
          'Erreur création callback legacy:',
          response.status,
          await response.text(),
        );
        return null;
      }

      const callbacks = await response.json();
      return callbacks[0] || null;
    } catch (error) {
      console.error('Erreur lors de la création du callback legacy:', error);
      return null;
    }
  }

  /**
   * Récupérer les callbacks d'un paiement
   */
  async getLegacyPaymentCallbacks(
    paymentId: string,
  ): Promise<LegacyPaymentCallback[]> {
    try {
      const url = `${this.baseUrl}/ic_postback?commande_id=eq.${paymentId}&select=*&order=date_reception.desc`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération callbacks legacy:', response.status);
        return [];
      }

      const callbacks = await response.json();
      return callbacks;
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des callbacks legacy:',
        error,
      );
      return [];
    }
  }

  /**
   * Obtenir des statistiques de paiement legacy
   */
  async getLegacyPaymentStats(
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    try {
      let url = `${this.baseUrl}/backofficeplateform_commande?select=statut_paiement,montant_total,methode_paiement,date_creation`;

      const conditions = [];
      if (startDate) {
        conditions.push(`date_creation=gte.${startDate}`);
      }
      if (endDate) {
        conditions.push(`date_creation=lte.${endDate}`);
      }

      if (conditions.length > 0) {
        url += `&${conditions.join('&')}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error(
          'Erreur récupération stats paiement legacy:',
          response.status,
        );
        return null;
      }

      const payments = await response.json();

      // Calculer les statistiques
      const stats: any = {
        total: payments.length,
        successful: payments.filter(
          (p: LegacyPaymentOrder) => p.statut_paiement === 'PAYE',
        ).length,
        failed: payments.filter(
          (p: LegacyPaymentOrder) => p.statut_paiement === 'ECHEC',
        ).length,
        pending: payments.filter(
          (p: LegacyPaymentOrder) => p.statut_paiement === 'EN_ATTENTE',
        ).length,
        cancelled: payments.filter(
          (p: LegacyPaymentOrder) => p.statut_paiement === 'ANNULE',
        ).length,
        refunded: payments.filter(
          (p: LegacyPaymentOrder) => p.statut_paiement === 'REMBOURSE',
        ).length,
        totalAmount: payments
          .filter((p: LegacyPaymentOrder) => p.statut_paiement === 'PAYE')
          .reduce(
            (sum: number, p: LegacyPaymentOrder) =>
              sum + parseFloat(p.montant_total),
            0,
          ),
        byGateway: payments.reduce((acc: any, p: LegacyPaymentOrder) => {
          acc[p.methode_paiement] = (acc[p.methode_paiement] || 0) + 1;
          return acc;
        }, {}),
      };

      stats.successRate =
        stats.total > 0
          ? ((stats.successful / stats.total) * 100).toFixed(2)
          : '0.00';

      return stats;
    } catch (error) {
      console.error(
        'Erreur lors du calcul des statistiques de paiement legacy:',
        error,
      );
      return null;
    }
  }

  /**
   * Vérifier si un client existe dans ___XTR_CUSTOMER
   */
  async checkLegacyCustomerExists(customerId: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/___xtr_customer?cst_id=eq.${customerId}&select=cst_id`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        return false;
      }

      const customers = await response.json();
      return customers.length > 0;
    } catch (error) {
      console.error('Erreur lors de la vérification du client legacy:', error);
      return false;
    }
  }

  /**
   * Vérifier si une commande existe dans ___XTR_ORDER
   */
  async checkLegacyOrderExists(orderId: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/___xtr_order?ord_id=eq.${orderId}&select=ord_id`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        return false;
      }

      const orders = await response.json();
      return orders.length > 0;
    } catch (error) {
      console.error(
        'Erreur lors de la vérification de la commande legacy:',
        error,
      );
      return false;
    }
  }
}
