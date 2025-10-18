/**
 * Analyseur AST pour détecter la structure des fichiers
 * Utilisé pour générer des plans de scission intelligents
 */

import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

export interface ASTAnalysis {
  filePath: string;
  exports: ExportInfo[];
  imports: ImportInfo[];
  functions: FunctionInfo[];
  components: ComponentInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  complexity: ComplexityMetrics;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'component' | 'const' | 'type' | 'interface' | 'default';
  isDefault: boolean;
  lineStart: number;
  lineEnd: number;
}

export interface ImportInfo {
  source: string;
  imports: string[];
  isTypeOnly: boolean;
}

export interface FunctionInfo {
  name: string;
  isExported: boolean;
  parameters: number;
  lineStart: number;
  lineEnd: number;
  linesOfCode: number;
}

export interface ComponentInfo {
  name: string;
  isExported: boolean;
  props: string[];
  hooks: string[];
  lineStart: number;
  lineEnd: number;
  linesOfCode: number;
}

export interface ClassInfo {
  name: string;
  isExported: boolean;
  methods: number;
  properties: number;
  lineStart: number;
  lineEnd: number;
}

export interface InterfaceInfo {
  name: string;
  isExported: boolean;
  properties: number;
  lineStart: number;
  lineEnd: number;
}

export interface TypeInfo {
  name: string;
  isExported: boolean;
  lineStart: number;
  lineEnd: number;
}

export interface ComplexityMetrics {
  totalExports: number;
  totalImports: number;
  totalFunctions: number;
  totalComponents: number;
  totalClasses: number;
  avgFunctionLength: number;
  maxFunctionLength: number;
  hasMultipleResponsibilities: boolean;
}

/**
 * Analyseur AST utilisant ts-morph
 */
export class ASTAnalyzer {
  private project: Project;

