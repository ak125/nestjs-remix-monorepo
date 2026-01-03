import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * ✅ MIGRÉ: Utilise maintenant les tables dédiées (migration 20260108)
 *    - `legal_documents` - Documents légaux avec colonnes indexées
 *    - `legal_document_versions` - Historique des versions
 *    - `legal_acceptances` - Acceptations par les utilisateurs
 *    au lieu de `___xtr_msg` (12.8M rows, LIKE queries = timeouts)
 */
export interface LegalDocument {
  // Champs legacy (conservés pour compatibilité)
  msg_id: string;
  msg_cst_id: string;
  msg_cnfa_id?: string;
  msg_date: string;
  msg_subject: string;
  msg_content: string;
  msg_open: '0' | '1';
  msg_close: '0' | '1';

  // Données du document
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
   * ✅ MIGRÉ: Utilise maintenant la table `legal_documents`
   */
  async createDocument(
    documentData: CreateLegalDocumentRequest,
  ): Promise<LegalDocument> {
    try {
      this.validateDocumentData(documentData);

      const version = 'v1.0';
      const effectiveDate = documentData.effectiveDate || new Date();
      const slug = this.generateSlug(documentData.title);

      // Créer le document dans la nouvelle table legal_documents
      const { data: newDoc, error } = await this.supabase
        .from('legal_documents')
        .insert({
          document_type: documentData.type,
          title: documentData.title,
          content: documentData.content,
          slug,
          version,
          effective_date: effectiveDate.toISOString(),
          published: false,
          is_draft: true,
          is_archived: false,
          language: documentData.language || 'fr',
          metadata: documentData.metadata || {},
          created_by: documentData.createdBy || 'system',
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(
          `Erreur lors de la création du document: ${error.message}`,
        );
      }

      this.logger.log(
        `Document légal créé: ${newDoc.id} - Type: ${documentData.type}`,
      );
      return this.mapToLegalDocument(newDoc);
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
   * ✅ MIGRÉ: Utilise maintenant la table `legal_documents`
   */
  async getDocument(identifier: string): Promise<LegalDocument | null> {
    try {
      // Essayer d'abord par ID numérique
      const numericId = parseInt(identifier, 10);

      let doc = null;

      if (!isNaN(numericId)) {
        const { data } = await this.supabase
          .from('legal_documents')
          .select('*')
          .eq('id', numericId)
          .single();
        doc = data;
      }

      // Sinon essayer par slug
      if (!doc) {
        const { data } = await this.supabase
          .from('legal_documents')
          .select('*')
          .eq('slug', identifier)
          .single();
        doc = data;
      }

      // Essayer par legacy_msg_id
      if (!doc) {
        const { data } = await this.supabase
          .from('legal_documents')
          .select('*')
          .eq('legacy_msg_id', identifier)
          .single();
        doc = data;
      }

      return doc ? this.mapToLegalDocument(doc) : null;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du document ${identifier}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Récupérer un document par type
   * ✅ MIGRÉ: Utilise maintenant la table `legal_documents`
   */
  async getDocumentByType(
    type: LegalDocument['type'],
  ): Promise<LegalDocument | null> {
    try {
      const { data: doc, error } = await this.supabase
        .from('legal_documents')
        .select('*')
        .eq('document_type', type)
        .eq('published', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !doc) return null;

      return this.mapToLegalDocument(doc);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du document de type ${type}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Récupérer tous les documents avec filtres
   * ✅ MIGRÉ: Utilise maintenant la table `legal_documents`
   */
  async getAllDocuments(filters?: {
    type?: LegalDocument['type'];
    published?: boolean;
    language?: string;
  }): Promise<LegalDocument[]> {
    try {
      let query = this.supabase
        .from('legal_documents')
        .select('*')
        .order('updated_at', { ascending: false });

      // Filtrer par type
      if (filters?.type) {
        query = query.eq('document_type', filters.type);
      }

      // Filtrer par statut de publication
      if (filters?.published !== undefined) {
        query = query.eq('published', filters.published);
      }

      // Filtrer par langue
      if (filters?.language) {
        query = query.eq('language', filters.language);
      }

      const { data: docs, error } = await query;

      if (error) {
        throw new Error(
          `Erreur lors de la récupération des documents: ${error.message}`,
        );
      }

      return (docs || []).map((doc) => this.mapToLegalDocument(doc));
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des documents: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Mettre à jour un document
   * ✅ MIGRÉ: Utilise maintenant la table `legal_documents`
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

      // Sauvegarder la version actuelle si des changements sont indiqués
      if (changes) {
        await this.saveVersion(documentId, document, changes, updatedBy);
      }

      // Préparer les données de mise à jour
      const updateData: Record<string, any> = {
        updated_by: updatedBy,
      };

      if (updates.title) updateData.title = updates.title;
      if (updates.content) updateData.content = updates.content;
      if (updates.type) updateData.document_type = updates.type;
      if (updates.language) updateData.language = updates.language;
      if (updates.slug) updateData.slug = updates.slug;
      if (updates.metadata) updateData.metadata = updates.metadata;
      if (updates.effectiveDate)
        updateData.effective_date = updates.effectiveDate;

      // Extraire l'ID numérique
      const numericId = parseInt(document.id, 10);

      // Mettre à jour le document
      const { data: updatedDoc, error } = await this.supabase
        .from('legal_documents')
        .update(updateData)
        .eq('id', numericId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erreur lors de la mise à jour: ${error.message}`);
      }

      this.logger.log(`Document ${documentId} mis à jour par ${updatedBy}`);
      return this.mapToLegalDocument(updatedDoc);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour du document ${documentId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Publier ou dépublier un document
   * ✅ MIGRÉ: Utilise maintenant la table `legal_documents`
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

      const numericId = parseInt(document.id, 10);

      // Mettre à jour le statut
      const { data: updatedDoc, error } = await this.supabase
        .from('legal_documents')
        .update({
          published,
          is_draft: !published,
        })
        .eq('id', numericId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erreur lors de la publication: ${error.message}`);
      }

      this.logger.log(
        `Document ${documentId} ${published ? 'publié' : 'dépublié'}`,
      );
      return this.mapToLegalDocument(updatedDoc);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la publication du document ${documentId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Supprimer un document
   * ✅ MIGRÉ: Utilise maintenant la table `legal_documents`
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new NotFoundException(`Document ${documentId} introuvable`);
      }

      const numericId = parseInt(document.id, 10);

      const { error } = await this.supabase
        .from('legal_documents')
        .delete()
        .eq('id', numericId);

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
   * ✅ MIGRÉ: Utilise maintenant la table `legal_acceptances`
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

      const numericDocId = parseInt(document.id, 10);

      // Créer un enregistrement d'acceptation dans legal_acceptances
      const { error } = await this.supabase.from('legal_acceptances').upsert(
        {
          user_id: userId,
          document_id: isNaN(numericDocId) ? null : numericDocId,
          document_type: documentType,
          document_version: document.version,
          ip_address: ipAddress || null,
          user_agent: userAgent || null,
          accepted_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,document_type,document_version',
        },
      );

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
   * ✅ MIGRÉ: Utilise maintenant la table `legal_acceptances`
   */
  async getUserAcceptances(userId: string): Promise<
    Array<{
      documentType: LegalDocument['type'];
      version: string;
      acceptedAt: Date;
    }>
  > {
    try {
      const { data: acceptances, error } = await this.supabase
        .from('legal_acceptances')
        .select('document_type, document_version, accepted_at')
        .eq('user_id', userId)
        .order('accepted_at', { ascending: false });

      if (error || !acceptances) return [];

      return acceptances.map((acc) => ({
        documentType: acc.document_type as LegalDocument['type'],
        version: acc.document_version,
        acceptedAt: new Date(acc.accepted_at),
      }));
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
   * ✅ MIGRÉ: Utilise maintenant la table `legal_document_versions`
   */
  async getDocumentVersions(
    documentId: string,
  ): Promise<LegalDocumentVersion[]> {
    try {
      const numericId = parseInt(documentId, 10);

      const { data: versions, error } = await this.supabase
        .from('legal_document_versions')
        .select('*')
        .eq('document_id', numericId)
        .order('created_at', { ascending: false });

      if (error || !versions) return [];

      return versions.map((v) => ({
        id: v.id.toString(),
        documentId: v.document_id.toString(),
        version: v.version,
        content: v.content,
        changes: v.changes || '',
        effectiveDate: new Date(v.effective_date),
        createdAt: new Date(v.created_at),
        createdBy: v.created_by,
      }));
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des versions: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Récupérer une version spécifique
   * ✅ MIGRÉ: Utilise maintenant la table `legal_document_versions`
   */
  async getDocumentVersion(
    documentId: string,
    versionId: string,
  ): Promise<LegalDocumentVersion | null> {
    try {
      const numericDocId = parseInt(documentId, 10);
      const numericVersionId = parseInt(versionId, 10);

      const { data: version, error } = await this.supabase
        .from('legal_document_versions')
        .select('*')
        .eq('id', numericVersionId)
        .eq('document_id', numericDocId)
        .single();

      if (error || !version) return null;

      return {
        id: version.id.toString(),
        documentId: version.document_id.toString(),
        version: version.version,
        content: version.content,
        changes: version.changes || '',
        effectiveDate: new Date(version.effective_date),
        createdAt: new Date(version.created_at),
        createdBy: version.created_by,
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
   * Convertir une row de la table legal_documents vers l'interface LegalDocument
   * ✅ Nouvelle méthode pour la migration vers les tables dédiées
   */
  private mapToLegalDocument(row: any): LegalDocument {
    return {
      // Champs legacy (compatibilité - simulés depuis les nouvelles colonnes)
      msg_id: row.legacy_msg_id || row.id?.toString() || '',
      msg_cst_id: row.created_by || '',
      msg_cnfa_id: row.updated_by || undefined,
      msg_date: row.created_at || new Date().toISOString(),
      msg_subject: row.title || '',
      msg_content: JSON.stringify({
        type: 'legal_document',
        documentType: row.document_type,
        content: row.content,
        version: row.version,
        slug: row.slug,
        language: row.language,
        metadata: row.metadata,
      }),
      msg_open: row.is_draft ? '1' : '0',
      msg_close: row.is_archived ? '1' : '0',

      // Données du document (nouvelles colonnes)
      id: row.id?.toString() || '',
      type: row.document_type || 'custom',
      title: row.title || '',
      content: row.content || '',
      version: row.version || 'v1.0',
      effectiveDate: new Date(row.effective_date || row.created_at),
      lastUpdated: new Date(row.updated_at || row.created_at),
      published: row.published ?? false,
      language: row.language || 'fr',
      slug: row.slug || '',
      metadata: row.metadata || {},
      createdBy: row.created_by || 'system',
      updatedBy: row.updated_by || undefined,
    };
  }

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
   * Sauvegarder une version du document
   * ✅ MIGRÉ: Utilise maintenant la table `legal_document_versions`
   */
  private async saveVersion(
    documentId: string,
    document: LegalDocument,
    changes: string,
    createdBy: string,
  ): Promise<void> {
    try {
      const numericDocId = parseInt(documentId, 10);

      await this.supabase.from('legal_document_versions').insert({
        document_id: numericDocId,
        version: document.version,
        content: document.content,
        changes,
        effective_date: document.effectiveDate.toISOString(),
        created_by: createdBy,
      });
    } catch (error) {
      this.logger.error(
        `Erreur lors de la sauvegarde de version: ${(error as Error).message}`,
      );
    }
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
