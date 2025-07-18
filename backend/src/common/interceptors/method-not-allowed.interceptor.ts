import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class MethodNotAllowedInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // Vérifier si la méthode PATCH est utilisée sur les routes orders
    if (request.method === 'PATCH' && request.url.includes('/api/orders')) {
      throw new HttpException('Méthode non autorisée', HttpStatus.METHOD_NOT_ALLOWED);
    }
    
    return next.handle();
  }
}
