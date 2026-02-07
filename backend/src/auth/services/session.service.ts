import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { DatabaseException, ErrorCodes } from '../../common/exceptions';

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionOptions {
  maxAge?: number; // en millisecondes
  secure?: boolean;
  httpOnly?: boolean;
}

@Injectable()
export class SessionService extends SupabaseBaseService {
  private readonly DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000; // 24h
  private readonly SESSION_TABLE = '___AUTH_SESSIONS';

  /**
   * Créer une nouvelle session
   */
  async createSession(
    sessionId: string,
    sessionData: SessionData,
    options: SessionOptions = {},
  ): Promise<void> {
    const maxAge = options.maxAge || this.DEFAULT_MAX_AGE;
    const expiresAt = new Date(Date.now() + maxAge);

    try {
      const { error } = await this.supabase.from(this.SESSION_TABLE).insert({
        session_id: sessionId,
        user_id: sessionData.userId,
        email: sessionData.email,
        role: sessionData.role,
        permissions: sessionData.permissions,
        last_activity: sessionData.lastActivity.toISOString(),
        ip_address: sessionData.ipAddress,
        user_agent: sessionData.userAgent,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.DATABASE.OPERATION_FAILED,
          message: `Erreur création session: ${error.message}`,
          details: error.message,
        });
      }

      this.logger.log(`Session créée pour utilisateur ${sessionData.userId}`);
    } catch (error) {
      this.logger.error(`Erreur création session: ${error}`);
      throw error;
    }
  }

  /**
   * Récupérer les données d'une session
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.SESSION_TABLE)
        .select('*')
        .eq('session_id', sessionId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      return {
        userId: data.user_id,
        email: data.email,
        role: data.role,
        permissions: data.permissions || [],
        lastActivity: new Date(data.last_activity),
        ipAddress: data.ip_address,
        userAgent: data.user_agent,
      };
    } catch (error) {
      this.logger.error(`Erreur récupération session: ${error}`);
      return null;
    }
  }

  /**
   * Mettre à jour l'activité d'une session
   */
  async updateSessionActivity(sessionId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.SESSION_TABLE)
        .update({
          last_activity: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);

      return !error;
    } catch (error) {
      this.logger.error(`Erreur mise à jour activité session: ${error}`);
      return false;
    }
  }

  /**
   * Supprimer une session (logout)
   */
  async destroySession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.SESSION_TABLE)
        .delete()
        .eq('session_id', sessionId);

      if (!error) {
        this.logger.log(`Session ${sessionId} supprimée`);
      }

      return !error;
    } catch (error) {
      this.logger.error(`Erreur suppression session: ${error}`);
      return false;
    }
  }

  /**
   * Nettoyer les sessions expirées
   */
  async cleanExpiredSessions(): Promise<number> {
    try {
      const { error } = await this.supabase
        .from(this.SESSION_TABLE)
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (!error) {
        this.logger.log('Sessions expirées nettoyées');
      }

      return 0;
    } catch (error) {
      this.logger.error(`Erreur nettoyage sessions: ${error}`);
      return 0;
    }
  }

  /**
   * Obtenir toutes les sessions actives d'un utilisateur
   */
  async getUserActiveSessions(userId: string): Promise<SessionData[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.SESSION_TABLE)
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('last_activity', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map((row) => ({
        userId: row.user_id,
        email: row.email,
        role: row.role,
        permissions: row.permissions || [],
        lastActivity: new Date(row.last_activity),
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
      }));
    } catch (error) {
      this.logger.error(`Erreur récupération sessions utilisateur: ${error}`);
      return [];
    }
  }

  /**
   * Vérifier si une session est valide
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session !== null;
  }

  /**
   * Prolonger la durée de vie d'une session
   */
  async extendSession(
    sessionId: string,
    additionalTime: number = this.DEFAULT_MAX_AGE,
  ): Promise<boolean> {
    try {
      const newExpiryTime = new Date(Date.now() + additionalTime);

      const { error } = await this.supabase
        .from(this.SESSION_TABLE)
        .update({
          expires_at: newExpiryTime.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);

      return !error;
    } catch (error) {
      this.logger.error(`Erreur prolongation session: ${error}`);
      return false;
    }
  }
}
