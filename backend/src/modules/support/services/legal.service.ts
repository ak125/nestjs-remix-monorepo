import { TABLES } from '@repo/database-types';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

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

  constructor() {
    super();
    this.initializeDefaultDocuments();
  }

  /**
   * Mapping des clés de pages légales (compatibilité legacy)
   */
  private readonly pageMapping: Record<string, LegalDocument['type']> = {
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
        throw new Error(
          `Erreur lors de la création du document: ${error.message}`,
        );
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
        throw new Error(
          `Erreur lors de la récupération des documents: ${error.message}`,
        );
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

      // Sauvegarder la version actuelle
      if (changes) {
        await this.saveVersion(documentId, document, changes, updatedBy);
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
        throw new Error(`Erreur lors de la mise à jour: ${error.message}`);
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
        throw new Error(`Erreur lors de la publication: ${error.message}`);
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
        throw new Error(`Erreur lors de la suppression: ${error.message}`);
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
        throw new Error(`Erreur lors de l'enregistrement: ${error.message}`);
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

  /**
   * Récupérer les versions d'un document
   */
  async getDocumentVersions(
    documentId: string,
  ): Promise<LegalDocumentVersion[]> {
    try {
      const { data: messages } = await this.supabase
        .from(TABLES.xtr_msg)
        .select('*')
        .like('msg_content', `%"documentId":"${documentId}"%`)
        .like('msg_content', '%"type":"legal_version"%')
        .order('msg_date', { ascending: false });

      if (!messages) return [];

      return messages
        .map((msg) => {
          try {
            const content = JSON.parse(msg.msg_content || '{}');
            return {
              id: msg.msg_id,
              documentId: content.documentId,
              version: content.version,
              content: content.content,
              changes: content.changes,
              effectiveDate: new Date(content.effectiveDate),
              createdAt: new Date(msg.msg_date),
              createdBy: msg.msg_cst_id,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as LegalDocumentVersion[];
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des versions: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Récupérer une version spécifique
   */
  async getDocumentVersion(
    documentId: string,
    versionId: string,
  ): Promise<LegalDocumentVersion | null> {
    try {
      const { data: message } = await this.supabase
        .from(TABLES.xtr_msg)
        .select('*')
        .eq('msg_id', versionId)
        .like('msg_content', `%"documentId":"${documentId}"%`)
        .single();

      if (!message) return null;

      const content = JSON.parse(message.msg_content || '{}');
      return {
        id: message.msg_id,
        documentId: content.documentId,
        version: content.version,
        content: content.content,
        changes: content.changes,
        effectiveDate: new Date(content.effectiveDate),
        createdAt: new Date(message.msg_date),
        createdBy: message.msg_cst_id,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération de la version: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Restaurer une version précédente
   */
  async restoreVersion(
    documentId: string,
    versionId: string,
    restoredBy: string,
  ): Promise<LegalDocument> {
    try {
      const version = await this.getDocumentVersion(documentId, versionId);
      if (!version) {
        throw new NotFoundException(
          `Version ${versionId} introuvable pour le document ${documentId}`,
        );
      }

      return await this.updateDocument(
        documentId,
        { content: version.content },
        restoredBy,
        `Restauration de la version ${version.version}`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la restauration: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  /**
   * Initialiser les documents par défaut
   */
  private async initializeDefaultDocuments(): Promise<void> {
    try {
      const defaultDocs = [
        {
          type: 'terms' as const,
          title: 'Conditions Générales de Vente',
          content: this.getDefaultTermsContent(),
          slug: 'cgv',
        },
        {
          type: 'privacy' as const,
          title: 'Politique de Confidentialité',
          content: this.getDefaultPrivacyContent(),
          slug: 'confidentialite',
        },
        {
          type: 'cookies' as const,
          title: 'Politique des Cookies',
          content: this.getDefaultCookieContent(),
          slug: 'cookies',
        },
        {
          type: 'returns' as const,
          title: 'Politique de Retour',
          content: this.getDefaultReturnContent(),
          slug: 'retours',
        },
      ];

      // Vérifier si les documents existent déjà
      for (const doc of defaultDocs) {
        const existing = await this.getDocumentByType(doc.type);
        if (!existing) {
          await this.createDocument({
            type: doc.type,
            title: doc.title,
            content: doc.content,
            createdBy: 'system', // Retour à 'system' car géré dans createDocument
            language: 'fr',
            effectiveDate: new Date('2024-01-01'),
            metadata: { isDefault: true },
          });
        }
      }

      this.logger.log('Documents légaux par défaut initialisés');
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation des documents: ${(error as Error).message}`,
      );
    }
  }

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
   * Sauvegarder une version du document
   */
  private async saveVersion(
    documentId: string,
    document: LegalDocument,
    changes: string,
    createdBy: string,
  ): Promise<void> {
    try {
      const versionData = {
        type: 'legal_version',
        documentId,
        version: document.version,
        content: document.content,
        changes,
        effectiveDate: document.effectiveDate.toISOString(),
      };

      await this.supabase.from(TABLES.xtr_msg).insert({
        msg_cst_id: createdBy,
        msg_date: new Date().toISOString(),
        msg_subject: `Version ${document.version} - ${document.title}`,
        msg_content: JSON.stringify(versionData),
        msg_open: '0',
        msg_close: '0',
      });
    } catch (error) {
      this.logger.error(
        `Erreur lors de la sauvegarde de version: ${(error as Error).message}`,
      );
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
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Contenu par défaut pour les CGV
   */
  private getDefaultTermsContent(): string {
    return `# Conditions Générales de Vente

## 1. Objet
Les présentes conditions générales de vente s'appliquent à toutes les commandes passées sur notre site.

## 2. Produits
Nos produits sont conformes à la réglementation française en vigueur.

## 3. Prix
Les prix sont indiqués en euros TTC.

## 4. Livraison
Les délais de livraison sont indiqués lors de la commande.

## 5. Garanties
Nos produits bénéficient de la garantie légale de conformité.

*Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}*`;
  }

  /**
   * Contenu par défaut pour la politique de confidentialité
   */
  private getDefaultPrivacyContent(): string {
    return `# Politique de Confidentialité

## 1. Collecte des données
Nous collectons uniquement les données nécessaires au traitement de votre commande.

## 2. Utilisation des données
Vos données sont utilisées pour traiter votre commande et améliorer nos services.

## 3. Conservation des données
Vos données sont conservées selon les durées légales.

## 4. Vos droits
Vous disposez d'un droit d'accès, de rectification et de suppression de vos données.

*Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}*`;
  }

  /**
   * Contenu par défaut pour la politique des cookies
   */
  private getDefaultCookieContent(): string {
    return `# Politique des Cookies

## 1. Qu'est-ce qu'un cookie ?
Un cookie est un petit fichier texte stocké sur votre ordinateur.

## 2. Utilisation des cookies
Nous utilisons des cookies pour améliorer votre expérience de navigation.

## 3. Types de cookies
- Cookies techniques nécessaires au fonctionnement du site
- Cookies d'analyse de trafic
- Cookies de personnalisation

## 4. Gestion des cookies
Vous pouvez désactiver les cookies dans votre navigateur.

*Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}*`;
  }

  /**
   * Contenu par défaut pour la politique de retour
   */
  private getDefaultReturnContent(): string {
    return `# Politique de Retour

## 1. Droit de rétractation
Vous disposez de 14 jours pour retourner votre commande.

## 2. Conditions de retour
Les produits doivent être dans leur emballage d'origine.

## 3. Modalités de retour
Contactez notre service client pour organiser le retour.

## 4. Remboursement
Le remboursement sera effectué sous 14 jours après réception du retour.

*Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}*`;
  }

  // ==================== MÉTHODES PAGES LÉGALES (___legal_pages) ====================

  /**
   * 📄 Récupère une page légale depuis ___legal_pages
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
      this.logger.log(`📄 Fetching legal page: ${alias}`);

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
   * 📄 Liste toutes les pages légales disponibles dans ___legal_pages
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

  /**
   * Méthode legacy pour récupérer une page légale (compatibilité)
   */
  async getLegalPage(pageKey: string) {
    const mappedType = this.pageMapping[pageKey];
    if (!mappedType) {
      throw new NotFoundException(`Type de page non reconnu: ${pageKey}`);
    }

    const document = await this.getDocumentByType(mappedType);
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
   * Méthode legacy pour accepter une page légale (compatibilité)
   */
  async acceptLegalPage(
    userId: string,
    pageKey: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const mappedType = this.pageMapping[pageKey];
    if (!mappedType) {
      throw new NotFoundException(`Type de page non reconnu: ${pageKey}`);
    }

    await this.acceptDocument(mappedType, userId, ipAddress, userAgent);
    return { success: true };
  }

  /**
   * Méthode legacy pour vérifier l'acceptation (compatibilité)
   */
  async hasAcceptedLegalPage(
    userId: string,
    pageKey: string,
  ): Promise<boolean> {
    const mappedType = this.pageMapping[pageKey];
    if (!mappedType) {
      return false;
    }

    return await this.hasUserAcceptedDocument(userId, mappedType);
  }

  /**
   * Méthode legacy pour récupérer toutes les pages (compatibilité)
   */
  async getAllLegalPages() {
    const documents = await this.getAllDocuments({ published: true });
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
