import { Injectable, Logger } from '@nestjs/common';
import { BaseNumericParamPipe } from './base-numeric-param.pipe';
import { PositiveIntParamSchema } from '../../schemas/numeric-param.schema';

/**
 * Pipe path-param scalar **canonique** pour tout id numérique : string
 * décimale stricte → `number` int4 borné (1..2_147_483_647 = borne de
 * stockage Postgres `integer`, le type de toutes les colonnes PK d'id).
 * Voir `PositiveIntParamSchema` pour le détail + le pourquoi du non-split
 * smallint.
 *
 * Usage : `@Param('typeId', PositiveIntParamPipe) typeId: number`
 */
@Injectable()
export class PositiveIntParamPipe extends BaseNumericParamPipe {
  protected readonly logger = new Logger(PositiveIntParamPipe.name);

  constructor() {
    super(PositiveIntParamSchema);
  }
}
