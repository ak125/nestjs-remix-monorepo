import { Injectable, Logger } from '@nestjs/common';
import { BaseNumericParamPipe } from './base-numeric-param.pipe';
import { PositiveSmallIntParamSchema } from '../../schemas/numeric-param.schema';

/**
 * Pipe path-param scalar : string décimale stricte → `number` smallint
 * borné (1..32767). Throws `BadRequestException` 400 en amont service/DB.
 *
 * Usage : `@Param('brandId', PositiveSmallIntParamPipe) brandId: number`
 */
@Injectable()
export class PositiveSmallIntParamPipe extends BaseNumericParamPipe {
  protected readonly logger = new Logger(PositiveSmallIntParamPipe.name);

  constructor() {
    super(PositiveSmallIntParamSchema);
  }
}
