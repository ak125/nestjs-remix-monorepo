import { TABLES } from '@repo/database-types';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { DatabaseException, ErrorCodes } from '@common/exceptions';
import { LegalVersionService } from './legal-version.service';
import { LegalPageService } from './legal-page.service';

export interface LegalDocument {
  msg_id: string;
  msg_cst_id: string; // Staff ID qui a créé le document
  msg_cnfa_id?: string; // Staff ID qui a modifié
  msg_date: string;
  msg_subject: string; // Titre du document
  msg_content: string; // Contenu JSON avec le document légal
  msg_open: '0' | '1'; // 1 = draft, 0 = publié
  msg_close: '0' | '1'; // 1 = archivé, 0 = actif

  // Données dérivées du JSON dans msg_content
  id: string;
  type:
    | 'terms'
    | 'privacy'
    | 'cookies'
    | 'gdpr'
    | 'returns'
    | 'shipping'
    | 'warranty'
    | 'custom';
  title: string;
  content: string;
  version: string;
  effectiveDate: Date;
  lastUpdated: Date;
  published: boolean;
  language: string;
  slug: string;
  metadata?: Record<string, any>;
  createdBy: string;
  updatedBy?: string;
}

export interface LegalDocumentVersion {
  id: string;
  documentId: string;
  version: string;
  content: string;
  changes: string;
  effectiveDate: Date;
  createdAt: Date;
  createdBy: string;
}

export interface CreateLegalDocumentRequest {
  type: LegalDocument['type'];
  title: string;
  content: string;
  language?: string;
  effectiveDate?: Date;
  metadata?: Record<string, any>;
  createdBy: string;
}

@Injectable()
export class LegalService extends SupabaseBaseService {
  protected readonly logger = new Logger(LegalService.name);

  constructor(
    @Inject(forwardRef(() => LegalVersionService))
    private readonly legalVersionService: LegalVersionService,
    @Inject(forwardRef(() => LegalPageService))
    private readonly legalPageService: LegalPageService,
  ) {
    // Aucun document n'est créé au démarrage. Le constructeur cherchait les CGV
    // et les politiques de confidentialité, de cookies et de retour par un
    // LIKE '%…%' non indexable sur toute la table des messages, puis insérait un
    // texte rédigé dans le code. L'insertion n'a jamais abouti (msg_id NOT NULL
    // sans valeur par défaut) et aurait recréé un brouillon à chaque démarrage,
    // le brouillon n'étant jamais retrouvé par le filtre « publié ». Un document
    // légal se crée par POST /api/support/legal (admin).
    super();
  }

