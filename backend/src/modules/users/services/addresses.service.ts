import { TABLES } from '@repo/database-types';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import {
  CreateBillingAddressDto,
  CreateDeliveryAddressDto,
  UpdateDeliveryAddressDto,
  BillingAddress,
  DeliveryAddress,
  AddressListResponse,
} from '../dto/addresses.dto';

/**
 * Service moderne pour la gestion des adresses utilisateur
 * ✅ Architecture SupabaseBaseService cohérente
 * ✅ DTOs Zod validés
 * ✅ Compatible avec les tables existantes
 * ✅ Patterns d'erreur cohérents
 */
@Injectable()
export class AddressesService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('AddressesService initialized - Modern architecture');
  }

  // =====================================
  // ADRESSES DE FACTURATION
  // =====================================

  /**
   * Récupérer l'adresse de facturation d'un client
   */
  async getBillingAddress(customerId: number): Promise<BillingAddress | null> {
    try {
      const { data, error } = await this.client
        .from(TABLES.xtr_customer_billing_address)
        .select('*')
        .eq('customer_id', customerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Pas d'adresse trouvée
        }
        throw error;
      }

      return this.transformBillingAddress(data);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération de l'adresse de facturation pour le client ${customerId}:`,
        error,
      );
      throw new BadRequestException(
        "Impossible de récupérer l'adresse de facturation",
      );
    }
  }

  /**
   * Créer ou mettre à jour l'adresse de facturation (équivalent myspace.account.change.adr.f.php)
   */
  async upsertBillingAddress(
    customerId: number,
    addressData: Omit<CreateBillingAddressDto, 'customerId'>,
  ): Promise<BillingAddress> {
    try {
      // Vérifier si une adresse existe déjà
      const existing = await this.getBillingAddress(customerId);

      const addressPayload = {
        customer_id: customerId,
        firstname: addressData.firstname,
        lastname: addressData.lastname,
        company: addressData.company || null,
        address1: addressData.address1,
        address2: addressData.address2 || null,
        postal_code: addressData.postalCode,
        city: addressData.city,
        country: addressData.country || 'FR',
        phone: addressData.phone || null,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Mettre à jour
        const { data, error } = await this.client
          .from(TABLES.xtr_customer_billing_address)
          .update(addressPayload)
          .eq('customer_id', customerId)
          .select()
          .single();

        if (error) throw error;
        return this.transformBillingAddress(data);
      } else {
        // Créer
        const { data, error } = await this.client
          .from(TABLES.xtr_customer_billing_address)
          .insert({
            ...addressPayload,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        return this.transformBillingAddress(data);
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la sauvegarde de l'adresse de facturation pour le client ${customerId}:`,
        error,
      );
      throw new BadRequestException(
        "Impossible de sauvegarder l'adresse de facturation",
      );
    }
  }

  // =====================================
  // ADRESSES DE LIVRAISON
  // =====================================

  /**
   * Récupérer toutes les adresses de livraison d'un client (équivalent myspace.account.change.adr.l.php)
   */
  async getDeliveryAddresses(customerId: number): Promise<DeliveryAddress[]> {
    try {
      const { data, error } = await this.client
        .from(TABLES.xtr_customer_delivery_address)
        .select('*')
        .eq('customer_id', customerId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((addr) => this.transformDeliveryAddress(addr));
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des adresses de livraison pour le client ${customerId}:`,
        error,
      );
      throw new BadRequestException(
        'Impossible de récupérer les adresses de livraison',
      );
    }
  }

  /**
   * Récupérer l'adresse de livraison par défaut
   */
  async getDefaultDeliveryAddress(
    customerId: number,
  ): Promise<DeliveryAddress | null> {
    try {
      const { data, error } = await this.client
        .from(TABLES.xtr_customer_delivery_address)
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_default', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Pas d'adresse par défaut trouvée
        }
        throw error;
      }

      return this.transformDeliveryAddress(data);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération de l'adresse de livraison par défaut pour le client ${customerId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Ajouter une nouvelle adresse de livraison
   */
  async createDeliveryAddress(
    customerId: number,
    addressData: Omit<CreateDeliveryAddressDto, 'customerId'>,
  ): Promise<DeliveryAddress> {
    try {
      // Si c'est marqué par défaut, retirer le défaut des autres
      if (addressData.isDefault) {
        await this.clearDefaultDeliveryAddress(customerId);
      }

      const addressPayload = {
        customer_id: customerId,
        label: addressData.label || 'Adresse',
        firstname: addressData.firstname,
        lastname: addressData.lastname,
        company: addressData.company || null,
        address1: addressData.address1,
        address2: addressData.address2 || null,
        postal_code: addressData.postalCode,
        city: addressData.city,
        country: addressData.country || 'FR',
        phone: addressData.phone || null,
        is_default: addressData.isDefault || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.client
        .from(TABLES.xtr_customer_delivery_address)
        .insert(addressPayload)
        .select()
        .single();

      if (error) throw error;

      return this.transformDeliveryAddress(data);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création de l'adresse de livraison pour le client ${customerId}:`,
        error,
      );
      throw new BadRequestException(
        "Impossible de créer l'adresse de livraison",
      );
    }
  }

  /**
   * Mettre à jour une adresse de livraison
   */
  async updateDeliveryAddress(
    customerId: number,
    addressId: number,
    addressData: UpdateDeliveryAddressDto,
  ): Promise<DeliveryAddress> {
    try {
      // Vérifier que l'adresse appartient au client
      const existing = await this.getDeliveryAddressById(customerId, addressId);
      if (!existing) {
        throw new NotFoundException('Adresse de livraison introuvable');
      }

      // Si marqué par défaut, retirer le défaut des autres
      if (addressData.isDefault) {
        await this.clearDefaultDeliveryAddress(customerId, addressId);
      }

      const updatePayload: Record<string, any> = {
        ...addressData,
        postal_code: addressData.postalCode,
        address1: addressData.address1,
        address2: addressData.address2,
        is_default: addressData.isDefault,
        updated_at: new Date().toISOString(),
      };

      // Nettoyer les undefined
      Object.keys(updatePayload).forEach((key) => {
        if (updatePayload[key] === undefined) {
          delete updatePayload[key];
        }
      });

      const { data, error } = await this.client
        .from(TABLES.xtr_customer_delivery_address)
        .update(updatePayload)
        .eq('id', addressId)
        .eq('customer_id', customerId)
        .select()
        .single();

      if (error) throw error;

      return this.transformDeliveryAddress(data);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour de l'adresse de livraison ${addressId} pour le client ${customerId}:`,
        error,
      );
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        "Impossible de mettre à jour l'adresse de livraison",
      );
    }
  }

  /**
   * Supprimer une adresse de livraison
   */
  async deleteDeliveryAddress(
    customerId: number,
    addressId: number,
  ): Promise<void> {
    try {
      // Vérifier les contraintes métier
      const addresses = await this.getDeliveryAddresses(customerId);
      const targetAddress = addresses.find((a) => a.id === addressId);

      if (!targetAddress) {
        throw new NotFoundException('Adresse de livraison introuvable');
      }

      if (addresses.length === 1) {
        throw new BadRequestException(
          'Vous devez conserver au moins une adresse de livraison',
        );
      }

      // Supprimer l'adresse
      const { error } = await this.client
        .from(TABLES.xtr_customer_delivery_address)
        .delete()
        .eq('id', addressId)
        .eq('customer_id', customerId);

      if (error) throw error;

      // Si c'était l'adresse par défaut, en définir une autre
      if (targetAddress.isDefault && addresses.length > 1) {
        const newDefault = addresses.find((a) => a.id !== addressId);
        if (newDefault) {
          await this.setDefaultDeliveryAddress(customerId, newDefault.id);
        }
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression de l'adresse de livraison ${addressId} pour le client ${customerId}:`,
        error,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        "Impossible de supprimer l'adresse de livraison",
      );
    }
  }

  /**
   * Définir une adresse de livraison par défaut
   */
  async setDefaultDeliveryAddress(
    customerId: number,
    addressId: number,
  ): Promise<DeliveryAddress> {
    try {
      // Vérifier que l'adresse appartient au client
      const existing = await this.getDeliveryAddressById(customerId, addressId);
      if (!existing) {
        throw new NotFoundException('Adresse de livraison introuvable');
      }

      // Retirer le défaut de toutes les autres adresses
      await this.clearDefaultDeliveryAddress(customerId, addressId);

      // Définir cette adresse comme défaut
      const { data, error } = await this.client
        .from(TABLES.xtr_customer_delivery_address)
        .update({
          is_default: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', addressId)
        .eq('customer_id', customerId)
        .select()
        .single();

      if (error) throw error;

      return this.transformDeliveryAddress(data);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la définition de l'adresse par défaut ${addressId} pour le client ${customerId}:`,
        error,
      );
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        "Impossible de définir l'adresse par défaut",
      );
    }
  }

  /**
   * Récupérer toutes les adresses d'un client (facturation + livraison)
   */
  async getAllAddresses(customerId: number): Promise<AddressListResponse> {
    try {
      const [billingAddress, deliveryAddresses] = await Promise.all([
        this.getBillingAddress(customerId),
        this.getDeliveryAddresses(customerId),
      ]);

      const defaultDeliveryAddress = deliveryAddresses.find(
        (addr) => addr.isDefault,
      );

      return {
        billingAddress: billingAddress || undefined,
        deliveryAddresses,
        defaultDeliveryAddress,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération de toutes les adresses pour le client ${customerId}:`,
        error,
      );
      throw new BadRequestException('Impossible de récupérer les adresses');
    }
  }

  // =====================================
  // MÉTHODES PRIVÉES
  // =====================================

  private async getDeliveryAddressById(
    customerId: number,
    addressId: number,
  ): Promise<DeliveryAddress | null> {
    try {
      const { data, error } = await this.client
        .from(TABLES.xtr_customer_delivery_address)
        .select('*')
        .eq('id', addressId)
        .eq('customer_id', customerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return this.transformDeliveryAddress(data);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération de l'adresse ${addressId}:`,
        error,
      );
      return null;
    }
  }

  private async clearDefaultDeliveryAddress(
    customerId: number,
    excludeAddressId?: number,
  ): Promise<void> {
    try {
      let query = this.client
        .from(TABLES.xtr_customer_delivery_address)
        .update({
          is_default: false,
          updated_at: new Date().toISOString(),
        })
        .eq('customer_id', customerId);

      if (excludeAddressId) {
        query = query.neq('id', excludeAddressId);
      }

      const { error } = await query;
      if (error) throw error;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression des adresses par défaut pour le client ${customerId}:`,
        error,
      );
      throw error;
    }
  }

  private transformBillingAddress(data: any): BillingAddress {
    return {
      id: data.id,
      customerId: data.customer_id,
      firstname: data.firstname,
      lastname: data.lastname,
      company: data.company,
      address1: data.address1,
      address2: data.address2,
      postalCode: data.postal_code,
      city: data.city,
      country: data.country,
      phone: data.phone,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private transformDeliveryAddress(data: any): DeliveryAddress {
    return {
      id: data.id,
      customerId: data.customer_id,
      label: data.label,
      firstname: data.firstname,
      lastname: data.lastname,
      company: data.company,
      address1: data.address1,
      address2: data.address2,
      postalCode: data.postal_code,
      city: data.city,
      country: data.country,
      phone: data.phone,
      isDefault: data.is_default,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
