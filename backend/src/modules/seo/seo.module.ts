import { Module } from '@nestjs/common';
import { SeoService } from './seo.service';
import { SitemapService } from './sitemap.service';
import { SeoController } from './seo.controller';
import { SitemapController } from './sitemap.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [SeoController, SitemapController],
  providers: [SeoService, SitemapService],
  exports: [SeoService, SitemapService],
})
export class SeoModule {}
