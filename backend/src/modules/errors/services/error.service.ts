import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ErrorLogService } from './error-log.service';
import { RedirectService } from './redirect.service';
import { ErrorLog } from '../entities/error-log.entity';

@Injectable()
export class ErrorService {
  private readonly logger = new Logger(ErrorService.name);

  constructor(
    private readonly errorLogService: ErrorLogService,
    private readonly redirectService: RedirectService,
  ) {}

  /**
   * Gère une erreur 404 et tente de trouver une redirection ou suggestion
   * Amélioré avec suggestions intelligentes et analyse contextuelle
   */
  async handle404(request: Request): Promise<{
    shouldRedirect: boolean;
    redirectUrl?: string;
    statusCode?: number;
    suggestions?: string[];
    context?: any;
  }> {
    try {
      const path = request.path;

      // 1. Chercher une redirection existante
      const redirectRule = await this.redirectService.findRedirect(path);

      if (redirectRule) {
        // Couche de compatibilité intelligente pour les interfaces
        const redirectUrl = this.getRedirectDestination(redirectRule);
        const statusCode = this.getRedirectStatusCode(redirectRule);

        this.logger.log(`Redirection trouvée: ${path} -> ${redirectUrl}`);
        return {
          shouldRedirect: true,
          redirectUrl,
          statusCode,
        };
      }

      // 2. Chercher des suggestions intelligentes
      const suggestions = await this.findSuggestions(path);

      // 3. Créer un contexte enrichi pour l'erreur
      const errorContext = {
        originalPath: path,
        userAgent: request.get('User-Agent'),
        referer: request.get('Referer'),
        query: request.query,
        suggestions,
        timestamp: new Date().toISOString(),
      };

      // 4. Enregistrer l'erreur 404 avec contexte enrichi
      await this.log404Error(request, errorContext);

      return {
        shouldRedirect: false,
        suggestions,
        context: errorContext,
      };
    } catch (error) {
      this.logger.error('Erreur dans handle404:', error);
      return {
        shouldRedirect: false,
      };
    }
  }

  /**
   * Gère une erreur 410 (Gone) - ressource définitivement supprimée
   */
  async handle410(request: Request): Promise<{
    shouldRedirect: boolean;
    redirectUrl?: string;
    statusCode?: number;
    message?: string;
  }> {
    try {
      const path = request.path;

      // Chercher une redirection pour les ressources supprimées
      const redirectRule = await this.redirectService.findRedirect(path);

      if (redirectRule) {
        // Couche de compatibilité intelligente pour les interfaces
        const redirectUrl = this.getRedirectDestination(redirectRule);
        const statusCode = this.getRedirectStatusCode(redirectRule);

        this.logger.log(`Redirection 410 trouvée: ${path} -> ${redirectUrl}`);
        return {
          shouldRedirect: true,
          redirectUrl,
          statusCode,
        };
      }

      // Enregistrer l'erreur 410
      await this.log410Error(request);

      return {
        shouldRedirect: false,
        message: 'Cette ressource a été définitivement supprimée.',
      };
    } catch (error) {
      this.logger.error('Erreur dans handle410:', error);
      return {
        shouldRedirect: false,
        message: 'Ressource non disponible.',
      };
    }
  }

  /**
   * Gère une erreur 412 (Precondition Failed)
   */
  async handle412(
    request: Request,
    condition?: string,
  ): Promise<{
    shouldRetry: boolean;
    message: string;
    retryAfter?: number;
  }> {
    try {
      // Enregistrer l'erreur 412
      await this.log412Error(request, condition);

      return {
        shouldRetry: true,
        message: 'Condition préalable non remplie. Veuillez réessayer.',
        retryAfter: 5, // Suggérer de réessayer dans 5 secondes
      };
    } catch (error) {
      this.logger.error('Erreur dans handle412:', error);
      return {
        shouldRetry: false,
        message: 'Erreur de condition préalable.',
      };
    }
  }

  /**
   * Trouve des suggestions intelligentes pour une URL 404
   */
  private async findSuggestions(path: string): Promise<string[]> {
    try {
      const suggestions: string[] = [];

      // Analyser le chemin pour extraire des mots-clés
      const pathSegments = path
        .split('/')
        .filter((segment) => segment.length > 0);
      const keywords = pathSegments.map((segment) =>
        segment.replace(/[-_]/g, ' ').toLowerCase(),
      ); // Rechercher des chemins similaires dans les logs de succès
      const similarPaths = await this.findSimilarPaths(keywords);
      suggestions.push(...similarPaths);

      // Si c'est potentiellement un produit, chercher des produits similaires
      if (
        path.includes('/product') ||
        path.includes('/item') ||
        pathSegments.some((seg) => /^\d+$/.test(seg))
      ) {
        const productSuggestions = await this.findSimilarProducts(keywords);
        suggestions.push(...productSuggestions);
      }

      // Limiter à 5 suggestions
      return suggestions.slice(0, 5);
    } catch (error) {
      this.logger.error('Erreur dans findSuggestions:', error);
      return [];
    }
  }

