import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fetch as undiciFetch } from 'undici';
import { getAppConfig } from '../../config/app.config';
import { RpcGateService } from '../../security/rpc-gate/rpc-gate.service';
import { RpcGateContext } from '../../security/rpc-gate/rpc-gate.types';
import {
  SupabaseRpcError,
  RpcBlockedError,
} from '../../security/rpc-gate/rpc-gate.errors';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

/**
 * 🚀 Sémaphore global pour limiter les connexions concurrentes à Supabase
 * Plan Small = max ~60 connexions, on limite à 20 pour laisser de la marge
 */
class ConnectionSemaphore {
  private current = 0;
  private readonly max: number;
  private readonly queue: Array<() => void> = [];

  constructor(maxConcurrent: number) {
    this.max = maxConcurrent;
  }

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve();
      });
    });
  }

  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }

  get stats() {
    return { current: this.current, max: this.max, queued: this.queue.length };
  }
}

// Singleton global - 20 connexions max pour le plan Small
const supabaseSemaphore = new ConnectionSemaphore(20);

@Injectable()
export abstract class SupabaseBaseService {
  protected readonly logger = new Logger(SupabaseBaseService.name);
  protected readonly supabase: SupabaseClient;
  protected readonly supabaseUrl: string;
  protected readonly supabaseServiceKey: string;
  protected readonly baseUrl: string;