  /**
   * Créer un nouveau document légal
   */
  async createDocument(
    documentData: CreateLegalDocumentRequest,
  ): Promise<LegalDocument> {
    try {
      this.validateDocumentData(documentData);

      const version = 'v1.0';
      const effectiveDate = documentData.effectiveDate || new Date();

      // Préparer le contenu JSON
      const contentData = {
        type: 'legal_document',
        documentType: documentData.type,
        content: documentData.content,
        version,
        effectiveDate: effectiveDate.toISOString(),
        published: false,
        language: documentData.language || 'fr',
        slug: this.generateSlug(documentData.title),
        metadata: documentData.metadata || {},
        createdAt: new Date().toISOString(),
      };

      // Créer le document dans ___xtr_msg
      const { data: legalMessage, error } = await this.supabase
        .from(TABLES.xtr_msg)
        .insert({
          msg_cst_id: documentData.createdBy || '1', // Utiliser ID par défaut si null
          msg_date: new Date().toISOString(),
          msg_subject: documentData.title,
          msg_content: JSON.stringify(contentData),
          msg_open: '1', // Draft
          msg_close: '0', // Actif
        })
        .select('*')
        .single();

      if (error) {
        throw new DatabaseException({
          message: `Erreur lors de la création du document: ${error.message}`,
          code: ErrorCodes.SUPPORT.CREATE_FAILED,
          details: error.message,
        });
      }

      this.logger.log(
        `Document légal créé: ${legalMessage.msg_id} - Type: ${documentData.type}`,
      );
      return await this.enrichDocumentData(legalMessage);
    } catch (error) {
      this.logger.error(
        `Échec de création du document: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Récupérer un document par ID ou slug
   */
  async getDocument(identifier: string): Promise<LegalDocument | null> {
    try {
      let message = null;

      // Essayer par ID de message d'abord
      const { data: messageById } = await this.supabase
        .from(TABLES.xtr_msg)
        .select('*')
        .eq('msg_id', identifier)
        .like('msg_content', '%"type":"legal_document"%')
        .single();

      if (messageById) {
        message = messageById;
      } else {
        // Essayer par slug dans le contenu JSON
        const { data: messages } = await this.supabase
          .from(TABLES.xtr_msg)
          .select('*')
          .like('msg_content', '%"type":"legal_document"%');

        if (messages) {
          message = messages.find((msg) => {
            try {
              const content = JSON.parse(msg.msg_content || '{}');
              return content.slug === identifier;
            } catch {
              return false;
            }
          });
        }
      }

      return message ? await this.enrichDocumentData(message) : null;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du document ${identifier}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Récupérer un document par type
   */
  async getDocumentByType(
    type: LegalDocument['type'],
  ): Promise<LegalDocument | null> {
    try {
      const { data: messages } = await this.supabase
        .from(TABLES.xtr_msg)
        .select('*')
        .like('msg_content', '%"type":"legal_document"%')
        .eq('msg_open', '0') // Seulement les documents publiés
        .order('msg_date', { ascending: false });

      if (!messages) return null;

      const message = messages.find((msg) => {
        try {
          const content = JSON.parse(msg.msg_content || '{}');
          return content.documentType === type;
        } catch {
          return false;
        }
      });

      return message ? await this.enrichDocumentData(message) : null;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du document de type ${type}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Récupérer tous les documents avec filtres
   */
  async getAllDocuments(filters?: {
    type?: LegalDocument['type'];
    published?: boolean;
    language?: string;
  }): Promise<LegalDocument[]> {
    try {
      let query = this.supabase
        .from(TABLES.xtr_msg)
        .select('*')
        .like('msg_content', '%"type":"legal_document"%')
        .order('msg_date', { ascending: false });

      // Filtrer par statut de publication
      if (filters?.published !== undefined) {
        query = query.eq('msg_open', filters.published ? '0' : '1');
      }

      const { data: messages, error } = await query;

      if (error) {
        throw new DatabaseException({
          message: `Erreur lors de la récupération des documents: ${error.message}`,
          code: ErrorCodes.SUPPORT.FETCH_FAILED,
          details: error.message,
        });
      }

      // Enrichir et filtrer par contenu JSON
      const documents = await Promise.all(
        messages.map((message) => this.enrichDocumentData(message)),
      );

      return this.applyContentFilters(documents, filters);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des documents: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Mettre à jour un document
   */
  async updateDocument(
    documentId: string,
    updates: Partial<Omit<LegalDocument, 'id' | 'lastUpdated'>>,
    updatedBy: string,
    changes?: string,
  ): Promise<LegalDocument> {
    try {
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new NotFoundException(`Document ${documentId} introuvable`);
      }

      // Sauvegarder la version actuelle (délégué à LegalVersionService)
      if (changes) {
        await this.legalVersionService.saveVersion(
          documentId,
          document,
          changes,
          updatedBy,
        );
      }

      // Préparer le contenu mis à jour
      const currentContent = JSON.parse(document.msg_content || '{}');
      const updatedContent = {
        ...currentContent,
        ...updates,
        lastUpdated: new Date().toISOString(),
        updatedBy,
      };

      // Mettre à jour le document
      const { data: updatedMessage, error } = await this.supabase
        .from(TABLES.xtr_msg)
        .update({
          msg_subject: updates.title || document.msg_subject,
          msg_content: JSON.stringify(updatedContent),
          msg_cnfa_id: updatedBy,
        })
        .eq('msg_id', documentId)
        .select('*')
        .single();

      if (error) {
        throw new DatabaseException({
          message: `Erreur lors de la mise à jour: ${error.message}`,
          code: ErrorCodes.SUPPORT.UPDATE_FAILED,
          details: error.message,
        });
      }

      this.logger.log(`Document ${documentId} mis à jour par ${updatedBy}`);
      return await this.enrichDocumentData(updatedMessage);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour du document ${documentId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Publier ou dépublier un document
   */
  async publishDocument(
    documentId: string,
    published: boolean,
  ): Promise<LegalDocument> {
    try {
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new NotFoundException(`Document ${documentId} introuvable`);
      }

      // Mettre à jour le contenu JSON
      const content = JSON.parse(document.msg_content || '{}');
      content.published = published;
      content.lastUpdated = new Date().toISOString();

      // Mettre à jour le statut
      const { data: updatedMessage, error } = await this.supabase
        .from(TABLES.xtr_msg)
        .update({
          msg_content: JSON.stringify(content),
          msg_open: published ? '0' : '1', // 0 = publié, 1 = draft
        })
        .eq('msg_id', documentId)
        .select('*')
        .single();

      if (error) {
        throw new DatabaseException({
          message: `Erreur lors de la publication: ${error.message}`,
          code: ErrorCodes.SUPPORT.UPDATE_FAILED,
          details: error.message,
        });
      }

      this.logger.log(
        `Document ${documentId} ${published ? 'publié' : 'dépublié'}`,
      );
      return await this.enrichDocumentData(updatedMessage);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la publication du document ${documentId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Supprimer un document
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new NotFoundException(`Document ${documentId} introuvable`);
      }

      const { error } = await this.supabase
        .from(TABLES.xtr_msg)
        .delete()
        .eq('msg_id', documentId);

      if (error) {
        throw new DatabaseException({
          message: `Erreur lors de la suppression: ${error.message}`,
          code: ErrorCodes.SUPPORT.DELETE_FAILED,
          details: error.message,
        });
      }

      this.logger.log(`Document légal supprimé: ${documentId}`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression du document ${documentId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Enregistrer l'acceptation d'un document légal
   */
  async acceptDocument(
    documentType: LegalDocument['type'],
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const document = await this.getDocumentByType(documentType);
      if (!document) {
        throw new NotFoundException(
          `Aucun document publié trouvé pour le type ${documentType}`,
        );
      }

      // Créer un enregistrement d'acceptation dans ___xtr_msg
      const acceptanceData = {
        type: 'legal_acceptance',
        userId,
        documentId: document.id,
        documentType: document.type,
        version: document.version,
        ipAddress,
        userAgent,
        acceptedAt: new Date().toISOString(),
      };

      const { error } = await this.supabase.from(TABLES.xtr_msg).insert({
        msg_cst_id: userId,
        msg_date: new Date().toISOString(),
        msg_subject: `Acceptation ${documentType}`,
        msg_content: JSON.stringify(acceptanceData),
        msg_open: '0', // Fermé
        msg_close: '0', // Actif
      });

      if (error) {
        throw new DatabaseException({
          message: `Erreur lors de l'enregistrement: ${error.message}`,
          code: ErrorCodes.SUPPORT.CREATE_FAILED,
          details: error.message,
        });
      }

