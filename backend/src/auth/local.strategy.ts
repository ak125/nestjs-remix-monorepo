import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { IStrategyOptionsWithRequest, Strategy } from 'passport-local';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({
      passReqToCallback: true,
      usernameField: 'email',
    } as IStrategyOptionsWithRequest);
  }

  async validate(request: Request, email: string, password: string) {
    console.log('--- LocalStrategy validate ---');
    console.log('Email:', email);
    console.log('Password:', password);

    const user = await this.authService.authenticateUser(email, password);
    console.log('Résultat authenticateUser:', user);

    if (!user || user.error) {
      console.log('Authentification échouée');
      return false;
    }

    console.log('Authentification réussie:', user);
    return user;
  }
}