  /**
   * Trouve des chemins similaires basés sur des mots-clés
   */
  private async findSimilarPaths(keywords: string[]): Promise<string[]> {
    try {
      // Cette méthode pourrait utiliser une recherche dans les logs d'accès
      // ou une base de données de routes connues
      const commonPaths = [
        '/products',
        '/categories',
        '/blog',
        '/contact',
        '/about',
        '/services',
        '/support',
      ];

      return commonPaths.filter((path) =>
        keywords.some((keyword) => path.includes(keyword)),
      );
    } catch (error) {
      this.logger.error('Erreur dans findSimilarPaths:', error);
      return [];
    }
  }

  /**
   * Trouve des produits similaires
   */
  private async findSimilarProducts(keywords: string[]): Promise<string[]> {
    try {
      // Implémentation basique - pourrait être améliorée avec une vraie recherche produit
      return [
        '/products/search?q=' + keywords.join('+'),
        '/categories',
        '/products/popular',
      ];
    } catch (error) {
      this.logger.error('Erreur dans findSimilarProducts:', error);
      return [];
    }
  }

  /**
   * Enregistre une erreur 404 dans les logs avec contexte enrichi
   */
  async log404Error(request: Request, context?: any): Promise<void> {
    try {
      const errorMetadata = {
        error_code: '404',
        error_message: `Page non trouvée: ${request.path}`,
        request_url: request.originalUrl || request.url,
        request_method: request.method,
        request_headers: this.sanitizeHeaders(request.headers),
        user_agent: request.get('User-Agent'),
        ip_address: this.getClientIp(request),
        severity: 'low' as const,
        environment: process.env.NODE_ENV || 'development',
        service_name: 'nestjs-remix-monorepo',
        additional_context: {
          query: request.query,
          referer: request.get('Referer'),
          ...context,
        },
      };

      const errorData: Partial<ErrorLog> = {
        msg_subject: 'ERROR_404',
        msg_content: JSON.stringify(errorMetadata),
        msg_date: new Date(),
        msg_open: '1', // Non résolu
        msg_close: '0', // Ouvert
        errorMetadata,
      };

      await this.errorLogService.logError(errorData);
    } catch (error) {
      this.logger.error("Erreur lors de l'enregistrement 404:", error);
    }
  }

  /**
   * Enregistre une erreur 410 dans les logs
   */
  async log410Error(request: Request): Promise<void> {
    try {
      const errorMetadata = {
        error_code: '410',
        error_message: `Ressource supprimée: ${request.path}`,
        request_url: request.originalUrl || request.url,
        request_method: request.method,
        request_headers: this.sanitizeHeaders(request.headers),
        user_agent: request.get('User-Agent'),
        ip_address: this.getClientIp(request),
        severity: 'medium' as const,
        environment: process.env.NODE_ENV || 'development',
        service_name: 'nestjs-remix-monorepo',
        additional_context: {
          query: request.query,
          referer: request.get('Referer'),
        },
      };

      const errorData: Partial<ErrorLog> = {
        msg_subject: 'ERROR_410',
        msg_content: JSON.stringify(errorMetadata),
        msg_date: new Date(),
        msg_open: '1',
        msg_close: '0',
        errorMetadata,
      };

      await this.errorLogService.logError(errorData);
    } catch (error) {
      this.logger.error("Erreur lors de l'enregistrement 410:", error);
    }
  }

  /**
   * Enregistre une erreur 412 dans les logs
   */
  async log412Error(request: Request, condition?: string): Promise<void> {
    try {
      const errorMetadata = {
        error_code: '412',
        error_message: `Condition préalable non remplie: ${condition || 'Non spécifiée'}`,
        request_url: request.originalUrl || request.url,
        request_method: request.method,
        request_headers: this.sanitizeHeaders(request.headers),
        user_agent: request.get('User-Agent'),
        ip_address: this.getClientIp(request),
        severity: 'medium' as const,
        environment: process.env.NODE_ENV || 'development',
        service_name: 'nestjs-remix-monorepo',
        additional_context: {
          query: request.query,
          condition,
          referer: request.get('Referer'),
        },
      };

      const errorData: Partial<ErrorLog> = {
        msg_subject: 'ERROR_412',
        msg_content: JSON.stringify(errorMetadata),
        msg_date: new Date(),
        msg_open: '1',
        msg_close: '0',
        errorMetadata,
      };

      await this.errorLogService.logError(errorData);
    } catch (error) {
      this.logger.error("Erreur lors de l'enregistrement 412:", error);
    }
  }

