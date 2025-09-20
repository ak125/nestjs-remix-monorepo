// 📁 backend/test-gamme-tables.ts
// 🔍 Script TypeScript pour tester les tables gammes

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from './src/shared/services/supabase-base.service';

@Injectable()
export class GammeTableExplorer extends SupabaseBaseService {
  private readonly logger = new Logger(GammeTableExplorer.name);

  async exploreGammeTables() {
    this.logger.log('🔍 Exploration des tables gammes disponibles...');

    // 1. Test table pieces_gamme
    try {
      this.logger.log('📋 Test table pieces_gamme:');
      const { data: piecesGamme, error: piecesError } = await this.supabase
        .from('pieces_gamme')
        .select('*')
        .limit(3);

      if (piecesError) {
        this.logger.error('❌ Erreur pieces_gamme:', piecesError);
      } else {
        this.logger.log(`✅ pieces_gamme: ${piecesGamme?.length || 0} échantillons trouvés`);
        if (piecesGamme && piecesGamme.length > 0) {
          this.logger.log('📊 Colonnes pieces_gamme:', Object.keys(piecesGamme[0]));
          this.logger.log('📄 Premier enregistrement:', JSON.stringify(piecesGamme[0], null, 2));
        }
      }
    } catch (error) {
      this.logger.error('❌ Exception pieces_gamme:', error);
    }

    // 2. Test table catalog_gamme
    try {
      this.logger.log('📋 Test table catalog_gamme:');
      const { data: catalogGamme, error: catalogError } = await this.supabase
        .from('catalog_gamme')
        .select('*')
        .limit(3);

      if (catalogError) {
        this.logger.error('❌ Erreur catalog_gamme:', catalogError);
      } else {
        this.logger.log(`✅ catalog_gamme: ${catalogGamme?.length || 0} échantillons trouvés`);
        if (catalogGamme && catalogGamme.length > 0) {
          this.logger.log('📊 Colonnes catalog_gamme:', Object.keys(catalogGamme[0]));
          this.logger.log('📄 Premier enregistrement:', JSON.stringify(catalogGamme[0], null, 2));
        }
      }
    } catch (error) {
      this.logger.error('❌ Exception catalog_gamme:', error);
    }

    // 3. Test direct pour voir si products_gamme existe aussi
    try {
      this.logger.log('📋 Test table products_gamme (au cas où):');
      const { data: productsGamme, error: productsError } = await this.supabase
        .from('products_gamme')
        .select('*')
        .limit(1);

      if (productsError) {
        this.logger.warn('⚠️ products_gamme n\'existe pas ou erreur:', productsError.message);
      } else {
        this.logger.log(`✅ products_gamme: ${productsGamme?.length || 0} échantillons trouvés`);
      }
    } catch (error) {
      this.logger.warn('⚠️ products_gamme non accessible:', error.message);
    }
  }
}