  constructor() {
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        allowJs: true,
        jsx: 2, // React
      },
    });
  }

  /**
   * Analyser un fichier TypeScript/JavaScript
   */
  async analyzeFile(filePath: string): Promise<ASTAnalysis | null> {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const sourceFile = this.project.addSourceFileAtPath(filePath);
      
      const analysis: ASTAnalysis = {
        filePath,
        exports: this.extractExports(sourceFile),
        imports: this.extractImports(sourceFile),
        functions: this.extractFunctions(sourceFile),
        components: this.extractComponents(sourceFile),
        classes: this.extractClasses(sourceFile),
        interfaces: this.extractInterfaces(sourceFile),
        types: this.extractTypes(sourceFile),
        complexity: this.calculateComplexity(sourceFile),
      };

      // Nettoyer pour libérer la mémoire
      this.project.removeSourceFile(sourceFile);

      return analysis;
    } catch (error) {
      console.error(`Erreur analyse AST pour ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Extraire les exports
   */
  private extractExports(sourceFile: SourceFile): ExportInfo[] {
    const exports: ExportInfo[] = [];

    // Export default
    const defaultExport = sourceFile.getDefaultExportSymbol();
    if (defaultExport) {
      const declarations = defaultExport.getDeclarations();
      if (declarations.length > 0) {
        const decl = declarations[0];
        exports.push({
          name: defaultExport.getName() || 'default',
          type: this.determineExportType(decl),
          isDefault: true,
          lineStart: decl.getStartLineNumber(),
          lineEnd: decl.getEndLineNumber(),
        });
      }
    }

    // Named exports
    sourceFile.getExportedDeclarations().forEach((declarations, name) => {
      declarations.forEach((decl) => {
        if (name !== 'default') {
          exports.push({
            name,
            type: this.determineExportType(decl),
            isDefault: false,
            lineStart: decl.getStartLineNumber(),
            lineEnd: decl.getEndLineNumber(),
          });
        }
      });
    });

    return exports;
  }

  /**
   * Déterminer le type d'export
   */
  private determineExportType(decl: any): ExportInfo['type'] {
    const kind = decl.getKind();
    
    if (kind === SyntaxKind.FunctionDeclaration) return 'function';
    if (kind === SyntaxKind.ClassDeclaration) return 'class';
    if (kind === SyntaxKind.InterfaceDeclaration) return 'interface';
    if (kind === SyntaxKind.TypeAliasDeclaration) return 'type';
    if (kind === SyntaxKind.VariableDeclaration) {
      // Vérifier si c'est un composant React
      const text = decl.getText();
      if (text.includes('React.') || text.includes('jsx') || text.includes('return (')) {
        return 'component';
      }
      return 'const';
    }
    
    return 'const';
  }

  /**
   * Extraire les imports
   */
  private extractImports(sourceFile: SourceFile): ImportInfo[] {
    const imports: ImportInfo[] = [];

    sourceFile.getImportDeclarations().forEach((importDecl) => {
      const source = importDecl.getModuleSpecifierValue();
      const isTypeOnly = importDecl.isTypeOnly();
      const importNames: string[] = [];

      // Default import
      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport) {
        importNames.push(defaultImport.getText());
      }

      // Named imports
      const namedImports = importDecl.getNamedImports();
      namedImports.forEach((named) => {
        importNames.push(named.getName());
      });

      // Namespace import
      const namespaceImport = importDecl.getNamespaceImport();
      if (namespaceImport) {
        importNames.push(`* as ${namespaceImport.getText()}`);
      }

      imports.push({
        source,
        imports: importNames,
        isTypeOnly,
      });
    });

    return imports;
  }

  /**
   * Extraire les fonctions
   */
  private extractFunctions(sourceFile: SourceFile): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    sourceFile.getFunctions().forEach((func) => {
      const name = func.getName() || 'anonymous';
      const isExported = func.isExported();
      const parameters = func.getParameters().length;
      const lineStart = func.getStartLineNumber();
      const lineEnd = func.getEndLineNumber();

      functions.push({
        name,
        isExported,
        parameters,
        lineStart,
        lineEnd,
        linesOfCode: lineEnd - lineStart + 1,
      });
    });

    return functions;
  }

  /**
   * Extraire les composants React
   */
  private extractComponents(sourceFile: SourceFile): ComponentInfo[] {
    const components: ComponentInfo[] = [];

    // Chercher les fonctions qui ressemblent à des composants React
    sourceFile.getFunctions().forEach((func) => {
      const name = func.getName();
      if (!name) return;

      // Un composant React commence par une majuscule
      if (name[0] === name[0].toUpperCase()) {
        const body = func.getBody()?.getText() || '';
        
        // Vérifier si ça retourne du JSX
        if (body.includes('return') && (body.includes('<') || body.includes('jsx'))) {
          const parameters = func.getParameters();
          const props = parameters.length > 0 ? [parameters[0].getName()] : [];
          
          // Détecter les hooks utilisés
          const hooks: string[] = [];
          const hookPattern = /use[A-Z]\w+/g;
          const matches = body.match(hookPattern);
          if (matches) {
            hooks.push(...new Set(matches));
          }

          components.push({
            name,
            isExported: func.isExported(),
            props,
            hooks,
            lineStart: func.getStartLineNumber(),
            lineEnd: func.getEndLineNumber(),
            linesOfCode: func.getEndLineNumber() - func.getStartLineNumber() + 1,
          });
        }
      }
    });

    // Arrow functions composants
    sourceFile.getVariableDeclarations().forEach((varDecl) => {
      const name = varDecl.getName();
      if (name[0] === name[0].toUpperCase()) {
        const initializer = varDecl.getInitializer();
        if (initializer && (initializer.getText().includes('=>') || initializer.getText().includes('function'))) {
          const text = initializer.getText();
          if (text.includes('return') && text.includes('<')) {
            const hooks: string[] = [];
            const hookPattern = /use[A-Z]\w+/g;
            const matches = text.match(hookPattern);
            if (matches) {
              hooks.push(...new Set(matches));
            }

            components.push({
              name,
              isExported: varDecl.isExported(),
              props: [],
              hooks,
              lineStart: varDecl.getStartLineNumber(),
              lineEnd: varDecl.getEndLineNumber(),
              linesOfCode: varDecl.getEndLineNumber() - varDecl.getStartLineNumber() + 1,
            });
          }
        }
      }
    });

    return components;
  }

  /**
   * Extraire les classes
   */
  private extractClasses(sourceFile: SourceFile): ClassInfo[] {
    const classes: ClassInfo[] = [];

    sourceFile.getClasses().forEach((cls) => {
      const name = cls.getName() || 'anonymous';
      const isExported = cls.isExported();
      const methods = cls.getMethods().length;
      const properties = cls.getProperties().length;

      classes.push({
        name,
        isExported,
        methods,
        properties,
        lineStart: cls.getStartLineNumber(),
        lineEnd: cls.getEndLineNumber(),
      });
    });

    return classes;
  }

  /**
   * Extraire les interfaces
   */
  private extractInterfaces(sourceFile: SourceFile): InterfaceInfo[] {
    const interfaces: InterfaceInfo[] = [];

    sourceFile.getInterfaces().forEach((iface) => {
      interfaces.push({
        name: iface.getName(),
        isExported: iface.isExported(),
        properties: iface.getProperties().length,
        lineStart: iface.getStartLineNumber(),
        lineEnd: iface.getEndLineNumber(),
      });
    });

    return interfaces;
  }

  /**
   * Extraire les types
   */
  private extractTypes(sourceFile: SourceFile): TypeInfo[] {
    const types: TypeInfo[] = [];

    sourceFile.getTypeAliases().forEach((typeAlias) => {
      types.push({
        name: typeAlias.getName(),
        isExported: typeAlias.isExported(),
        lineStart: typeAlias.getStartLineNumber(),
        lineEnd: typeAlias.getEndLineNumber(),
      });
    });

    return types;
  }

  /**
   * Calculer les métriques de complexité
   */
  private calculateComplexity(sourceFile: SourceFile): ComplexityMetrics {
    const exports = this.extractExports(sourceFile);
    const imports = this.extractImports(sourceFile);
    const functions = this.extractFunctions(sourceFile);
    const components = this.extractComponents(sourceFile);
    const classes = this.extractClasses(sourceFile);

    const functionLengths = functions.map((f) => f.linesOfCode);
    const avgFunctionLength = functionLengths.length > 0
      ? functionLengths.reduce((a, b) => a + b, 0) / functionLengths.length
      : 0;
    const maxFunctionLength = functionLengths.length > 0
      ? Math.max(...functionLengths)
      : 0;

    // Un fichier a des responsabilités multiples si :
    // - Plus de 5 exports
    // - Ou mélange de composants + classes + fonctions utilitaires
    const hasMultipleResponsibilities =
      exports.length > 5 ||
      (components.length > 0 && classes.length > 0) ||
      (components.length > 0 && functions.length > 3);

    return {
      totalExports: exports.length,
      totalImports: imports.reduce((acc, imp) => acc + imp.imports.length, 0),
      totalFunctions: functions.length,
      totalComponents: components.length,
      totalClasses: classes.length,
      avgFunctionLength: Math.round(avgFunctionLength),
      maxFunctionLength,
      hasMultipleResponsibilities,
    };
  }
}
