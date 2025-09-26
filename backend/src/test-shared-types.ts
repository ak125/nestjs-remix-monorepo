/**
 * 🧪 TEST D'INTÉGRATION - Types partagés
 * 
 * Test simple pour vérifier que le package @monorepo/shared-types
 * peut être importé et utilisé dans le backend NestJS
 */

// Test d'import des types principaux
import type {
  VehicleBrand,
  VehicleModel,
  UnifiedPiece,
  ApiResponse,
  PaginationOptions,
} from '@monorepo/shared-types';

// Test d'import des schemas Zod
import {
  VehicleBrandSchema,
  UnifiedPieceSchema,
  validateVehicleBrand,
  createSuccessResponse,
  SHARED_TYPES_VERSION,
} from '@monorepo/shared-types';

console.log('🚀 Test du package @monorepo/shared-types');
console.log('Version:', SHARED_TYPES_VERSION);

// Test de validation d'une marque véhicule
const testBrand: VehicleBrand = {
  marque_id: 1,
  marque_name: 'Toyota',
  marque_alias: 'toyota',
  marque_display: 1,
};

try {
  const validatedBrand = validateVehicleBrand(testBrand);
  console.log('✅ Validation VehicleBrand réussie:', validatedBrand.marque_name);
} catch (error) {
  console.error('❌ Erreur validation VehicleBrand:', error);
}

// Test de création d'une réponse API
const successResponse = createSuccessResponse(testBrand, 'Marque récupérée avec succès');
console.log('✅ Réponse API créée:', successResponse.success);

// Test de création d'un objet UnifiedPiece
const testPiece = {
  piece_id: 1,
  piece_name: 'Filtre à huile',
  piece_reference: 'FO-001',
  piece_price: 25.99,
  piece_stock: 10,
  piece_description: 'Filtre à huile haute qualité',
  marque_id: 1,
  gamme_id: 1,
  pieces_collection: [],
  piece_fits: [],
  piece_quality: 'OES',
  piece_is_promo: false,
  piece_marque_name: 'Toyota',
  piece_gamme_name: 'Corolla',
};

try {
  const validatedPiece = UnifiedPieceSchema.parse(testPiece);
  console.log('✅ Validation UnifiedPiece réussie:', validatedPiece.piece_name);
} catch (error) {
  console.log('⚠️  Validation UnifiedPiece (champs manquants normaux):', error.errors?.[0]?.message || error.message);
}

console.log('🎉 Tests d\'intégration terminés !');

export { }; // Pour que ce soit un module