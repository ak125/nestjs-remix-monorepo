/**
 * Utilitaires pour les environnements de test uniquement
 * ⚠️  NE PAS UTILISER EN PRODUCTION
 */

export class TestHelpers {
  /**
   * Retourne les credentials de test UNIQUEMENT en dev/test
   * Lance une erreur en production
   */
  static getTestCredentials() {
    const env = process.env.NODE_ENV;

    if (env === 'production') {
      throw new Error(
        'Les credentials de test ne sont pas disponibles en production',
      );
    }

    return {
      admin: {
        email: 'admin@test.local',
        password: 'SuperAdmin123!',
        warning: '⚠️  CREDENTIALS DE TEST - NE PAS UTILISER EN PRODUCTION',
      },
      user: {
        email: 'user@test.local',
        password: 'TestUser123!',
        warning: '⚠️  CREDENTIALS DE TEST - NE PAS UTILISER EN PRODUCTION',
      },
    };
  }

  /**
   * Vérifie si on est en environnement de test
   */
  static isTestEnvironment(): boolean {
    return ['development', 'test', 'staging'].includes(
      process.env.NODE_ENV || '',
    );
  }

  /**
   * Log un warning pour les données de test
   */
  static logTestWarning(message: string) {
    if (this.isTestEnvironment()) {
      console.warn(`\n${'='.repeat(60)}`);
      console.warn('⚠️  ENVIRONNEMENT DE TEST');
      console.warn(message);
      console.warn(`${'='.repeat(60)}\n`);
    }
  }
}
