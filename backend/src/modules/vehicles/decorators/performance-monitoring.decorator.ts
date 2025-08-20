import { SetMetadata, applyDecorators } from '@nestjs/common';

export const PERFORMANCE_MONITORING_KEY = 'performance_monitoring';

/**
 * 📊 Décorateur pour activer le monitoring automatique des performances
 * 
 * Usage:
 * @MonitorPerformance('models')
 * @Get('models')
 * async getModels() { ... }
 */
export function MonitorPerformance(endpointName: string) {
  return applyDecorators(
    SetMetadata(PERFORMANCE_MONITORING_KEY, endpointName)
  );
}

/**
 * 🎯 Intercepteur personnalisé pour capturer les métriques
 */
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { VehiclesPerformanceService } from '../services/vehicles-performance.service';
import { throwError } from 'rxjs';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    @Inject(VehiclesPerformanceService)
    private performanceService: VehiclesPerformanceService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const endpointName = this.reflector.get<string>(
      PERFORMANCE_MONITORING_KEY,
      context.getHandler(),
    );

    if (!endpointName) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const dataSize = JSON.stringify(data || {}).length;

        this.performanceService.recordMetric({
          endpoint: endpointName,
          method: request.method,
          duration,
          success: true,
          dataSize,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        this.performanceService.recordMetric({
          endpoint: endpointName,
          method: request.method,
          duration,
          success: false,
          errorMessage: error.message || 'Unknown error',
        });

        return throwError(() => error);
      }),
    );
  }
}
