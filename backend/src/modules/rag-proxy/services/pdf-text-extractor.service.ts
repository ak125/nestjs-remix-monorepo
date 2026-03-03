import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';

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
   * Extract text from a PDF file using pdf-parse.
   * Pure JS — no system dependencies required.
   */
  async extractText(pdfPath: string): Promise<PdfExtractResult> {
    const absPath = path.resolve(pdfPath);

    // Validate path
    try {
      const stat = await fs.stat(absPath);
      if (!stat.isFile()) {
        throw new BadRequestException(`Not a file: ${absPath}`);
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`PDF not found: ${absPath}`);
    }

    if (!absPath.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('File must have .pdf extension');
    }

    // Dynamic import to avoid issues if pdf-parse isn't installed
    const { PDFParse } = await import('pdf-parse');
    const buffer = await fs.readFile(absPath);

    this.logger.log(
      `Extracting text from PDF: ${absPath} (${buffer.length} bytes)`,
    );

    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();
    await parser.destroy();

    const fullText = textResult.text || '';
    const numPages = infoResult.total || 1;

    // Per-page text from TextResult.pages (PageTextResult[])
    const pages = textResult.pages
      .map((p) => p.text.trim())
      .filter((t) => t.length > 0);

    const info = infoResult.info || {};
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
