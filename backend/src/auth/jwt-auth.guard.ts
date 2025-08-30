import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * Guard JWT pour protéger les endpoints admin
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    this.logger.log(`🔒 JwtAuthGuard checking: ${request.method} ${request.url}`);
    this.logger.log(`🔑 Authorization header: ${request.headers.authorization ? 'Present' : 'Missing'}`);
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    this.logger.log(`🔐 JwtAuthGuard handleRequest - Error: ${err}, User: ${user ? JSON.stringify(user) : 'null'}, Info: ${info}`);
    
    if (err || !user) {
      throw err || new UnauthorizedException('JWT authentication failed');
    }
    return user;
  }
}
