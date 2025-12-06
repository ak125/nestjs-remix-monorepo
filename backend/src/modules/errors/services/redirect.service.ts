import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface RedirectEntry {
  old_path: string;
  new_path: string;
  redirect_type: number;
  reason?: string;
}

export interface RedirectRule {
  id?: string;
  source_path: string;
  destination_path: string;
  status_code: number; // 301, 302, 307, 308
  is_active: boolean;
  is_regex: boolean;
  priority: number;
  description?: string;
  created_at?: Date;
  updated_at?: Date;
  hit_count?: number;
  last_hit?: Date;

  // Propriétés de la table ___xtr_msg
  msg_id?: string;
  msg_cst_id?: string;
  msg_cnfa_id?: string;
  msg_ord_id?: string;
  msg_date: Date;
  msg_subject: string;
  msg_content: string;
  msg_parent_id?: string;
  msg_open: string;
  msg_close: string;
  redirectMetadata?: {
    source_path: string;
    destination_path: string;
    status_code: number;
    is_active: boolean;
    is_regex: boolean;
    priority: number;
    description?: string;
    hit_count?: number;
    last_hit?: Date;
    created_by?: string;
    updated_by?: string;
  };
}

@Injectable()
export class RedirectService extends SupabaseBaseService {
  protected readonly logger = new Logger(RedirectService.name);
  private redirectCache = new Map<string, RedirectRule>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor(configService: ConfigService) {
    super(configService);
    // Charger les règles de redirection au démarrage
    this.loadRedirectRules().catch((error) => {
      this.logger.error('Erreur lors du chargement initial des règles:', error);
    });
  }

  /**
   * Trouve une redirection pour un chemin donné (version améliorée)
   * Compatible avec l'ancien format RedirectEntry et le nouveau RedirectRule
   */
  async findRedirect(
    path: string,
  ): Promise<RedirectRule | RedirectEntry | null> {
    try {
      await this.refreshCacheIfNeeded();

      // Recherche exacte d'abord
      if (this.redirectCache.has(path)) {
        const rule = this.redirectCache.get(path)!;
        // Fire and forget pour le compteur
        this.incrementHitCount(rule.id || rule.msg_id!).catch(() => {});
        return this.convertToRedirectEntry(rule);
      }

      // Recherche par regex et patterns
      const regexRules = Array.from(this.redirectCache.values())
        .filter((rule) => rule.is_regex && rule.is_active)
        .sort((a, b) => b.priority - a.priority);

      for (const rule of regexRules) {
        try {
          const regex = new RegExp(rule.source_path);
          if (regex.test(path)) {
            // Fire and forget pour le compteur
            this.incrementHitCount(rule.id || rule.msg_id!).catch(() => {});
            const processedRule = {
              ...rule,
              destination_path: path.replace(regex, rule.destination_path),
            };
            return this.convertToRedirectEntry(processedRule);
          }
        } catch (error) {
          this.logger.debug(
            `Erreur regex pour la règle ${rule.id || rule.msg_id}: ${error}`,
          );
        }
      }

      // Recherche par patterns wildcards (compatibilité avec l'ancien système)
      return this.findPatternRedirect(path);
    } catch (error) {
      this.logger.warn('Erreur dans findRedirect:', error);
      return null;
    }
  }

  /**
   * Chercher une redirection par pattern (avec wildcards)
   * Implémentation améliorée du code utilisateur
   */
  private async findPatternRedirect(
    url: string,
  ): Promise<RedirectEntry | null> {
    try {
      const result = await this.executeWithRetry(
        async () => {
          const { data: redirects, error } = await this.supabase
            .from(TABLES.xtr_msg)
            .select('*')
            .eq('msg_subject', 'REDIRECT_RULE')
            .eq('msg_open', '1') // Actif
            .like('msg_content', '%*%'); // Contient des wildcards

          if (error) {
            this.logger.warn('Erreur lors de la recherche pattern:', error);
            throw error; // Lancer l'erreur pour déclencher le retry
          }

          for (const redirect of redirects || []) {
            try {
              const metadata = JSON.parse(redirect.msg_content || '{}');
              const pattern = metadata.source_path?.replace(/\*/g, '.*');

              if (!pattern) continue;

              const regex = new RegExp(`^${pattern}$`);

              if (regex.test(url)) {
                // Ne pas attendre l'incrément du compteur (fire and forget)
                this.incrementHitCount(redirect.msg_id).catch(() => {});

                // Remplacer les wildcards dans destination_path
                const newPath = metadata.destination_path?.replace(
                  /\$(\d+)/g,
                  (match: string, index: string) => {
                    const captures = url.match(regex);
                    return captures?.[parseInt(index)] || match;
                  },
                );

                return {
                  old_path: metadata.source_path,
                  new_path: newPath || metadata.destination_path,
                  redirect_type: metadata.status_code || 301,
                  reason: metadata.description,
                };
              }
            } catch (parseError) {
              this.logger.debug('Erreur parsing metadata:', parseError);
            }
          }

          return null;
        },
        'findPatternRedirect',
        2, // Seulement 2 tentatives pour les recherches
      );

      return result;
    } catch {
      // En cas d'erreur totale, retourner null sans bloquer
      this.logger.debug(`Aucune redirection pattern trouvée pour: ${url}`);
      return null;
    }
  }

