/**
 * Configuration Pino Logger
 * - JSON structuré en production
 * - Pretty print coloré en développement
 * - Redaction des données sensibles
 */
import { Params } from 'nestjs-pino';

const isProd = process.env.NODE_ENV === 'production';

export const loggerConfig: Params = {
  pinoHttp: {
    // Niveau de log selon l'environnement
    level: isProd ? 'info' : 'debug',

    // Pretty print en dev, JSON brut en prod
    transport: !isProd
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,

    // Redaction des données sensibles
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.creditCard',
        'req.body.cardNumber',
        'res.headers["set-cookie"]',
      ],
      censor: '[REDACTED]',
    },

    // Serializers personnalisés pour réduire la verbosité
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        id: req.id,
        // Inclure query params pour debug
        ...(req.query && Object.keys(req.query).length > 0
          ? { query: req.query }
          : {}),
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },

    // Génération d'ID de requête pour traçabilité
    genReqId: (req) => {
      return (
        (req.headers['x-request-id'] as string) ||
        `req-${Date.now()}-${Math.random().toString(36).substring(7)}`
      );
    },

    // Custom log level selon le status code
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },

    // Messages personnalisés
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode} - Error`;
    },

    // Ne pas logger les health checks en prod
    autoLogging: {
      ignore: (req) => {
        const url = req.url || '';
        // Ignorer health checks et assets statiques
        return (
          url === '/health' ||
          url.startsWith('/assets/') ||
          url.startsWith('/build/') ||
          url.endsWith('.ico')
        );
      },
    },
  },
};
