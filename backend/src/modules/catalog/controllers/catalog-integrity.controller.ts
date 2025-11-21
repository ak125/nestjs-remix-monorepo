import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogDataIntegrityService } from '../services/catalog-data-integrity.service';

/**
 * 🛡️ Contrôleur pour la validation de l'intégrité des données du catalogue
 *
 * Endpoints :
 * - GET /api/catalog/integrity/validate/:typeId/:gammeId - Valide une combinaison
 * - GET /api/catalog/integrity/health - Rapport de santé global
 * - GET /api/catalog/integrity/orphans - Liste des relations orphelines
 */
@Controller('api/catalog/integrity')
export class CatalogIntegrityController {
  constructor(private readonly integrityService: CatalogDataIntegrityService) {}

  /**
   * 🔍 Valide une combinaison type_id + gamme_id
   * GET /api/catalog/integrity/validate/:typeId/:gammeId
   *
   * Retourne :
   * - http_status: 200 (OK), 404 (Not Found), 410 (Gone)
   * - data_quality: qualité des données (% avec marque, prix, image)
   * - recommendation: action recommandée
   *
   * Exemples :
   * - /api/catalog/integrity/validate/18784/854 → 404 (type_id inexistant)
   * - /api/catalog/integrity/validate/14820/854 → 200 ou 410 (selon qualité)
   */
  @Get('validate/:typeId/:gammeId')
  async validateCombination(
    @Param('typeId') typeId: string,
    @Param('gammeId') gammeId: string,
  ) {
    const typeIdNum = parseInt(typeId);
    const gammeIdNum = parseInt(gammeId);

    if (isNaN(typeIdNum) || isNaN(gammeIdNum)) {
      return {
        success: false,
        error: 'type_id et gamme_id doivent être des nombres',
        timestamp: new Date().toISOString(),
      };
    }

    const result = await this.integrityService.validateTypeGammeCompatibility(
      typeIdNum,
      gammeIdNum,
    );

    return {
      success: result.valid,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 📊 Génère un rapport de santé complet du catalogue
   * GET /api/catalog/integrity/health
   *
   * Retourne :
   * - Compteurs globaux (types, gammes, relations)
   * - Liste des problèmes critiques
   * - Top 20 des relations orphelines
   */
  @Get('health')
  async getHealthReport() {
    try {
      const report = await this.integrityService.generateHealthReport();

      return {
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🧹 Liste toutes les relations orphelines
   * GET /api/catalog/integrity/orphans?limit=100
   *
   * Retourne :
   * - total_orphans: nombre total de type_id orphelins
   * - orphan_type_ids: liste des type_id inexistants
   * - sample_relations: échantillon des relations affectées
   */
  @Get('orphans')
  async getOrphanRelations(@Query('limit') limit?: string) {
    try {
      const limitNum = limit ? parseInt(limit) : 100;

      const orphans =
        await this.integrityService.findOrphanTypeRelations(limitNum);

      return {
        success: true,
        data: orphans,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🧹 Génère un script SQL pour nettoyer les relations orphelines
   * GET /api/catalog/integrity/cleanup-sql
   *
   * Génère les commandes DELETE pour supprimer toutes les relations
   * dont le type_id n'existe pas dans auto_type
   *
   * ⚠️ ATTENTION : Ce script doit être exécuté avec précaution
   * Recommandé : faire un backup avant exécution
   *
   * Exemples :
   * - /api/catalog/integrity/cleanup-sql
   * - /api/catalog/integrity/cleanup-sql?limit=1000 (limiter à 1000 orphelins)
   */
  @Get('cleanup-sql')
  async generateCleanupSQL(@Query('limit') limit?: string) {
    try {
      const limitNum = limit ? parseInt(limit) : 10000;

      const orphans =
        await this.integrityService.findOrphanTypeRelations(limitNum);

      if (orphans.total_orphans === 0) {
        return {
          success: true,
          message: '✅ Aucune relation orpheline détectée',
          sql_script: '-- Aucun nettoyage nécessaire',
          orphans_count: 0,
          affected_relations: 0,
          timestamp: new Date().toISOString(),
        };
      }

      // Générer les DELETE statements
      const deleteSQLStatements = orphans.orphan_type_ids.map(
        (typeId) =>
          `DELETE FROM pieces_relation_type WHERE rtp_type_id = '${typeId}';`,
      );

      // Calculer le nombre total de relations affectées
      const totalAffectedRelations = orphans.sample_relations.reduce(
        (sum, rel) => sum + rel.pieces_count,
        0,
      );

      const sqlScript = `-- ========================================
-- 🧹 SCRIPT DE NETTOYAGE DES RELATIONS ORPHELINES
-- Généré le ${new Date().toISOString()}
-- ========================================
--
-- ⚠️ ATTENTION : Ce script va supprimer des données !
-- 
-- Statistiques :
-- - ${orphans.total_orphans} type_ids orphelins détectés
-- - ~${totalAffectedRelations} relations affectées (échantillon)
-- - ${deleteSQLStatements.length} commandes DELETE générées
--
-- ========================================
-- 📋 ÉTAPES RECOMMANDÉES AVANT EXÉCUTION
-- ========================================
--
-- 1. Backup de la table pieces_relation_type
--    pg_dump -t pieces_relation_type automecanik > backup_pieces_relation_type_$(date +%Y%m%d_%H%M%S).sql
--
-- 2. Vérifier les orphelins
--    SELECT COUNT(*) FROM pieces_relation_type prt
--    LEFT JOIN auto_type at ON prt.rtp_type_id = at.type_id
--    WHERE at.type_id IS NULL;
--
-- 3. Exécuter ce script dans une transaction
--
-- ========================================
-- 🧪 EXÉCUTION DANS UNE TRANSACTION
-- ========================================

BEGIN;

-- Afficher le nombre de relations AVANT nettoyage
SELECT 
  COUNT(*) as total_relations_avant_nettoyage,
  COUNT(DISTINCT rtp_type_id) as type_ids_uniques
FROM pieces_relation_type;

-- Afficher les type_ids orphelins à supprimer
SELECT 
  prt.rtp_type_id,
  COUNT(*) as relations_count
FROM pieces_relation_type prt
LEFT JOIN auto_type at ON prt.rtp_type_id = at.type_id
WHERE at.type_id IS NULL
GROUP BY prt.rtp_type_id
ORDER BY relations_count DESC
LIMIT 20;

-- ========================================
-- 🗑️ SUPPRESSION DES RELATIONS ORPHELINES
-- ========================================

${deleteSQLStatements.join('\n')}

-- ========================================
-- ✅ VÉRIFICATION POST-NETTOYAGE
-- ========================================

-- Compter les relations APRÈS nettoyage
SELECT 
  COUNT(*) as total_relations_apres_nettoyage,
  COUNT(DISTINCT rtp_type_id) as type_ids_uniques
FROM pieces_relation_type;

-- Vérifier qu'il ne reste plus d'orphelins
SELECT 
  COUNT(*) as orphelins_restants
FROM pieces_relation_type prt
LEFT JOIN auto_type at ON prt.rtp_type_id = at.type_id
WHERE at.type_id IS NULL;

-- ========================================
-- 💾 VALIDATION FINALE
-- ========================================
--
-- Si orphelins_restants = 0, décommenter la ligne suivante :
-- COMMIT;
--
-- Sinon, annuler les modifications :
ROLLBACK;

-- ========================================
-- 📊 RAPPORT FINAL
-- ========================================
-- Type IDs orphelins supprimés : ${orphans.total_orphans}
-- Relations affectées : ~${totalAffectedRelations}
-- Date génération : ${new Date().toISOString()}
-- ========================================
`;

      return {
        success: true,
        message: `Script SQL généré pour ${orphans.total_orphans} type_ids orphelins`,
        sql_script: sqlScript,
        orphans_count: orphans.total_orphans,
        affected_relations: totalAffectedRelations,
        orphan_type_ids: orphans.orphan_type_ids,
        sample_relations: orphans.sample_relations.slice(0, 10),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔍 Valide l'existence d'un type_id
   * GET /api/catalog/integrity/validate-type/:typeId
   *
   * Utilisé par le frontend pour vérifier si un ID de véhicule est valide
   * avant de charger la page.
   */
  @Get('validate-type/:typeId')
  async validateType(@Param('typeId') typeId: string) {
    const typeIdNum = parseInt(typeId);

    if (isNaN(typeIdNum)) {
      return {
        exists: false,
        error: 'type_id doit être un nombre',
        timestamp: new Date().toISOString(),
      };
    }

    const result = await this.integrityService.validateTypeId(typeIdNum);

    return {
      exists: result.valid,
      type_id: result.type_id,
      type_name: result.type_name,
      error: result.error,
      timestamp: new Date().toISOString(),
    };
  }
}
