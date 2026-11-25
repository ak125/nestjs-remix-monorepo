import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';
import { resolveConfinedPath } from '../utils/rag-paths.util';

/** Réponse unique à tout chemin de PDF refusé, sans répéter le chemin reçu. */
const PDF_REFUSED = 'PDF not found or not allowed';

export interface PdfExtractResult {
  /** Full concatenated text */
  fullText: string;
  /** Text per page */
  pages: string[];
  /** PDF metadata (title, author, etc.) */
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    pages: number;
  };
  /** Source file path */
  sourcePath: string;
}

@Injectable()
export class PdfTextExtractorService {
  private readonly logger = new Logger(PdfTextExtractorService.name);

  /**
   * Répertoires où un PDF peut être lu : le dépôt des PDF, voisin de la base
   * de connaissances, et la base elle-même (`_raw/pdf`).
   */
  private get pdfRoots(): string[] {
    const knowledgePath = RAG_KNOWLEDGE_PATH;
    return [path.join(path.dirname(knowledgePath), 'pdfs'), knowledgePath];
  }

  /** Chemin réel d'un fichier `.pdf` situé dans l'un des répertoires admis. */
  private resolvePdf(pdfPath: string): string | null {
    for (const root of this.pdfRoots) {
      const realPath = resolveConfinedPath(root, pdfPath);
      if (realPath && realPath.toLowerCase().endsWith('.pdf')) return realPath;
    }
    return null;
  }

  /**
   * Extract text from a PDF file using pdf-parse.
   * Pure JS — no system dependencies required.
   */
  async extractText(pdfPath: string): Promise<PdfExtractResult> {
    const absPath = this.resolvePdf(pdfPath);
    if (!absPath) {
      throw new BadRequestException(PDF_REFUSED);
    }

    // Dynamic import to avoid issues if pdf-parse isn't installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = await fs.readFile(absPath);

    this.logger.log(
      `Extracting text from PDF: ${absPath} (${buffer.length} bytes)`,
    );

    const pdfResult = await pdfParse(buffer);

    const fullText = pdfResult.text || '';
    const numPages = pdfResult.numpages || 1;

    // v1 doesn't provide per-page text — split on form-feed (PDF page break)
    const pages = fullText
      .split(/\f/)
      .map((p: string) => p.trim())
      .filter((t: string) => t.length > 0);

    const info = pdfResult.info || {};
    const result: PdfExtractResult = {
      fullText,
      pages,
      metadata: {
        title: info.Title || undefined,
        author: info.Author || undefined,
        subject: info.Subject || undefined,
        creator: info.Creator || undefined,
        pages: numPages,
      },
      sourcePath: absPath,
    };

    this.logger.log(
      `Extracted ${fullText.length} chars from ${numPages} pages: ${absPath}`,
    );

    return result;
  }
}
