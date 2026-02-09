import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { SupabaseBaseService } from './supabase-base.service';

@Injectable()
export class RedisCacheService extends SupabaseBaseService {
  protected readonly logger = new Logger(RedisCacheService.name);
  private redis: Redis;

  constructor() {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
    });

    this.redis.on('connect', () => {
      this.logger.log('✅ Redis connecté avec succès');
    });

    this.redis.on('error', (err) => {
      this.logger.error('❌ Erreur Redis:', err);
    });
  }

  /**
   * 🚀 CACHE COMPLET DES COMMANDES AVEC RELATIONS
   */
  async getCachedOrdersWithRelations(
    page: number = 1,
    limit: number = 10,
  ): Promise<any[]> {
    const cacheKey = `orders:enriched:page:${page}:limit:${limit}`;

    try {
      // 1. Essayer d'abord le cache Redis
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.log(`🎯 Cache HIT pour les commandes page ${page}`);
        return JSON.parse(cached);
      }

      this.logger.log(`🔄 Cache MISS - Chargement des commandes page ${page}`);

      // 2. Si pas en cache, charger depuis Supabase
      const enrichedOrders = await this.loadAndEnrichOrders(page, limit);

      // 3. Mettre en cache pour 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(enrichedOrders));

      this.logger.log(`✅ Commandes page ${page} mises en cache Redis`);
      return enrichedOrders;
    } catch (error) {
      this.logger.error(`❌ Erreur cache commandes:`, error);
      return [];
    }
  }

  /**
   * Chargement des commandes avec enrichissement client manuel
   */
  private async loadAndEnrichOrders(
    page: number,
    limit: number,
  ): Promise<any[]> {
    const offset = (page - 1) * limit;

    try {
      // 1. Récupérer d'abord les commandes de la table '___xtr_order'
      const ordersQuery = `${this.baseUrl}/___xtr_order?order=ord_date.desc&limit=${limit}&offset=${offset}&select=*`;
      this.logger.log(`📡 Récupération des commandes: ${ordersQuery}`);

      const ordersResponse = await fetch(ordersQuery, {
        method: 'GET',
        headers: this.headers,
      });

      if (!ordersResponse.ok) {
        this.logger.error(
          `Erreur HTTP ${ordersResponse.status} pour les commandes`,
        );
        return [];
      }

      const orders = await ordersResponse.json();
      if (!Array.isArray(orders) || orders.length === 0) {
        this.logger.warn('Aucune commande trouvée');
        return [];
      }

      this.logger.log(`✅ ${orders.length} commandes récupérées`);

      // 2. Extraire les IDs clients uniques
      const customerIds = [
        ...new Set(
          orders
            .map((order) => order.ord_cst_id)
            .filter((id) => id && id !== 'null' && id !== ''),
        ),
      ];

      this.logger.log(
        `� ${customerIds.length} clients uniques à enrichir: [${customerIds.slice(0, 5).join(', ')}...]`,
      );

      // 3. Récupérer les données clients en une seule requête
      const customersData = await this.batchGetCustomers(customerIds);

      // 4. Enrichir les commandes avec les données clients
      const enrichedOrders = orders.map((order) => ({
        ...order,
        customer: customersData[order.ord_cst_id] || {
          cst_id: order.ord_cst_id,
          cst_name: 'Client introuvable',
          cst_fname: '',
          cst_mail: 'Email non disponible',
          cst_activ: '0',
        },
      }));

      this.logger.log(
        `🔗 Enrichissement terminé pour ${enrichedOrders.length} commandes`,
      );
      return enrichedOrders;
    } catch (error) {
      this.logger.error(
        'Erreur chargement et enrichissement commandes:',
        error,
      );
      return [];
    }
  }

  /**
   * Récupération en lot des données clients depuis Supabase
   */
  private async batchGetCustomers(
    customerIds: string[],
  ): Promise<Record<string, any>> {
    try {
      if (!Array.isArray(customerIds) || customerIds.length === 0) {
        return {};
      }

      // Valider et nettoyer les IDs clients
      const sanitizedIds = this.sanitizeCustomerIds(customerIds);

      if (sanitizedIds.length === 0) {
        this.logger.warn('Aucun ID client valide après validation');
        return {};
      }

      if (sanitizedIds.length !== customerIds.length) {
        this.logger.warn(
          `${customerIds.length - sanitizedIds.length} IDs clients filtrés pour sécurité`,
        );
      }

      const idsParam = sanitizedIds.map((id) => `"${id}"`).join(',');
      const customersQuery = `${this.baseUrl}/___xtr_customer?cst_id=in.(${idsParam})&select=cst_id,cst_name,cst_fname,cst_mail,cst_activ,cst_tel,cst_city`;

      this.logger.log(`👥 Requête clients batch: ${customersQuery}`);

      const customersResponse = await fetch(customersQuery, {
        method: 'GET',
        headers: this.headers,
      });

      if (!customersResponse.ok) {
        this.logger.error(
          `Erreur HTTP ${customersResponse.status} pour les clients batch`,
        );
        return {};
      }

      const customers = await customersResponse.json();
      this.logger.log(
        `✅ ${Array.isArray(customers) ? customers.length : 0} clients récupérés en batch`,
      );

      // Convertir en map pour lookup rapide
      const customersMap: Record<string, any> = {};
      if (Array.isArray(customers)) {
        customers.forEach((customer) => {
          if (customer.cst_id) {
            customersMap[customer.cst_id] = customer;
          }
        });
      }

      return customersMap;
    } catch (error) {
      this.logger.error('Erreur récupération batch clients:', error);
      return {};
    }
  }

  /**
   * Invalidation du cache
   */
  async invalidateOrderCache(orderId?: string): Promise<void> {
    try {
      if (orderId) {
        const pattern = `*order*${orderId}*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        const patterns = ['orders:*'];
        for (const pattern of patterns) {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Erreur invalidation cache:`, error);
    }
  }

  /**
   * 📊 Statistiques du cache enrichies
   */
  async getCacheStats(): Promise<{
    connected?: boolean;
    keyCount?: number;
    memory?: string;
    hits?: number;
    misses?: number;
    hitRate?: number;
    timestamp?: string;
    error?: string;
  }> {
    try {
      const info = await this.redis.info('memory');
      const statsInfo = await this.redis.info('stats');
      const keyCount = await this.redis.dbsize();

      // Parser les statistiques Redis
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memoryUsed = memoryMatch ? memoryMatch[1] : 'N/A';

      const hitsMatch = statsInfo.match(/keyspace_hits:(\d+)/);
      const missesMatch = statsInfo.match(/keyspace_misses:(\d+)/);
      const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0;
      const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
      const hitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0;

      return {
        connected: this.redis.status === 'ready',
        keyCount,
        memory: memoryUsed,
        hits,
        misses,
        hitRate: Math.round(hitRate * 100) / 100,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur stats cache:`, message);
      return { error: message };
    }
  }

  /**
   * 🗑️ Invalidation par namespace
   */
  async invalidateNamespace(namespace: string): Promise<number> {
    try {
      const pattern = `${namespace}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(
          `🗑️ ${keys.length} clés supprimées pour namespace: ${namespace}`,
        );
        return keys.length;
      }
      return 0;
    } catch (error) {
      this.logger.error(
        `❌ Erreur invalidation namespace ${namespace}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Validation et nettoyage des IDs clients pour éviter les injections SQL
   */
  private sanitizeCustomerIds(customerIds: string[]): string[] {
    return customerIds
      .filter((id) => {
        // Valider que l'ID est uniquement numérique ou alphanumerique simple
        const isValid =
          /^[a-zA-Z0-9_-]+$/.test(id) &&
          !id.includes(';') &&
          !id.includes('--') &&
          !id.includes('DROP') &&
          !id.includes('DELETE') &&
          !id.includes('INSERT') &&
          !id.includes('UPDATE') &&
          id.length < 50; // Limite raisonnable pour un ID

        if (!isValid) {
          this.logger.warn(`🚨 ID client malveillant détecté et filtré: ${id}`);
        }

        return isValid;
      })
      .slice(0, 1000); // Limite le nombre d'IDs pour éviter les URL trop longues
  }

  /**
   * 🎯 Méthode principale : Cache wrapper générique avec retry Supabase
   * Utiliser pour wrapper n'importe quelle fonction async
   */
  async cached<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    ttl: number = 3600,
    namespace: string = 'app',
  ): Promise<T> {
    const fullKey = `${namespace}:${cacheKey}`;
    const startTime = Date.now();

    try {
      // 1️⃣ Vérifier cache
      const cached = await this.get(fullKey);
      if (cached !== null) {
        const duration = Date.now() - startTime;
        this.logger.log(`✅ Cache HIT: ${fullKey} (${duration}ms)`);
        return cached as T;
      }

      // 2️⃣ Cache MISS - Fetch data avec retry Supabase
      this.logger.log(`🔍 Cache MISS: ${fullKey}`);

      const data = await fetchFn();

      // 3️⃣ Stocker en cache
      await this.set(fullKey, data, ttl);

      const duration = Date.now() - startTime;
      this.logger.log(
        `💾 Cached: ${fullKey} (fetch: ${duration}ms, TTL: ${ttl}s)`,
      );

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Cache error for ${fullKey} after ${duration}ms:`,
        error,
      );
      // En cas d'erreur cache, on exécute quand même la fonction
      return fetchFn();
    }
  }

  /**
   * Méthodes de cache basiques pour compatibilité
   */
  async get(key: string): Promise<any> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`❌ Erreur Redis GET ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 600): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`❌ Erreur Redis SET ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.log(`🗑️ Clé supprimée du cache: ${key}`);
    } catch (error) {
      this.logger.error(`❌ Erreur Redis DEL ${key}:`, error);
    }
  }

  // Alias pour compatibilité
  async delete(key: string): Promise<void> {
    return this.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(
          `🗑️ ${keys.length} clés supprimées du cache avec le pattern: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Erreur Redis DEL PATTERN ${pattern}:`, error);
    }
  }

  /**
   * Fermeture propre de Redis
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('🔌 Redis déconnecté proprement');
    }
  }
}
