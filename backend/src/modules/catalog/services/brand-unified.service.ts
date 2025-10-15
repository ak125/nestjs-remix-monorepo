import { Injectable } from '@nestjs/common';
import {
  type VehicleBrand,
  type ApiResponse,
  createSuccessResponse,
  createErrorResponse,
  validateVehicleBrand,
} from '@monorepo/shared-types';

@Injectable()
export class BrandUnifiedService {
  /**
   * Mock service pour démontrer l'utilisation des types unifiés
   */
  async getBrands(): Promise<ApiResponse<VehicleBrand[]>> {
    try {
      // Simulation de données avec types unifiés
      const mockBrands: VehicleBrand[] = [
        {
          marque_id: 1,
          marque_name: 'Toyota',
          marque_alias: 'toyota',
          marque_display: 1,
          marque_relfollow: 1,
          marque_sitemap: 1,
          is_featured: true,
        },
        {
          marque_id: 2,
          marque_name: 'BMW',
          marque_alias: 'bmw',
          marque_display: 1,
          marque_relfollow: 1,
          marque_sitemap: 1,
          is_featured: true,
        },
      ];

      // Validation avec Zod
      const validatedBrands = mockBrands.map((brand) =>
        validateVehicleBrand(brand),
      );

      return createSuccessResponse(
        validatedBrands,
        `${validatedBrands.length} marques récupérées avec succès`,
      );
    } catch (error: any) {
      return createErrorResponse(
        'BRANDS_FETCH_ERROR',
        'Erreur lors de la récupération des marques',
        error.message,
      );
    }
  }

  /**
   * Récupère une marque par ID avec validation
   */
  async getBrandById(id: number): Promise<ApiResponse<VehicleBrand>> {
    try {
      const mockBrand = {
        marque_id: id,
        marque_name: 'Toyota',
        marque_alias: 'toyota',
        marque_display: 1,
        marque_relfollow: 1,
        marque_sitemap: 1,
        is_featured: true,
      };

      // Validation automatique avec Zod
      const validatedBrand = validateVehicleBrand(mockBrand);

      return createSuccessResponse(
        validatedBrand,
        `Marque ${validatedBrand.marque_name} récupérée avec succès`,
      );
    } catch (error: any) {
      return createErrorResponse(
        'BRAND_NOT_FOUND',
        `Marque avec l'ID ${id} non trouvée`,
        error.message,
      );
    }
  }
}
