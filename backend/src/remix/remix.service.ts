import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SupabaseRestService } from '../database/supabase-rest.service';
import { CacheService } from '../cache/cache.service';
import { RemixIntegrationService } from './remix-integration.service';

@Injectable()
export class RemixService {
  constructor(
    public readonly supabaseRestService: SupabaseRestService,
    public readonly auth: AuthService,
    private readonly cacheService: CacheService,
    public readonly integration: RemixIntegrationService,
  ) {}

  public readonly getUser = async ({ userId }: { userId: string }) => {
    console.log('--- Début de getUser (RemixService) ---');
    console.log('Recherche utilisateur avec ID:', userId);
    
    try {
      // D'abord essayer de récupérer depuis le cache
      let cachedUser = null;
      try {
        cachedUser = await this.cacheService.getCachedUser(userId);
      } catch (error) {
        console.log('Erreur cache lors de la récupération:', error);
      }
      
      if (cachedUser) {
        console.log('Utilisateur trouvé dans le cache:', cachedUser);
        return cachedUser;
      }

      // Sinon, chercher dans la base de données
      const user = await this.supabaseRestService.getUserById(userId);
      
      if (user) {
        console.log('Utilisateur trouvé dans RemixService:', user);
        
        // Retourner les données dans le format attendu par le frontend
        const userResponse = {
          id: user.cst_id,
          email: user.cst_mail,
          firstName: user.cst_fname || 'Utilisateur',
          lastName: user.cst_name || 'Connecté',
          civility: user.cst_civility,
          address: user.cst_address,
          zipCode: user.cst_zip_code,
          city: user.cst_city,
          country: user.cst_country,
          tel: user.cst_tel,
          gsm: user.cst_gsm,
          isPro: user.cst_is_pro,
          isActive: user.cst_activ,
          level: user.cst_level,
        };

        // Mettre en cache pour les prochaines requêtes
        try {
          await this.cacheService.cacheUser(userId, userResponse);
        } catch (error) {
          console.log('Erreur cache lors de la mise en cache:', error);
        }

        return userResponse;
      }
      
      console.log('Utilisateur non trouvé dans RemixService');
      
      // Fallback : si l'utilisateur n'est pas trouvé dans la DB mais qu'il est authentifié,
      // on peut renvoyer des données minimales
      console.log('Tentative de fallback pour utilisateur authentifié');
      return {
        id: userId,
        email: 'utilisateur@example.com',
        firstName: 'Utilisateur',
        lastName: 'Connecté',
        isPro: false,
        isActive: true
      };
      
    } catch (error) {
      console.error('Erreur dans getUser (RemixService):', error);
      
      // En cas d'erreur, retourner des données minimales pour éviter le crash
      return {
        id: userId,
        email: 'utilisateur@example.com',
        firstName: 'Utilisateur',
        lastName: 'Connecté',
        isPro: false,
        isActive: true
      };
    }
  };

  public readonly createUser = async (userData: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }) => {
    console.log('--- Début de createUser (RemixService) ---');
    console.log('Données utilisateur:', userData);
    
    try {
      const newUser = await this.auth.createUser({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: userData.password,
      });
      
      console.log('Résultat createUser:', newUser);
      return newUser;
    } catch (error) {
      console.error('Erreur dans createUser (RemixService):', error);
      return null;
    }
  };
  
  public readonly updateProfile = async (data: {
    userId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    tel?: string;
    address?: string;
    city?: string;
    zipCode?: string;
    country?: string;
  }) => {
    console.log('--- Début de updateProfile (RemixService) ---');
    console.log('Données reçues:', data);
    
    try {
      const result = await this.auth.updateUserProfile(data.userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        tel: data.tel,
        address: data.address,
        city: data.city,
        zipCode: data.zipCode,
        country: data.country
      });
      
      // Invalider le cache utilisateur
      try {
        await this.cacheService.invalidateUser(data.userId);
      } catch (error) {
        console.log('Erreur invalidation cache:', error);
      }
      
      return result;
    } catch (error) {
      console.error('Erreur dans updateProfile (RemixService):', error);
      throw error;
    }
  };
  
  public readonly changePassword = async (data: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }) => {
    console.log('--- Début de changePassword (RemixService) ---');
    
    try {
      const result = await this.auth.changePassword(
        data.userId,
        data.currentPassword,
        data.newPassword
      );
      
      return result;
    } catch (error) {
      console.error('Erreur dans changePassword (RemixService):', error);
      throw error;
    }
  };

  /**
   * Récupérer les commandes via le service d'intégration
   */
  public readonly getOrders = async (params: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    search?: string;
  }) => {
    console.log('--- Début de getOrders (RemixService) ---');
    console.log('Paramètres:', params);
    
    try {
      const result = await this.integration.getOrdersForRemix(params);
      console.log('Résultat getOrders:', result.total, 'commandes trouvées');
      return result;
    } catch (error) {
      console.error('Erreur dans getOrders (RemixService):', error);
      throw error;
    }
  };
}