      this.logger.log(
        `Utilisateur ${userId} a accepté ${documentType} version ${document.version}`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'acceptation du document ${documentType}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Récupérer les acceptations d'un utilisateur
   */
  async getUserAcceptances(userId: string): Promise<
    Array<{
      documentType: LegalDocument['type'];
      version: string;
      acceptedAt: Date;
    }>
  > {
    try {
      const { data: messages } = await this.supabase
        .from(TABLES.xtr_msg)
        .select('*')
        .eq('msg_cst_id', userId)
        .like('msg_content', '%"type":"legal_acceptance"%')
        .order('msg_date', { ascending: false });

      if (!messages) return [];

      return messages
        .map((msg) => {
          try {
            const content = JSON.parse(msg.msg_content || '{}');
            return {
              documentType: content.documentType,
              version: content.version,
              acceptedAt: new Date(content.acceptedAt),
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Array<{
        documentType: LegalDocument['type'];
        version: string;
        acceptedAt: Date;
      }>;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des acceptations de ${userId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Vérifier si un utilisateur a accepté un type de document
   */
  async hasUserAcceptedDocument(
    userId: string,
    documentType: LegalDocument['type'],
  ): Promise<boolean> {
    try {
      const acceptances = await this.getUserAcceptances(userId);
      return acceptances.some((acc) => acc.documentType === documentType);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification d'acceptation: ${(error as Error).message}`,
      );
      return false;
    }
  }

  // ==================== DELEGATED VERSION METHODS ====================

  /**
   * Récupérer les versions d'un document
   */
  async getDocumentVersions(
    documentId: string,
  ): Promise<LegalDocumentVersion[]> {
    return this.legalVersionService.getDocumentVersions(documentId);
  }

  /**
   * Récupérer une version spécifique
   */
  async getDocumentVersion(
    documentId: string,
    versionId: string,
  ): Promise<LegalDocumentVersion | null> {
    return this.legalVersionService.getDocumentVersion(documentId, versionId);
  }

  /**
   * Restaurer une version précédente
   */
  async restoreVersion(
    documentId: string,
    versionId: string,
    restoredBy: string,
  ): Promise<LegalDocument> {
    const version = await this.legalVersionService.getVersionForRestore(
      documentId,
      versionId,
    );

    return await this.updateDocument(
      documentId,
      { content: version.content },
      restoredBy,
      `Restauration de la version ${version.version}`,
    );
  }

  // ==================== DELEGATED LEGAL PAGE METHODS ====================

  /**
   * Récupère une page légale depuis ___legal_pages
   */
  async getLegalPageFromAriane(alias: string) {
    return this.legalPageService.getLegalPageFromAriane(alias);
  }

  /**
   * Liste toutes les pages légales disponibles dans ___legal_pages
   */
  async getAllLegalPagesFromAriane() {
    return this.legalPageService.getAllLegalPagesFromAriane();
  }

  /**
   * Méthode legacy pour récupérer une page légale (compatibilité)
   */
  async getLegalPage(pageKey: string) {
    return this.legalPageService.getLegalPage(pageKey, (type) =>
      this.getDocumentByType(type),
    );
  }

  /**
   * Méthode legacy pour accepter une page légale (compatibilité)
   */
  async acceptLegalPage(
    userId: string,
    pageKey: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.legalPageService.acceptLegalPage(
      userId,
      pageKey,
      (documentType, uid, ip, ua) =>
        this.acceptDocument(documentType, uid, ip, ua),
      ipAddress,
      userAgent,
    );
  }

  /**
   * Méthode legacy pour vérifier l'acceptation (compatibilité)
   */
  async hasAcceptedLegalPage(
    userId: string,
    pageKey: string,
  ): Promise<boolean> {
    return this.legalPageService.hasAcceptedLegalPage(
      userId,
      pageKey,
      (uid, documentType) => this.hasUserAcceptedDocument(uid, documentType),
    );
  }

  /**
   * Méthode legacy pour récupérer toutes les pages (compatibilité)
   */
  async getAllLegalPages() {
    return this.legalPageService.getAllLegalPages((filters) =>
      this.getAllDocuments(filters),
    );
  }

  // ==================== PRIVATE UTILITY METHODS ====================

  /**
   * Enrichir les données de document avec les informations dérivées
   */
  private async enrichDocumentData(message: any): Promise<LegalDocument> {
    try {
      const content = JSON.parse(message.msg_content || '{}');

      return {
        msg_id: message.msg_id,
        msg_cst_id: message.msg_cst_id,
        msg_cnfa_id: message.msg_cnfa_id,
        msg_date: message.msg_date,
        msg_subject: message.msg_subject,
        msg_content: message.msg_content,
        msg_open: message.msg_open,
        msg_close: message.msg_close,

        // Données dérivées du JSON
        id: message.msg_id,
        type: content.documentType || 'custom',
        title: message.msg_subject || '',
        content: content.content || '',
        version: content.version || 'v1.0',
        effectiveDate: new Date(content.effectiveDate || message.msg_date),
        lastUpdated: new Date(content.lastUpdated || message.msg_date),
        published: content.published || message.msg_open === '0',
        language: content.language || 'fr',
        slug: content.slug || this.generateSlug(message.msg_subject),
        metadata: content.metadata || {},
        createdBy: message.msg_cst_id,
        updatedBy: content.updatedBy || message.msg_cnfa_id,
      };
    } catch (error) {
      this.logger.error(
        `Erreur dans enrichDocumentData: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Appliquer les filtres basés sur le contenu JSON
   */
  private applyContentFilters(
    documents: LegalDocument[],
    filters?: {
      type?: LegalDocument['type'];
      published?: boolean;
      language?: string;
    },
  ): LegalDocument[] {
    if (!filters) {
      return documents;
    }

    return documents
      .filter((doc) => {
        if (filters.type && doc.type !== filters.type) {
          return false;
        }
        if (
          filters.published !== undefined &&
          doc.published !== filters.published
        ) {
          return false;
        }
        if (filters.language && doc.language !== filters.language) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
      );
  }

  /**
   * Valider les données du document
   */
  private validateDocumentData(data: CreateLegalDocumentRequest): void {
    if (!data.title || data.title.length < 5) {
      throw new BadRequestException(
        'Le titre doit contenir au moins 5 caractères',
      );
    }

    if (!data.content || data.content.length < 50) {
      throw new BadRequestException(
        'Le contenu doit contenir au moins 50 caractères',
      );
    }

    if (!data.type) {
      throw new BadRequestException('Le type de document est requis');
    }

    if (!data.createdBy) {
      throw new BadRequestException("L'ID du créateur est requis");
    }
  }

  /**
   * Générer un slug à partir du titre
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
