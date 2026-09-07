---
title: "Tunnel de paiement Paybox — runbook de diagnostic SEV1"
status: current
version: "1.0"
date: 2026-09-07
applies_to: scripts/monitoring/check-payment-tunnel.sh
---

# Runbook — tunnel de paiement Paybox

> Destination des alertes `[SEV1] AutoMecanik — Payment tunnel…` / `— No payment for Nd…`
> / `— ORDER CREATION broken…`, émises par `scripts/monitoring/check-payment-tunnel.sh`.
>
> **Objectif : trancher en 10 minutes entre « une vente perdue » et « le tunnel est rompu ».**
> Ce sont deux incidents très différents et ils se ressemblent énormément en base.
>
> `payments/` est une **zone STOP owner** : ce runbook diagnostique, il ne corrige pas.
> Toute modification du module exige un accord nominatif de l'owner.

## Étape 0 — quelle règle a parlé ?

| Sujet de l'alerte | Règle | Ce qu'elle dit vraiment |
|---|---|---|
| `ORDER CREATION broken` | création | Des commandes **échouent à s'écrire**. Le plus grave : le client ne peut même pas commander. |
| `No payment for Nd (M orders unpaid since)` | cumulative | **Rupture lente.** C'est la règle qui voit une panne de plusieurs semaines sur une boutique à faible volume. Prendre au sérieux. |
| `Payment tunnel possibly broken (N orders, 0 paid)` | burst | N commandes en 2 h, aucune payée. **Peut être un seul acheteur qui réessaie.** Lire la ligne `Shape`. |

L'email de la règle burst contient désormais `Distinct carts` et `Shape`. **`RETRY CLUSTER — … 1 single cart`
signifie un seul acheteur.** C'est une vente perdue à récupérer, rarement une panne générale.

## Étape 1 — le tunnel est-il vivant ? (30 secondes)

```sql
SELECT orderid, status, statuscode, amount, datepayment
FROM ic_postback ORDER BY datepayment DESC LIMIT 5;
```

Un encaissement récent ⇒ **la chaîne complète fonctionne** (redirection, Paybox, IPN, gate,
bascule de la commande). Ne pas rouvrir un SEV1 « tunnel mort » sur cette base : chercher ce qui
distingue les tentatives échouées des réussies.

Aucun encaissement depuis longtemps ⇒ passer à l'étape 3 en priorité.

## Étape 2 — forme de l'incident

```sql
-- Combien d'acheteurs réels derrière les commandes impayées ?
SELECT o.ord_id, o.ord_date, o.ord_total_ttc, i.fingerprint
FROM ___xtr_order o
LEFT JOIN order_idempotency i ON i.order_id = o.ord_id
WHERE o.ord_is_pay = '0' AND o.ord_date > '<date de la dernière commande payée>'
ORDER BY o.ord_date DESC;
```

`fingerprint` identique sur toutes les lignes ⇒ **un panier, un acheteur, N tentatives.**
La clé d'idempotence est régénérée à chaque montage de la page de commande : un client qui
recharge et réessaie crée donc légitimement N commandes. Ce n'est pas un doublon accidentel.

Empreintes différentes ⇒ **plusieurs acheteurs touchés** ⇒ traiter comme une rupture.

## Étape 3 — LA question : le client a-t-il été débité ?

**C'est la seule question qui engage l'argent d'un client, et la base ne peut pas y répondre.**

Ouvrir le **back-office Paybox**, journal des transactions, sur la fenêtre de l'incident (heures UTC).

- **Transactions présentes alors que les commandes sont impayées** ⇒ 🔴 **clients débités et IPN
  bloqué en amont.** SEV1 réel, remboursement ou réconciliation manuelle à faire. Escalade owner
  immédiate. Regarder ensuite Cloudflare → Security → Events, chemin contenant `/api/paybox`.
- **Aucune transaction** ⇒ l'acheteur n'a jamais mené le paiement à son terme. L'incident est un
  problème de **conversion**, pas de panne. Continuer à l'étape 4 pour savoir où il a décroché.

Cette vérification est restée ouverte de mai à septembre 2026 faute d'avoir été faite. Elle est
la **première** action, pas la dernière.

## Étape 4 — où l'acheteur a-t-il décroché ? (fenêtre qui se referme vite)

```bash
# Sur la machine qui héberge le container PROD (cf. .claude/rules/deployment.md)
docker logs nestjs-remix-monorepo-prod --since 2h 2>&1 | grep -iE 'paybox'
```

Le chemin nominal journalise `✅ Order <id> verified: DB amount=<n> EUR` puis
`✅ Formulaire Paybox généré`. Chacune des quatre branches d'erreur de `/api/paybox/redirect`
journalise sa propre ligne (`❌ Paramètres manquants`, `❌ Order not found`,
`⚠️ Order already paid`, `❌ Invalid order amount`).

- Ligne `✅ Formulaire Paybox généré` présente ⇒ l'acheteur **a bien été envoyé chez Paybox** ;
  ce qui suit s'est joué chez le prestataire (abandon, refus carte, 3-D Secure).
- Aucune ligne pour cette commande ⇒ il n'a **jamais atteint Paybox** ; le défaut est chez nous.

Les logs Caddy ne conservent qu'environ 5 heures de trafic — au-delà, cette preuve n'existe plus.

## Pièges vérifiés — ne pas refaire ces déductions

- **`__paybox_gate_log` ne journalise que les ÉCHECS** (`persistGateFail`). Une table vide ne
  prouve **pas** qu'aucun callback n'est arrivé : un paiement réussi n'y écrit rien.
- **Le beacon `r2_order_placed` n'est pas une preuve.** Émis côté client après la redirection, il
  est documenté comme *lossy*, et il double-compte (15 lignes pour 7 transactions historiques).
  Son absence ne prouve pas qu'un client n'a pas payé.
- **Les frais de port ne cassent pas Paybox.** Des paiements ont abouti avec 5,49 € et 7,59 € de
  port. Un port à 0,00 € est simplement l'effet du franco à 150 €.
- **Un `transactionid` alphanumérique long** (ex. `9S6209586J404615P`) est un paiement **PayPal**,
  pas Paybox. Ne pas le compter comme preuve que Paybox fonctionne.
- **`ord_amount_ttc` ≠ `ord_total_ttc`** : le premier est la marchandise, le second le montant
  payable port compris. L'écart n'est pas une anomalie.
- **Une commande payée porte `ord_ords_id = '3'`**, dont le libellé historique
  (« En attente de rajout de frais de port ») ne correspond plus à son usage. Se fier à
  `ord_is_pay = '1'` et `payment_confirmed = true`.
- **SSH vers la machine PROD est refusé aux sessions agent.** L'étape 4 est une action humaine.

## Escalade

Zone STOP owner (accord nominatif requis) : tout correctif dans `payments/`, toute reprise de
commande ou de panier, tout déploiement PROD (tag `v*`).

Récupération commerciale : une commande impayée conserve l'e-mail de l'acheteur — un rappel
manuel récupère souvent la vente.

## Références

- Incident fondateur : `.spec/reports/incident-2026-04-14-payments-sev1.md`
- Analyse 2026-09-07 (forme « retry cluster ») : `audit/payment-tunnel-sev1-alert-2026-09-07.md`
- Vocabulaire et topologie de déploiement : `.claude/rules/deployment.md`
- Contraintes du module paiement : `.claude/rules/payments.md`
