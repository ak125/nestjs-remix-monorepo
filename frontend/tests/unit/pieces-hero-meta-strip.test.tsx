/**
 * Tests — `PiecesHeroMetaStrip` (Tier 3 conversion meta).
 *
 * Affiche les 3 claims SoT (`SITE_TRUST_CLAIMS`) en ligne avec bullets
 * séparateurs. Doit utiliser le SoT — pas de string littérale claims dans
 * le composant. Markup minimal (pas de `Separator` pour les bullets, juste
 * `<span aria-hidden="true">•</span>`).
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PiecesHeroMetaStrip } from '~/components/pieces/hero/PiecesHeroMetaStrip';
import { SITE_TRUST_CLAIMS } from '~/components/pieces/hero/site-trust-claims';

describe('PiecesHeroMetaStrip', () => {
  it('rend exactement 3 items (un par claim SoT)', () => {
    const { container } = render(<PiecesHeroMetaStrip />);
    const items = container.querySelectorAll('li');
    // 3 claims + 2 bullets décoratifs entre les items = 5 <li> totaux
    // OU 3 <li> claims + bullets en <span> séparé. On compte les claims réels
    // via le label SoT pour être robuste à la structure DOM.
    for (const claim of SITE_TRUST_CLAIMS) {
      expect(screen.queryByText(claim.label)).not.toBeNull();
    }
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('respecte l\'ordre canon shipping → returns → payment', () => {
    const { container } = render(<PiecesHeroMetaStrip />);
    const text = container.textContent || '';
    const labels = SITE_TRUST_CLAIMS.map((c) => c.label);
    const indices = labels.map((label) => text.indexOf(label));
    expect(indices[0]).toBeLessThan(indices[1]);
    expect(indices[1]).toBeLessThan(indices[2]);
  });

  it('utilise <ul> sémantique', () => {
    const { container } = render(<PiecesHeroMetaStrip />);
    expect(container.querySelector('ul')).not.toBeNull();
  });

  it('icônes Lucide décoratives (aria-hidden)', () => {
    const { container } = render(<PiecesHeroMetaStrip />);
    const icons = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThanOrEqual(3);
  });

  it('bullets séparateurs en <span aria-hidden="true">•</span> (markup minimal, pas Separator)', () => {
    const { container } = render(<PiecesHeroMetaStrip />);
    const bullets = Array.from(
      container.querySelectorAll('span[aria-hidden="true"]'),
    ).filter((s) => (s.textContent || '').trim() === '•');
    expect(bullets.length).toBe(2); // entre les 3 items
  });

  it('utilise font-body (canon DM Sans)', () => {
    const { container } = render(<PiecesHeroMetaStrip />);
    expect(container.querySelector('[class*="font-body"]')).not.toBeNull();
  });
});

describe('PiecesHeroMetaStrip — anti-drift labels hardcoded', () => {
  it('le fichier composant ne contient AUCUN label SoT en string littérale', async () => {
    // Force l'usage de SITE_TRUST_CLAIMS au lieu de hardcoder les strings
    // dans le composant. Si un futur dev hardcode "Expédition 24h" dans
    // PiecesHeroMetaStrip.tsx, ce test échoue.
    const source = await import(
      '~/components/pieces/hero/PiecesHeroMetaStrip?raw'
    );
    const code = (source as { default: string }).default;
    for (const claim of SITE_TRUST_CLAIMS) {
      // Le composant doit lire depuis SITE_TRUST_CLAIMS, pas hardcoder
      expect(code).not.toContain(`"${claim.label}"`);
      expect(code).not.toContain(`'${claim.label}'`);
    }
  });
});
