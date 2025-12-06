import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard pour protéger l'application des erreurs de logging non-critiques
 *
 * En mode développement, les timeouts Supabase sur ___xtr_msg ne doivent pas
 * bloquer l'application. Ce guard capture ces erreurs silencieusement.
 */
@Injectable()
export class SupabaseLoggerGuard {
  private readonly logger = new Logger(SupabaseLoggerGuard.name);
  private readonly isDevelopment: boolean;
  private readonly silentMode: boolean;

  constructor(private configService?: ConfigService) {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.silentMode =
      this.configService?.get<boolean>('SUPABASE_RESILIENT_MODE', true) ?? true;
  }

  /**
   * Exécute une opération de logging de manière silencieuse
   * En cas d'erreur, log en DEBUG uniquement (pas en ERROR)
   */
  async safeLog<T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T | null> {
    if (this.silentMode && this.isDevelopment) {
      try {
        return await operation();
      } catch (error: any) {
        // Log en niveau DEBUG uniquement
        this.logger.debug(
          `⚠️ Logging non-critique échoué (${context}): ${error?.message || 'Unknown error'}`,
        );
        return null;
      }
    }

    // En production, laisser l'erreur se propager
    return await operation();
  }

  /**
   * Vérifie si une erreur est un timeout Supabase
   */
  isSupabaseTimeout(error: any): boolean {
    return (
      error?.code === 'ETIMEDOUT' ||
      error?.message?.includes('ETIMEDOUT') ||
      error?.message?.includes('timeout')
    );
  }

  /**
   * Vérifie si l'opération concerne la table ___xtr_msg (non critique)
   */
  isNonCriticalTable(tableName: string): boolean {
    const nonCriticalTables = ['___xtr_msg', 'system_logs', 'audit_logs'];
    return nonCriticalTables.includes(tableName);
  }
}
