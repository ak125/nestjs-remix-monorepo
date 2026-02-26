import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { IStrategyOptionsWithRequest, Strategy } from 'passport-local';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      passReqToCallback: true,
      usernameField: 'email',
    } as IStrategyOptionsWithRequest);
  }

  async validate(request: Request, username: string, password: string) {
    try {
      const user = await this.authService.authenticateUser(username, password);
      if (!user) return false;
      return user;
    } catch (error) {
      this.logger.error(
        `Authentication error for ${username}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
