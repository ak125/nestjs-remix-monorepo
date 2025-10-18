/**
 * Types pour les agents IA
 */

export type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

export type AgentType = 
  | 'cartographe'
  | 'fichiers-massifs'
  | 'detecteur-doublons'
  | 'graphe-imports'
  | 'upgrade-nestjs'
  | 'upgrade-remix'
  | 'upgrade-react'
  | 'upgrade-nodejs'
  | 'refacto-css'
  | 'perf-observabilite'
  | 'data-sanity'
  | 'meta-agent';

/**
 * Interface de base pour tous les agents
 */
export interface IAgent {
  name: string;
  type: AgentType;
  description: string;
  version: string;
  execute(): Promise<AgentResult>;
  getStatus(): AgentStatus;
}

/**
 * Résultat d'exécution d'un agent
 */
export interface AgentResult {
  agentName: string;
  agentType: AgentType;
  status: 'success' | 'error' | 'warning';
  timestamp: Date;
  duration: number; // en ms
  data: any;
  errors?: string[];
  warnings?: string[];
  kpis: KPI[];
}

/**
 * Indicateur de performance
 */
export interface KPI {
  name: string;
  value: number | string;
  unit?: string;
  threshold?: {
    min?: number;
    max?: number;
    target?: number;
  };
  status: 'ok' | 'warning' | 'critical';
}

/**
 * Informations sur un fichier du monorepo
 */
export interface FileInfo {
  path: string;
  absolutePath: string;
  type: 'file' | 'directory';
  extension?: string;
  size: number; // en bytes
  lines?: number;
  workspace: string; // frontend, backend, packages, etc.
  category: string; // source, config, test, etc.
  lastModified: Date;
}

/**
 * Carte du monorepo
 */
export interface MonorepoMap {
  timestamp: Date;
  totalFiles: number;
  totalSize: number; // en bytes
  totalLines: number;
  workspaces: WorkspaceInfo[];
  files: FileInfo[];
}

/**
 * Informations sur un workspace
 */
export interface WorkspaceInfo {
  name: string;
  path: string;
  type: 'frontend' | 'backend' | 'package' | 'config' | 'other';
  fileCount: number;
  totalSize: number;
  totalLines: number;
  categories: {
    source: number;
    test: number;
    config: number;
    other: number;
  };
}

/**
 * Heatmap des fichiers volumineux
 */
export interface Heatmap {
  timestamp: Date;
  topFiles: HeatmapEntry[];
  threshold: number; // taille minimale pour être dans le top
}

/**
 * Entrée de la heatmap
 */
export interface HeatmapEntry {
  rank: number;
  path: string;
  size: number;
  lines?: number;
  workspace: string;
  percentage: number; // % de la taille totale
}

/**
 * Configuration du driver IA
 */
export interface DriverConfig {
  rootPath: string;
  outputPath: string;
  agents: AgentConfig[];
  parallel: boolean;
  reportFormat: 'json' | 'markdown' | 'both';
}

/**
 * Configuration d'un agent
 */
export interface AgentConfig {
  type: AgentType;
  enabled: boolean;
  options?: Record<string, any>;
}

/**
 * Rapport d'audit complet
 */
export interface AuditReport {
  timestamp: Date;
  duration: number;
  agents: AgentResult[];
  summary: {
    totalAgents: number;
    successCount: number;
    errorCount: number;
    warningCount: number;
  };
  kpis: KPI[];
}

/**
 * Fichier massif détecté par l'Agent 2
 */
export interface MassiveFile {
  rank: number;
  path: string;
  absolutePath: string;
  size: number;
  lines: number;
  workspace: string;
  category: 'route' | 'service' | 'component' | 'util' | 'other';
  threshold: 'critical' | 'warning'; // critical: >500 lignes, warning: >300
  splittingPlan?: SplittingPlan;
}

/**
 * Plan de scission d'un fichier massif
 */
export interface SplittingPlan {
  originalFile: string;
  suggestedSplits: SuggestedSplit[];
  rationale: string;
  estimatedImpact: {
    filesCreated: number;
    avgLinesPerFile: number;
    maintainabilityGain: string; // low, medium, high
  };
}

/**
 * Scission suggérée
 */
export interface SuggestedSplit {
  fileName: string;
  purpose: 'UI' | 'Data' | 'Helpers' | 'Types' | 'Hooks' | 'Services';
  estimatedLines: number;
  description: string;
}

/**
 * Rapport de l'Agent 2
 */
export interface MassiveFilesReport {
  timestamp: Date;
  totalFilesScanned: number;
  massiveFilesCount: number;
  criticalCount: number; // >500 lignes
  warningCount: number; // >300 lignes
  top20Files: MassiveFile[];
  cumulativeSize: {
    top10: number; // taille cumulée des 10 pires
    top20: number;
  };
  recommendations: string[];
}

/**
 * Cluster de duplication détecté par l'Agent 3
 */
export interface DuplicationCluster {
  id: string;
  occurrences: number;
  linesPerOccurrence: number;
  totalDuplicatedLines: number;
  percentage: number; // % du code total dupliqué
  files: DuplicatedFile[];
  category: 'hooks' | 'utils' | 'services' | 'components' | 'styles' | 'other';
  priority: 'critical' | 'high' | 'medium' | 'low';
  factorizationPlan?: FactorizationPlan;
}

/**
 * Fichier contenant du code dupliqué
 */
export interface DuplicatedFile {
  path: string;
  workspace: string;
  lineStart: number;
  lineEnd: number;
  fragment: string; // Extrait du code dupliqué
}

/**
 * Plan de factorisation pour un cluster
 */
export interface FactorizationPlan {
  clusterId: string;
  targetLocation: string; // Où créer le code mutualisé
  targetFileName: string;
  refactoringSteps: string[];
  estimatedImpact: {
    linesReduced: number;
    filesImpacted: number;
    complexity: 'low' | 'medium' | 'high';
  };
}

/**
 * Rapport de l'Agent 3
 */
export interface DuplicationReport {
  timestamp: Date;
  totalFilesScanned: number;
  totalLines: number;
  duplicatedLines: number;
  duplicationPercentage: number;
  clustersCount: number;
  top5Clusters: DuplicationCluster[];
  byCategory: {
    hooks: number;
    utils: number;
    services: number;
    components: number;
    styles: number;
    other: number;
  };
  recommendations: string[];
}
