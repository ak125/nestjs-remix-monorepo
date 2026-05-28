/**
 * Tests — `PiecesHeroPriceCard` (Tier 1 dominant).
 *
 * Affiche le prix "à partir de" sur la hero R2. Visuellement le plus fort
 * des 3 tiers. N'apparaît pas si minPrice est absent ou <= 0.
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { PiecesHeroPriceCard } from '~/components/pieces/hero/PiecesHeroPriceCard';

describe('PiecesHeroPriceCard', () => {
  it('rend null quand minPrice est undefined', () => {
    const { container } = render(<PiecesHeroPriceCard minPrice={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('rend null quand minPrice est 0', () => {
    const { container } = render(<PiecesHeroPriceCard minPrice={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('rend null quand minPrice est négatif (anti-data-corruption)', () => {
    const { container } = render(<PiecesHeroPriceCard minPrice={-5} />);
    expect(container.firstChild).toBeNull();
  });

  it('formate le prix avec 2 décimales et symbole €', () => {
    const { getByText } = render(<PiecesHeroPriceCard minPrice={49.9} />);
    expect(getByText(/49,90\s*€|49\.90\s*€/)).not.toBeNull();
  });

  it('affiche le label "À partir de"', () => {
    const { getByText } = render(<PiecesHeroPriceCard minPrice={10} />);
    expect(getByText(/À partir de/i)).not.toBeNull();
  });

  it('utilise font-heading pour le prix (canon Outfit)', () => {
    const { container } = render(<PiecesHeroPriceCard minPrice={10} />);
    const price = container.querySelector('[class*="font-heading"]');
    expect(price).not.toBeNull();
  });

  it('utilise font-body pour le label (canon DM Sans)', () => {
    const { container } = render(<PiecesHeroPriceCard minPrice={10} />);
    const label = container.querySelector('[class*="font-body"]');
    expect(label).not.toBeNull();
  });

  it('icon Lucide avec aria-hidden (décorative)', () => {
    const { container } = render(<PiecesHeroPriceCard minPrice={10} />);
    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).not.toBeNull();
  });

  it('icon bg utilise le token CTA (bg-cta)', () => {
    const { container } = render(<PiecesHeroPriceCard minPrice={10} />);
    const ctaBg = container.querySelector('[class*="bg-cta"]');
    expect(ctaBg).not.toBeNull();
  });

  it('respecte motion-safe sur les transitions', () => {
    const { container } = render(<PiecesHeroPriceCard minPrice={10} />);
    const card = container.firstElementChild as HTMLElement;
    if (card) {
      expect(card.className).toMatch(/motion-safe:|transition-shadow/);
    }
  });

  it('utilise <output> sémantique pour la valeur monétaire (machine-readable)', () => {
    const { container } = render(<PiecesHeroPriceCard minPrice={49.9} />);
    const output = container.querySelector('output');
    expect(output).not.toBeNull();
  });
});
