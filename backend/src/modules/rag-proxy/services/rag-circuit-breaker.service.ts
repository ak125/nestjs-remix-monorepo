import { Injectable, Logger } from '@nestjs/common';
import { ExternalServiceException } from '../../../common/exceptions';

/** Simple circuit breaker state for the RAG external service. */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const CB_THRESHOLD = 5; // failures before opening
const CB_RESET_MS = 30_000; // 30s before half-open probe

@Injectable()
export class RagCircuitBreakerService {
  private readonly logger = new Logger(RagCircuitBreakerService.name);
  private readonly cb: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    state: 'closed',
  };

  /** Check circuit breaker before calling RAG service. Throws if open. */
  public cbGuard(): void {
    if (this.cb.state === 'open') {
      if (Date.now() - this.cb.lastFailure > CB_RESET_MS) {
        this.cb.state = 'half-open';
        this.logger.log('Circuit breaker → half-open (probing RAG service)');
      } else {
        throw new ExternalServiceException({
          message:
            'Le service RAG est temporairement indisponible. Réessayez dans quelques secondes.',
          serviceName: 'rag',
          code: 'EXTERNAL.CIRCUIT_OPEN',
        });
      }
    }
  }

  /** Record a successful call — resets the circuit breaker. */
  public cbSuccess(): void {
    if (this.cb.state !== 'closed') {
      this.logger.log('Circuit breaker → closed (RAG service recovered)');
    }
    this.cb.failures = 0;
    this.cb.state = 'closed';
  }

  /** Record a failed call — may open the circuit breaker. */
  public cbFailure(): void {
    this.cb.failures++;
    this.cb.lastFailure = Date.now();
    if (this.cb.failures >= CB_THRESHOLD) {
      this.cb.state = 'open';
      this.logger.warn(
        `Circuit breaker → open after ${this.cb.failures} failures (cooldown ${CB_RESET_MS}ms)`,
      );
    }
  }
}
