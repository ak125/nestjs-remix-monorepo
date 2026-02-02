/**
 * 🔌 CIRCUIT BREAKER SERVICE - AI Provider Resilience
 *
 * Implements the Circuit Breaker pattern for AI providers:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Provider failing, requests blocked, fallback to next provider
 * - HALF_OPEN: Testing if provider recovered
 *
 * Features:
 * - Tracks failures per provider
 * - Opens circuit after N consecutive failures
 * - Auto-recovery after timeout (half-open state)
 * - Metrics for monitoring
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening (default: 5)
  resetTimeout: number; // Milliseconds before half-open (default: 60000)
  halfOpenSuccessThreshold: number; // Successes needed to close (default: 2)
}

export interface ProviderCircuit {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  openedAt: Date | null;
  totalRequests: number;
  totalFailures: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, ProviderCircuit>();
  private readonly config: CircuitBreakerConfig;

  // Provider priority order for failover
  private readonly providerOrder = [
    'anthropic',
    'groq',
    'huggingface',
    'openai',
  ];

  constructor(private configService: ConfigService) {
    this.config = {
      failureThreshold: this.configService.get<number>(
        'AI_CIRCUIT_FAILURE_THRESHOLD',
        5,
      ),
      resetTimeout: this.configService.get<number>(
        'AI_CIRCUIT_RESET_TIMEOUT',
        60000, // 1 minute
      ),
      halfOpenSuccessThreshold: this.configService.get<number>(
        'AI_CIRCUIT_HALF_OPEN_THRESHOLD',
        2,
      ),
    };

    // Initialize circuits for all providers
    this.providerOrder.forEach((name) => this.initializeCircuit(name));

    this.logger.log('🔌 Circuit Breaker initialized');
    this.logger.log(
      `   Failure threshold: ${this.config.failureThreshold} failures`,
    );
    this.logger.log(`   Reset timeout: ${this.config.resetTimeout / 1000}s`);
  }

  private initializeCircuit(name: string): void {
    this.circuits.set(name, {
      name,
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      lastFailure: null,
      lastSuccess: null,
      openedAt: null,
      totalRequests: 0,
      totalFailures: 0,
    });
  }

  /**
   * Check if a provider's circuit allows requests
   */
  canRequest(provider: string): boolean {
    const circuit = this.circuits.get(provider);
    if (!circuit) return false;

    switch (circuit.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if enough time has passed to try again
        if (circuit.openedAt) {
          const elapsed = Date.now() - circuit.openedAt.getTime();
          if (elapsed >= this.config.resetTimeout) {
            this.transitionToHalfOpen(provider);
            return true;
          }
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open state
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(provider: string): void {
    const circuit = this.circuits.get(provider);
    if (!circuit) return;

    circuit.totalRequests++;
    circuit.lastSuccess = new Date();
    circuit.successes++;
    circuit.failures = 0; // Reset consecutive failures

    if (circuit.state === CircuitState.HALF_OPEN) {
      if (circuit.successes >= this.config.halfOpenSuccessThreshold) {
        this.transitionToClosed(provider);
      }
    }

    this.logger.debug(`✅ ${provider} success recorded`);
  }

  /**
   * Record a failed request
   */
  recordFailure(provider: string, error?: Error): void {
    const circuit = this.circuits.get(provider);
    if (!circuit) return;

    circuit.totalRequests++;
    circuit.totalFailures++;
    circuit.lastFailure = new Date();
    circuit.failures++;
    circuit.successes = 0; // Reset consecutive successes

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Immediate reopening on failure in half-open
      this.transitionToOpen(provider);
    } else if (circuit.failures >= this.config.failureThreshold) {
      this.transitionToOpen(provider);
    }

    this.logger.warn(
      `❌ ${provider} failure #${circuit.failures}: ${error?.message || 'Unknown error'}`,
    );
  }

  /**
   * Get the next available provider for failover
   */
  getNextAvailableProvider(excludeProvider?: string): string | null {
    for (const provider of this.providerOrder) {
      if (provider !== excludeProvider && this.canRequest(provider)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Get all providers that can currently accept requests
   */
  getAvailableProviders(): string[] {
    return this.providerOrder.filter((provider) => this.canRequest(provider));
  }

  /**
   * Get circuit status for all providers (for monitoring)
   */
  getCircuitStatus(): Record<string, ProviderCircuit> {
    const status: Record<string, ProviderCircuit> = {};
    this.circuits.forEach((circuit, name) => {
      status[name] = { ...circuit };
    });
    return status;
  }

  /**
   * Get metrics summary
   */
  getMetrics(): {
    providers: Record<
      string,
      {
        state: CircuitState;
        failureRate: number;
        totalRequests: number;
      }
    >;
    availableProviders: string[];
    openCircuits: string[];
  } {
    const providers: Record<
      string,
      {
        state: CircuitState;
        failureRate: number;
        totalRequests: number;
      }
    > = {};

    const openCircuits: string[] = [];

    this.circuits.forEach((circuit, name) => {
      const failureRate =
        circuit.totalRequests > 0
          ? (circuit.totalFailures / circuit.totalRequests) * 100
          : 0;

      providers[name] = {
        state: circuit.state,
        failureRate: Math.round(failureRate * 100) / 100,
        totalRequests: circuit.totalRequests,
      };

      if (circuit.state === CircuitState.OPEN) {
        openCircuits.push(name);
      }
    });

    return {
      providers,
      availableProviders: this.getAvailableProviders(),
      openCircuits,
    };
  }

  /**
   * Force reset a circuit (for manual recovery)
   */
  resetCircuit(provider: string): void {
    const circuit = this.circuits.get(provider);
    if (circuit) {
      this.initializeCircuit(provider);
      this.logger.log(`🔄 ${provider} circuit manually reset`);
    }
  }

  /**
   * Force reset all circuits
   */
  resetAllCircuits(): void {
    this.providerOrder.forEach((provider) => this.resetCircuit(provider));
    this.logger.log('🔄 All circuits reset');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🔒 PRIVATE STATE TRANSITIONS
  // ════════════════════════════════════════════════════════════════════════════

  private transitionToOpen(provider: string): void {
    const circuit = this.circuits.get(provider);
    if (!circuit) return;

    circuit.state = CircuitState.OPEN;
    circuit.openedAt = new Date();

    this.logger.warn(`🔴 Circuit OPENED for ${provider}`);
    this.logger.warn(`   Will retry in ${this.config.resetTimeout / 1000}s`);
  }

  private transitionToHalfOpen(provider: string): void {
    const circuit = this.circuits.get(provider);
    if (!circuit) return;

    circuit.state = CircuitState.HALF_OPEN;
    circuit.successes = 0;

    this.logger.log(`🟡 Circuit HALF_OPEN for ${provider} - testing recovery`);
  }

  private transitionToClosed(provider: string): void {
    const circuit = this.circuits.get(provider);
    if (!circuit) return;

    circuit.state = CircuitState.CLOSED;
    circuit.failures = 0;
    circuit.openedAt = null;

    this.logger.log(`🟢 Circuit CLOSED for ${provider} - recovered!`);
  }
}
