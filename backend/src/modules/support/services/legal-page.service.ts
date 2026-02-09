import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type { LegalDocument } from './legal.service';

/**
 * Service de gestion des pages légales (couche de compatibilité legacy).
 * Gère les accès à la table ___legal_pages et le mapping legacy pageKey → documentType.
 * Extrait de LegalService pour isoler la logique des pages légales.
 */
@Injectable()
export class LegalPageService extends SupabaseBaseService {
  protected readonly logger = new Logger(LegalPageService.name);

  /**
   * Mapping des clés de pages légales (compatibilité legacy)
   */
  readonly pageMapping: Record<string, LegalDocument['type']> = {
    cgv: 'terms',
    cpuc: 'privacy',
    cu: 'terms',
    gcrg: 'warranty',
    liv: 'shipping',
    ml: 'privacy',
    ps: 'terms',
    rec: 'returns',
    us: 'custom',
  };

  constructor() {
    super();
  }

  // ==================== ___legal_pages TABLE METHODS ====================

  /**
   * Récupère une page légale depuis ___legal_pages
   * Table dédiée aux contenus légaux (CGV, mentions légales, etc.)
   */
  async getLegalPageFromAriane(alias: string): Promise<{
    alias: string;
    title: string;
    description: string;
    keywords: string;
    h1: string;
    content: string;
    breadcrumb: string;
    indexable: boolean;
  } | null> {
    try {
      this.logger.log(`Fetching legal page: ${alias}`);

      const { data, error } = await this.supabase
        .from('___legal_pages')
        .select(
          'alias, title, description, keywords, h1, content, breadcrumb, indexable',
        )
        .eq('alias', alias)
        .single();

      if (error) {
        this.logger.error(`Error fetching legal page ${alias}:`, error.message);
        return null;
      }

      if (!data) {
        this.logger.warn(`Legal page not found: ${alias}`);
        return null;
      }

      return {
        alias: data.alias,
        title: data.title || '',
        description: data.description || '',
        keywords: data.keywords || '',
        h1: data.h1 || '',
        content: data.content || '',
        breadcrumb: data.breadcrumb || '',
        indexable: data.indexable ?? true,
      };
    } catch (error) {
      this.logger.error(
        `Exception fetching legal page ${alias}:`,
        (error as Error).message,
      );
      return null;
    }
  }

  /**
   * Liste toutes les pages légales disponibles dans ___legal_pages
   */
  async getAllLegalPagesFromAriane(): Promise<
    Array<{
      alias: string;
      title: string;
      breadcrumb: string;
    }>
  > {
    try {
      const { data, error } = await this.supabase
        .from('___legal_pages')
        .select('alias, title, breadcrumb')
        .order('id', { ascending: true });

      if (error) {
        this.logger.error('Error fetching all legal pages:', error.message);
        return [];
      }

      return (data || []).map((row) => ({
        alias: row.alias,
        title: row.title || '',
        breadcrumb: row.breadcrumb || '',
      }));
    } catch (error) {
      this.logger.error(
        'Exception fetching all legal pages:',
        (error as Error).message,
      );
      return [];
    }
  }

  // ==================== LEGACY COMPATIBILITY METHODS ====================

  /**
   * Méthode legacy pour récupérer une page légale (compatibilité).
   * Requires a callback to fetch document by type from the main LegalService.
   */
  async getLegalPage(
    pageKey: string,
    getDocumentByType: (
      type: LegalDocument['type'],
    ) => Promise<LegalDocument | null>,
  ) {
    const mappedType = this.pageMapping[pageKey];
    if (!mappedType) {
      throw new NotFoundException(`Type de page non reconnu: ${pageKey}`);
    }

    const document = await getDocumentByType(mappedType);
    if (!document) {
      throw new NotFoundException(`Page légale non trouvée: ${pageKey}`);
    }

    return {
      id: document.id,
      key: pageKey,
      title: document.title,
      content: document.content,
      summary: document.metadata?.summary || '',
      version: document.version,
      effectiveDate: document.effectiveDate,
      metadata: document.metadata,
    };
  }

  /**
   * Méthode legacy pour accepter une page légale (compatibilité).
   * Requires a callback to accept document from the main LegalService.
   */
  async acceptLegalPage(
    userId: string,
    pageKey: string,
    acceptDocument: (
      documentType: LegalDocument['type'],
      userId: string,
      ipAddress?: string,
      userAgent?: string,
    ) => Promise<void>,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const mappedType = this.pageMapping[pageKey];
    if (!mappedType) {
      throw new NotFoundException(`Type de page non reconnu: ${pageKey}`);
    }

    await acceptDocument(mappedType, userId, ipAddress, userAgent);
    return { success: true };
  }

  /**
   * Méthode legacy pour vérifier l'acceptation (compatibilité).
   * Requires a callback to check acceptance from the main LegalService.
   */
  async hasAcceptedLegalPage(
    userId: string,
    pageKey: string,
    hasUserAcceptedDocument: (
      userId: string,
      documentType: LegalDocument['type'],
    ) => Promise<boolean>,
  ): Promise<boolean> {
    const mappedType = this.pageMapping[pageKey];
    if (!mappedType) {
      return false;
    }

    return await hasUserAcceptedDocument(userId, mappedType);
  }

  /**
   * Méthode legacy pour récupérer toutes les pages (compatibilité).
   * Requires a callback to fetch all documents from the main LegalService.
   */
  async getAllLegalPages(
    getAllDocuments: (filters?: {
      published?: boolean;
    }) => Promise<LegalDocument[]>,
  ) {
    const documents = await getAllDocuments({ published: true });
    return documents.map((doc) => ({
      page_key:
        Object.keys(this.pageMapping).find(
          (key) => this.pageMapping[key] === doc.type,
        ) || doc.type,
      title: doc.title,
      summary: doc.metadata?.summary || '',
      effective_date: doc.effectiveDate,
    }));
  }
}