  /**
   * Enregistre une erreur générale
   */
  async logError(
    error: Error,
    request?: Request,
    context?: Record<string, any>,
  ): Promise<void> {
    try {
      const severity = this.determineSeverity(error);

      const errorMetadata: any = {
        error_code: error.name || 'UnknownError',
        error_message: error.message,
        stack_trace: error.stack,
        severity,
        environment: process.env.NODE_ENV || 'development',
        service_name: 'nestjs-remix-monorepo',
        additional_context: context,
      };

      if (request) {
        errorMetadata.request_url = request.originalUrl || request.url;
        errorMetadata.request_method = request.method;
        errorMetadata.request_headers = this.sanitizeHeaders(request.headers);
        errorMetadata.request_body = this.sanitizeBody(request.body);
        errorMetadata.user_agent = request.get('User-Agent');
        errorMetadata.ip_address = this.getClientIp(request);
      }

      const errorData: Partial<ErrorLog> = {
        msg_subject: `ERROR_${error.name || 'UNKNOWN'}`,
        msg_content: JSON.stringify(errorMetadata),
        msg_date: new Date(),
        msg_open: '1',
        msg_close: '0',
        errorMetadata,
      };

      await this.errorLogService.logError(errorData);
    } catch (logError) {
      this.logger.error("Erreur lors de l'enregistrement:", logError);
    }
  }

  /**
   * Récupère les erreurs avec pagination
   */
  async getErrors(options: {
    page?: number;
    limit?: number;
    severity?: string;
    resolved?: boolean;
  }) {
    return this.errorLogService.getErrors(options);
  }

  /**
   * Récupère les métriques d'erreurs
   */
  async getErrorMetrics(period: '24h' | '7d' | '30d' = '24h') {
    return this.errorLogService.getErrorMetrics(period);
  }

  /**
   * Marque une erreur comme résolue
   */
  async resolveError(errorId: string, resolvedBy: string): Promise<boolean> {
    return this.errorLogService.resolveError(errorId, resolvedBy);
  }

  /**
   * Génère un rapport des erreurs fréquentes (version améliorée)
   */
  async getFrequentErrorsReport(): Promise<{
    frequent_404s: Array<{
      path: string;
      count: number;
      last_occurrence: Date;
    }>;
    frequent_errors: Array<{
      code: string;
      message: string;
      count: number;
      severity: string;
    }>;
  }> {
    try {
      const { data: errors } = await this.errorLogService.getErrors({
        limit: 1000,
      });

      // Analyser les 404s fréquents
      const path404s = errors
        .filter((error) => {
          // Parser les métadonnées pour trouver les erreurs 404
          try {
            const metadata =
              error.errorMetadata || JSON.parse(error.msg_content || '{}');
            return (
              metadata.error_code === '404' || error.msg_subject === 'ERROR_404'
            );
          } catch {
            return error.msg_subject === 'ERROR_404';
          }
        })
        .reduce(
          (acc, error) => {
            let path = '';
            try {
              const metadata =
                error.errorMetadata || JSON.parse(error.msg_content || '{}');
              path = this.extractPathFromMessage(metadata.error_message || '');
            } catch {
              path = error.msg_subject;
            }

            if (!acc[path]) {
              acc[path] = {
                count: 0,
                last_occurrence: error.msg_date,
              };
            }
            acc[path].count++;
            if (
              new Date(error.msg_date) > new Date(acc[path].last_occurrence)
            ) {
              acc[path].last_occurrence = error.msg_date;
            }
            return acc;
          },
          {} as Record<string, { count: number; last_occurrence: Date }>,
        );

      const frequent404s = Object.entries(path404s)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 20)
        .map(([path, data]) => ({
          path,
          count: data.count,
          last_occurrence: data.last_occurrence,
        }));

      // Analyser les autres erreurs fréquentes
      const errorCounts = errors
        .filter((error) => {
          try {
            const metadata =
              error.errorMetadata || JSON.parse(error.msg_content || '{}');
            return (
              metadata.error_code !== '404' && error.msg_subject !== 'ERROR_404'
            );
          } catch {
            return error.msg_subject !== 'ERROR_404';
          }
        })
        .reduce(
          (acc, error) => {
            try {
              const metadata =
                error.errorMetadata || JSON.parse(error.msg_content || '{}');
              const key = `${metadata.error_code || 'UNKNOWN'}|${metadata.error_message || 'No message'}|${metadata.severity || 'low'}`;
              acc[key] = (acc[key] || 0) + 1;
            } catch {
              const key = `${error.msg_subject}|No message|low`;
              acc[key] = (acc[key] || 0) + 1;
            }
            return acc;
          },
          {} as Record<string, number>,
        );

      const frequentErrors = Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([key, count]) => {
          const [code, message, severity] = key.split('|');
          return { code, message, count, severity };
        });

