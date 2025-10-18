import { DriverConfig } from '../types';

/**
 * Configuration du driver IA et des agents
 */
export const config: DriverConfig = {
  rootPath: '/workspaces/nestjs-remix-monorepo',
  outputPath: '/workspaces/nestjs-remix-monorepo/ai-agents/reports',
  parallel: false, // Exécution séquentielle par défaut
  reportFormat: 'both',
  agents: [
    {
      type: 'cartographe',
      enabled: true,
      options: {
        includeNodeModules: false,
        includeDist: false,
        topFilesLimit: 50,
        weightDriftThreshold: 5, // ±5%
      },
    },
    {
      type: 'fichiers-massifs',
      enabled: true,
      options: {
        thresholds: {
          route: 400,      // lignes pour routes Remix
          service: 300,    // lignes pour services NestJS
          general: 500,    // lignes pour autres TS/TSX
        },
        top: 20,           // Top 20 fichiers massifs
      },
    },
    {
      type: 'detecteur-doublons',
      enabled: true,
      options: {
        minLines: 5,       // Minimum 5 lignes pour détecter une duplication
        minOccurrences: 3, // Clusters avec ≥3 occurrences
        top: 5,            // Top 5 clusters
      },
    },
    {
      type: 'graphe-imports',
      enabled: true,
      options: {
        maxCycles: 50,       // Nombre max de cycles à reporter
        includeDiagram: true, // Générer diagramme Mermaid
      },
    },
    {
      type: 'upgrade-nestjs',
      enabled: true,
      options: {
        targetVersion: '11.0.0',
        analyzeTests: true,
      },
    },
    {
      type: 'perf-observabilite',
      enabled: true,
      options: {
        collectRealMetrics: false, // true = connexion Redis/APM, false = analyse statique
        baselineComparison: true,   // Comparer avec baseline précédente
      },
    },
    // Autres agents à ajouter ici
  ],
};

/**
 * Extensions de fichiers à exclure du scan
 */
export const EXCLUDED_EXTENSIONS = [
  '.map',
  '.lock',
  '.log',
  '.tmp',
  '.cache',
];

/**
 * Dossiers à exclure du scan
 */
export const EXCLUDED_DIRECTORIES = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  '.turbo',
  'coverage',
  '.vscode',
  '.idea',
  'cache',
  'dumps',
];

/**
 * Mapping des extensions vers catégories
 */
export const FILE_CATEGORIES: Record<string, string> = {
  '.ts': 'source',
  '.tsx': 'source',
  '.js': 'source',
  '.jsx': 'source',
  '.json': 'config',
  '.yml': 'config',
  '.yaml': 'config',
  '.md': 'documentation',
  '.test.ts': 'test',
  '.spec.ts': 'test',
  '.test.js': 'test',
  '.spec.js': 'test',
  '.css': 'style',
  '.scss': 'style',
  '.prisma': 'schema',
  '.env': 'config',
};

/**
 * Seuils KPI
 */
export const KPI_THRESHOLDS = {
  maxFileSize: 500 * 1024, // 500KB
  maxLines: 1000,
  weightDriftMax: 5, // ±5%
  coverageTarget: 100, // 100%
};
