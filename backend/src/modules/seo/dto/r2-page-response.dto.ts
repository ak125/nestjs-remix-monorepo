import type { R2ContentContract } from '../../../config/r2-content-contract.schema';

export type R2PageResponseDto = {
  seo: {
    title: string;
    description: string;
    canonical: string;
    robots: 'index,follow' | 'noindex,follow';
  };
  diversityContract: R2ContentContract;
};
