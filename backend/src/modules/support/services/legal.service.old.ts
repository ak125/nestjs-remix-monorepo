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

export interface LegalAcceptance {
  userId: string;
  documentId: string;
  documentType: string;
  version: string;
  acceptedAt: Date;
  ipAddress?: string;
  userAgent?: string;
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
  private readonly pageMapping = {
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

      const documentId = this.generateDocumentId();
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
        .from('___xtr_msg')
        .insert({
          msg_cst_id: documentData.createdBy,
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
        .from('___xtr_msg')
        .select('*')
        .eq('msg_id', identifier)
        .like('msg_content', '%"type":"legal_document"%')
        .single();

      if (messageById) {
        message = messageById;
      } else {
        // Essayer par slug dans le contenu JSON
        const { data: messages } = await this.supabase
          .from('___xtr_msg')
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
        .from('___xtr_msg')
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
        .from('___xtr_msg')
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
        .from('___xtr_msg')
        .update({
          msg_subject: updates.title || document.msg_subject,
          msg_content: JSON.stringify(updatedContent),
          msg_cnfa_id: updatedBy,
        })
        .eq('msg_id', documentId)
        .select('*')
        .single();

      if (error) {
        throw new Error(
          `Erreur lors de la mise à jour: ${error.message}`,
        );
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
        .from('___xtr_msg')
        .update({
          msg_content: JSON.stringify(content),
          msg_open: published ? '0' : '1', // 0 = publié, 1 = draft
        })
        .eq('msg_id', documentId)
        .select('*')
        .single();

      if (error) {
        throw new Error(
          `Erreur lors de la publication: ${error.message}`,
        );
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
        .from('___xtr_msg')
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

  async createDocument(
    documentData: Omit<LegalDocument, 'id' | 'lastUpdated'>,
  ): Promise<LegalDocument> {
    this.validateDocument(documentData);

    const document: LegalDocument = {
      ...documentData,
      id: this.generateDocumentId(),
      lastUpdated: new Date(),
    };

    this.documents.set(document.id, document);
    this.versions.set(document.id, []);

    this.logger.log(`Legal document created: ${document.id}`);
    return document;
  }

  async getDocument(identifier: string): Promise<LegalDocument | null> {
    // Try to find by ID first, then by slug
    let document = this.documents.get(identifier);

    if (!document) {
      document = Array.from(this.documents.values()).find(
        (d) => d.slug === identifier,
      );
    }

    return document || null;
  }

  async getDocumentByType(
    type: LegalDocument['type'],
  ): Promise<LegalDocument | null> {
    return (
      Array.from(this.documents.values()).find(
        (d) => d.type === type && d.published,
      ) || null
    );
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

      const { error } = await this.supabase
        .from('___xtr_msg')
        .insert({
          msg_cst_id: userId,
          msg_date: new Date().toISOString(),
          msg_subject: `Acceptation ${documentType}`,
          msg_content: JSON.stringify(acceptanceData),
          msg_open: '0', // Fermé
          msg_close: '0', // Actif
        });

      if (error) {
        throw new Error(
          `Erreur lors de l'enregistrement: ${error.message}`,
        );
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
        .from('___xtr_msg')
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
   * Méthodes de gestion des versions (simplifiées pour l'exemple)
   */
  async getDocumentVersions(
    documentId: string,
  ): Promise<LegalDocumentVersion[]> {
    try {
      const { data: messages } = await this.supabase
        .from('___xtr_msg')
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
        .from('___xtr_msg')
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

  async updateDocument(
    documentId: string,
    updates: Partial<Omit<LegalDocument, 'id' | 'lastUpdated'>>,
    updatedBy: string,
    changes?: string,
  ): Promise<LegalDocument> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Save current version before updating
    if (updates.content && updates.content !== document.content) {
      await this.saveVersion(
        documentId,
        document,
        changes || 'Content updated',
        updatedBy,
      );
    }

    const updatedDocument = {
      ...document,
      ...updates,
      lastUpdated: new Date(),
      updatedBy,
    };

    this.documents.set(documentId, updatedDocument);
    this.logger.log(`Legal document updated: ${documentId}`);

    return updatedDocument;
  }

  async publishDocument(
    documentId: string,
    published: boolean,
  ): Promise<LegalDocument> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    document.published = published;
    document.lastUpdated = new Date();

    this.documents.set(documentId, document);
    this.logger.log(
      `Document ${documentId} ${published ? 'published' : 'unpublished'}`,
    );

    return document;
  }

  async deleteDocument(documentId: string): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    this.documents.delete(documentId);
    this.versions.delete(documentId);
    this.logger.log(`Legal document deleted: ${documentId}`);
  }

  async getDocumentVersions(
    documentId: string,
  ): Promise<LegalDocumentVersion[]> {
    return this.versions.get(documentId) || [];
  }

  async getDocumentVersion(
    documentId: string,
    versionId: string,
  ): Promise<LegalDocumentVersion | null> {
    const versions = this.versions.get(documentId) || [];
    return versions.find((v) => v.id === versionId) || null;
  }

  async restoreVersion(
    documentId: string,
    versionId: string,
    restoredBy: string,
  ): Promise<LegalDocument> {
    const version = await this.getDocumentVersion(documentId, versionId);
    if (!version) {
      throw new Error(
        `Version ${versionId} not found for document ${documentId}`,
      );
    }

    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Save current state as a version before restoring
    await this.saveVersion(
      documentId,
      document,
      `Restored to version ${version.version}`,
      restoredBy,
    );

    // Restore content
    document.content = version.content;
    document.version = `${document.version}.restored`;
    document.lastUpdated = new Date();
    document.updatedBy = restoredBy;

    this.documents.set(documentId, document);
    this.logger.log(
      `Document ${documentId} restored to version ${version.version}`,
    );

    return document;
  }

  async acceptDocument(
    documentType: LegalDocument['type'],
    userId: string,
  ): Promise<void> {
    const document = await this.getDocumentByType(documentType);
    if (!document) {
      throw new Error(`No published document found for type ${documentType}`);
    }

    // Here you would typically save the acceptance to a database
    // For now, we'll just log it
    this.logger.log(
      `User ${userId} accepted ${documentType} version ${document.version}`,
    );
  }

  async getUserAcceptances(userId: string): Promise<
    Array<{
      documentType: LegalDocument['type'];
      version: string;
      acceptedAt: Date;
    }>
  > {
    // This would typically fetch from a database
    // For now, return empty array
    return [];
  }

  private async saveVersion(
    documentId: string,
    document: LegalDocument,
    changes: string,
    createdBy: string,
  ): Promise<void> {
    const version: LegalDocumentVersion = {
      id: this.generateVersionId(),
      documentId,
      version: document.version,
      content: document.content,
      changes,
      effectiveDate: document.effectiveDate,
      createdAt: new Date(),
      createdBy,
    };

    const versions = this.versions.get(documentId) || [];
    versions.push(version);
    this.versions.set(documentId, versions);

    this.logger.log(`Version saved for document ${documentId}: ${version.id}`);
  }

  private validateDocument(
    data: Omit<LegalDocument, 'id' | 'lastUpdated'>,
  ): void {
    if (!data.title || !data.content || !data.version) {
      throw new Error('Title, content, and version are required');
    }

    if (!data.slug || !/^[a-z0-9-]+$/.test(data.slug)) {
      throw new Error(
        'Slug must contain only lowercase letters, numbers, and hyphens',
      );
    }

    if (data.content.length < 100) {
      throw new Error('Document content must be at least 100 characters');
    }

    // Check for duplicate slug
    const existingDoc = Array.from(this.documents.values()).find(
      (d) => d.slug === data.slug,
    );
    if (existingDoc) {
      throw new Error('Slug already exists');
    }
  }

  private generateDocumentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `DOC-${timestamp}-${random}`.toUpperCase();
  }

  private generateVersionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `VER-${timestamp}-${random}`.toUpperCase();
  }

  private getDefaultTermsContent(): string {
    return `
# Conditions Générales de Vente - Automecanik

## Article 1 - Objet
Les présentes conditions générales de vente régissent les relations entre Automecanik et ses clients.

## Article 2 - Commandes
Toute commande implique l'acceptation pleine et entière des présentes conditions générales de vente.

## Article 3 - Prix
Les prix sont indiqués en euros, toutes taxes comprises.

## Article 4 - Paiement
Le paiement s'effectue par carte bancaire, PayPal ou virement bancaire.

## Article 5 - Livraison
Les délais de livraison sont de 2 à 3 jours ouvrés en France métropolitaine.

## Article 6 - Droit de rétractation
Vous disposez d'un délai de 14 jours pour exercer votre droit de rétractation.

## Article 7 - Garanties
Tous nos produits bénéficient de la garantie légale de conformité.

## Article 8 - Responsabilité
Notre responsabilité est limitée au montant de la commande.

## Article 9 - Données personnelles
Vos données personnelles sont traitées conformément à notre politique de confidentialité.

## Article 10 - Droit applicable
Les présentes conditions sont régies par le droit français.
    `.trim();
  }

  private getDefaultPrivacyContent(): string {
    return `
# Politique de Confidentialité - Automecanik

## 1. Collecte des données
Nous collectons les données nécessaires au traitement de vos commandes et à l'amélioration de nos services.

## 2. Utilisation des données
Vos données sont utilisées pour :
- Traiter vos commandes
- Vous contacter concernant vos commandes
- Améliorer nos services
- Vous envoyer nos offres (avec votre consentement)

## 3. Partage des données
Nous ne vendons ni ne louons vos données personnelles à des tiers.

## 4. Sécurité des données
Nous mettons en place des mesures techniques et organisationnelles appropriées.

## 5. Vos droits
Vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données.

## 6. Contact
Pour toute question relative à vos données personnelles, contactez-nous à privacy@automecanik.com.
    `.trim();
  }

  private getDefaultCookieContent(): string {
    return `
# Politique des Cookies - Automecanik

## Qu'est-ce qu'un cookie ?
Un cookie est un petit fichier texte stocké sur votre appareil lors de votre visite sur notre site.

## Types de cookies utilisés
- **Cookies essentiels** : nécessaires au fonctionnement du site
- **Cookies analytiques** : pour analyser l'utilisation du site
- **Cookies de préférences** : pour mémoriser vos choix

## Gestion des cookies
Vous pouvez gérer vos préférences de cookies via les paramètres de votre navigateur.

## Contact
Pour toute question, contactez-nous à cookies@automecanik.com.
    `.trim();
  }

  private getDefaultReturnContent(): string {
    return `
# Politique de Retour - Automecanik

## Délai de retour
Vous disposez de 14 jours à compter de la réception de votre commande pour nous retourner vos produits.

## Conditions de retour
- Produits dans leur emballage d'origine
- Produits en parfait état
- Facture d'achat jointe

## Procédure de retour
1. Contactez notre service client
2. Obtenez votre numéro de retour
3. Renvoyez le produit à nos frais (si défectueux)

## Remboursement
Le remboursement est effectué sous 14 jours après réception du retour.

## Contact
Service client : returns@automecanik.com
    `.trim();
  }
}
