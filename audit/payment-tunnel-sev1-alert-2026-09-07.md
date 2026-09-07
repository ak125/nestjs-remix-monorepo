# Alerte SEV1 tunnel de paiement — 2026-09-07 — analyse

> Investigation **lecture seule**. Module `payments/` = zone STOP owner : aucune mutation
> proposée n'y touche sans accord nominatif. Sessions d'alerte : 16:45 et 18:00 CEST.

## Verdict

**Ce n'est pas une récidive de la panne totale du 19/05→22/07.** Le tunnel encaisse : 6 paiements
Paybox aboutis depuis la réparation de juillet, le dernier le **03/09 à 12:28 UTC** (542,64 €).

L'alerte est un **vrai signal** — un acheteur réel n'a pas pu payer 110,52 € — mais son intitulé
« Payment tunnel possibly broken » surestime la portée : le périmètre observé est **un acheteur,
trois tentatives, quatre minutes**.

La question qui compte n'est pas tranchée et **ne peut pas l'être depuis la base** :
**cet acheteur a-t-il été débité ?** Voir §Action owner.

## Ce que disent les données

Trois commandes le 2026-09-07, toutes à 110,52 € (101,23 € marchandise + 9,29 € de port) :

| Commande | Heure UTC | Statut |
|---|---|---|
| `ORD-1788791453974-174` | 14:30:54 | créée, non payée |
| `ORD-1788791548881-815` | 14:32:28 | créée, non payée |
| `ORD-1788791681028-204` | 14:34:41 | créée, non payée |

- **Un seul acheteur** : même empreinte email (`beb1e822`), mais **3 comptes invité distincts** créés.
- **Même panier** : `order_idempotency.fingerprint = dcaeb8c8746b84c6` pour les trois, avec
  **3 clés d'idempotence différentes** — la dédup n'a donc pas joué (la clé est régénérée à chaque
  montage de la page, par construction).
- **Aucun IPN Paybox, d'aucune sorte.** Un paiement réussi écrit une ligne `ic_postback` ; un refus
  échoue au gate et écrit une ligne `__paybox_gate_log` (`persistGateFail`,
  `paybox-callback-gate.service.ts:428-434` — **seuls les échecs sont journalisés**). Ni l'un ni
  l'autre aujourd'hui ⇒ aucun callback n'a atteint l'application.

### Ce qui est réfuté

- **« Le tunnel est cassé »** — réfuté : 08-03, 08-06, 08-08, 08-14, 08-20, 09-03 = 6 encaissements
  Paybox depuis le correctif.
- **« Les frais de port cassent Paybox »** — réfuté : Paybox a encaissé avec port à 5,49 €
  (13/03, 14/04) et 7,59 € (17/04, 30/04). Le port à 9,29 € n'est que l'effet du seuil de
  franco à 150 € ; les commandes payées récentes étaient au-dessus, donc à 0,00 €.
- **« Une régression de déploiement »** — réfuté par la chronologie : le dernier tag PROD est
  `v2026.08.20-ssr-loopback-lcp` (déployé le 20/08 à 15:25 UTC). Le paiement réussi du 03/09 et les
  échecs du 07/09 ont tourné **sur le même build**. Le correctif #1256 est bien présent dedans
  (`git merge-base --is-ancestor a03de24b7 v2026.08.20-ssr-loopback-lcp` → vrai).

### Le fait non expliqué

`/health` donne un uptime de 245 195 s ⇒ **le process PROD a démarré le 2026-09-05 à ~00:01 UTC**,
sans tag `v*` correspondant. Le dernier paiement réussi est **avant** ce redémarrage, les trois
échecs **après**. Le watchdog est explicitement *observe-only* (`scripts/ops/prod-watchdog.sh`) —
ce n'est pas lui. Redémarrage manuel, reboot hôte ou crash+restart : indéterminable d'ici.

Corrélation à **n = 1 acheteur** : à ne pas confondre avec une cause. Mais c'est le seul changement
d'état connu entre « ça marchait » et « ça n'a pas marché ».

## Pourquoi on ne peut pas conclure — le défaut structurel

**Toute la séquence « commande écrite → formulaire Paybox » n'écrit rien en base.**
`/api/paybox/redirect` fait une lecture (`getOrderForPayment`) et zéro écriture ;
`generatePaymentForm` est pure ; `/checkout` n'émet aucun beacon.

Conséquence directe : **« l'acheteur n'a jamais atteint Paybox » et « l'acheteur a atteint Paybox
et a renoncé » sont le même état en base.** L'alerte pose une question à laquelle le système est
incapable de répondre, et renvoie l'humain vers des logs conteneur.

Deux aggravants mesurés :

- Les quatre branches `400` de `/api/paybox/redirect` rendent une page HTML nue, ne laissent
  **aucune trace**, et leur lien de retour ramène vers `/checkout` → nouveau montage → **nouvelle
  clé d'idempotence** → une commande de plus. C'est exactement la forme observée aujourd'hui —
  mais un simple abandon répété sur trois montages produit la **même** forme. Non discriminant.
- Le beacon `r2_order_placed` n'est pas un signal de conversion fiable : émis côté client après
  redirection (documenté *lossy* dans `order-funnel.listener.ts:1-10`), **et** dupliqué —
  15 lignes pour 7 transactions, dont une comptée 7 fois. Son absence aujourd'hui ne prouve donc
  **pas** que l'acheteur n'a pas payé.

## Action owner — par ordre d'urgence

