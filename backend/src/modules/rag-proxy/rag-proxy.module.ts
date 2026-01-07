import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RagProxyController } from './rag-proxy.controller';
import { RagProxyService } from './rag-proxy.service';

@Module({
  imports: [ConfigModule],
  controllers: [RagProxyController],
  providers: [RagProxyService],
  exports: [RagProxyService],
})
export class RagProxyModule {}
