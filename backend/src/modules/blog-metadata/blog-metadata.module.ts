/**
 * 📝 BLOG METADATA MODULE
 *
 * Module pour gérer les métadonnées SEO des pages blog
 * depuis la table __blog_meta_tags_ariane
 */

import { Module } from '@nestjs/common';
import { BlogMetadataService } from './blog-metadata.service';
import { BlogMetadataController } from './blog-metadata.controller';

@Module({
  controllers: [BlogMetadataController],
  providers: [BlogMetadataService],
  exports: [BlogMetadataService], // Exporté pour être utilisé par d'autres modules
})
export class BlogMetadataModule {}
