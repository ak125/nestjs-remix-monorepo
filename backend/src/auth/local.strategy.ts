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

    console.log(
      '🔧 LocalStrategy constructor - AuthService:',
      !!this.authService,
    );
    if (this.authService) {
      console.log(
        '🔧 AuthService methods:',
        Object.getOwnPropertyNames(Object.getPrototypeOf(this.authService)),
      );
    } else {
      console.error('❌ AuthService est undefined dans le constructeur');
    }
  }

  async validate(request: Request, username: string, password: string) {
    console.log('--- LocalStrategy validate ---');
    console.log('Username:', username);
    console.log('Password:', password);
    console.log('🔧 AuthService disponible:', !!this.authService);
    console.log(
      '🔧 Méthode authenticateUser disponible:',
      typeof this.authService?.authenticateUser,
    );

    if (
      !this.authService ||
      typeof this.authService.authenticateUser !== 'function'
    ) {
      console.error('❌ AuthService ou authenticateUser non disponible');
      return false;
    }

    try {
      const user = await this.authService.authenticateUser(username, password);
      console.log('Résultat authenticateUser:', user);

      if (!user || user.error) {
        console.log('Authentification échouée');
        return false;
      }

      console.log('Authentification réussie:', user);
      return user;
    } catch (error) {
      console.error("❌ Erreur lors de l'authentification:", error);
      return false;
    }
  }
}
