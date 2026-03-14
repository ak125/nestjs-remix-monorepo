import { Injectable } from '@nestjs/common';
import {
  buildR2H1,
  buildR2Title,
} from '../../../config/r2-heading-policy.utils';
import type {
  R2PagePlan,
  R2Range,
  R2Vehicle,
} from '../../../config/r2-content-contract.schema';

type R2PlanKnowledge = {
  compatibilitySummary: string[];
  selectionGuide: string[];
  catalogSignals: string[];
  faqQuestions: string[];
  subgroups: Array<{
    key: string;
    label: string;
    productCount: number;
    oemCount?: number;
  }>;
  hasOemCompact?: boolean;
  hasGuides?: boolean;
  hasStats?: boolean;
  hasMinimalReassurance?: boolean;
};

@Injectable()
export class R2PagePlanService {
  build(
    vehicle: R2Vehicle,
    range: R2Range,
    knowledge: R2PlanKnowledge,
  ): R2PagePlan {
    const orderedBlocks: R2PagePlan['orderedBlocks'] = [
      'heroRangeVehicle',
      'compatibilitySummary',
      'selectionGuide',
      'productSubgroups',
      'productListing',
      'compatibilityInfoBox',
    ];

    if (knowledge.hasOemCompact) {
      orderedBlocks.push('oemReferencesCompact');
    }

    if (knowledge.faqQuestions.length > 0) {
      orderedBlocks.push('faqSpecific');
    }

    if (knowledge.hasStats) {
      orderedBlocks.push('technicalStatsCompact');
    }

    if (knowledge.hasGuides) {
      orderedBlocks.push('relatedGuidesMinimal');
    }

    if (knowledge.hasMinimalReassurance) {
      orderedBlocks.push('reassuranceMinimal');
    }

    const specificBlocks = orderedBlocks.filter((block) =>
      [
        'compatibilitySummary',
        'selectionGuide',
        'activeFiltersSummary',
        'productSubgroups',
        'oemReferencesCompact',
        'faqSpecific',
        'compatibilityInfoBox',
        'technicalStatsCompact',
        'relatedGuidesMinimal',
      ].includes(block),
    ) as R2PagePlan['specificBlocks'];

    return {
      h1: buildR2H1(vehicle, range),
      title: buildR2Title(vehicle, range),
      orderedBlocks,
      specificBlocks,
      compatibilitySummary: knowledge.compatibilitySummary.slice(0, 6),
      selectionGuide: knowledge.selectionGuide.slice(0, 6),
      catalogSignals: knowledge.catalogSignals.slice(0, 8),
      subgroups: knowledge.subgroups.slice(0, 8),
      faqQuestions: knowledge.faqQuestions.slice(0, 4),
    };
  }
}
