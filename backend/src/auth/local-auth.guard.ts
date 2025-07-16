import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();
    console.log('--- LocalAuthGuard canActivate ---');
    console.log('Request method:', request.method);
    console.log('Request URL:', request.url);
    console.log('Request body:', request.body);
    console.log('Request headers:', request.headers);
    
    const canBeActivated = (await super.canActivate(context)) as boolean;
    await super.logIn(request);
    return canBeActivated;
  }

  handleRequest(err: any, user: any, info: any) {
    console.log('LocalAuthGuard handleRequest:', { err, user, info });
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication failed');
    }
    return user;
  }
}