  /**
   * Convertit une RedirectRule en RedirectEntry pour compatibilité
   */
  private convertToRedirectEntry(rule: RedirectRule): RedirectEntry {
    return {
      old_path: rule.source_path,
      new_path: rule.destination_path,
      redirect_type: rule.status_code,
      reason: rule.description,
    };
  }

  /**
   * Crée une nouvelle redirection (version améliorée)
   * Compatible avec l'ancien format RedirectEntry
   */
  async createRedirect(redirect: RedirectEntry): Promise<RedirectRule | null> {
    const rule: Partial<RedirectRule> = {
      source_path: redirect.old_path,
      destination_path: redirect.new_path,
      status_code: redirect.redirect_type,
      description: redirect.reason,
      is_active: true,
      is_regex: redirect.old_path.includes('*'),
      priority: 0,
    };

    return this.createRedirectRule(rule);
  }

  /**
   * Crée une nouvelle règle de redirection
   */
  async createRedirectRule(
    rule: Partial<RedirectRule>,
  ): Promise<RedirectRule | null> {
    try {
      const redirectMetadata = {
        source_path: rule.source_path || '',
        destination_path: rule.destination_path || '',
        status_code: rule.status_code || 301,
        is_active: rule.is_active ?? true,
        is_regex: rule.is_regex ?? false,
        priority: rule.priority ?? 0,
        description: rule.description,
        hit_count: 0,
        created_by: rule.msg_cnfa_id,
        created_at: new Date().toISOString(),
      };

      const newRule = {
        msg_cst_id: null, // Pas de client pour les redirections
        msg_cnfa_id: rule.msg_cnfa_id || null,
        msg_ord_id: null, // Pas de commande pour les redirections
        msg_date: new Date().toISOString(),
        msg_subject: 'REDIRECT_RULE',
        msg_content: JSON.stringify(redirectMetadata),
        msg_parent_id: rule.msg_parent_id || null,
        msg_open: redirectMetadata.is_active ? '1' : '0',
        msg_close: '0', // Toujours ouvert pour les nouvelles règles
      };

      const { data, error } = await this.supabase
        .from(TABLES.xtr_msg)
        .insert(newRule)
        .select()
        .single();

      if (error) {
        this.logger.error('Erreur lors de la création de la règle:', error);
        return null;
      }

      await this.loadRedirectRules(); // Recharger le cache

      // Construire et retourner l'objet RedirectRule complet
      return {
        msg_id: data.msg_id,
        msg_cst_id: data.msg_cst_id,
        msg_cnfa_id: data.msg_cnfa_id,
        msg_ord_id: data.msg_ord_id,
        msg_date: new Date(data.msg_date),
        msg_subject: data.msg_subject,
        msg_content: data.msg_content,
        msg_parent_id: data.msg_parent_id,
        msg_open: data.msg_open,
        msg_close: data.msg_close,
        redirectMetadata,
        source_path: redirectMetadata.source_path,
        destination_path: redirectMetadata.destination_path,
        status_code: redirectMetadata.status_code,
        is_active: redirectMetadata.is_active,
        is_regex: redirectMetadata.is_regex,
        priority: redirectMetadata.priority,
        description: redirectMetadata.description || '',
        hit_count: redirectMetadata.hit_count || 0,
        created_at: new Date(redirectMetadata.created_at),
      };
    } catch (error) {
      this.logger.error('Erreur dans createRedirectRule:', error);
      return null;
    }
  }

