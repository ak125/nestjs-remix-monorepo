import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class IsAdminGuard implements CanActivate {
  private readonly logger = new Logger(IsAdminGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.log(
      `IsAdminGuard - User: ${user?.email}, isAdmin: ${user?.isAdmin}, level: ${user?.level}`,
    );

    // Vérifier si l'utilisateur est admin (niveau 7+ pour admin, 9 pour superadmin)
    const isAdmin = user?.isAdmin === true || parseInt(user?.level) >= 7;

    if (!isAdmin) {
      this.logger.warn(`Access denied for user: ${user?.email || 'unknown'}`);
    } else {
      this.logger.log(`Admin access granted for: ${user?.email}`);
    }

    return isAdmin;
  }
}
