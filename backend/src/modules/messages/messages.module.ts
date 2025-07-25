/**
 * Module Messages - Table ___xtr_msg
 * Communication entre clients et staff administratif
 */

import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { SupabaseRestService } from '../../database/supabase-rest.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, SupabaseRestService],
  exports: [MessagesService],
})
export class MessagesModule {}
