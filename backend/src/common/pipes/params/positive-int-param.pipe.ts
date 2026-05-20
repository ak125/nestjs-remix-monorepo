import { Injectable, Logger } from '@nestjs/common';
import { BaseNumericParamPipe } from './base-numeric-param.pipe';
import { PositiveIntParamSchema } from '../../schemas/numeric-param.schema';

/**
 * Pipe path-param scalar : string décimale stricte → `number` int4
 * borné (1..2_147_483_647). Mêmes garanties que
 * PositiveSmallIntParamPipe, range étendu.
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
