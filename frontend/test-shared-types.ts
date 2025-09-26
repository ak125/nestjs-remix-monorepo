import {
  VehicleFuelType,
  SHARED_TYPES_VERSION,
  createSuccessResponse,
  type VehicleBrand,
} from '@monorepo/shared-types';

console.log('🎨 Test Frontend du package @monorepo/shared-types');
console.log('Version:', SHARED_TYPES_VERSION);
console.log('Types de carburant disponibles:', Object.values(VehicleFuelType));

// Test de création d'une marque véhicule avec tous les champs requis
const testBrand: VehicleBrand = {
  marque_id: 1,
  marque_name: 'Toyota',
  marque_alias: 'toyota',
  marque_display: 1,
  marque_relfollow: 1,
  marque_sitemap: 1,
};

console.log('✅ VehicleBrand créé:', testBrand.marque_name);

// Test de réponse API
const apiResponse = createSuccessResponse([testBrand], 'Marques récupérées');
console.log('✅ Réponse API créée:', apiResponse.success);

console.log('🎉 Tests frontend terminés !');

export { };