import { Module } from '@nestjs/common';
import { SupplierCardRepository } from './supplier-card.repository';

/**
 * Fiche fournisseur (mandat CH) : le seul fournisseur de
 * `SupplierCardRepository`. Aucun connecteur, aucune file Bull, aucun
 * planificateur : un importeur ne tire que la lecture et l'écriture de la fiche.
 *
 * Importeur : `SuppliersModule` (écrans admin `admin.suppliers.$id*`).
 */
@Module({
  providers: [SupplierCardRepository],
  exports: [SupplierCardRepository],
})
export class SupplierCardModule {}
