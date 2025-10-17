/**
 * 🔧 SERVICE USERS FINAL - Logique Métier Consolidée
 * Intègre le cache Redis et toute la logique métier
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { UserDataConsolidatedService } from './services/user-data-consolidated.service';
import { CacheService } from '../../cache/cache.service';
import {
  User,
  CreateUserDto,
  UpdateUserDto,
  UserFilters,
  PaginatedUsers,
  UserStats,
  UserWithStats,
} from './dto/user.dto';

export interface DashboardData {
  user: User;
  stats: UserStats;
  recentOrders: any[];
  notifications: number;
}

export interface GlobalStats {
  totalUsers: number;
  activeUsers: number;
  proUsers: number;
  companyUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  averageLevel: number;
}

@Injectable()
export class UsersFinalService {
  private readonly logger = new Logger(UsersFinalService.name);
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly userDataService: UserDataConsolidatedService,
    private readonly cacheService: CacheService,
  ) {
    this.logger.log('✅ UsersFinalService initialized');
  }

  // ============================================================================
  // MÉTHODES PUBLIQUES - GESTION UTILISATEURS
  // ============================================================================

  /**
   * Récupérer un utilisateur par ID avec cache
   */
  async getUserById(userId: string): Promise<User> {
    const cacheKey = `user:${userId}`;
    const cached = this.cacheService.get<User>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for user ${userId}`);
      return cached;
    }

    const user = await this.userDataService.findById(userId);
    if (!user) {
      throw new NotFoundException(`Utilisateur ${userId} non trouvé`);
    }

    // Cache pour 5 minutes
    this.cacheService.set(cacheKey, user, this.CACHE_TTL);
    return user;
  }

  /**
   * Récupérer un utilisateur par email avec cache
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const cacheKey = `user:email:${email}`;
    const cached = this.cacheService.get<User | null>(cacheKey);

    if (cached !== null) {
      this.logger.debug(`Cache hit for email ${email}`);
      return cached;
    }

    const user = await this.userDataService.findByEmail(email);

    // Cache pour 5 minutes
    this.cacheService.set(cacheKey, user, this.CACHE_TTL);
    return user;
  }

  /**
   * Récupérer tous les utilisateurs avec filtres et pagination
   */
  async getAllUsers(filters: UserFilters): Promise<PaginatedUsers> {
    const cacheKey = `users:list:${JSON.stringify(filters)}`;
    const cached = this.cacheService.get<PaginatedUsers>(cacheKey);

    if (cached) {
      this.logger.debug('Cache hit for users list');
      return cached;
    }

    const result = await this.userDataService.findAll(filters);

    // Cache pour 2 minutes (liste change souvent)
    this.cacheService.set(cacheKey, result, 2 * 60 * 1000);
    return result;
  }

  /**
   * Créer un nouvel utilisateur
   */
  async createUser(userData: CreateUserDto): Promise<User> {
    // Vérifier si l'email existe déjà
    const existing = await this.getUserByEmail(userData.email);
    if (existing) {
      throw new Error('Un utilisateur avec cet email existe déjà');
    }

    const user = await this.userDataService.create(userData);

    // Invalider les caches
    this.invalidateUserCaches();

    this.logger.log(`✅ User created: ${user.id}`);
    return user;
  }

  /**
   * Mettre à jour un utilisateur
   */
  async updateUser(userId: string, updates: UpdateUserDto): Promise<User> {
    // Vérifier que l'utilisateur existe
    await this.getUserById(userId);

    // Si l'email change, vérifier qu'il n'existe pas déjà
    if (updates.email) {
      const existing = await this.getUserByEmail(updates.email);
      if (existing && existing.id !== userId) {
        throw new Error('Un utilisateur avec cet email existe déjà');
      }
    }

    const user = await this.userDataService.update(userId, updates);

    // Invalider les caches
    this.invalidateUserCache(userId);
    this.invalidateUserCaches();

    this.logger.log(`✅ User updated: ${userId}`);
    return user;
  }

  /**
   * Désactiver un utilisateur (soft delete)
   */
  async deleteUser(userId: string): Promise<boolean> {
    // Vérifier que l'utilisateur existe
    await this.getUserById(userId);

    const result = await this.userDataService.delete(userId);

    // Invalider les caches
    this.invalidateUserCache(userId);
    this.invalidateUserCaches();

    this.logger.log(`✅ User deleted: ${userId}`);
    return result;
  }

  /**
   * Réactiver un utilisateur
   */
  async reactivateUser(userId: string): Promise<User> {
    const user = await this.userDataService.reactivate(userId);

    // Invalider les caches
    this.invalidateUserCache(userId);
    this.invalidateUserCaches();

    this.logger.log(`✅ User reactivated: ${userId}`);
    return user;
  }

  /**
   * Mettre à jour le mot de passe
   */
  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    // Vérifier que l'utilisateur existe
    await this.getUserById(userId);

    const result = await this.userDataService.updatePassword(
      userId,
      newPassword,
    );

    this.logger.log(`✅ Password updated for user: ${userId}`);
    return result;
  }

  /**
   * Rechercher des utilisateurs
   */
  async searchUsers(searchTerm: string, limit = 20): Promise<User[]> {
    const cacheKey = `users:search:${searchTerm}:${limit}`;
    const cached = this.cacheService.get<User[]>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for search: ${searchTerm}`);
      return cached;
    }

    const users = await this.userDataService.search(searchTerm, limit);

    // Cache pour 1 minute
    this.cacheService.set(cacheKey, users, 60 * 1000);
    return users;
  }

  // ============================================================================
  // MÉTHODES PUBLIQUES - STATISTIQUES
  // ============================================================================

  /**
   * Obtenir les statistiques d'un utilisateur
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const cacheKey = `user:stats:${userId}`;
    const cached = this.cacheService.get<UserStats>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for user stats ${userId}`);
      return cached;
    }

    // Récupérer les commandes de l'utilisateur
    const orders = await this.userDataService.search(userId, 1000); // Workaround temporaire

    // Calculer les stats
    const stats: UserStats = {
      totalOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    };

    // Cache pour 10 minutes
    this.cacheService.set(cacheKey, stats, 10 * 60 * 1000);
    return stats;
  }

  /**
   * Obtenir les statistiques globales
   */
  async getGlobalStats(): Promise<GlobalStats> {
    const cacheKey = 'users:stats:global';
    const cached = this.cacheService.get<GlobalStats>(cacheKey);

    if (cached) {
      this.logger.debug('Cache hit for global stats');
      return cached;
    }

    const totalUsers = await this.userDataService.countActive();

    // Récupérer un échantillon pour calculer les stats
    const sampleUsers = await this.userDataService.findAll({
      page: 1,
      limit: 1000,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    const activeUsers = sampleUsers.users.filter((u) => u.isActive).length;
    const proUsers = sampleUsers.users.filter((u) => u.isPro).length;
    const companyUsers = sampleUsers.users.filter((u) => u.isCompany).length;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const newUsersToday = sampleUsers.users.filter(
      (u) => u.createdAt && u.createdAt >= today,
    ).length;
    const newUsersThisWeek = sampleUsers.users.filter(
      (u) => u.createdAt && u.createdAt >= weekAgo,
    ).length;
    const newUsersThisMonth = sampleUsers.users.filter(
      (u) => u.createdAt && u.createdAt >= monthAgo,
    ).length;

    const levels = sampleUsers.users.map((u) => u.level);
    const averageLevel =
      levels.length > 0
        ? Math.round(
            (levels.reduce((a, b) => a + b, 0) / levels.length) * 100,
          ) / 100
        : 1;

    const stats: GlobalStats = {
      totalUsers,
      activeUsers: Math.round(
        (activeUsers / sampleUsers.users.length) * totalUsers,
      ),
      proUsers: Math.round((proUsers / sampleUsers.users.length) * totalUsers),
      companyUsers: Math.round(
        (companyUsers / sampleUsers.users.length) * totalUsers,
      ),
      newUsersToday: Math.round(
        (newUsersToday / sampleUsers.users.length) * totalUsers,
      ),
      newUsersThisWeek: Math.round(
        (newUsersThisWeek / sampleUsers.users.length) * totalUsers,
      ),
      newUsersThisMonth: Math.round(
        (newUsersThisMonth / sampleUsers.users.length) * totalUsers,
      ),
      averageLevel,
    };

    // Cache pour 5 minutes
    this.cacheService.set(cacheKey, stats, 5 * 60 * 1000);
    return stats;
  }

  /**
   * Obtenir les données du dashboard utilisateur
   */
  async getDashboardData(userId: string): Promise<DashboardData> {
    const cacheKey = `user:dashboard:${userId}`;
    const cached = this.cacheService.get<DashboardData>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for dashboard ${userId}`);
      return cached;
    }

    const user = await this.getUserById(userId);
    const stats = await this.getUserStats(userId);

    const dashboard: DashboardData = {
      user,
      stats,
      recentOrders: [], // TODO: Intégrer avec OrdersService
      notifications: 0, // TODO: Intégrer avec NotificationsService
    };

    // Cache pour 2 minutes
    this.cacheService.set(cacheKey, dashboard, 2 * 60 * 1000);
    return dashboard;
  }

  // ============================================================================
  // MÉTHODES PUBLIQUES - UTILITAIRES
  // ============================================================================

  /**
   * Exporter les utilisateurs en CSV
   */
  async exportToCSV(filters: UserFilters): Promise<string> {
    // Récupérer tous les utilisateurs avec les filtres
    const allUsers = await this.userDataService.findAll({
      ...filters,
      limit: 10000, // Max pour export
    });

    // En-têtes CSV
    const headers = [
      'ID',
      'Email',
      'Prénom',
      'Nom',
      'Téléphone',
      'Ville',
      'Pays',
      'Type',
      'Niveau',
      'Statut',
      'Date création',
    ];

    // Lignes CSV
    const rows = allUsers.users.map((user) => [
      user.id,
      user.email,
      user.firstName || '',
      user.lastName || '',
      user.phone || '',
      user.city || '',
      user.country || '',
      user.isPro ? 'Pro' : user.isCompany ? 'Entreprise' : 'Particulier',
      user.level,
      user.isActive ? 'Actif' : 'Inactif',
      user.createdAt ? user.createdAt.toISOString().split('T')[0] : '',
    ]);

    // Créer le CSV
    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }

  // ============================================================================
  // MÉTHODES PRIVÉES - GESTION DU CACHE
  // ============================================================================

  /**
   * Invalider le cache d'un utilisateur spécifique
   */
  private invalidateUserCache(userId: string): void {
    this.cacheService.del(`user:${userId}`);
    this.cacheService.del(`user:stats:${userId}`);
    this.cacheService.del(`user:dashboard:${userId}`);
  }

  /**
   * Invalider tous les caches utilisateurs (listes, stats globales)
   */
  private invalidateUserCaches(): void {
    // TODO: Implémenter delPattern() dans CacheService
    // this.cacheService.delPattern('users:*');
    this.logger.warn('invalidateUserCaches: delPattern non implémenté');
  }
}
