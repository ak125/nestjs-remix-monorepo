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

    const isAdmin = user?.isAdmin === true || parseInt(user?.level) >= 7;

    if (!isAdmin) {
      this.logger.warn(`Admin access denied: ${user?.email || 'anonymous'}`);
    }

    return isAdmin;
  }
}
