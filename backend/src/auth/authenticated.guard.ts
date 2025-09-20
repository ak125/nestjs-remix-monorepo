import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  private readonly logger = new Logger(AuthenticatedGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const isAuthenticated = request.isAuthenticated();

    this.logger.log(
      `AuthenticatedGuard - Path: ${request.path}, Authenticated: ${isAuthenticated}, User: ${request.user?.email || 'none'}`,
    );

    return isAuthenticated;
  }
}
