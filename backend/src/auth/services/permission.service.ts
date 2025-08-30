import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { RedisCacheService } from '../../database/services/redis-cache.service';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface UserPermission {
  userId: string;
  permissions: Permission[];
  roles: string[];
  level: number;
}

@Injectable()
export class PermissionService extends SupabaseBaseService {
  protected readonly logger = new Logger(PermissionService.name);
  private readonly PERMISSIONS_TABLE = '___AUTH_PERMISSIONS';
  private readonly USER_PERMISSIONS_TABLE = '___AUTH_USER_PERMISSIONS';
  private readonly ROLES_TABLE = '___AUTH_ROLES';

  constructor(private readonly cacheService: RedisCacheService) {
    super();
  }

  /**
   * Vérifier si un utilisateur a une permission spécifique
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string = 'read',
  ): Promise<boolean> {
    const cacheKey = `permission:${userId}:${resource}:${action}`;
    
    try {
      // Vérifier en cache d'abord
      const cached = await this.cacheService.get(cacheKey);
      if (cached !== null) {
        return cached === 'true';
      }

      // Récupérer les permissions utilisateur
      const userPermissions = await this.getUserPermissions(userId, resource);
      
      // Vérifier la permission spécifique
      const hasPermission = userPermissions.some(
        perm => perm.resource === resource && perm.action === action
      );

      // Mettre en cache (5 minutes)
      await this.cacheService.set(cacheKey, hasPermission.toString(), 300);

      return hasPermission;
    } catch (error) {
      this.logger.error(`Error checking permission: ${error}`);
      return false;
    }
  }

  /**
   * Récupérer toutes les permissions d'un utilisateur pour une ressource
   */
  async getUserPermissions(userId: string, resource?: string): Promise<Permission[]> {
    const cacheKey = `user_permissions:${userId}${resource ? ':' + resource : ''}`;
    
    try {
      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Récupérer depuis la base via les rôles et permissions directes
      let query = this.supabase
        .from(this.USER_PERMISSIONS_TABLE)
        .select(`
          permission:${this.PERMISSIONS_TABLE}(*)
        `)
        .eq('user_id', userId);

      if (resource) {
        query = query.eq(`${this.PERMISSIONS_TABLE}.resource`, resource);
      }

      const { data: userPerms, error } = await query;

      if (error) {
        this.logger.error(`Error fetching user permissions: ${error}`);
        return [];
      }

      const permissions = userPerms
        ?.map((item) => item.permission)
        .filter(Boolean) || [];

      // Ajouter les permissions basées sur le niveau utilisateur (legacy)
      const legacyPermissions = await this.getLegacyPermissions(
        userId,
        resource,
      );
      const allPermissions = [...permissions, ...legacyPermissions];

      // Mettre en cache (10 minutes)
      await this.cacheService.set(
        cacheKey,
        JSON.stringify(allPermissions),
        600,
      );

      return allPermissions;
    } catch (error) {
      this.logger.error(`Error getting user permissions: ${error}`);
      return [];
    }
  }

  /**
   * Récupérer les permissions basées sur le système legacy (niveaux)
   */
  private async getLegacyPermissions(userId: string, resource?: string): Promise<Permission[]> {
    try {
      // Récupérer le niveau utilisateur depuis le système existant
      const userLevel = await this.getUserLevel(userId);
      
      if (!userLevel) return [];

      // Définir les permissions basées sur le niveau
      const levelPermissions: Record<number, Permission[]> = {
        1: [
          { id: 'read_basic', name: 'Lecture basique', resource: 'blog', action: 'read' },
        ],
        5: [
          { id: 'read_basic', name: 'Lecture basique', resource: 'blog', action: 'read' },
          { id: 'create_blog', name: 'Créer articles', resource: 'blog', action: 'create' },
          { id: 'edit_blog', name: 'Modifier articles', resource: 'blog', action: 'edit' },
        ],
        9: [
          { id: 'read_basic', name: 'Lecture basique', resource: 'blog', action: 'read' },
          { id: 'create_blog', name: 'Créer articles', resource: 'blog', action: 'create' },
          { id: 'edit_blog', name: 'Modifier articles', resource: 'blog', action: 'edit' },
          { id: 'delete_blog', name: 'Supprimer articles', resource: 'blog', action: 'delete' },
          { id: 'admin_blog', name: 'Admin blog', resource: 'blog', action: 'admin' },
          { id: 'manage_users', name: 'Gestion utilisateurs', resource: 'users', action: 'admin' },
        ]
      };

      const permissions = levelPermissions[userLevel] || [];
      
      // Filtrer par ressource si spécifiée
      return resource 
        ? permissions.filter(perm => perm.resource === resource)
        : permissions;

    } catch (error) {
      this.logger.error(`Error getting legacy permissions: ${error}`);
      return [];
    }
  }

