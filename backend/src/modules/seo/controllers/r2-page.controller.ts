import { Controller, Get, Param } from '@nestjs/common';
import { R2PagePlanService } from '../services/r2-page-plan.service';
import { R2ValidatorService } from '../services/r2-validator.service';
import { buildR2Meta } from '../../../config/r2-meta-builder.utils';
import type {
  R2Range,
  R2Vehicle,
} from '../../../config/r2-content-contract.schema';
import type { R2PageResponseDto } from '../dto/r2-page-response.dto';

@Controller('seo/r2')
export class R2PageController {
  constructor(
    private readonly pagePlanService: R2PagePlanService,
    private readonly validatorService: R2ValidatorService,
  ) {}

  @Get(':range/:brand/:model/:vehicle')
  async getRangeVehiclePage(
    @Param('range') rangeSlug: string,
    @Param('brand') brand: string,
    @Param('model') model: string,
    @Param('vehicle') vehicleSlug: string,
  ): Promise<R2PageResponseDto> {
    const canonicalUrl = `https://www.automecanik.com/${rangeSlug}/${brand}/${model}/${vehicleSlug}`;

    // TODO: Fetch real vehicle/range data from DB
    const vehicle: R2Vehicle = {
      brandSlug: brand,
      modelSlug: model,
      vehicleSlug,
      fuelType: 'diesel' as const,
      label: 'RENAULT CLIO III 1.5 dCi 86 ch',
      productionStartYear: 2005,
      productionEndYear: 2012,
      powerHp: 86,
    };

    const range: R2Range = {
      rangeSlug,
      rangeLabel: 'Plaquette de frein',
      rangeFamily: 'freinage',
      positionVariants: ['avant', 'arriere', 'non_positionnel'],
    };

    const pagePlan = this.pagePlanService.build(vehicle, range, {
      compatibilitySummary: [
        "La compatibilité peut varier entre l'avant et l'arrière.",
        'Certaines références dépendent du système de freinage monté sur le véhicule.',
        'Une vérification avec OEM ou VIN est recommandée avant commande.',
      ],
      selectionGuide: [
        'Vérifiez la position de montage : avant ou arrière.',
        'Contrôlez le système de freinage avant de choisir la référence.',
        "Comparez avec la référence d'origine si un doute subsiste.",
      ],
      catalogSignals: [
        '36 pièces disponibles',
        '14 marques proposées',
        'Sous-groupes avant, arrière et accessoires disponibles',
      ],
      faqQuestions: [
        'Comment choisir entre plaquettes avant et arrière ?',
        'La référence change-t-elle selon le système de freinage ?',
        "Faut-il vérifier l'OEM avant commande ?",
      ],
      subgroups: [
        {
          key: 'plaquettes-avant',
          label: 'Plaquettes avant',
          productCount: 12,
          oemCount: 9,
        },
        {
          key: 'plaquettes-arriere',
          label: 'Plaquettes arrière',
          productCount: 12,
          oemCount: 41,
        },
        {
          key: 'plaquettes-standard',
          label: 'Plaquettes',
          productCount: 5,
          oemCount: 0,
        },
        {
          key: 'accessoires-avant',
          label: 'Accessoires avant',
          productCount: 2,
          oemCount: 1,
        },
        {
          key: 'accessoires-arriere',
          label: 'Accessoires arrière',
          productCount: 1,
          oemCount: 2,
        },
      ],
      hasOemCompact: true,
      hasGuides: true,
      hasStats: true,
      hasMinimalReassurance: true,
    });

    const contract = this.validatorService.createContract({
      canonicalUrl,
      vehicle,
      range,
      pagePlan,
      knowledge: {
        productReferenceKeys: [
          '24996z',
          '6214051',
          'N360N87',
          '0 986 424 795',
          '2397301',
          'MDB2595',
        ],
        subgroupKeys: pagePlan.subgroups.map((s) => s.key),
        repeatedFaqCount: 1,
        sharedProductRatioWithNearest: 0.22,
        sharedBrandRatioWithNearest: 0.35,
        sharedOemRatioWithNearest: 0.18,
        hasYearDelta: true,
        hasPositionDelta: true,
        hasSystemDelta: true,
        hasVinOrOemCheck: true,
        compatibilityRuleCount: 4,
        subgroupCount: pagePlan.subgroups.length,
        hasMultiplePositions: true,
        hasAccessoriesGroup: true,
        hasCompactOemGroup: true,
        subgroupOverlapRatioWithNearest: 0.3,
        sharedTextBlockRatio: 0.42,
        sharedFaqRatio: 0.33,
        sharedSubgroupRatio: 0.25,
        sharedCompatibilityRatio: 0.3,
        sameContentFingerprintCount: 0,
        sameProductSetSignatureCount: 0,
        sameCompatibilitySignatureCount: 0,
      },
    });

    return {
      seo: buildR2Meta(contract),
      diversityContract: contract,
    };
  }
}
