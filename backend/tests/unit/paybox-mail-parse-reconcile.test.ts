/**
 * Mandat BT — lecture des mails Paybox : analyse et rapprochement (fonctions pures).
 *
 * Gabarits SYNTHÉTIQUES uniquement (aucun mail réel) : numéros de commande,
 * d'autorisation, de carte et adresses inventés.
 *
 * Verrouille :
 * - ticket accepté (HTML, et repli texte) ; tout autre titre = non accepté ;
 *   gabarit inconnu refusé ;
 * - la ligne de carte (`trs_ticket_pan`, ligne 11 du texte) et l'adresse du
 *   client ne sortent jamais de l'analyse ;
 * - télécollecte : séquence stricte, montants en centimes, heure de Paris → UTC ;
 * - rapprochement : télécollecte J = tickets J − 7 ⇒ captured ; nombre ou
 *   montant différent, remboursement ou annulation ⇒ écart sans écriture ;
 *   saisie manuelle jamais écrasée ; capture en retard ; ticket manquant ;
 *   silence de tpeweb ; écarts durables signalés à la première lecture seulement.
 */
import {
  classifyMessage,
  isPayboxAuthenticated,
  parisLocalToUtc,
  parseTelecollecte,
  parseTicket,
  senderAddress,
} from '../../src/modules/orders/paybox-mail/paybox-mail.parse';
import {
  reconcile,
  type CaptureFact,
  type OrderFact,
  type ReconcileInput,
  type StoredTelecollecte,
  type StoredTicket,
} from '../../src/modules/orders/paybox-mail/paybox-mail.reconcile';
import {
  checkScopes,
  GMAIL_READONLY_SCOPE,
  PayboxMailScopeError,
} from '../../src/modules/orders/paybox-mail/paybox-mail-gmail.client';

import {
  CARD,
  CUSTOMER,
  REF,
  telecollecteText,
  ticketHtml,
  ticketText,
} from './fixtures/paybox-mail.templates';

