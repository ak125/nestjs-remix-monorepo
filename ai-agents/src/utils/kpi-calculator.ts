import { KPI, FileInfo, WorkspaceInfo } from '../types';
import { KPI_THRESHOLDS } from '../config/agents.config';

/**
 * Calculateur de KPIs pour l'audit du monorepo
 */
export class KPICalculator {
  /**
   * Calculer tous les KPIs
   */
  calculateAll(files: FileInfo[], workspaces: WorkspaceInfo[]): KPI[] {
    return [
      this.calculateCoverage(workspaces),
      this.calculateTotalSize(files),
      this.calculateTotalLines(files),
      this.calculateFileCount(files),
      this.calculateWorkspaceCount(workspaces),
      this.calculateAverageFileSize(files),
      this.calculateLargeFileCount(files),
    ];
  }

  /**
   * Couverture des workspaces
   */
  private calculateCoverage(workspaces: WorkspaceInfo[]): KPI {
    const expectedWorkspaces = ['frontend', 'backend'];
    const actualWorkspaces = workspaces.map(w => w.name);
    const coverage = expectedWorkspaces.filter(w => actualWorkspaces.includes(w)).length / expectedWorkspaces.length * 100;

    return {
      name: 'Couverture Workspaces',
      value: coverage,
      unit: '%',
      threshold: {
        target: 100,
      },
      status: coverage === 100 ? 'ok' : 'warning',
    };
  }

  /**
   * Taille totale
   */
  private calculateTotalSize(files: FileInfo[]): KPI {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const sizeMB = totalSize / (1024 * 1024);

    return {
      name: 'Taille Totale',
      value: sizeMB.toFixed(2),
      unit: 'MB',
      status: 'ok',
    };
  }

  /**
   * Nombre total de lignes
   */
  private calculateTotalLines(files: FileInfo[]): KPI {
    const totalLines = files.reduce((sum, f) => sum + (f.lines || 0), 0);

    return {
      name: 'Lignes de Code Totales',
      value: totalLines,
      status: 'ok',
    };
  }

  /**
   * Nombre de fichiers
   */
  private calculateFileCount(files: FileInfo[]): KPI {
    return {
      name: 'Nombre de Fichiers',
      value: files.length,
      status: 'ok',
    };
  }

  /**
   * Nombre de workspaces
   */
  private calculateWorkspaceCount(workspaces: WorkspaceInfo[]): KPI {
    return {
      name: 'Nombre de Workspaces',
      value: workspaces.length,
      status: 'ok',
    };
  }

  /**
   * Taille moyenne des fichiers
   */
  private calculateAverageFileSize(files: FileInfo[]): KPI {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const avgSize = files.length > 0 ? totalSize / files.length : 0;
    const avgKB = avgSize / 1024;

    return {
      name: 'Taille Moyenne Fichier',
      value: avgKB.toFixed(2),
      unit: 'KB',
      status: 'ok',
    };
  }

  /**
   * Nombre de fichiers volumineux
   */
  private calculateLargeFileCount(files: FileInfo[]): KPI {
    const largeFiles = files.filter(f => f.size > KPI_THRESHOLDS.maxFileSize);

    return {
      name: 'Fichiers Volumineux',
      value: largeFiles.length,
      threshold: {
        max: 10,
      },
      status: largeFiles.length > 10 ? 'warning' : 'ok',
    };
  }

  /**
   * Calculer la dérive de poids (nécessite historique)
   */
  calculateWeightDrift(currentSize: number, previousSize: number): KPI {
    const drift = ((currentSize - previousSize) / previousSize) * 100;

    return {
      name: 'Dérive de Poids',
      value: drift.toFixed(2),
      unit: '%',
      threshold: {
        min: -KPI_THRESHOLDS.weightDriftMax,
        max: KPI_THRESHOLDS.weightDriftMax,
      },
      status: Math.abs(drift) <= KPI_THRESHOLDS.weightDriftMax ? 'ok' : 'warning',
    };
  }
}
