/**
 * Mandat BT — gabarits SYNTHÉTIQUES des mails Paybox (ticket, télécollecte).
 * Aucun contenu réel : numéros de commande, d'autorisation, de carte et
 * adresse inventés. La carte et l'adresse sont présentes pour prouver qu'elles
 * ne sortent jamais de l'analyse.
 */
export const REF = 'ORD-1762500000000-001';
export const CARD = '4970XXXXXXXX9876';
export const CUSTOMER = 'client.synthetique@example.test';

export function ticketHtml(
  o: {
    title?: string;
    date?: string;
    ref?: string;
    amount?: string;
    auth?: string;
    merchant?: string;
  } = {},
): string {
  return `<html><body><table>
<tr><td id="ticketTitle">${o.title ?? 'PAIEMENT ACCEPT&Eacute;'}</td></tr>
<tr><td>Merci de votre confiance.</td></tr>
<tr><td id="trs_ticket_date">${o.date ?? 'Le 07/11/2026 &agrave; 10:15'}</td></tr>
<tr><td id="trs_ticket_num_commercant">${o.merchant ?? '5259250'}</td></tr>
<tr><td id="trs_ticket_pan">${CARD}</td></tr>
<tr><td id="trs_ticket_info_remise">REMISE 000123</td></tr>
<tr><td id="trs_ticket_op_type">DEBIT VADS @</td></tr>
<tr><td id="trs_ticket_numauto">NUMERO D'AUTORISATION : ${o.auth ?? '123456'}</td></tr>
<tr><td id="trs_ticket_montant">MONTANT : ${o.amount ?? '42.20'} EUR</td></tr>
<tr><td id="trs_ticket_refcmd">NUMERO DE COMMANDE : ${o.ref ?? REF}</td></tr>
<tr><td>Email client : ${CUSTOMER}</td></tr>
</table></body></html>`;
}

export function ticketText(title = 'PAIEMENT ACCEPTÉ'): string {
  return [
    title,
    'Merci de votre confiance.',
    'AUTOMECANIK.COM',
    'CARTE BANCAIRE',
    'VISA',
    'BANQUE SYNTHETIQUE',
    'Le 07/11/2026 à 10:15',
    'AUTO PIECE EQ.@',
    'SITE 0000001',
    '5259250',
    CARD,
    'REMISE 000123',
    'DEBIT VADS @',
    "NUMERO D'AUTORISATION : 123456",
    'MONTANT : 42.20 EUR',
    `NUMERO DE COMMANDE : ${REF}`,
    'MERCI ET A BIENTOT.',
  ].join('\n');
}

export function telecollecteText(
  o: {
    date?: string;
    count?: number;
    amount?: string;
    refund?: [number, string];
    cancel?: [number, string];
    status?: string;
  } = {},
): string {
  const [rc, ra] = o.refund ?? [0, '0.00'];
  const [cc, ca] = o.cancel ?? [0, '0.00'];
  return [
    'TELECOLLECTE DE',
    "L'APPLICATION VADS",
    'BANQUE SYNTHETIQUE',
    `le ${o.date ?? '14/11/2026 04:55:12'}`,
    '12345678901234',
    '42',
    '5259250',
    '7',
    'REMISE Nro: 000321',
    'FICHIER Nro: 0099',
    'NBR TRANSACTIONS:',
    `Achats: ${o.count ?? 1}`,
    'Dont différés: 0',
    `Rembt: ${rc}`,
    `Annulées: ${cc}`,
    'Abandon: 0',
    'MONTANT EN EUR',
    `Achats: ${o.amount ?? '42.20'}`,
    'Dont différés: 0.00',
    `Rembt: ${ra}`,
    `Annulées: ${ca}`,
    o.status ?? 'TRANSMISSION REUSSIE',
    'TICKET A CONSERVER',
    'MERCI ET A BIENTOT.',
  ].join('\n');
}