describe('paybox-mail : analyse (mandat BT)', () => {
  it('ticket accepté (HTML) : champs gardés, heure de Paris convertie en UTC, montant en centimes', () => {
    const r = parseTicket({ html: ticketHtml(), text: null });
    expect(r).toEqual({
      ok: true,
      value: {
        kind: 'ticket',
        accepted: true,
        orderRef: REF,
        amountCents: 4220,
        authNumber: '123456',
        authorizedAt: '2026-11-07T09:15:00.000Z',
      },
    });
  });

  it('ticket accepté (repli texte) : même résultat', () => {
    const r = parseTicket({ html: null, text: ticketText() });
    expect(r.ok && r.value).toMatchObject({
      accepted: true,
      orderRef: REF,
      amountCents: 4220,
    });
  });

  it('ni la carte masquée ni l’adresse du client ne sortent de l’analyse', () => {
    for (const body of [{ html: ticketHtml() }, { text: ticketText() }]) {
      const out = JSON.stringify(parseTicket(body));
      expect(out).not.toContain('9876');
      expect(out).not.toContain(CARD);
      expect(out).not.toContain(CUSTOMER);
    }
  });

  it('tout autre titre = non accepté, sans erreur', () => {
    const r = parseTicket({
      html: ticketHtml({ title: 'PAIEMENT REFUS&Eacute;' }),
    });
    expect(r.ok && r.value.accepted).toBe(false);
    const t = parseTicket({ text: ticketText('PAIEMENT REFUSÉ') });
    expect(t.ok && t.value.accepted).toBe(false);
  });

  it('gabarit inconnu, commerçant étranger ou date illisible : refusé avec un motif', () => {
    expect(
      parseTicket({ html: '<p>Bonjour</p>', text: 'Bonjour\nAu revoir' }),
    ).toEqual({
      ok: false,
      reason: 'gabarit de ticket non reconnu',
    });
    expect(parseTicket({ html: ticketHtml({ merchant: '1111111' }) })).toEqual({
      ok: false,
      reason: 'commerçant inattendu',
    });
    expect(parseTicket({ html: ticketHtml({ date: '07/11/2026' }) }).ok).toBe(
      false,
    );
    expect(parseTicket({ html: ticketHtml({ ref: 'CMD-12' }) })).toEqual({
      ok: false,
      reason: 'numéro de commande illisible',
    });
  });

  it('télécollecte : séquence stricte lue, totaux en centimes, heure UTC', () => {
    const r = parseTelecollecte({
      text: telecollecteText({ refund: [1, '5.00'] }),
    });
    expect(r).toEqual({
      ok: true,
      value: {
        kind: 'telecollecte',
        remiseNumber: '000321',
        fileNumber: '0099',
        purchaseCount: 1,
        purchaseCents: 4220,
        refundCount: 1,
        refundCents: 500,
        cancelCount: 0,
        cancelCents: 0,
        collectedAt: '2026-11-14T03:55:12.000Z',
      },
    });
  });

  it('télécollecte : version HTML seule, convertie en lignes', () => {
    const html = `<div>${telecollecteText().split('\n').join('<br>')}</div>`;
    expect(parseTelecollecte({ html }).ok).toBe(true);
  });

  it('télécollecte : ligne en plus, statut différent ou corps vide refusés', () => {
    expect(parseTelecollecte({ text: `${telecollecteText()}\nPS` }).ok).toBe(
      false,
    );
    expect(
      parseTelecollecte({
        text: telecollecteText({ status: 'TRANSMISSION ECHOUEE' }),
      }).ok,
    ).toBe(false);
    expect(parseTelecollecte({ text: null, html: null })).toEqual({
      ok: false,
      reason: 'corps vide',
    });
  });

  it('heure de Paris : été, hiver, heure inexistante', () => {
    expect(parisLocalToUtc(2026, 7, 1, 12, 0)).toBe('2026-07-01T10:00:00.000Z');
    expect(parisLocalToUtc(2026, 1, 1, 12, 0)).toBe('2026-01-01T11:00:00.000Z');
    expect(parisLocalToUtc(2026, 3, 29, 2, 30)).toBeNull();
  });

  it('expéditeur et sujet exacts ; authentification paybox.com exigée', () => {
    expect(senderAddress('PayBox <noreply@paybox.com>')).toBe(
      'noreply@paybox.com',
    );
    expect(senderAddress('"a <noreply@paybox.com>" <x@evil.test>')).toBeNull();
    expect(
      classifyMessage(
        'noreply@paybox.com',
        'AUTO PIECE EQ.@     : Ticket paiement',
      ),
    ).toBe('ticket');
    expect(
      classifyMessage(
        'noreply@paybox.com',
        'Re: AUTO PIECE EQ.@ : Ticket paiement',
      ),
    ).toBeNull();
    expect(
      classifyMessage(
        'tpeweb@paybox.com',
        'PayBox system (compte rendu de telecollecte)',
      ),
    ).toBe('telecollecte');
    expect(
      classifyMessage('tpeweb@paybox.com', 'Compte rendu de teleparametrage'),
    ).toBe('heartbeat');
    expect(
      classifyMessage(
        'noreply@paybox.com.evil.test',
        'AUTO PIECE EQ.@ : Ticket paiement',
      ),
    ).toBeNull();
    expect(
      isPayboxAuthenticated(
        'mx.google.com; dkim=pass header.i=@paybox.com header.s=s1',
      ),
    ).toBe(true);
    expect(
      isPayboxAuthenticated(
        'mx.google.com; dmarc=pass (p=NONE) header.from=paybox.com',
      ),
    ).toBe(true);
    expect(
      isPayboxAuthenticated(
        'mx.google.com; dkim=pass header.i=@paybox.com.evil.test',
      ),
    ).toBe(false);
    expect(
      isPayboxAuthenticated('mx.google.com; dkim=fail header.i=@paybox.com'),
    ).toBe(false);
    expect(
      isPayboxAuthenticated(
        'mx.google.com; dmarc=pass header.from=paybox.com.evil.test',
      ),
    ).toBe(false);
    expect(
      isPayboxAuthenticated(
        'mx.google.com; dkim=pass header.d=mail.paybox.com; spf=pass',
      ),
    ).toBe(true);
    expect(isPayboxAuthenticated(null)).toBe(false);
  });

  it('jeton aux portées trop larges ou sans gmail.readonly : refusé', () => {
    expect(() => checkScopes([GMAIL_READONLY_SCOPE])).not.toThrow();
    expect(() =>
      checkScopes([GMAIL_READONLY_SCOPE, 'https://mail.google.com/']),
    ).toThrow(PayboxMailScopeError);
    expect(() =>
      checkScopes(['https://www.googleapis.com/auth/gmail.send']),
    ).toThrow(PayboxMailScopeError);
    expect(() => checkScopes(undefined)).toThrow(PayboxMailScopeError);
  });
});

