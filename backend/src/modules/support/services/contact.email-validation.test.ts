/**
 * ContactService — adresse électronique du formulaire de contact
 * (POST /api/support/contact → submitContactForm, et createContact).
 *
 * L'adresse passe par le validateur commun : une adresse plus longue que la
 * borne, ou qui n'est pas une chaîne, reçoit la même réponse qu'une adresse
 * mal formée (400 « Email invalide »), avant toute lecture ou écriture en base
 * et avant tout envoi de mail.
 *
 * Le service étend SupabaseBaseService : comme pour ReviewService, l'instance
 * est construite via Object.create et le client Supabase est un faux.
 */
import { BadRequestException } from '@nestjs/common';
import { EMAIL_MAX_LENGTH } from '@common/utils/email-validation.util';
import { ContactService, type ContactRequest } from './contact.service';

function makeService() {
  const service = Object.create(ContactService.prototype) as ContactService;
  const supabase = { from: jest.fn() };
  const mailService = { sendMail: jest.fn() };
  const notificationService = {};
  const logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
  Object.assign(service, {
    supabase,
    mailService,
    notificationService,
    logger,
  });
  return { service, supabase, mailService };
}

function contact(email: unknown): ContactRequest {
  return {
    name: 'Prénom Nom',
    email,
    subject: 'Question sur une commande',
    message: 'Bonjour, je souhaite un renseignement.',
    priority: 'normal',
    category: 'general',
  } as ContactRequest;
}

const TOO_LONG = `${'a'.repeat(EMAIL_MAX_LENGTH)}@example.test`;

describe.each([
  ['submitContactForm (route publique)', 'submitContactForm'],
  ['createContact', 'createContact'],
] as const)('ContactService.%s — adresse électronique', (_label, method) => {
  it.each([
    ['plus longue que la borne', TOO_LONG],
    ['mal formée', 'pas-un-email'],
    ['vide', ''],
    ['absente', undefined],
    ["qui n'est pas une chaîne", ['client@example.test']],
  ])(
    'adresse %s → 400 « Email invalide », rien lu ni écrit',
    async (_, email) => {
      const { service, supabase, mailService } = makeService();

      const error = await service[method](contact(email)).catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(400);
      expect((error as BadRequestException).message).toBe('Email invalide');
      expect(supabase.from).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    },
  );

  it('adresse valide → la validation passe et le traitement commence', async () => {
    const { service, supabase } = makeService();
    supabase.from.mockImplementation(() => {
      throw new Error('base atteinte');
    });

    await expect(
      service[method](contact('client@example.test')),
    ).rejects.toThrow('base atteinte');
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});
