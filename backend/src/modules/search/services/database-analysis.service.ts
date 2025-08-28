import { Injectable, Logger } from '@nestjs/common';
import { SupabaseIndexationService } from './supabase-indexation.service';

/**
 * 🔍 SERVICE D'ANALYSE DE LA BASE DE DONNÉES
 */
@Injectable()
export class DatabaseAnalysisService {
  private readonly logger = new Logger(DatabaseAnalysisService.name);

  constructor(private readonly supabaseService: SupabaseIndexationService) {}

  /**
   * 🚗 Analyser la structure de la hiérarchie des véhicules
   */
  async analyzeVehicleStructure() {
    this.logger.log('🔍 Analyse structure véhicules...');
    
    try {
      const client = this.supabaseService.getClient();

      // AUTO_MARQUE
      const { data: marques, error: marquesError } = await client
        .from('auto_marque')
        .select('*')
        .limit(5);

      if (marquesError) {
        return { success: false, error: marquesError.message };
      }

      // AUTO_MODELE
      const { data: modeles, error: modelesError } = await client
        .from('auto_modele')
        .select('*')
        .limit(5);

      if (modelesError) {
        return { success: false, error: modelesError.message };
      }

      // AUTO_TYPE
      const { data: types, error: typesError } = await client
        .from('auto_type')
        .select('*')
        .limit(5);

      if (typesError) {
        return { success: false, error: typesError.message };
      }

      return {
        success: true,
        analysis: {
          auto_marque: { samples: marques },
          auto_modele: { samples: modeles },
          auto_type: { samples: types },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * 🔗 Analyser les relations
   */
  async analyzeVehicleRelations() {
    try {
      const client = this.supabaseService.getClient();

      // Test relation AUTO_TYPE → AUTO_MODELE
      const { data: typeWithModel, error: e1 } = await client
        .from('auto_type')
        .select(`
          type_id,
          type_name,
          auto_modele!inner(modele_name)
        `)
        .limit(3);

      return {
        success: true,
        relations: {
          type_to_model: {
            working: !e1,
            error: e1?.message,
            samples: typeWithModel,
          },
        },
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue' 
      };
    }
  }

  /**
   * 🚀 Test requête optimale
   */
  async testOptimalQuery() {
    try {
      const client = this.supabaseService.getClient();
      
      const { data: vehicles, error } = await client
        .from('auto_type')
        .select(`
          type_id,
          type_name,
          auto_modele!inner(
            modele_name,
            auto_marque!inner(marque_name)
          )
        `)
        .eq('type_display', 1)
        .limit(5);

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        count: vehicles?.length || 0,
        vehicles: vehicles,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * 📊 Analyse complète
   */
  async fullDatabaseAnalysis() {
    try {
      const vehicleStructure = await this.analyzeVehicleStructure();
      const relations = await this.analyzeVehicleRelations();

      return {
        success: true,
        timestamp: new Date().toISOString(),
        database: {
          structure: vehicleStructure,
          relations,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * 🔧 Analyser la structure des PIECES
   */
  async analyzePiecesStructure() {
    try {
      const client = this.supabaseService.getClient();
      
      // Échantillon de pièces
      const { data: pieces, error } = await client
        .from('pieces')
        .select('*')
        .limit(5);

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        pieces: pieces,
        count: pieces?.length || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}