import { TABLES } from '@repo/database-types';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
// DatabaseException/ErrorCodes available if needed for future error handling
import type { LegalDocument, LegalDocumentVersion } from './legal.service';

/**
 * Service de gestion des versions de documents légaux.
 * Extrait de LegalService pour isoler la logique de versioning.
 */
@Injectable()
export class LegalVersionService extends SupabaseBaseService {
  protected readonly logger = new Logger(LegalVersionService.name);

  constructor() {
    super();
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
   * Restaurer une version précédente.
   * Retourne les données de version nécessaires pour que LegalService
   * appelle updateDocument().
   */
  async getVersionForRestore(
    documentId: string,
    versionId: string,
  ): Promise<LegalDocumentVersion> {
    const version = await this.getDocumentVersion(documentId, versionId);
    if (!version) {
      throw new NotFoundException(
        `Version ${versionId} introuvable pour le document ${documentId}`,
      );
    }
    return version;
  }

  /**
   * Sauvegarder une version du document
   */
  async saveVersion(
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
}
