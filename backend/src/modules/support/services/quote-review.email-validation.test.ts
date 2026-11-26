/**
 * QuoteService et ReviewService — adresse électronique des demandes de devis
 * et des avis (routes d'administration du support).
 *
 * L'adresse passe par le validateur commun : une adresse plus longue que la
 * borne reçoit la même réponse qu'une adresse mal formée, avant toute lecture
 * ou écriture en base.
 *
 * Les deux services étendent SupabaseBaseService : l'instance est construite
 * via Object.create et le client Supabase est un faux.
 */
import { BadRequestException } from '@nestjs/common';
import { DomainValidationException, ErrorCodes } from '@common/exceptions';
import { EMAIL_MAX_LENGTH } from '@common/utils/email-validation.util';
import { QuoteService } from './quote.service';
import { ReviewService, type ReviewCreateRequest } from './review.service';

const TOO_LONG = `${'a'.repeat(EMAIL_MAX_LENGTH)}@example.test`;

function makeService<T>(prototype: T) {
  const service = Object.create(prototype as object) as T;
  const supabase = { from: jest.fn() };
  const logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
  Object.assign(service as object, {
    supabase,
    logger,
    notificationService: {},
  });
  return { service, supabase };
}

function quote(customerEmail: string) {
  return {
    customerName: 'Prénom Nom',
    customerEmail,
    projectDescription: 'Pièces pour un atelier',
    requiredProducts: [{ name: 'Filtre à huile', quantity: 2 }],
    priority: 'normal' as const,
  };
}

function review(email: string): ReviewCreateRequest {
  return {
    name: 'Prénom Nom',
    email,
    product_id: '12345',
    rating: 5,
    title: 'Très bonne pièce',
    comment: 'Montage simple, pièce conforme à la description.',
  };
}

describe('QuoteService.submitQuoteRequest — adresse électronique', () => {
  it.each([
    ['plus longue que la borne', TOO_LONG],
    ['mal formée', 'pas-un-email'],
  ])('adresse %s → 400 INVALID_EMAIL, rien lu ni écrit', async (_, email) => {
    const { service, supabase } = makeService(QuoteService.prototype);

    const error = await service
      .submitQuoteRequest(quote(email))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DomainValidationException);
    expect((error as DomainValidationException).getStatus()).toBe(400);
    expect((error as DomainValidationException).code).toBe(
      ErrorCodes.VALIDATION.INVALID_EMAIL,
    );
    expect((error as DomainValidationException).message).toBe(
      'Invalid email format',
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('adresse valide → la validation passe et le traitement commence', async () => {
    const { service, supabase } = makeService(QuoteService.prototype);
    supabase.from.mockImplementation(() => {
      throw new Error('base atteinte');
    });

    await expect(
      service.submitQuoteRequest(quote('client@example.test')),
    ).rejects.toThrow('base atteinte');
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});

describe('ReviewService.submitReview — adresse électronique', () => {
  it.each([
    ['plus longue que la borne', TOO_LONG],
    ['mal formée', 'pas-un-email'],
  ])(
    'adresse %s → 400 « Format email invalide », rien lu ni écrit',
    async (_, email) => {
      const { service, supabase } = makeService(ReviewService.prototype);

      const error = await service
        .submitReview(review(email))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(400);
      expect((error as BadRequestException).message).toBe(
        'Format email invalide',
      );
      expect(supabase.from).not.toHaveBeenCalled();
    },
  );

  it('adresse valide → la validation passe et le traitement commence', async () => {
    const { service, supabase } = makeService(ReviewService.prototype);
    supabase.from.mockImplementation(() => {
      throw new Error('base atteinte');
    });

    await expect(
      service.submitReview(review('client@example.test')),
    ).rejects.toThrow('base atteinte');
    expect(supabase.from).toHaveBeenCalled();
  });
});
