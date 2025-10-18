import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { FileInfo, WorkspaceInfo } from '../types';
import { EXCLUDED_DIRECTORIES, EXCLUDED_EXTENSIONS, FILE_CATEGORIES } from '../config/agents.config';

/**
 * Scanner de fichiers pour le monorepo
 */
export class FileScanner {
  private rootPath: string;
  private includeNodeModules: boolean;
  private includeDist: boolean;

  constructor(rootPath: string, options: { includeNodeModules?: boolean; includeDist?: boolean } = {}) {
    this.rootPath = rootPath;
    this.includeNodeModules = options.includeNodeModules ?? false;
    this.includeDist = options.includeDist ?? false;
  }

  /**
   * Scan tous les fichiers du monorepo
   */
  async scanAll(): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const excludedDirs = this.getExcludedDirectories();

    const pattern = '**/*';
    const ignore = excludedDirs.map(dir => `**/${dir}/**`);

    const matches = await glob(pattern, {
      cwd: this.rootPath,
      absolute: false,
      ignore,
      nodir: false,
    });

    for (const relativePath of matches) {
      const absolutePath = path.join(this.rootPath, relativePath);
      const stats = await fs.promises.stat(absolutePath);

      if (!stats.isFile()) continue;

      const ext = path.extname(relativePath);
      if (EXCLUDED_EXTENSIONS.includes(ext)) continue;

      const fileInfo = await this.getFileInfo(relativePath, absolutePath, stats);
      files.push(fileInfo);
    }

    return files;
  }

  /**
   * Obtenir les informations d'un fichier
   */
  private async getFileInfo(relativePath: string, absolutePath: string, stats: fs.Stats): Promise<FileInfo> {
    const extension = path.extname(relativePath);
    const workspace = this.detectWorkspace(relativePath);
    const category = this.detectCategory(relativePath, extension);
    const lines = await this.countLines(absolutePath);

    return {
      path: relativePath,
      absolutePath,
      type: 'file',
      extension,
      size: stats.size,
      lines,
      workspace,
      category,
      lastModified: stats.mtime,
    };
  }

  /**
   * Compter les lignes d'un fichier
   */
  private async countLines(filePath: string): Promise<number> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }

  /**
   * Détecter le workspace d'un fichier
   */
  private detectWorkspace(filePath: string): string {
    const parts = filePath.split(path.sep);
    
    if (parts[0] === 'frontend') return 'frontend';
    if (parts[0] === 'backend') return 'backend';
    if (parts[0] === 'packages') return `packages/${parts[1] || 'unknown'}`;
    if (parts[0] === 'scripts') return 'scripts';
    if (parts[0] === 'ai-agents') return 'ai-agents';
    
    return 'root';
  }

  /**
   * Détecter la catégorie d'un fichier
   */
  private detectCategory(filePath: string, extension: string): string {
    // Tests
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return 'test';
    }

    // Configuration
    if (FILE_CATEGORIES[extension] === 'config') {
      return 'config';
    }

    // Documentation
    if (extension === '.md') {
      return 'documentation';
    }

    // Source
    if (['.ts', '.tsx', '.js', '.jsx'].includes(extension)) {
      return 'source';
    }

    // Styles
    if (['.css', '.scss', '.sass', '.less'].includes(extension)) {
      return 'style';
    }

    return 'other';
  }

  /**
   * Obtenir la liste des répertoires exclus
   */
  private getExcludedDirectories(): string[] {
    const excluded = [...EXCLUDED_DIRECTORIES];
    
    if (!this.includeNodeModules) {
      if (!excluded.includes('node_modules')) {
        excluded.push('node_modules');
      }
    }
    
    if (!this.includeDist) {
      if (!excluded.includes('dist')) excluded.push('dist');
      if (!excluded.includes('build')) excluded.push('build');
    }

    return excluded;
  }

  /**
   * Grouper les fichiers par workspace
   */
  groupByWorkspace(files: FileInfo[]): Map<string, FileInfo[]> {
    const groups = new Map<string, FileInfo[]>();

    for (const file of files) {
      if (!groups.has(file.workspace)) {
        groups.set(file.workspace, []);
      }
      groups.get(file.workspace)!.push(file);
    }

    return groups;
  }

  /**
   * Créer les informations de workspace
   */
  createWorkspaceInfo(name: string, files: FileInfo[]): WorkspaceInfo {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const totalLines = files.reduce((sum, f) => sum + (f.lines || 0), 0);

    const categories = {
      source: files.filter(f => f.category === 'source').length,
      test: files.filter(f => f.category === 'test').length,
      config: files.filter(f => f.category === 'config').length,
      other: files.filter(f => !['source', 'test', 'config'].includes(f.category)).length,
    };

    let type: WorkspaceInfo['type'] = 'other';
    if (name === 'frontend') type = 'frontend';
    else if (name === 'backend') type = 'backend';
    else if (name.startsWith('packages/')) type = 'package';
    else if (name === 'scripts' || name === 'ai-agents') type = 'config';

    return {
      name,
      path: name,
      type,
      fileCount: files.length,
      totalSize,
      totalLines,
      categories,
    };
  }
}
