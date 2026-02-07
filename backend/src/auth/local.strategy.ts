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
      usernameField: 'email', // Changé de 'username' à 'email' pour correspondre au formulaire
    } as IStrategyOptionsWithRequest);

    this.logger.log(
      `LocalStrategy constructor - AuthService: ${!!this.authService}`,
    );
    if (this.authService) {
      this.logger.log(
        `AuthService methods: ${JSON.stringify(Object.getOwnPropertyNames(Object.getPrototypeOf(this.authService)))}`,
      );
    } else {
      this.logger.error('AuthService est undefined dans le constructeur');
    }
  }

  async validate(request: Request, username: string, password: string) {
    this.logger.log('--- LocalStrategy validate ---');
    this.logger.log(`Username: ${username}`);
    this.logger.log(`Password: ${password}`);
    this.logger.log(`AuthService disponible: ${!!this.authService}`);
    this.logger.log(
      `Méthode authenticateUser disponible: ${typeof this.authService?.authenticateUser}`,
    );

    if (
      !this.authService ||
      typeof this.authService.authenticateUser !== 'function'
    ) {
      this.logger.error('AuthService ou authenticateUser non disponible');
      return false;
    }

    try {
      const user = await this.authService.authenticateUser(username, password);
      this.logger.log(`Résultat authenticateUser: ${JSON.stringify(user)}`);

      if (!user || user.error) {
        this.logger.log('Authentification échouée');
        return false;
      }

      this.logger.log(`Authentification réussie: ${JSON.stringify(user)}`);
      return user;
    } catch (error) {
      this.logger.error(`Erreur lors de l'authentification: ${error}`);
      return false;
    }
  }
}
