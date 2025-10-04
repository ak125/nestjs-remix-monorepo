import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Injectable()
export class CookieSerializer extends PassportSerializer {
  constructor(private readonly authService: AuthService) {
    super();
  }

  /**
   * ✅ DESERIALIZE: Récupérer l'utilisateur depuis la BDD à chaque requête
   * Évite le problème de "cache" où tous les utilisateurs voient le même compte
   */
  async deserializeUser(
    userId: string,
    done: (err: any, user?: any) => void,
  ) {
    try {
      console.log('🔍 Deserializing user ID:', userId);

      // Récupérer les données à jour depuis la base
      const user = await this.authService.getUserById(userId);

      if (!user) {
        console.log('⚠️  User not found during deserialization:', userId);
        return done(null, false);
      }

      console.log('✅ User deserialized:', user.email);
      done(null, user);
    } catch (error) {
      console.error('❌ Deserialization error:', error);
      done(error, null);
    }
  }

  /**
   * ✅ SERIALIZE: Sauvegarder UNIQUEMENT l'ID utilisateur dans la session
   * Pas l'objet complet pour éviter les données obsolètes
   */
  serializeUser(user: any, done: (err: any, userId?: any) => void) {
    // Si user est undefined, false ou null, ne pas créer de session
    if (!user || user === false || user === null) {
      console.log(
        '⚠️  User is undefined/false/null, skipping session creation',
      );
      return done(null, false);
    }

    // ✅ Sauvegarder UNIQUEMENT l'ID (pas l'objet complet)
    const userId = user.id || user.cst_id || user.cnfa_id;

    if (!userId) {
      console.log('⚠️  No user ID found, cannot serialize:', user);
      return done(null, false);
    }

    console.log('✅ Serializing user ID:', userId, 'for email:', user.email);
    done(null, userId); // ⚠️ IMPORTANT: Ne stocker QUE l'ID
  }
}
