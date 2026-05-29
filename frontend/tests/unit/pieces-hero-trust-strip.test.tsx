/**
 * Tests — `PiecesHeroTrustStrip` (composition 3-tier).
 *
 * Compose PriceCard (Tier 1) + 2 FactChips (Tier 2) + MetaStrip (Tier 3).
 * Assertions ciblées (pas de snapshot lourd sur classes Tailwind responsives,
 * trop fragile — on vérifie présence des classes responsive critiques).
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PiecesHeroTrustStrip } from '~/components/pieces/hero/PiecesHeroTrustStrip';
import { SITE_TRUST_CLAIMS } from '~/components/pieces/hero/site-trust-claims';

const baseProps = {
  count: 24,
  vehicleModele: 'Megane',
  vehicleType: '1.5 dCi 90',
};

describe('PiecesHeroTrustStrip — composition', () => {
  it('rend le container avec role region + aria-label', () => {
    const { container } = render(<PiecesHeroTrustStrip {...baseProps} />);
    const section = container.querySelector('section[aria-label]');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('aria-label')).toMatch(/tarif|garantie/i);
  });

  it('rend le PriceCard quand minPrice fourni', () => {
    render(<PiecesHeroTrustStrip {...baseProps} minPrice={49.9} />);
    expect(screen.queryByText(/À partir de/i)).not.toBeNull();
  });

  it('omet le PriceCard quand minPrice absent', () => {
    render(<PiecesHeroTrustStrip {...baseProps} />);
    expect(screen.queryByText(/À partir de/i)).toBeNull();
  });

  it('rend le FactChip count (références)', () => {
    const { container } = render(
      <PiecesHeroTrustStrip {...baseProps} count={24} />,
    );
    // Text est split entre <span> et parent → on cherche dans textContent
    expect(container.textContent).toMatch(/24\s*références?/i);
  });

  it('rend le FactChip compat. véhicule avec modele + type', () => {
    render(
      <PiecesHeroTrustStrip
        {...baseProps}
        vehicleModele="Megane"
        vehicleType="1.5 dCi 90"
      />,
    );
    expect(screen.queryByText(/Megane/i)).not.toBeNull();
    expect(screen.queryByText(/1\.5 dCi 90/i)).not.toBeNull();
  });

  it('rend les 3 claims SoT (MetaStrip)', () => {
    render(<PiecesHeroTrustStrip {...baseProps} />);
    for (const claim of SITE_TRUST_CLAIMS) {
      expect(screen.queryByText(claim.label)).not.toBeNull();
    }
  });

  it('singulier "référence" quand count = 1', () => {
    const { container } = render(
      <PiecesHeroTrustStrip {...baseProps} count={1} />,
    );
    expect(container.textContent).toMatch(/1\s*référence(?!s)/i);
  });

  it('pluriel "références" quand count > 1', () => {
    const { container } = render(
      <PiecesHeroTrustStrip {...baseProps} count={5} />,
    );
    expect(container.textContent).toMatch(/5\s*références/i);
  });
});

describe('PiecesHeroTrustStrip — debug performance', () => {
  it('cache le bloc debugPerformance en production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { container } = render(
        <PiecesHeroTrustStrip
          {...baseProps}
          debugPerformance={{ source: 'rm-v2', loadTime: 42 }}
        />,
      );
      expect(container.textContent).not.toMatch(/rm-v2/);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('affiche debugPerformance hors production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      render(
        <PiecesHeroTrustStrip
          {...baseProps}
          debugPerformance={{ source: 'rm-v2', loadTime: 42 }}
        />,
      );
      expect(screen.queryByText(/rm-v2/)).not.toBeNull();
      expect(screen.queryByText(/42ms/)).not.toBeNull();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe('PiecesHeroTrustStrip — classes responsive critiques', () => {
  it('le container utilise flex-wrap pour adapter mobile/desktop', () => {
    const { container } = render(
      <PiecesHeroTrustStrip {...baseProps} minPrice={10} />,
    );
    // chercher au moins 1 élément avec flex-wrap (responsive layout cue)
    const flexWrap = container.querySelector('[class*="flex-wrap"]');
    expect(flexWrap).not.toBeNull();
  });

  it('aucun hex hardcodé dans le rendu (tokens uniquement)', () => {
    const { container } = render(
      <PiecesHeroTrustStrip {...baseProps} minPrice={10} />,
    );
    const html = container.innerHTML;
    // Pas de #XXX ou #XXXXXX inline dans className ou style
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('aucun inline style (Tailwind classes uniquement)', () => {
    const { container } = render(
      <PiecesHeroTrustStrip {...baseProps} minPrice={10} />,
    );
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
  });
});
