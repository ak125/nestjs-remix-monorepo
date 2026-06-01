/**
 * Tests — `PiecesHeroFactChip` (Tier 2 primitive réutilisable).
 *
 * Chip atomique avec icon + label, variantes pour le contexte du hero R2.
 * Variants : `default` (overlay subtle) | `verified` (success semantic).
 */

import { CheckCircle2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PiecesHeroFactChip } from '~/components/pieces/hero/PiecesHeroFactChip';

describe('PiecesHeroFactChip', () => {
  it('rend le label fourni', () => {
    render(<PiecesHeroFactChip icon={CheckCircle2} label="24 références" />);
    expect(screen.queryByText('24 références')).not.toBeNull();
  });

  it('rend une icône décorative (aria-hidden)', () => {
    const { container } = render(
      <PiecesHeroFactChip icon={CheckCircle2} label="Test" />,
    );
    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).not.toBeNull();
  });

  it('variant `verified` applique la classe success token', () => {
    const { container } = render(
      <PiecesHeroFactChip
        icon={CheckCircle2}
        label="Compatible"
        variant="verified"
      />,
    );
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.className).toMatch(/bg-success\/15|ring-success/);
  });

  it('variant `default` n\'applique PAS de classe success', () => {
    const { container } = render(
      <PiecesHeroFactChip icon={CheckCircle2} label="Default" />,
    );
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.className).not.toMatch(/bg-success|ring-success/);
  });

  it('respecte motion-safe (transition gated par prefers-reduced-motion)', () => {
    const { container } = render(
      <PiecesHeroFactChip icon={CheckCircle2} label="Test" />,
    );
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.className).toMatch(/motion-safe:/);
  });

  it('utilise font-body (canon DM Sans)', () => {
    const { container } = render(
      <PiecesHeroFactChip icon={CheckCircle2} label="Test" />,
    );
    const text = container.querySelector('[class*="font-body"]');
    expect(text).not.toBeNull();
  });

  it('accepte une description sr-only pour a11y data list', () => {
    render(
      <PiecesHeroFactChip
        icon={CheckCircle2}
        label="24 références"
        srLabel="Nombre de références produit"
      />,
    );
    expect(
      screen.queryByText('Nombre de références produit'),
    ).not.toBeNull();
  });
});
