import { Controller, Get, Param, Logger } from '@nestjs/common';
import { VehiclePiecesCompatibilityService } from '../services/vehicle-pieces-compatibility.service';

/**
 * 🔍 DIAGNOSTIC DES RELATIONS PIÈCES-VÉHICULES
 *
 * Ce contrôleur permet de valider la cohérence des données dans pieces_relation_type
 * et de détecter les associations incorrectes (pièces sans marque, références invalides, etc.)
 */
@Controller('api/catalog/diagnostic')
export class PiecesDiagnosticController {
  private readonly logger = new Logger(PiecesDiagnosticController.name);

  constructor(
    private readonly vehiclePiecesService: VehiclePiecesCompatibilityService,
  ) {}

  // Accès au client Supabase via le service
  private get client() {
    return this.vehiclePiecesService['client'];
  }

  /**
   * 🔍 DIAGNOSTIC COMPLET: Vérifie la qualité des relations pour un type_id + pg_id
   *
   * GET /api/catalog/diagnostic/relations/:typeId/:pgId
   *
   * Retourne:
   * - Nombre de relations trouvées
   * - Nombre de pièces uniques
   * - Pourcentage de pièces avec marque
   * - Pourcentage de pièces avec prix
   * - Pourcentage de pièces avec image
   * - Liste des pièces problématiques
   */
  @Get('relations/:typeId/:pgId')
  async diagnosticRelations(
    @Param('typeId') typeId: string,
    @Param('pgId') pgId: string,
  ) {
    const startTime = Date.now();
    const typeIdNum = parseInt(typeId);
    const pgIdNum = parseInt(pgId);

    try {
      // 1️⃣ Récupérer les relations
      const { data: relations, error: relationsError } = await this.client
        .from('pieces_relation_type')
        .select('rtp_piece_id, rtp_psf_id, rtp_pm_id')
        .eq('rtp_type_id', typeIdNum)
        .eq('rtp_pg_id', pgIdNum);

      if (relationsError) {
        return {
          success: false,
          error: relationsError.message,
          timestamp: new Date().toISOString(),
        };
      }

      if (!relations?.length) {
        return {
          success: true,
          data: {
            relations_count: 0,
            message: 'Aucune relation trouvée',
            recommendation:
              '❌ Cette combinaison type_id + pg_id ne devrait pas être affichée (410 Gone)',
          },
          timestamp: new Date().toISOString(),
        };
      }

      const pieceIds = [...new Set(relations.map((r) => r.rtp_piece_id))];
      const pmIds = [
        ...new Set(relations.map((r) => r.rtp_pm_id).filter(Boolean)),
      ];

      // 2️⃣ Récupérer les détails des pièces
      const { data: pieces, error: piecesError } = await this.client
        .from('pieces')
        .select('piece_id, piece_ref, piece_pm_id, piece_has_img, piece_name')
        .in('piece_id', pieceIds);

      if (piecesError) {
        return {
          success: false,
          error: piecesError.message,
          timestamp: new Date().toISOString(),
        };
      }

      // 3️⃣ Récupérer les marques
      const { data: marques, error: marquesError } =
        pmIds.length > 0
          ? await this.client
              .from('pieces_marque')
              .select('pm_id, pm_name, pm_logo')
              .in('pm_id', pmIds)
              .eq('pm_display', 1)
          : { data: null, error: null };

      if (marquesError) {
        this.logger.warn(`⚠️ Erreur marques: ${marquesError.message}`);
      }

      // 4️⃣ Récupérer les prix
      const { data: prices, error: pricesError } = await this.client
        .from('pieces_price')
        .select('pp_piece_id, pp_psf_id, pp_price')
        .in('pp_piece_id', pieceIds);

      if (pricesError) {
        this.logger.warn(`⚠️ Erreur prix: ${pricesError.message}`);
      }

      // 5️⃣ ANALYSE DE LA QUALITÉ DES DONNÉES
      const marquesMap = new Map<number, any>(
        marques?.map((m: any) => [m.pm_id, m]) || [],
      );
      const pricesMap = new Map<number, any>(
        prices?.map((p: any) => [p.pri_piece_id, p]) || [],
      );

      let piecesWithBrand = 0;
      let piecesWithPrice = 0;
      let piecesWithImage = 0;
      const problematicPieces: any[] = [];

      pieces?.forEach((piece) => {
        const hasBrand = piece.piece_pm_id && marquesMap.has(piece.piece_pm_id);
        const hasPrice = pricesMap.has(piece.piece_id);
        const hasImage = piece.piece_has_img === 1;

        if (hasBrand) piecesWithBrand++;
        if (hasPrice) piecesWithPrice++;
        if (hasImage) piecesWithImage++;

        // Identifier les pièces problématiques
        if (!hasBrand || !hasPrice) {
          problematicPieces.push({
            piece_id: piece.piece_id,
            nom: piece.piece_name,
            reference: piece.piece_ref,
            problems: {
              no_brand: !hasBrand,
              no_price: !hasPrice,
              no_image: !hasImage,
            },
          });
        }
      });

      const totalPieces = pieces?.length || 0;
      const percentWithBrand = (piecesWithBrand / totalPieces) * 100;
      const percentWithPrice = (piecesWithPrice / totalPieces) * 100;
      const percentWithImage = (piecesWithImage / totalPieces) * 100;

      // 6️⃣ DÉTERMINER LE STATUT DE QUALITÉ
      let quality_status = '✅ GOOD';
      let recommendation =
        'Les données sont cohérentes, la page peut être affichée.';

      if (percentWithBrand < 50) {
        quality_status = '❌ CRITICAL';
        recommendation =
          'RETOURNER 410 GONE - Moins de 50% des pièces ont une marque.';
      } else if (percentWithBrand < 80) {
        quality_status = '⚠️ WARNING';
        recommendation =
          'Données de qualité moyenne - Envisager 410 Gone si < 80%.';
      }

      if (totalPieces === 0) {
        quality_status = '❌ CRITICAL';
        recommendation = 'RETOURNER 410 GONE - Aucune pièce trouvée.';
      }

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          // Statistiques globales
          relations_count: relations.length,
          unique_pieces: totalPieces,
          unique_brands: marquesMap.size,

          // Qualité des données (pourcentages)
          quality: {
            pieces_with_brand: {
              count: piecesWithBrand,
              percentage: percentWithBrand.toFixed(1),
            },
            pieces_with_price: {
              count: piecesWithPrice,
              percentage: percentWithPrice.toFixed(1),
            },
            pieces_with_image: {
              count: piecesWithImage,
              percentage: percentWithImage.toFixed(1),
            },
          },

          // Statut et recommandation
          quality_status,
          recommendation,

          // Pièces problématiques (top 10)
          problematic_pieces: problematicPieces.slice(0, 10),
          total_problematic: problematicPieces.length,

          // Marques trouvées
          brands_found: Array.from(marquesMap.values()).map((m) => ({
            id: m.pm_id,
            name: m.pm_name,
            has_logo: !!m.pm_logo,
          })),
        },
        performance: {
          response_time: `${responseTime}ms`,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur diagnostic: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔍 VÉRIFIER LA VALIDITÉ D'UN TYPE_ID
   *
   * GET /api/catalog/diagnostic/type/:typeId
   *
   * Retourne les informations du véhicule associé à ce type_id
   */
  @Get('type/:typeId')
  async diagnosticType(@Param('typeId') typeId: string) {
    const typeIdNum = parseInt(typeId);

    try {
      // ✅ FIX: Utiliser .maybeSingle() au lieu de .single()
      const { data: typeData, error } = await this.client
        .from('auto_type')
        .select(
          `
          type_id,
          type_name,
          type_modele_id,
          auto_modele!auto_type_type_modele_id_fkey (
            modele_id,
            modele_name,
            auto_marque (
              marque_id,
              marque_name
            )
          )
        `,
        )
        .eq('type_id', typeIdNum)
        .maybeSingle();

      if (error) {
        return {
          success: false,
          data: {
            type_id: typeIdNum,
            exists: false,
            message: `❌ Erreur technique: ${error.message}`,
            recommendation: 'Vérifier les logs serveur',
          },
          timestamp: new Date().toISOString(),
        };
      }

      if (!typeData) {
        return {
          success: false,
          data: {
            type_id: typeIdNum,
            exists: false,
            message: "❌ Ce type_id n'existe pas dans la base",
            recommendation: "Vérifier l'URL ou corriger le type_id",
          },
          timestamp: new Date().toISOString(),
        };
      }
      return {
        success: true,
        data: {
          type_id: typeData.type_id,
          type_name: typeData.type_name,
          marque: (typeData as any).auto_modele?.[0]?.auto_marque?.[0]
            ?.marque_name,
          modele: (typeData as any).auto_modele?.[0]?.modele_name,
          exists: true,
          recommendation: '✅ Type ID valide',
        },
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
   * 🔍 AUDIT COMPLET: Teste plusieurs combinaisons type_id + pg_id
   *
   * GET /api/catalog/diagnostic/audit-batch
   *
   * Teste les 7 URLs critiques du monitoring SEO
   */
  @Get('audit-batch')
  async auditBatch() {
    const criticalCombinations = [
      {
        url: '/pieces/amortisseur-1/mercedes-107/classe-c-107003/220-cdi-18784.html',
        typeId: 18784,
        pgId: 854,
      },
      {
        url: '/pieces/freinage-402/renault-140/clio-iii-140004/1-5-dci-19052.html',
        typeId: 19052,
        pgId: 402,
      },
      {
        url: '/pieces/distribution-128/peugeot-19/308-19010/1-6-hdi-13894.html',
        typeId: 13894,
        pgId: 128,
      },
    ];

    const results: any[] = [];

    for (const combo of criticalCombinations) {
      const diagnostic = await this.diagnosticRelations(
        combo.typeId.toString(),
        combo.pgId.toString(),
      );

      results.push({
        url: combo.url,
        type_id: combo.typeId,
        pg_id: combo.pgId,
        status: diagnostic.data?.quality_status || '❌ ERROR',
        pieces_count: diagnostic.data?.unique_pieces || 0,
        brand_percentage:
          diagnostic.data?.quality?.pieces_with_brand?.percentage || '0',
        recommendation: diagnostic.data?.recommendation,
      });
    }

    return {
      success: true,
      data: {
        total_tested: results.length,
        results,
        summary: {
          critical: results.filter((r) => r.status === '❌ CRITICAL').length,
          warning: results.filter((r) => r.status === '⚠️ WARNING').length,
          good: results.filter((r) => r.status === '✅ GOOD').length,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 🔍 Endpoint 4: Recherche de type_id correct pour un véhicule
   * GET /api/catalog/diagnostic/find-type/:marqueId/:modeleId/:searchTerm
   *
   * Exemple: /api/catalog/diagnostic/find-type/108/108038/220%20CDI
   */
  @Get('find-type/:marqueId/:modeleId/:searchTerm')
  async findCorrectTypeId(
    @Param('marqueId') marqueId: string,
    @Param('modeleId') modeleId: string,
    @Param('searchTerm') searchTerm: string,
  ) {
    try {
      const modeleIdNum = parseInt(modeleId);
      const marqueIdNum = parseInt(marqueId);

      const { data: types, error } = await this.client
        .from('auto_type')
        .select('type_id, type_name, type_modele_id')
        .eq('type_modele_id', modeleIdNum)
        .ilike('type_name', `%${searchTerm}%`)
        .limit(20);

      if (error) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: {
          search: {
            marqueId: marqueIdNum,
            modeleId: modeleIdNum,
            searchTerm,
          },
          types_found: types?.length || 0,
          types: types || [],
          recommendation: types?.length
            ? `✅ ${types.length} type(s) trouvé(s). Utilisez type_id dans l'URL.`
            : '❌ Aucun type trouvé. Vérifiez le modele_id ou le terme de recherche.',
        },
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
}
