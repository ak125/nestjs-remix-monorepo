import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../../../common/decorators/user.decorator';
import { AddressesService } from '../services/addresses.service';
import {
  CreateBillingAddressSchema,
  CreateDeliveryAddressSchema,
  UpdateDeliveryAddressSchema,
  CreateBillingAddressDto,
  CreateDeliveryAddressDto,
  UpdateDeliveryAddressDto,
  BillingAddress,
  DeliveryAddress,
  AddressListResponse,
} from '../dto/addresses.dto';

/**
 * Contrôleur moderne pour la gestion des adresses
 * ✅ Compatible avec myspace.account.change.adr.f.php et myspace.account.change.adr.l.php
 * ✅ Validation Zod intégrée
 * ✅ Documentation Swagger complète
 */
@ApiTags('Addresses')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  // =====================================
  // TOUTES LES ADRESSES
  // =====================================

  @Get()
  @ApiOperation({
    summary: 'Récupérer toutes les adresses du client connecté',
    description: "Retourne l'adresse de facturation et toutes les adresses de livraison",
  })
  @ApiResponse({
    status: 200,
    description: 'Adresses récupérées avec succès',
    type: Object,
  })
  async getAllAddresses(@User('id') userId: number): Promise<AddressListResponse> {
    return this.addressesService.getAllAddresses(userId);
  }

  // =====================================
  // ADRESSES DE FACTURATION
  // =====================================

  @Get('billing')
  @ApiOperation({
    summary: "Récupérer l'adresse de facturation",
    description: "Retourne l'adresse de facturation du client connecté",
  })
  @ApiResponse({
    status: 200,
    description: 'Adresse de facturation récupérée',
    type: Object,
  })
  async getBillingAddress(@User('id') userId: number): Promise<BillingAddress | null> {
    return this.addressesService.getBillingAddress(userId);
  }

  @Post('billing')
  @ApiOperation({
    summary: "Créer ou mettre à jour l'adresse de facturation",
    description: 'Équivalent de myspace.account.change.adr.f.php',
  })
  @ApiResponse({
    status: 201,
    description: 'Adresse de facturation sauvegardée',
    type: Object,
  })
  async upsertBillingAddress(
    @User('id') userId: number,
    @Body() addressData: CreateBillingAddressDto,
  ): Promise<BillingAddress> {
    // Validation avec Zod
    const validatedData = CreateBillingAddressSchema.omit({
      customerId: true,
    }).parse(addressData);
    
    return this.addressesService.upsertBillingAddress(userId, validatedData);
  }

  // =====================================
  // ADRESSES DE LIVRAISON
  // =====================================

  @Get('delivery')
  @ApiOperation({
    summary: 'Récupérer toutes les adresses de livraison',
    description: 'Retourne toutes les adresses de livraison du client, triées par défaut',
  })
  @ApiResponse({
    status: 200,
    description: 'Adresses de livraison récupérées',
    type: [Object],
  })
  async getDeliveryAddresses(@User('id') userId: number): Promise<DeliveryAddress[]> {
    return this.addressesService.getDeliveryAddresses(userId);
  }

  @Get('delivery/default')
  @ApiOperation({
    summary: "Récupérer l'adresse de livraison par défaut",
    description: "Retourne l'adresse de livraison marquée comme défaut",
  })
  @ApiResponse({
    status: 200,
    description: 'Adresse de livraison par défaut récupérée',
    type: Object,
  })
  async getDefaultDeliveryAddress(@User('id') userId: number): Promise<DeliveryAddress | null> {
    return this.addressesService.getDefaultDeliveryAddress(userId);
  }

  @Post('delivery')
  @ApiOperation({
    summary: 'Créer une nouvelle adresse de livraison',
    description: 'Ajoute une nouvelle adresse de livraison pour le client',
  })
  @ApiResponse({
    status: 201,
    description: 'Adresse de livraison créée',
    type: Object,
  })
  async createDeliveryAddress(
    @User('id') userId: number,
    @Body() addressData: CreateDeliveryAddressDto,
  ): Promise<DeliveryAddress> {
    // Validation avec Zod
    const validatedData = CreateDeliveryAddressSchema.omit({
      customerId: true,
    }).parse(addressData);
    
    return this.addressesService.createDeliveryAddress(userId, validatedData);
  }

  @Patch('delivery/:addressId')
  @ApiOperation({
    summary: 'Mettre à jour une adresse de livraison',
    description: 'Met à jour une adresse de livraison existante',
  })
  @ApiResponse({
    status: 200,
    description: 'Adresse de livraison mise à jour',
    type: Object,
  })
  async updateDeliveryAddress(
    @User('id') userId: number,
    @Param('addressId', ParseIntPipe) addressId: number,
    @Body() addressData: UpdateDeliveryAddressDto,
  ): Promise<DeliveryAddress> {
    // Validation avec Zod
    const validatedData = UpdateDeliveryAddressSchema.parse(addressData);
    
    return this.addressesService.updateDeliveryAddress(userId, addressId, validatedData);
  }

  @Delete('delivery/:addressId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une adresse de livraison',
    description: 'Supprime une adresse de livraison (minimum 1 adresse obligatoire)',
  })
  @ApiResponse({
    status: 204,
    description: 'Adresse de livraison supprimée',
  })
  async deleteDeliveryAddress(
    @User('id') userId: number,
    @Param('addressId', ParseIntPipe) addressId: number,
  ): Promise<void> {
    return this.addressesService.deleteDeliveryAddress(userId, addressId);
  }

  @Patch('delivery/:addressId/set-default')
  @ApiOperation({
    summary: 'Définir une adresse de livraison par défaut',
    description: 'Marque cette adresse comme défaut et retire le défaut des autres',
  })
  @ApiResponse({
    status: 200,
    description: 'Adresse définie comme défaut',
    type: Object,
  })
  async setDefaultDeliveryAddress(
    @User('id') userId: number,
    @Param('addressId', ParseIntPipe) addressId: number,
  ): Promise<DeliveryAddress> {
    return this.addressesService.setDefaultDeliveryAddress(userId, addressId);
  }
}
