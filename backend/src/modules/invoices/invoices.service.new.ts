/**
 * 🧾 SERVICE INVOICES - Version Production
 *
 * Gestion des factures utilisant les vraies tables :
 * - ___xtr_invoice : Table principale des factures
 * - ___xtr_invoice_line : Lignes détaillées des factures
 * - ___xtr_customer : Informations clients
 * - Cache intelligent 5min TTL
 * - Architecture alignée ManufacturersModule
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseBaseService } from '../../common/services/supabase-base.service';

interface Invoice {
  inv_id: string;
  inv_ord_id: string;
  inv_cst_id: string;
  inv_date: string;
  inv_amount_ht: string;
  inv_total_ht: string;
  inv_amount_ttc: string;
  inv_total_ttc: string;
  inv_info?: any;
}

interface InvoiceLine {
  invl_id: string;
  invl_inv_id: string;
  invl_pg_id: string;
  invl_pg_name: string;
  invl_pm_id: string;
  invl_pm_name: string;
  invl_art_ref: string;
  invl_art_quantity: string;
  invl_art_price_sell_unit_ttc: string;
  invl_art_price_sell_ttc: string;
}

interface Customer {
  cst_id: string;
  cst_mail: string;
  cst_name: string;
  cst_fname: string;
  cst_address: string;
  cst_zip_code: string;
  cst_city: string;
  cst_country: string;
  cst_tel?: string;
  cst_is_pro: string;
}

@Injectable()
export class InvoicesService extends SupabaseBaseService {
  private readonly logger = new Logger(InvoicesService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
  ) {
    super(cacheManager);
  }

  /**
   * 📋 Récupérer toutes les factures avec pagination
   */
  async getAllInvoices(page: number = 1, limit: number = 20) {
    const cacheKey = `invoices:all:page_${page}:limit_${limit}`;
    
    try {
      // Vérifier le cache
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cachedData;
      }

      const offset = (page - 1) * limit;

      // Récupérer les factures avec informations client
      const { data, error } = await this.client
        .from('___xtr_invoice')
        .select(`
          *,
          customer:___xtr_customer!inv_cst_id(cst_id, cst_name, cst_fname, cst_mail, cst_city)
        `)
        .range(offset, offset + limit - 1)
        .order('inv_date', { ascending: false });

      if (error) {
        this.logger.error('Erreur lors de la récupération des factures:', error);
        throw new Error('Impossible de récupérer les factures');
      }

      // Compter le total pour la pagination
      const { count } = await this.client
        .from('___xtr_invoice')
        .select('*', { count: 'exact', head: true });

      const result = {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      };

      // Mettre en cache
      await this.setCachedData(cacheKey, result, this.CACHE_TTL);
      this.logger.log(`Récupération de ${data?.length || 0} factures (page ${page})`);

      return result;
    } catch (error) {
      this.logger.error('Erreur dans getAllInvoices:', error);
      throw error;
    }
  }

  /**
   * 🔍 Récupérer une facture par ID avec ses lignes
   */
  async getInvoiceById(invoiceId: string) {
    const cacheKey = `invoice:detail:${invoiceId}`;

    try {
      // Vérifier le cache
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cachedData;
      }

      // Récupérer la facture principale
      const { data: invoice, error: invoiceError } = await this.client
        .from('___xtr_invoice')
        .select(`
          *,
          customer:___xtr_customer!inv_cst_id(*)
        `)
        .eq('inv_id', invoiceId)
        .single();

      if (invoiceError || !invoice) {
        this.logger.warn(`Facture ${invoiceId} non trouvée`);
        return null;
      }

      // Récupérer les lignes de la facture
      const { data: lines, error: linesError } = await this.client
        .from('___xtr_invoice_line')
        .select('*')
        .eq('invl_inv_id', invoiceId)
        .order('invl_id');

      if (linesError) {
        this.logger.error('Erreur lors de la récupération des lignes:', linesError);
      }

      const result = {
        ...invoice,
        lines: lines || []
      };

      // Mettre en cache
      await this.setCachedData(cacheKey, result, this.CACHE_TTL);
      this.logger.log(`Facture ${invoiceId} récupérée avec ${lines?.length || 0} lignes`);

      return result;
    } catch (error) {
      this.logger.error('Erreur dans getInvoiceById:', error);
      throw error;
    }
  }

  /**
   * 👥 Récupérer les factures d'un client
   */
  async getInvoicesByCustomer(customerId: string, page: number = 1, limit: number = 10) {
    const cacheKey = `invoices:customer:${customerId}:page_${page}:limit_${limit}`;

    try {
      // Vérifier le cache
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cachedData;
      }

      const offset = (page - 1) * limit;

      const { data, error } = await this.client
        .from('___xtr_invoice')
        .select('*')
        .eq('inv_cst_id', customerId)
        .range(offset, offset + limit - 1)
        .order('inv_date', { ascending: false });

      if (error) {
        this.logger.error('Erreur lors de la récupération des factures client:', error);
        throw new Error('Impossible de récupérer les factures du client');
      }

      const { count } = await this.client
        .from('___xtr_invoice')
        .select('*', { count: 'exact', head: true })
        .eq('inv_cst_id', customerId);

      const result = {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      };

      await this.setCachedData(cacheKey, result, this.CACHE_TTL);
      this.logger.log(`Récupération de ${data?.length || 0} factures pour le client ${customerId}`);

      return result;
    } catch (error) {
      this.logger.error('Erreur dans getInvoicesByCustomer:', error);
      throw error;
    }
  }

  /**
   * 📊 Statistiques des factures
   */
  async getInvoiceStats() {
    const cacheKey = 'invoices:stats';

    try {
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      // Compter le total des factures
      const { count: totalInvoices } = await this.client
        .from('___xtr_invoice')
        .select('*', { count: 'exact', head: true });

      // Calculer le montant total
      const { data: amountData } = await this.client
        .from('___xtr_invoice')
        .select('inv_total_ttc');

      const totalAmount = amountData?.reduce((sum, invoice) => {
        return sum + parseFloat(invoice.inv_total_ttc || '0');
      }, 0) || 0;

      const result = {
        totalInvoices: totalInvoices || 0,
        totalAmount: totalAmount,
        averageAmount: totalInvoices ? totalAmount / totalInvoices : 0,
        lastUpdated: new Date().toISOString()
      };

      await this.setCachedData(cacheKey, result, this.CACHE_TTL * 2); // Cache plus long pour les stats
      this.logger.log('Statistiques des factures calculées');

      return result;
    } catch (error) {
      this.logger.error('Erreur dans getInvoiceStats:', error);
      throw error;
    }
  }

  /**
   * 🗑️ Nettoyer le cache des factures
   */
  async clearInvoiceCache() {
    try {
      const patterns = ['invoices:*', 'invoice:*'];
      
      for (const pattern of patterns) {
        await this.clearCachePattern(pattern);
      }
      
      this.logger.log('Cache des factures nettoyé');
      return { success: true, message: 'Cache nettoyé avec succès' };
    } catch (error) {
      this.logger.error('Erreur lors du nettoyage du cache:', error);
      throw error;
    }
  }
}
