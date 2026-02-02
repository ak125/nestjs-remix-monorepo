/**
 * RPC Safety Gate - Module
 *
 * Global module that provides RPC governance across the application.
 * Imported once in AppModule and available everywhere.
 */

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RpcGateService } from './rpc-gate.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RpcGateService],
  exports: [RpcGateService],
})
export class RpcGateModule {}
