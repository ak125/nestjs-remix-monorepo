import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SupabaseRestService } from '../database/supabase-rest.service';

@Injectable()
export class RemixService {
  constructor(
    public readonly supabaseRestService: SupabaseRestService,
    public readonly auth: AuthService,
  ) {}

  public readonly getUser = async ({ userId }: { userId: string }) => {
    console.log('--- Début de getUser (RemixService) ---');
    console.log('Recherche utilisateur avec ID:', userId);
    
    try {
      const user = await this.supabaseRestService.getUserById(userId);
      
      if (user) {
        console.log('Utilisateur trouvé dans RemixService:', user);
        
        // Retourner les données dans le format attendu par le frontend
        return {
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
      }
      
      console.log('Utilisateur non trouvé dans RemixService');
      return null;
    } catch (error) {
      console.error('Erreur dans getUser (RemixService):', error);
      return null;
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
}
