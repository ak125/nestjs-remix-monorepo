import { FileInfo, Heatmap, HeatmapEntry } from '../types';

/**
 * Générateur de heatmap pour identifier les fichiers volumineux
 */
export class HeatmapGenerator {
  /**
   * Générer une heatmap des N fichiers les plus volumineux
   */
  generate(files: FileInfo[], topN: number = 50): Heatmap {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    // Trier par taille décroissante
    const sortedFiles = [...files].sort((a, b) => b.size - a.size);
    
    // Prendre les N premiers
    const topFiles = sortedFiles.slice(0, topN);

    // Créer les entrées de heatmap
    const entries: HeatmapEntry[] = topFiles.map((file, index) => ({
      rank: index + 1,
      path: file.path,
      size: file.size,
      lines: file.lines,
      workspace: file.workspace,
      percentage: (file.size / totalSize) * 100,
    }));

    return {
      timestamp: new Date(),
      topFiles: entries,
      threshold: topFiles[topFiles.length - 1]?.size || 0,
    };
  }

  /**
   * Formater la taille en unité lisible
   */
  formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Générer un rapport markdown de la heatmap
   */
  generateMarkdownReport(heatmap: Heatmap): string {
    let report = '# 🔥 Heatmap - Fichiers les plus volumineux\n\n';
    report += `**Date**: ${heatmap.timestamp.toISOString()}\n\n`;
    report += `**Top ${heatmap.topFiles.length} fichiers**\n\n`;
    report += '| Rang | Fichier | Taille | Lignes | Workspace | % Total |\n';
    report += '|------|---------|--------|--------|-----------|----------|\n';

    for (const entry of heatmap.topFiles) {
      report += `| ${entry.rank} | \`${entry.path}\` | ${this.formatSize(entry.size)} | ${entry.lines || 'N/A'} | ${entry.workspace} | ${entry.percentage.toFixed(2)}% |\n`;
    }

    return report;
  }
}
