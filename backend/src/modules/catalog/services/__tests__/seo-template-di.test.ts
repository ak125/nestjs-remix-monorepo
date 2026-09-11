process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { CacheService } from '@cache/cache.service';
import { CatalogModule } from '../../catalog.module';
import { SeoModule } from '../../../seo/seo.module';
import { SeoPlaceholderEventsService } from '../../../seo/services/seo-placeholder-events.service';
import { SeoTemplateService } from '../seo-template.service';

/**
 * Câblage DI de la garde des marqueurs (2026-09-11). `SeoTemplateService`
 * dépend désormais de `SeoPlaceholderEventsService` : sans provider dans
 * `CatalogModule`, le démarrage du backend échouerait. Le service est fourni
 * par CatalogModule lui-même — importer SeoModule créerait un cycle (SeoModule
 * importe déjà CatalogModule).
 */
describe('SeoTemplateService — câblage DI', () => {
  it('CatalogModule fournit SeoTemplateService et son émetteur, sans importer SeoModule', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      CatalogModule,
    ) as unknown[];
    const imports = (
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, CatalogModule) as unknown[]
    ).map((i) =>
      i && typeof i === 'object' && 'forwardRef' in i
        ? (i as { forwardRef: () => unknown }).forwardRef()
        : i,
    );

    expect(providers).toContain(SeoTemplateService);
    expect(providers).toContain(SeoPlaceholderEventsService);
    expect(imports).not.toContain(SeoModule);
  });

  it('les dépendances du constructeur se résolvent (ConfigService global, cache)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [
        SeoTemplateService,
        SeoPlaceholderEventsService,
        { provide: CacheService, useValue: {} },
      ],
    }).compile();

    const svc = moduleRef.get(SeoTemplateService);
    expect(svc).toBeInstanceOf(SeoTemplateService);
    expect((svc as any).placeholderEvents).toBeInstanceOf(
      SeoPlaceholderEventsService,
    );
    await moduleRef.close();
  });
});