// ── Rapprochement ───────────────────────────────────────────────────────────

const NOW = new Date('2026-11-14T05:30:00Z'); // 06:30 Paris, jour de la télécollecte

const ticket = (o: Partial<StoredTicket> = {}): StoredTicket => ({
  messageId: 'tk1',
  accepted: true,
  orderRef: REF,
  amountCents: 4220,
  authorizedAt: '2026-11-07T09:15:00.000Z',
  ...o,
});

const tc = (o: Partial<StoredTelecollecte> = {}): StoredTelecollecte => ({
  messageId: 'tc1',
  remiseNumber: '000321',
  purchaseCount: 1,
  purchaseCents: 4220,
  refundCount: 0,
  refundCents: 0,
  cancelCount: 0,
  cancelCents: 0,
  collectedAt: '2026-11-14T03:55:12.000Z',
  ...o,
});

const order = (o: Partial<OrderFact> = {}): OrderFact => ({
  orderId: REF,
  paid: true,
  totalCents: 4220,
  ...o,
});

function input(o: Partial<ReconcileInput> = {}): ReconcileInput {
  return {
    now: NOW,
    tickets: [ticket()],
    telecollectes: [tc()],
    orders: new Map([[REF, order()]]),
    captures: new Map(),
    payments: [],
    lastTpeMailAt: '2026-11-14T03:55:12.000Z',
    unrecognized: [],
    fresh: new Set(['tk1', 'tc1']),
    ...o,
  };
}

const kinds = (p: { discrepancies: Array<{ kind: string }> }) =>
  p.discrepancies.map((d) => d.kind);