1. **Back-office Paybox — journal des transactions du 2026-09-07, 14:25→14:45 UTC.**
   C'est la seule source qui tranche. **Transactions présentes ⇒ clients débités et IPN bloqué en
   amont (SEV1 réel, leg 2 vivant).** Aucune transaction ⇒ l'acheteur n'a jamais payé, et le sujet
   devient la conversion, pas la panne. Cette vérification était déjà l'action n°1 en juillet ;
   elle n'a jamais été faite.
2. **Logs conteneur PROD, tant qu'ils existent** (fenêtre qui se referme) :
   `docker logs nestjs-remix-monorepo-prod --since 2026-09-07T14:25 2>&1 | grep -iE 'paybox'`.
   Le chemin nominal logge `✅ Order <id> verified` puis `✅ Formulaire Paybox généré` ; chaque
   branche 400 logge sa propre ligne. Une seule commande départage les hypothèses.
3. **Expliquer le redémarrage PROD du 05/09 ~00:01 UTC** (`docker inspect`, `journalctl`, historique
   d'uptime hôte).
4. **Rappeler l'acheteur** — 110,52 € récupérables, identité connue en base.

## Défauts trouvés, hors périmètre de l'alerte

| # | Constat | Sévérité | Zone |
|---|---|---|---|
| 1 | `PayboxMonitoringController` (`api/admin/paybox-health`, `api/admin/paybox-monitoring`) n'a **aucun `@UseGuards`** ; le seul `APP_GUARD` global est le throttler de rate-limiting (`app.module.ts:286-289`). Au niveau du code, `PAYBOX_SITE`/`RANG`/`IDENTIFIANT`/`MODE` et les 20 dernières transactions sont exposés sans authentification. La clé HMAC, elle, est masquée (`CONFIGURED`/`MISSING`). | **haute** | owner-gated (`payments/`) |
| 2 | Le runbook cité par chaque email d'alerte, `.spec/runbooks/payments-tunnel-debug.md`, **n'existe pas** — ouvert depuis avril. L'alerte envoie l'humain vers un fichier absent. | moyenne | libre |
| 3 | Double-alerte déterministe : `DEDUP_WINDOW_MIN=60` < `WINDOW_HOURS=2`, donc les mêmes commandes sont encore dans la fenêtre quand le cooldown expire. C'est la cause des deux mails de ce soir, et ça se reproduira à chaque incident. | moyenne | libre |
| 4 | `last_paid_at` est lu, journalisé et affiché, mais **jamais comparé à un seuil** : c'est de la décoration, pas une règle. La règle « dernier paiement > N jours » recommandée en juillet n'a jamais été construite — c'est elle qui aurait attrapé la panne de 8 semaines. | moyenne | libre |
| 5 | Le checkout invité crée **un compte client par tentative** (3 aujourd'hui pour un email). Pollue le CRM et les comptages. | moyenne | orders/ |
| 6 | `ScheduleModule` est désactivé dans le monorepo : tout décorateur `@Cron` est inerte, dont la réconciliation des commandes bloquées en `processing`. Aujourd'hui sans effet (0 ligne `processing`), mais la règle de création de l'alerte a là un angle mort. | basse | libre |
| 7 | Les commandes payées reçoivent `ords_id=3`, libellé **« En attente de rajout de frais de port »**, alors que `ords_id=5` « Payée — En préparation » existe et n'est plus utilisé depuis mars. | basse | orders/ |

**Levier gratuit** : `FUNNEL_SERVER_EMIT_ENABLED` est encore à `false`, alors que l'`emit(ORDER_EVENTS.PAID)`
côté payments **a bien atterri** (`paybox-callback.controller.ts:308`) — l'en-tête de
`order-funnel.listener.ts` qui le dit « pas encore livré » est périmé. Basculer ce flag donne une
mesure de conversion serveur garantie, **sans une ligne de code**. Cela n'éclaire pas la question du
jour (ça enregistre les paiements aboutis, pas les redirections), et la mise en PROD reste une
décision owner.

## Couverture

**Vérifié** — état DB complet (commandes, lignes, idempotence, `ic_postback`, `__paybox_gate_log`,
`___xtr_order_history`, `__seo_event_log`) ; corps du RPC `check_payment_tunnel_health` ; script
d'alerte ; chemins de code checkout / redirect / callback / gate ; généalogie git du tag PROD ;
`/health` PROD (200).

**Non vérifiable dans cette session** :
- Logs du conteneur PROD — **SSH vers 49.12.233.2 refusé** (`Permission denied (publickey)`),
  comme en juillet. C'est la pièce manquante décisive.
- Back-office Paybox — hors de portée d'un agent ; seule source sur un éventuel débit client.
- Cloudflare (Security Events / Audit Log) — connecteur non authentifié.
- Valeurs d'env réelles du conteneur PROD (`PAYBOX_MODE`, `BASE_URL`, `PAYBOX_HMAC_KEY`).
- Le constat n°1 est établi **au niveau du code** ; je n'ai pas sondé l'endpoint en PROD —
  cela aurait tiré des identifiants marchands dans un transcript, et un filtrage Caddy/Cloudflare
  sur `/api/admin/*` pourrait le neutraliser. À confirmer côté owner.

**Verdict de couverture : partiellement vérifié.** La cause racine des trois échecs n'est pas
établie ; elle est **indécidable** avec les traces existantes, ce qui est en soi le constat principal.

---

_Investigation lecture seule, 2026-09-07. Aucun fichier applicatif modifié._