  /**
   * Récupérer le niveau d'un utilisateur depuis le système existant
   */
  private async getUserLevel(userId: string): Promise<number | null> {
    try {
      // D'abord essayer dans customers
      const { data: customer } = await this.supabase
        .from('customers')
        .select('cst_level')
        .eq('cst_id', userId)
        .single();

      if (customer) {
        return parseInt(customer.cst_level) || 1;
      }

      // Ensuite essayer dans admins
      const { data: admin } = await this.supabase
        .from('cnf_admins')
        .select('cnfa_level')
        .eq('cnfa_id', userId)
        .single();

      if (admin) {
        return parseInt(admin.cnfa_level) || 9;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting user level: ${error}`);
      return null;
    }
  }

  /**
   * Assigner une permission à un utilisateur
   */
  async assignPermission(userId: string, permissionId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.USER_PERMISSIONS_TABLE)
        .insert({
          user_id: userId,
          permission_id: permissionId,
          assigned_at: new Date().toISOString(),
          assigned_by: 'system' // ou l'ID de l'admin qui assigne
        });

      if (error) {
        this.logger.error(`Error assigning permission: ${error}`);
        return false;
      }

      // Invalider le cache des permissions
      await this.invalidateUserPermissionsCache(userId);
      
      return true;
    } catch (error) {
      this.logger.error(`Error assigning permission: ${error}`);
      return false;
    }
  }

  /**
   * Révoquer une permission d'un utilisateur
   */
  async revokePermission(userId: string, permissionId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.USER_PERMISSIONS_TABLE)
        .delete()
        .eq('user_id', userId)
        .eq('permission_id', permissionId);

      if (error) {
        this.logger.error(`Error revoking permission: ${error}`);
        return false;
      }

      // Invalider le cache des permissions
      await this.invalidateUserPermissionsCache(userId);
      
      return true;
    } catch (error) {
      this.logger.error(`Error revoking permission: ${error}`);
      return false;
    }
  }

  /**
   * Invalider le cache des permissions pour un utilisateur
   */
  private async invalidateUserPermissionsCache(userId: string): Promise<void> {
    const patterns = [
      `permission:${userId}:*`,
      `user_permissions:${userId}*`
    ];

    for (const pattern of patterns) {
      try {
        // Note: Redis SCAN pour trouver les clés matchant le pattern
        // et les supprimer individuellement
        const keys = await this.cacheService.keys(pattern);
        if (keys.length > 0) {
          await Promise.all(keys.map(key => this.cacheService.del(key)));
        }
      } catch (error) {
        this.logger.warn(`Error invalidating cache pattern ${pattern}: ${error}`);
      }
    }
  }

  /**
   * Créer une nouvelle permission
   */
  async createPermission(permission: Omit<Permission, 'id'>): Promise<Permission | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.PERMISSIONS_TABLE)
        .insert({
          name: permission.name,
          resource: permission.resource,
          action: permission.action,
          description: permission.description,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        this.logger.error(`Error creating permission: ${error}`);
        return null;
      }

      return data as Permission;
    } catch (error) {
      this.logger.error(`Error creating permission: ${error}`);
      return null;
    }
  }

  /**
   * Lister toutes les permissions disponibles
   */
  async listPermissions(resource?: string): Promise<Permission[]> {
    try {
      let query = this.supabase
        .from(this.PERMISSIONS_TABLE)
        .select('*')
        .order('resource', { ascending: true })
        .order('action', { ascending: true });

      if (resource) {
        query = query.eq('resource', resource);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error(`Error listing permissions: ${error}`);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Error listing permissions: ${error}`);
      return [];
    }
  }
}
