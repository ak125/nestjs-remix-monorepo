/**
 * Service de gestion des données véhicule adapté pour le monorepo
 * Utilise SupabaseRestService pour les données legacy
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseRestService } from '../../../database/supabase-rest.service';
import { z } from 'zod';

// Schemas Zod pour validation
export const VinDataSchema = z.object({
  vinNumber: z.string().length(17, 'VIN doit contenir exactement 17 caractères'),
});

export const RegistrationDataSchema = z.object({
  registrationNumber: z.string().min(1, 'Numéro d\'immatriculation requis'),
  country: z.string().default('FR'),
});

export const VehicleDataSchema = z.object({
  vin: VinDataSchema.optional(),
  registration: RegistrationDataSchema.optional(),
  additionalInfo: z.string().optional(),
});

export const validateVehicleData = (data: any) => VehicleDataSchema.parse(data);

// Types
export interface VehicleIdentification {
  brand: string;
  model: string;
  year: number;
  engine: string;
  fuelType: string;
  transmission: string;
}

export interface PartCompatibility {
  partId: string;
  partReference: string;
  isOemPart: boolean;
  equivalentParts: string[];
  compatibleVehicles: string[];
  category: string;
  subCategory: string;
}

export interface VehicleData {
  vin?: {
    vinNumber: string;
  };
  registration?: {
    registrationNumber: string;
    country?: string;
  };
  additionalInfo?: string;
}

@Injectable()
export class VehicleDataService {
  private readonly logger = new Logger(VehicleDataService.name);

  constructor(
    private readonly supabaseService: SupabaseRestService,
  ) {}

  /**
   * Valide un numéro VIN avec traitement des erreurs
   */
  async validateVIN(vin: string): Promise<VehicleIdentification> {
    const result = this.validateAndDecodeVIN(vin);
    if (!result) {
      throw new Error(`VIN invalide: ${vin}`);
    }
    return result;
  }

  /**
   * Valide un numéro d'immatriculation
   */
  async validateRegistration(registrationNumber: string, country: string = 'FR'): Promise<boolean> {
    if (!registrationNumber) {
      throw new BadRequestException('Numéro d\'immatriculation requis');
    }

    return this.validateImmatriculation(registrationNumber);
  }

  /**
   * Trouve les pièces équivalentes pour un code OEM
   */
  async findEquivalentParts(oemCode: string): Promise<any[]> {
    if (!oemCode) {
      throw new BadRequestException('Code OEM requis');
    }

    return this.findPartEquivalences(oemCode);
  }

  /**
   * Valide et décode un VIN (implémentation simplifiée)
   */
  validateAndDecodeVIN(vin: string): VehicleIdentification | null {
    try {
      const vinSchema = z.string().length(17, 'VIN doit contenir exactement 17 caractères');
      vinSchema.parse(vin);

      // Validation basique du format VIN
      if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
        return null;
      }

      // Simulation de décodage VIN (en production utiliser une API spécialisée)
      return this.mockDecodeVIN(vin);
    } catch (error) {
      this.logger.error(`Erreur validation VIN: ${vin}`, error);
      return null;
    }
  }

  /**
   * Valide un numéro d'immatriculation (alias pour compatibilité)
   * @param immatriculation Numéro d'immatriculation
   * @returns true si valide
   */
  validateRegistrationPlate(immatriculation: string): boolean {
    return this.validateImmatriculation(immatriculation);
  }

  /**
   * Valide un numéro d'immatriculation français
   */
  validateImmatriculation(immatriculation: string): boolean {
    try {
      const immatSchema = z.string().min(1, 'Immatriculation requise');
      immatSchema.parse(immatriculation);

      // Format français moderne (AB-123-CD)
      const formatModerne = /^[A-Z]{2}-\d{3}-[A-Z]{2}$/;
      // Format ancien (123 AB 45)
      const formatAncien = /^\d{3,4}\s?[A-Z]{1,3}\s?\d{2}$/;
      
      return formatModerne.test(immatriculation) || formatAncien.test(immatriculation);
    } catch (error) {
      this.logger.error(`Erreur validation immatriculation: ${immatriculation}`, error);
      return false;
    }
  }

  /**
   * Recherche des équivalences de pièces dans la base legacy
   */
  async findPartEquivalences(oemCode: string): Promise<PartCompatibility[]> {
    try {
      // En production, interroger les tables legacy via SupabaseRestService
      // Ici on simule avec des données de test
      return this.mockFindCompatibleParts({ oemReference: oemCode });
    } catch (error) {
      this.logger.error(`Erreur recherche équivalences: ${oemCode}`, error);
      return [];
    }
  }

  /**
   * Formate les données véhicule pour l'affichage
   */
  formatVehicleDisplayData(vehicleData: VehicleData): Record<string, string> {
    const formatted: Record<string, string> = {};

    if (vehicleData.vin?.vinNumber) {
      formatted['VIN'] = vehicleData.vin.vinNumber;
      
      // Essayer de décoder le VIN pour l'affichage
      try {
        const decoded = this.validateAndDecodeVIN(vehicleData.vin.vinNumber);
        if (decoded) {
          formatted['Marque'] = decoded.brand;
          formatted['Modèle'] = decoded.model;
          formatted['Année'] = decoded.year.toString();
          formatted['Motorisation'] = decoded.engine;
          formatted['Carburant'] = decoded.fuelType;
        }
      } catch (error) {
        // Ignorer les erreurs de décodage pour l'affichage
      }
    }

    if (vehicleData.registration?.registrationNumber) {
      formatted['Immatriculation'] = vehicleData.registration.registrationNumber;
      formatted['Pays'] = vehicleData.registration.country || 'FR';
    }

    if (vehicleData.additionalInfo) {
      formatted['Informations supplémentaires'] = vehicleData.additionalInfo;
    }

    return formatted;
  }

  /**
   * Simulation de décodage VIN (à remplacer par une API réelle)
   */
  private mockDecodeVIN(vin: string): VehicleIdentification {
    const brands = ['RENAULT', 'PEUGEOT', 'CITROEN', 'VOLKSWAGEN', 'BMW', 'AUDI'];
    const models = ['CLIO', '208', 'C3', 'GOLF', 'SERIE3', 'A4'];
    
    return {
      brand: brands[vin.charCodeAt(0) % brands.length],
      model: models[vin.charCodeAt(1) % models.length],
      year: 2000 + (vin.charCodeAt(9) % 25),
      engine: '1.6L',
      fuelType: 'Essence',
      transmission: 'Manuelle'
    };
  }

  /**
   * Simulation de recherche de pièces compatibles
   */
  private mockFindCompatibleParts(vehicleData: { oemReference?: string }): PartCompatibility[] {
    return [
      {
        partId: 'PART001',
        partReference: 'BOSCH-0123456789',
        isOemPart: false,
        equivalentParts: ['VALEO-987654321', 'CONTINENTAL-456789123'],
        compatibleVehicles: [],
        category: 'Freinage',
        subCategory: 'Plaquettes de frein'
      },
      {
        partId: 'PART002',
        partReference: 'OEM-ORIGINAL-123',
        isOemPart: true,
        equivalentParts: ['FEBI-67890', 'LEMFORDER-13579'],
        compatibleVehicles: [],
        category: 'Suspension',
        subCategory: 'Amortisseurs'
      }
    ];
  }
}
