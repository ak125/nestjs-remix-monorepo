/**
 * File Parser - Extract JSX from TSX files
 *
 * Responsibilities:
 * - Read TSX file
 * - Find default export component
 * - Extract JSX return statement
 * - Track line numbers
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ParsedFile {
  /** Original file path */
  filePath: string;
  /** File name without extension */
  fileName: string;
  /** Route pattern derived from file name */
  route: string;
  /** Full file content */
  fullContent: string;
  /** JSX content only (return statement) */
  jsxContent: string;
  /** Line number where JSX starts */
  jsxStartLine: number;
  /** Total lines in file */
  totalLines: number;
}

/**
 * Parse a TSX file and extract the JSX content
 */
export function parseFile(filePath: string): ParsedFile {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const fullContent = fs.readFileSync(absolutePath, 'utf-8');
  const lines = fullContent.split('\n');
  const totalLines = lines.length;

  // Extract file name and route
  const fileName = path.basename(filePath, path.extname(filePath));
  const route = fileNameToRoute(fileName);

  // Find JSX content
  const { jsxContent, jsxStartLine } = extractJSX(fullContent);

  return {
    filePath: absolutePath,
    fileName,
    route,
    fullContent,
    jsxContent,
    jsxStartLine,
    totalLines,
  };
}

/**
 * Convert Remix file name to route pattern
 * Example: "cart.tsx" -> "/cart"
 * Example: "pieces.$gamme.$marque.$modele.$type[.]html.tsx" -> "/pieces/:gamme/:marque/:modele/:type.html"
 */
function fileNameToRoute(fileName: string): string {
  return '/' + fileName
    .replace(/\[\.?\]/g, '') // Remove [.] escapes
    .replace(/\$/g, ':')      // $ -> :param
    .replace(/\._index$/, '') // Remove ._index suffix
    .replace(/^_index$/, '')  // Root index
    .replace(/\./g, '/')      // . -> /
    .replace(/\/html$/, '.html'); // Restore .html extension
}

/**
 * Extract JSX from the return statement of the default export
 */
function extractJSX(content: string): { jsxContent: string; jsxStartLine: number } {
  const lines = content.split('\n');

  // Find the default export function/component
  let inDefaultExport = false;
  let braceCount = 0;
  let jsxStartLine = 0;
  let jsxLines: string[] = [];
  let foundReturn = false;
  let returnBraceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of default export
    if (!inDefaultExport && /export\s+default\s+function/.test(line)) {
      inDefaultExport = true;
      braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      continue;
    }

    if (inDefaultExport) {
      // Track braces
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Find return statement
      if (!foundReturn && /^\s*return\s*\(/.test(line)) {
        foundReturn = true;
        jsxStartLine = i + 1; // 1-indexed
        returnBraceCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;

        // Get content after "return ("
        const afterReturn = line.replace(/^.*return\s*\(/, '');
        if (afterReturn.trim()) {
          jsxLines.push(afterReturn);
        }
        continue;
      }

      if (foundReturn) {
        returnBraceCount += (line.match(/\(/g) || []).length;
        returnBraceCount -= (line.match(/\)/g) || []).length;

        if (returnBraceCount <= 0) {
          // End of return statement - remove trailing );
          const lastLine = line.replace(/\);?\s*$/, '');
          if (lastLine.trim()) {
            jsxLines.push(lastLine);
          }
          break;
        }

        jsxLines.push(line);
      }

      // Exit if we've closed the function
      if (braceCount <= 0 && foundReturn) {
        break;
      }
    }
  }

  return {
    jsxContent: jsxLines.join('\n'),
    jsxStartLine,
  };
}

/**
 * Get line number for a position in content
 */
export function getLineNumber(content: string, position: number): number {
  const before = content.substring(0, position);
  return (before.match(/\n/g) || []).length + 1;
}

/**
 * Find all matches with line numbers
 */
export function findMatchesWithLines(
  content: string,
  pattern: RegExp,
  startLine: number = 1
): Array<{ match: string; line: number; column: number }> {
  const results: Array<{ match: string; line: number; column: number }> = [];
  const lines = content.split('\n');

  // Make pattern global if not already
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;

    while ((match = globalPattern.exec(line)) !== null) {
      results.push({
        match: match[0],
        line: startLine + i,
        column: match.index + 1,
      });
    }

    // Reset lastIndex for next line
    globalPattern.lastIndex = 0;
  }

  return results;
}

export default parseFile;