      return {
        frequent_404s: frequent404s,
        frequent_errors: frequentErrors,
      };
    } catch (error) {
      this.logger.error('Erreur dans getFrequentErrorsReport:', error);
      return {
        frequent_404s: [],
        frequent_errors: [],
      };
    }
  }

  /**
   * Détermine la sévérité d'une erreur
   */
  private determineSeverity(
    error: Error,
  ): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Erreurs critiques
    if (
      message.includes('database') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      stack.includes('uncaughtexception')
    ) {
      return 'critical';
    }

    // Erreurs importantes
    if (
      message.includes('validation') ||
      message.includes('authentication') ||
      message.includes('authorization') ||
      error.name === 'ValidationError'
    ) {
      return 'high';
    }

    // Erreurs moyennes
    if (
      message.includes('not found') ||
      message.includes('invalid') ||
      error.name === 'BadRequestException'
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Nettoie les headers sensibles
   */
  private sanitizeHeaders(headers: any): Record<string, any> {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Nettoie le body des requêtes sensibles
   */
  private sanitizeBody(body: any): any {
    if (!body) return null;

    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'credit_card',
      'ssn',
    ];

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      const result: any = Array.isArray(obj) ? [] : {};

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some((field) => lowerKey.includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Récupère l'IP du client
   */
  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Extrait le chemin du message d'erreur 404
   */
  private extractPathFromMessage(message: string): string {
    const match = message.match(/Page non trouvée: (.+)/);
    return match ? match[1] : message;
  }

  /**
   * Méthode publique pour obtenir des suggestions pour une URL donnée
   * Utilisée par l'API pour les appels depuis le frontend
   */
  async getSuggestionsForUrl(url: string): Promise<string[]> {
    try {
      // Créer un objet Request minimal pour la méthode privée
      const mockRequest = {
        path: url,
        originalUrl: url,
        url: url,
        headers: {},
        query: {},
        get: () => undefined,
      } as any;

      // Appeler la méthode privée avec les bons paramètres
      return await this.findSuggestions(url);
    } catch (error) {
      this.logger.error('Erreur dans getSuggestionsForUrl:', error);
      return [];
    }
  }

  /**
   * Couche de compatibilité intelligente pour extraire la destination
   * Fonctionne avec RedirectEntry ET RedirectRule
   */
  private getRedirectDestination(redirect: any): string {
    // RedirectEntry interface (code utilisateur original)
    if (redirect.destination) {
      return redirect.destination;
    }
    // RedirectRule interface (nouvelle architecture)
    if (redirect.destination_path) {
      return redirect.destination_path;
    }
    // Fallback sécurisé
    return redirect.target || redirect.to || '/';
  }

  /**
   * Couche de compatibilité intelligente pour extraire le code de statut
   * Fonctionne avec RedirectEntry ET RedirectRule
   */
  private getRedirectStatusCode(redirect: any): number {
    // RedirectRule interface (nouvelle architecture)
    if (redirect.status_code) {
      return redirect.status_code;
    }
    // RedirectEntry interface (code utilisateur original)
    if (redirect.permanent === true) {
      return 301; // Permanent redirect
    }
    if (redirect.permanent === false) {
      return 302; // Temporary redirect
    }
    // Fallback par défaut
    return 302;
  }

  /**
   * Type guard pour détecter le type de redirection
   */
  private isRedirectEntry(redirect: any): boolean {
    return (
      redirect &&
      typeof redirect.source === 'string' &&
      typeof redirect.destination === 'string' &&
      typeof redirect.permanent === 'boolean'
    );
  }

  /**
   * Type guard pour détecter RedirectRule
   */
  private isRedirectRule(redirect: any): boolean {
    return redirect && redirect.destination_path && redirect.status_code;
  }
}