  // Circuit breaker pour éviter de surcharger Supabase en cas d'erreurs
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    state: 'closed',
  };
  private readonly maxFailures = 5;
  private readonly resetTimeout = 60000; // 1 minute
  private readonly halfOpenAttempts = 3;

  // RPC Safety Gate - Optional injection by child services
  protected rpcGate?: RpcGateService;

  // Kill-switch DEV: Track if running in read-only mode
  protected readonly isDevKillSwitchEnabled: boolean;

  constructor(protected configService?: ConfigService) {
    // Context7 : Resilient configuration loading
    const appConfig = getAppConfig();

    // Essayer d'utiliser ConfigService en premier, sinon utiliser la config centralisée
    if (configService) {
      this.supabaseUrl =
        configService.get<string>('SUPABASE_URL') || appConfig.supabase.url;
      this.supabaseServiceKey =
        configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
        appConfig.supabase.serviceKey;
    } else {
      this.supabaseUrl = appConfig.supabase.url;
      this.supabaseServiceKey = appConfig.supabase.serviceKey;
    }

    if (!this.supabaseUrl) {
      throw new Error('SUPABASE_URL not found in environment variables');
    }

    if (!this.supabaseServiceKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY not found in environment variables',
      );
    }

    // 🔒 Kill-switch DEV: Use dev_readonly key in non-production when enabled
    this.isDevKillSwitchEnabled =
      process.env.NODE_ENV !== 'production' &&
      process.env.DEV_KILL_SWITCH === 'true';

    let effectiveKey = this.supabaseServiceKey;
    if (this.isDevKillSwitchEnabled && process.env.DEV_SUPABASE_KEY) {
      effectiveKey = process.env.DEV_SUPABASE_KEY;
      this.logger.warn(
        '🔒 Kill-switch DEV: Using dev_readonly key (READ-ONLY mode)',
      );
    }

    this.baseUrl = `${this.supabaseUrl}/rest/v1`;

    // Créer le client Supabase
    // 🔥 CRITIQUE: service_role bypasse automatiquement RLS
    // 🔒 Kill-switch DEV: dev_readonly key = SELECT-only, pas de bypass RLS
    // 🚀 AMÉLIORATION: Timeout augmenté à 30s et keepAlive activé pour éviter ETIMEDOUT
    this.supabase = createClient(this.supabaseUrl, effectiveKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-client-info': 'supabase-js-node',
        },
        fetch: async (url, init) => {
          // ✅ FIX: Utilisation de undici.fetch pour éviter les conflits de polyfill (web-streams-polyfill)
          // ✅ FIX: Timeout strict de 15s via AbortSignal.timeout (Node 22+)

          let signal: AbortSignal;
          try {
            // Utiliser AbortSignal.timeout si disponible (Node 17.3+)
            const timeoutSignal = AbortSignal.timeout(15000);

            // Combiner avec le signal existant si présent (AbortSignal.any Node 20+)
            if (init?.signal) {
              signal = AbortSignal.any([
                init.signal as AbortSignal,
                timeoutSignal,
              ]);
            } else {
              signal = timeoutSignal;
            }
          } catch {
            // Fallback pour environnements plus anciens (ne devrait pas arriver en Node 22)
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 15000);
            signal = controller.signal;
          }

          // 🚀 OPTIMISATION: Utiliser le sémaphore pour limiter les connexions concurrentes
          await supabaseSemaphore.acquire();
          try {
            // Cast explicite pour satisfaire les types de Supabase qui attendent le fetch global
            const response = await undiciFetch(
              url as string,
              {
                ...init,
                signal: signal,
              } as any,
            );
            return response as unknown as Response;
          } catch (error: any) {
            if (
              error.name === 'TimeoutError' ||
              error.name === 'AbortError' ||
              error.code === 'UND_ERR_CONNECT_TIMEOUT'
            ) {
              this.logger.error(`❌ Supabase Request Timeout (15s) for ${url}`);
              throw new Error('Supabase Request Timeout (15s)');
            }
            throw error;
          } finally {
            supabaseSemaphore.release();
          }
        },
      },
    });

    this.logger.log('✅ SupabaseBaseService initialized');
    this.logger.log(`📍 URL: ${this.supabaseUrl}`);
    this.logger.log(
      `🔑 Service key present: ${this.supabaseServiceKey ? 'Yes' : 'No'}`,
    );
    if (this.isDevKillSwitchEnabled) {
      this.logger.warn(`🔒 Kill-switch DEV: ACTIVE - READ-ONLY mode enabled`);
      this.logger.warn(`🔓 RLS: NOT bypassed (using dev_readonly role)`);
    } else {
      this.logger.log(`🔓 RLS: Bypassed automatically with service_role key`);
    }
  }

  /**
   * Expose le client Supabase pour les classes héritées
   */
  get client(): SupabaseClient {
    return this.supabase;
  }

  protected get headers() {
    return {
      'Content-Type': 'application/json',
      apikey: this.supabaseServiceKey,
      Authorization: `Bearer ${this.supabaseServiceKey}`,
      Prefer: 'return=representation',
    };
  }

  /**
   * Test de connexion Supabase
   */
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

  /**
   * Wrapper pour exécuter des requêtes avec retry et circuit breaker
   * 🚀 AMÉLIORATION: Gère aussi les timeouts ETIMEDOUT
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries = 3,
  ): Promise<T | null> {
    // Vérifier l'état du circuit breaker
    if (!this.canExecute()) {
      this.logger.warn(
        `Circuit breaker OPEN - Opération ${operationName} bloquée`,
      );
      return null;
    }

    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();

        // Succès - réinitialiser le circuit breaker
        this.onSuccess();
        return result;
      } catch (error: any) {
        lastError = error;

        // Vérifier le type d'erreur pour décider si on retry
        const isCloudflareError =
          error?.message?.includes('500 Internal Server Error') ||
          error?.message?.includes('cloudflare');

        const isTimeoutError =
          error?.code === 'ETIMEDOUT' ||
          error?.errno === 'ETIMEDOUT' ||
          error?.type === 'system' ||
          error?.message?.includes('ETIMEDOUT') ||
          error?.message?.includes('timeout');

        const isNetworkError =
          error?.code === 'ECONNRESET' ||
          error?.code === 'ECONNREFUSED' ||
          error?.code === 'ENOTFOUND';

        const shouldRetry =
          isCloudflareError || isTimeoutError || isNetworkError;

        if (shouldRetry) {
          const errorType = isTimeoutError
            ? 'TIMEOUT'
            : isNetworkError
              ? 'NETWORK'
              : 'CLOUDFLARE';

          this.logger.warn(
            `⚠️ ${errorType} error lors de ${operationName} (tentative ${attempt}/${maxRetries}): ${error?.message}`,
          );
          this.onFailure();

          // Attendre avant de réessayer (exponential backoff)
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s
            this.logger.log(
              `⏳ Attente de ${delay}ms avant nouvelle tentative...`,
            );
            await this.sleep(delay);
          }
        } else {
          // Autre type d'erreur - ne pas réessayer
          this.logger.error(
            `❌ Erreur non-retryable lors de ${operationName}:`,
            error,
          );
          throw error;
        }
      }
    }

    this.logger.error(
      `Échec de ${operationName} après ${maxRetries} tentatives`,
      lastError,
    );
    return null;
  }

  /**
   * Vérifier si on peut exécuter une requête (circuit breaker)
   */
  private canExecute(): boolean {
    const now = Date.now();

    switch (this.circuitBreaker.state) {
      case 'closed':
        return true;

      case 'open':
        // Vérifier si on peut passer en half-open
        if (now - this.circuitBreaker.lastFailure > this.resetTimeout) {
          this.logger.log('Circuit breaker: OPEN → HALF-OPEN');
          this.circuitBreaker.state = 'half-open';
          this.circuitBreaker.failures = 0;
          return true;
        }
        return false;

      case 'half-open':
        return this.circuitBreaker.failures < this.halfOpenAttempts;

      default:
        return true;
    }
  }

  /**
   * Enregistrer un succès
   */
  private onSuccess(): void {
    if (this.circuitBreaker.state === 'half-open') {
      this.logger.log('Circuit breaker: HALF-OPEN → CLOSED (succès détecté)');
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failures = 0;
    }
  }

  /**
   * Enregistrer un échec
   */
  private onFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (
      this.circuitBreaker.state === 'closed' &&
      this.circuitBreaker.failures >= this.maxFailures
    ) {
      this.logger.warn(
        `Circuit breaker: CLOSED → OPEN (${this.circuitBreaker.failures} échecs consécutifs)`,
      );
      this.circuitBreaker.state = 'open';
    } else if (this.circuitBreaker.state === 'half-open') {
      this.logger.warn('Circuit breaker: HALF-OPEN → OPEN (échec détecté)');
      this.circuitBreaker.state = 'open';
    }
  }

  /**
   * Utilitaire pour attendre
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Obtenir l'état du circuit breaker (pour monitoring)
   */
  getCircuitBreakerStatus(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  /**
   * Safe RPC call with governance check via RPC Safety Gate
   *
   * This method wraps supabase.rpc() to:
   * 1. Evaluate the call against allowlist/denylist
   * 2. Block dangerous functions based on mode/level
   * 3. Preserve full Supabase error details
   * 4. Log decisions with sampling
   *
   * @param rpcName - Name of the RPC function to call
   * @param params - Parameters to pass to the RPC function
   * @param context - Optional context for gate evaluation (role, userId, source)
   * @returns Object with data and error (error is SupabaseRpcError or RpcBlockedError)
   */
  protected async callRpc<T>(
    rpcName: string,
    params: Record<string, unknown>,
    context: RpcGateContext = {},
  ): Promise<{
    data: T | null;
    error: SupabaseRpcError | RpcBlockedError | null;
  }> {
    const startTime = Date.now();

    // Evaluate gate (if injected)
    const { decision, reason } = this.rpcGate?.evaluate(rpcName, context) ?? {
      decision: 'ALLOW' as const,
      reason: 'GATE_NOT_INJECTED',
    };

    // Block if decision is BLOCK
    if (decision === 'BLOCK') {
      const error = new RpcBlockedError(rpcName, reason);
      this.rpcGate?.log(
        rpcName,
        decision,
        reason,
        context,
        Date.now() - startTime,
        error,
      );
      return { data: null, error };
    }

    // Execute the RPC call
    try {
      const { data, error: rawError } = await this.supabase.rpc(
        rpcName,
        params,
      );

      const rpcError = rawError ? new SupabaseRpcError(rawError) : null;
      this.rpcGate?.log(
        rpcName,
        decision,
        reason,
        context,
        Date.now() - startTime,
        rpcError ?? undefined,
      );

      return { data: data as T, error: rpcError };
    } catch (err) {
      const error = new SupabaseRpcError(err);
      this.rpcGate?.log(
        rpcName,
        decision,
        reason,
        context,
        Date.now() - startTime,
        error,
      );
      return { data: null, error };
    }
  }
}