describe('paybox-mail : rapprochement (mandat BT)', () => {
  it('ticket accepté seul (pas encore de télécollecte) : authorized, sans écart', () => {
    const p = reconcile(
      input({ telecollectes: [], now: new Date('2026-11-07T10:00:00Z') }),
    );
    expect(p.writes).toEqual([
      {
        orderId: REF,
        state: 'authorized',
        amountCents: null,
        checkedAt: '2026-11-07T09:15:00.000Z',
        updatedBy: 'paybox_mail:tk1',
        op: 'insert',
      },
    ]);
    expect(p.discrepancies).toEqual([]);
  });

  it('télécollecte J = tickets J − 7 : captured au montant, à l’heure de la télécollecte', () => {
    const p = reconcile(input());
    expect(p.writes).toEqual([
      {
        orderId: REF,
        state: 'captured',
        amountCents: 4220,
        checkedAt: '2026-11-14T03:55:12.000Z',
        updatedBy: 'paybox_mail:tc1',
        op: 'insert',
      },
    ]);
    expect(p.discrepancies).toEqual([]);
  });

  it('ligne paybox_mail authorized existante : mise à jour en captured', () => {
    const captures = new Map<string, CaptureFact>([
      [
        REF,
        {
          orderId: REF,
          state: 'authorized',
          amountCents: null,
          source: 'paybox_mail',
        },
      ],
    ]);
    const p = reconcile(input({ captures, fresh: new Set(['tc1']) }));
    expect(p.writes).toEqual([
      expect.objectContaining({ state: 'captured', op: 'update' }),
    ]);
  });

  it.each([
    ['nombre différent', { purchaseCount: 2 }],
    ['montant différent', { purchaseCents: 4300 }],
    ['remboursement non nul', { refundCount: 1, refundCents: 500 }],
    ['annulation non nulle', { cancelCount: 1, cancelCents: 4220 }],
  ])(
    'télécollecte non rapprochée (%s) : écart, aucune capture écrite',
    (_l, over) => {
      const p = reconcile(input({ telecollectes: [tc(over)] }));
      expect(p.writes.filter((w) => w.state === 'captured')).toEqual([]);
      expect(kinds(p)).toEqual(['telecollecte_non_rapprochee']);
    },
  );

  it('deux télécollectes le même jour : écart, rien écrit', () => {
    const p = reconcile(
      input({
        telecollectes: [tc(), tc({ messageId: 'tc2', remiseNumber: '000322' })],
        fresh: new Set(['tc2']),
      }),
    );
    expect(p.writes.filter((w) => w.state === 'captured')).toEqual([]);
    expect(kinds(p)).toEqual(['telecollecte_non_rapprochee']);
  });

  it('saisie manuelle : jamais écrasée ; désaccord signalé, accord silencieux', () => {
    const manual = (state: CaptureFact['state'], amountCents: number | null) =>
      new Map<string, CaptureFact>([
        [REF, { orderId: REF, state, amountCents, source: 'manual' }],
      ]);
    const disagree = reconcile(input({ captures: manual('authorized', null) }));
    expect(disagree.writes).toEqual([]);
    expect(kinds(disagree)).toEqual(['desaccord_saisie']);
    const agree = reconcile(input({ captures: manual('captured', 4220) }));
    expect(agree.writes).toEqual([]);
    expect(agree.discrepancies).toEqual([]);
  });

  it('commande introuvable, non payée ou montant différent : écart à la première lecture, rien écrit', () => {
    expect(kinds(reconcile(input({ orders: new Map() })))).toEqual([
      'commande_introuvable',
    ]);
    expect(
      kinds(
        reconcile(input({ orders: new Map([[REF, order({ paid: false })]]) })),
      ),
    ).toEqual(['commande_introuvable']);
    const diff = reconcile(
      input({ orders: new Map([[REF, order({ totalCents: 5000 })]]) }),
    );
    expect(diff.writes).toEqual([]);
    expect(kinds(diff)).toEqual(['montant_different']);
  });

  it('capture en retard (J + 8) : signalée chaque jour, même sur un ticket déjà lu', () => {
    const late = new Date('2026-11-15T07:00:00Z');
    const p = reconcile(
      input({ now: late, telecollectes: [], fresh: new Set() }),
    );
    expect(kinds(p)).toEqual(['capture_en_retard']);
    const day7 = reconcile(
      input({
        now: new Date('2026-11-14T07:00:00Z'),
        telecollectes: [],
        fresh: new Set(),
      }),
    );
    expect(kinds(day7)).toEqual([]);
  });

  it('ticket manquant : paiement enregistré depuis plus de 24 h sans ticket', () => {
    const p = reconcile(
      input({
        tickets: [],
        telecollectes: [],
        payments: [
          {
            orderId: 'ORD-1762500000000-002',
            paidAt: '2026-11-13T04:00:00.000Z',
          },
        ],
      }),
    );
    expect(kinds(p)).toEqual(['ticket_manquant']);
    const recent = reconcile(
      input({
        tickets: [],
        telecollectes: [],
        payments: [
          {
            orderId: 'ORD-1762500000000-002',
            paidAt: '2026-11-13T06:00:00.000Z',
          },
        ],
      }),
    );
    expect(kinds(recent)).toEqual([]);
  });

  it('aucun mail de tpeweb depuis 48 h : écart', () => {
    expect(
      kinds(
        reconcile(
          input({
            lastTpeMailAt: '2026-11-12T03:00:00.000Z',
            telecollectes: [],
          }),
        ),
      ),
    ).toEqual(['silence_tpeweb']);
    expect(
      kinds(reconcile(input({ lastTpeMailAt: null, telecollectes: [] }))),
    ).toEqual(['silence_tpeweb']);
  });

  it('format non reconnu : un écart par message', () => {
    const p = reconcile(
      input({ unrecognized: [{ messageId: 'x1', reason: 'sujet inattendu' }] }),
    );
    expect(kinds(p)).toEqual(['format_non_reconnu']);
  });

  it('idempotence : un passage suivant ne réécrit pas et ne re-signale pas un écart durable', () => {
    const captures = new Map<string, CaptureFact>([
      [
        REF,
        {
          orderId: REF,
          state: 'captured',
          amountCents: 4220,
          source: 'paybox_mail',
        },
      ],
    ]);
    expect(reconcile(input({ captures, fresh: new Set() }))).toEqual({
      writes: [],
      discrepancies: [],
    });
    const authorized = new Map<string, CaptureFact>([
      [
        REF,
        {
          orderId: REF,
          state: 'authorized',
          amountCents: null,
          source: 'paybox_mail',
        },
      ],
    ]);
    const unmatched = reconcile(
      input({
        captures: authorized,
        telecollectes: [tc({ purchaseCount: 2 })],
        fresh: new Set(),
      }),
    );
    expect(unmatched.writes).toEqual([]);
    expect(kinds(unmatched)).toEqual([]);
  });
});