  /**
   * Met à jour une règle de redirection (utilise ___xtr_msg)
   */
  async updateRedirectRule(
    id: string,
    updates: Partial<RedirectRule>,
  ): Promise<boolean> {
    try {
      // Récupérer la règle existante
      const { data: existing, error: fetchError } = await this.supabase
        .from(TABLES.xtr_msg)
        .select('*')
        .eq('msg_id', id)
        .eq('msg_subject', 'REDIRECT_RULE')
        .single();

      if (fetchError || !existing) {
        this.logger.error('Règle non trouvée:', fetchError);
        return false;
      }

      // Merger les métadonnées existantes avec les nouvelles
      const existingMetadata = JSON.parse(existing.msg_content || '{}');
      const updatedMetadata = {
        ...existingMetadata,
        ...updates.redirectMetadata,
        updated_by: updates.msg_cnfa_id,
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.supabase
        .from(TABLES.xtr_msg)
        .update({
          msg_content: JSON.stringify(updatedMetadata),
          msg_open: updatedMetadata.is_active ? '1' : '0',
          msg_cnfa_id: updates.msg_cnfa_id || existing.msg_cnfa_id,
        })
        .eq('msg_id', id);

      if (error) {
        this.logger.error('Erreur lors de la mise à jour:', error);
        return false;
      }

      await this.loadRedirectRules(); // Recharger le cache
      return true;
    } catch (error) {
      this.logger.error('Erreur dans updateRedirectRule:', error);
      return false;
    }
  }

  /**
   * Supprime une règle de redirection (marque comme inactive)
   */
  async deleteRedirectRule(id: string): Promise<boolean> {
    try {
      // Au lieu de supprimer, on marque comme inactif et fermé
      const { error } = await this.supabase
        .from(TABLES.xtr_msg)
        .update({
          msg_open: '0', // Inactif
          msg_close: '1', // Fermé/archivé
        })
        .eq('msg_id', id)
        .eq('msg_subject', 'REDIRECT_RULE');

      if (error) {
        this.logger.error('Erreur lors de la suppression:', error);
        return false;
      }

      await this.loadRedirectRules(); // Recharger le cache
      return true;
    } catch (error) {
      this.logger.error('Erreur dans deleteRedirectRule:', error);
      return false;
    }
  }

  /**
   * Récupère toutes les règles de redirection depuis ___xtr_msg
   */
  async getAllRedirectRules(): Promise<RedirectRule[]> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_msg)
        .select('*')
        .eq('msg_subject', 'REDIRECT_RULE')
        .order('msg_date', { ascending: false });

      if (error) {
        this.logger.error('Erreur lors de la récupération:', error);
        return [];
      }

