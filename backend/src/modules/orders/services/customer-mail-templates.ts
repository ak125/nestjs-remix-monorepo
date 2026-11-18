/**
 * Mandat CG — modèles du bloc « Écrire au client » de la fiche commande.
 *
 * Texte brut, prérempli avec la commande (numéro, date, lignes, montant),
 * modifiable avant l'aperçu. Structure reprise du skill
 * `order-rupture-equivalence` (§7 proposition, §8 annulation). Les textes
 * restent à relire par l'owner : ce fichier ne contient aucune donnée client.
 *
 * Un passage à écrire à la main est marqué `[À COMPLÉTER : …]` ; l'envoi est
 * refusé tant qu'il en reste un.
 */

export const PLACEHOLDER_MARK = '[À COMPLÉTER';

export const CUSTOMER_MAIL_TEMPLATES = [
  'cancel-payment-voided',
  'cancel-refunded',
  'stock-out-equivalent',
  'ask-vehicle-or-reference',
  'free',
] as const;

export type CustomerMailTemplate = (typeof CUSTOMER_MAIL_TEMPLATES)[number];

const CUSTOMER_MAIL_TEMPLATE_LABELS: Record<CustomerMailTemplate, string> = {
  'cancel-payment-voided': 'Annulation — paiement annulé avant encaissement',
  'cancel-refunded': 'Annulation — remboursement fait dans Paybox',
  'stock-out-equivalent': 'Rupture — équivalent proposé',
  'ask-vehicle-or-reference':
    "Demande d'immatriculation ou de référence de la pièce",
  free: 'Message libre',
};

export interface CustomerMailContext {
  orderId: string;
  orderDate: string | null;
  totalTtc: string | number | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  lines: Array<{
    name: string | null;
    brand: string | null;
    reference: string | null;
    quantity: string | number | null;
  }>;
}

export interface PrefilledCustomerMail {
  template: CustomerMailTemplate;
  label: string;
  subject: string;
  body: string;
}

function todo(what: string): string {
  return `${PLACEHOLDER_MARK} : ${what}]`;
}

/** « 89,90 € » ; montant illisible ⇒ passage à compléter. */
function formatEuros(value: string | number | null): string {
  const n = Number(String(value ?? '').replace(',', '.'));
  if (value === null || value === '' || !Number.isFinite(n)) {
    return todo('montant');
  }
  return `${n.toFixed(2).replace('.', ',')} €`;
}

/** « 17/11/2026 », heure de Paris ; date illisible ⇒ passage à compléter. */
function formatOrderDate(value: string | null): string {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return todo('date de la commande');
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function clean(v: string | null | undefined): string {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lineText(line: CustomerMailContext['lines'][number]): string {
  const qty = clean(String(line.quantity ?? '')) || '1';
  const item = [clean(line.name), clean(line.brand)].filter(Boolean).join(' ');
  const ref = clean(line.reference);
  return `- ${qty} × ${item || todo('pièce')}${ref ? `, réf. ${ref}` : ''}`;
}

function greeting(ctx: CustomerMailContext): string {
  const name = [clean(ctx.customerFirstName), clean(ctx.customerLastName)]
    .filter(Boolean)
    .join(' ');
  return name ? `Bonjour ${name},` : 'Bonjour,';
}

function orderRecap(ctx: CustomerMailContext): string {
  const lines = ctx.lines.length
    ? ctx.lines.map(lineText).join('\n')
    : `- ${todo('pièces commandées')}`;
  return `Votre commande n° ${ctx.orderId} du ${formatOrderDate(ctx.orderDate)} :\n${lines}`;
}

const SIGNATURE = "Cordialement,\nL'équipe AutoMecanik";

const STOCK_OUT =
  "Notre fournisseur est en rupture de stock sur cette commande. Nous ne pouvons pas vous la livrer : nous l'avons annulée.";

function paragraphs(...parts: string[]): string {
  return parts.join('\n\n');
}

export function buildCustomerMail(
  template: CustomerMailTemplate,
  ctx: CustomerMailContext,
): PrefilledCustomerMail {
  const amount = formatEuros(ctx.totalTtc);
  const label = CUSTOMER_MAIL_TEMPLATE_LABELS[template];
  switch (template) {
    case 'cancel-payment-voided':
      return {
        template,
        label,
        subject: `Votre commande ${ctx.orderId} est annulée`,
        body: paragraphs(
          greeting(ctx),
          orderRecap(ctx),
          STOCK_OUT,
          `Votre paiement de ${amount} a été annulé avant encaissement : aucun montant ne sera prélevé sur votre carte.`,
          'Nous vous prions de nous excuser pour ce contretemps.',
          SIGNATURE,
        ),
      };
    case 'cancel-refunded':
      return {
        template,
        label,
        subject: `Votre remboursement de ${amount}`,
        body: paragraphs(
          greeting(ctx),
          orderRecap(ctx),
          STOCK_OUT,
          `Le remboursement de ${amount} a été fait sur la carte utilisée pour cette commande.`,
          'Nous vous prions de nous excuser pour ce contretemps.',
          SIGNATURE,
        ),
      };
    case 'stock-out-equivalent': {
      // Remboursement intégral = total payé si la commande n'a qu'une ligne ;
      // sinon le montant est fixé par l'owner (skill, §7 point 8).
      const refund =
        ctx.lines.length === 1 ? amount : todo('montant remboursé');
      return {
        template,
        label,
        subject: `Votre commande ${ctx.orderId} : une solution disponible tout de suite`,
        body: paragraphs(
          greeting(ctx),
          orderRecap(ctx),
          'Notre fournisseur est en rupture de stock sur cette pièce, sans date de retour. Plutôt que de vous faire attendre, nous avons cherché un équivalent disponible tout de suite.',
          `NOTRE PROPOSITION\n${todo("marque et référence de l'équivalent, références d'origine constructeur communes, caractéristiques")}`,
          `VOTRE VÉHICULE\n${todo('véhicules couverts ; véhicules non couverts, suivis de « si vous roulez en <modèle>, ne payez pas et répondez à ce mail »')}`,
          `LE PRIX\n${todo('quantité × prix = total ; déjà réglé ; reste à régler')}`,
          `POUR ACCEPTER\n${todo(`sans supplément, « Répondez à ce mail pour accepter. » ; avec supplément, « Réglez le supplément par carte bancaire avec le lien reçu dans notre mail "Commande ${ctx.orderId} : supplément à valider". »`)}`,
          `Si cette proposition ne vous convient pas, répondez à ce mail : nous annulons la commande et vous remboursons intégralement ${refund}.`,
          SIGNATURE,
        ),
      };
    }
    case 'ask-vehicle-or-reference':
      return {
        template,
        label,
        subject: `Votre commande ${ctx.orderId} : une précision pour vérifier la pièce`,
        body: paragraphs(
          greeting(ctx),
          orderRecap(ctx),
          "Avant d'expédier votre commande, nous voulons vérifier que la pièce correspond à votre véhicule. Pouvez-vous nous indiquer, en réponse à ce mail, l'immatriculation du véhicule ou la référence d'origine constructeur de la pièce ?",
          SIGNATURE,
        ),
      };
    case 'free':
      return {
        template,
        label,
        subject: `Votre commande ${ctx.orderId}`,
        body: paragraphs(greeting(ctx), todo('votre message'), SIGNATURE),
      };
  }
}

export function buildAllCustomerMails(
  ctx: CustomerMailContext,
): PrefilledCustomerMail[] {
  return CUSTOMER_MAIL_TEMPLATES.map((t) => buildCustomerMail(t, ctx));
}
