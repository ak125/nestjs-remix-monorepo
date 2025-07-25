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
      usernameField: 'email', // Changé de 'username' à 'email' pour correspondre au formulaire
    } as IStrategyOptionsWithRequest);
  }

  async validate(request: Request, username: string, password: string) {
    console.log('--- LocalStrategy validate ---');
    console.log('Username:', username);
    console.log('Password:', password);

    const user = await this.authService.authenticateUser(username, password);
    console.log('Résultat authenticateUser:', user);

    if (!user || user.error) {
      console.log('Authentification échouée');
      return false;
    }

    console.log('Authentification réussie:', user);
    return user;
  }
}