      return (data || []).map((item) => {
        let redirectMetadata: any = {
          source_path: '',
          destination_path: '',
          status_code: 301,
          is_active: item.msg_open === '1',
          is_regex: false,
          priority: 0,
          description: '',
          hit_count: 0,
          last_hit: null,
        };

        try {
          const parsed = JSON.parse(item.msg_content || '{}');
          redirectMetadata = { ...redirectMetadata, ...parsed };
        } catch {
          // Si parsing échoue, garder les valeurs par défaut
        }

        return {
          msg_id: item.msg_id,
          msg_cst_id: item.msg_cst_id,
          msg_cnfa_id: item.msg_cnfa_id,
          msg_ord_id: item.msg_ord_id,
          msg_date: new Date(item.msg_date),
          msg_subject: item.msg_subject,
          msg_content: item.msg_content,
          msg_parent_id: item.msg_parent_id,
          msg_open: item.msg_open,
          msg_close: item.msg_close,
          redirectMetadata,
          // Ajout des propriétés RedirectRule pour compatibilité
          source_path: redirectMetadata.source_path,
          destination_path: redirectMetadata.destination_path,
          status_code: redirectMetadata.status_code,
          is_active: redirectMetadata.is_active,
          is_regex: redirectMetadata.is_regex,
          priority: redirectMetadata.priority,
          description: redirectMetadata.description || '',
          hit_count: redirectMetadata.hit_count || 0,
          last_hit: redirectMetadata.last_hit
            ? new Date(redirectMetadata.last_hit)
            : undefined,
        };
      });
    } catch (error) {
      this.logger.error('Erreur dans getAllRedirectRules:', error);
      return [];
    }
  }

  /**
   * Génère des statistiques de redirection
   */
  async getRedirectStats(): Promise<{
    total_rules: number;
    active_rules: number;
    total_hits: number;
    top_redirects: Array<{
      source_path: string;
      destination_path: string;
      hit_count: number;
    }>;
  }> {
    try {
      const rules = await this.getAllRedirectRules();
      const activeRules = rules.filter((rule) => rule.is_active);
      const totalHits = rules.reduce(
        (sum, rule) => sum + (rule.hit_count || 0),
        0,
      );

      const topRedirects = rules
        .sort((a, b) => (b.hit_count || 0) - (a.hit_count || 0))
        .slice(0, 10)
        .map((rule) => ({
          source_path: rule.source_path,
          destination_path: rule.destination_path,
          hit_count: rule.hit_count || 0,
        }));

      return {
        total_rules: rules.length,
        active_rules: activeRules.length,
        total_hits: totalHits,
        top_redirects: topRedirects,
      };
    } catch (error) {
      this.logger.error('Erreur dans getRedirectStats:', error);
      return {
        total_rules: 0,
        active_rules: 0,
        total_hits: 0,
        top_redirects: [],
      };
    }
  }

  /**
   * Charge les règles de redirection en cache
   */
  private async loadRedirectRules(): Promise<void> {
    try {
      const rules = await this.getAllRedirectRules();
      this.redirectCache.clear();

      for (const rule of rules) {
        if (rule.is_active && !rule.is_regex) {
          this.redirectCache.set(rule.source_path, rule);
        }
      }

      // Ajouter les règles regex à la fin pour la recherche
      for (const rule of rules) {
        if (rule.is_active && rule.is_regex) {
          this.redirectCache.set(`regex_${rule.id}`, rule);
        }
      }

      this.lastCacheUpdate = Date.now();
      this.logger.log(`Cache rechargé avec ${rules.length} règles`);
    } catch (error) {
      this.logger.warn(
        `Erreur lors du chargement du cache (service de redirection non disponible): ${error?.message || 'Erreur inconnue'}`,
      );
      // Ne pas lancer l'erreur, juste logger
      // L'application peut continuer sans redirections
    }
  }

  /**
   * Rafraîchit le cache si nécessaire
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    if (Date.now() - this.lastCacheUpdate > this.cacheExpiry) {
      await this.loadRedirectRules();
    }
  }

  /**
   * Incrémente le compteur de hits pour une règle
   */
  private async incrementHitCount(ruleId: string): Promise<void> {
    // Ne pas utiliser executeWithRetry ici pour éviter de bloquer la redirection
    // si la mise à jour des stats échoue
    try {
      // Récupérer la règle actuelle
      const { data: currentRule } = await this.supabase
        .from(TABLES.xtr_msg)
        .select('msg_content')
        .eq('msg_id', ruleId)
        .single();

      if (currentRule) {
        const metadata = JSON.parse(currentRule.msg_content || '{}');
        metadata.hit_count = (metadata.hit_count || 0) + 1;
        metadata.last_hit = new Date().toISOString();

        await this.supabase
          .from(TABLES.xtr_msg)
          .update({
            msg_content: JSON.stringify(metadata),
          })
          .eq('msg_id', ruleId);
      }
    } catch (error) {
      // Ne pas logger cette erreur en ERROR car ce n'est pas critique
      // La redirection fonctionnera même si les stats ne sont pas mises à jour
      this.logger.warn(
        `Erreur lors de la mise à jour des statistiques: ${error?.message || 'Erreur inconnue'}`,
      );
    }
  }

  /**
   * Marquer une URL comme 410 (Gone) - implémentation du code utilisateur
   */
  async markAsGone(url: string, reason?: string): Promise<RedirectRule | null> {
    return this.createRedirect({
      old_path: url,
      new_path: '',
      redirect_type: 410,
      reason: reason || 'Page supprimée définitivement',
    });
  }

  /**
   * Incrémenter le compteur de hits (version du code utilisateur)
   * Conservé pour compatibilité avec l'ancien système
   */
  private async incrementHitCountLegacy(redirectId: number): Promise<void> {
    try {
      // Cette méthode ne fonctionne plus avec notre nouvelle architecture
      // Mais on la garde pour référence
      this.logger.debug(
        `Tentative d'incrémentation legacy pour ID: ${redirectId}`,
      );
    } catch {
      // Ignore silencieusement
    }
  }
}
