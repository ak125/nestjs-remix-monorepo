# Supplier Availability Report — département Achats & Fournisseurs

> **Premier rapport départemental réel** (couche de pilotage agentique → [automecanik-departments-map.md](./automecanik-departments-map.md)).
> Ce document **ne crée aucun agent, module, registre ni gate**. Il exploite **en lecture seule** les
> capacités existantes (signaux LIVE `pri_dispo`/`pri_marge_n` + grille du moteur Supplier-Truth worktree)
> pour expliquer pourquoi les rares paiements finissent en remboursement « pas dispo ».
> Période mesurée : **30 derniers jours** (Supabase `cxpojprgwgubzjyqzmoq`), à réactualiser chaque semaine.

## 1. Capacité utilisée & mode
| Capacité | Mode | Rôle |
|---|---|---|
| `pieces_price.pri_dispo` (signal dispo) | **LIVE** | flag '0'/'1'/'3' |
| `pieces_price.pri_marge_n` / `pri_achat_ht_n` / `pri_vente_ht_n` | **LIVE** | marge & prix |
| `pri_frs` → `___xtr_supplier` | **LIVE** | fournisseur source |
| `pieces_marque` (`pm_name`) | **LIVE** | marque/équipementier |
| Moteur Supplier-Truth (`projectTruth`, 9 états) | **WORKTREE (non live)** | grille de verdict seulement |
*Pas d'« agent » lancé : le moteur de vérification n'est pas mergé et nécessiterait un scraper externe (DistriCash) + creds non fournis. On exploite les signaux matérialisés.*

## 2. 🔴 Trou racine — le signal de disponibilité est un faux positif
Distribution catalogue (442 097 lignes prix) : **`pri_dispo='1'` = 92.66 %** · `'0'` = 3.92 % · `'3'` = 3.43 %.
**Les 3 pièces remboursées « pas dispo » étaient TOUTES marquées `pri_dispo='1'`.** Donc :
- `pri_dispo='1'` (93 % du catalogue) **ne garantit pas le stock** — c'est un défaut optimiste, jamais rafraîchi par ligne.
- Seul `pri_dispo='0'` (3.92 %) est un « ne pas vendre » fiable, **mais il n'est pas appliqué au browse** (le catalogue montre tout).
- Conséquence : la rupture est **invisible jusqu'à l'échec de la commande fournisseur** → remboursement.
- **Ce n'est pas un problème de marge** : les marges des remboursés sont 31-40 % (saines).

## 3. Les 3 paiements remboursés (un par un)
| Commande | Pièce | Gamme | Marque | Fournisseur (`pri_frs`) | `pri_dispo` | Marge | Achat→Vente HT | Cause |
|---|---|---|---|---|---|---|---|---|
| ORD-…850 | Jeu émetteurs/récepteurs embrayage | Émetteur d'embrayage | LUK | **ACR** | **1** (faux) | 32.0 % | 166.84 → 220.28 | « plus diponiblr » |
| ORD-…385 | Jeu émetteurs/récepteurs embrayage | Émetteur d'embrayage | LUK | **ACR** | **1** (faux) | 31.0 % | 184.71 → 241.88 | « plus diponiblr » |
| ORD-…972 | Kit d'embrayage | Kit d'embrayage | SASIC | **SASIC** | **1** (faux) | 39.7 % | 99.88 → 139.56 | « pas dispo » |
*Détectable avant paiement ? **Non** avec le signal actuel (les 3 étaient '1'). Oui avec une dispo fraîche par fournisseur (= moteur Supplier-Truth, parké).*

## 4. Épicentre = l'embrayage (gamme + fournisseurs ACR / SASIC)
Sur les **9 commandes créées (30 j)** : **6 = émetteur d'embrayage LUK via ACR**, **2 = kit embrayage SASIC**, 1 = maître-cylindre ATE (PAP), 1 = alternateur SNRA (SOREA). → **8/9 commandes sont de l'embrayage**, et **3/3 payées (toutes embrayage) annulées**. L'émetteur LUK/ACR est aussi la **#5 gamme la plus vue** (21 vues / 12 sessions).

## 5. Les 18 paniers (30 j) — par fournisseur
Tous `pri_dispo='1'` (aucun bloqué par le signal actuel). Marges 29-110 % (saines).
| Fournisseur (`pri_frs`) | Adds | Produits distincts | Gammes |
|---|---|---|---|
| **ACR** | 13 | 6 | émetteur embrayage, plaquette BREMBO, tambour, injecteur, servo-frein, étrier |
| **PAP** | 16 | 4 | cardan SNR (×2 prix, top demande), plaquette ATE, kit distribution |
| **DCA (DistriCash)** | 4 | 3 | plaquette SASIC, plaquette TEXTAR, support moteur SASIC |
| NED | 2 | 2 | vanne EGR, pompe carburant |
| SOREA / AFP / CS | 1 each | 1 | alternateur, joint culbuteurs, support moteur |
*Top panier = Cardan SNR (PAP, 13 adds/1 session) et émetteur embrayage LUK (ACR, 6 adds/4 sessions).*

## 6. Top gammes vues (452 vues, niveau gamme — `r2_view` n'a pas de piece_id)
courroie-accessoire (52) · capteur temp. air (33) · galet tendeur (25) · cardan (21) · **émetteur-embrayage (21)** · support moteur (18) · compresseur clim (17) · plaquette frein (15) · thermostat (14) · disque frein (12)…

## 7. Score fournisseurs (périmètre tunnel 30 j)
| Fournisseur | Demande tunnel | Remboursements rupture | Marge | Verdict |
|---|---|---|---|---|
| **ACR** (spl 3) | forte (émetteur ×6 cmd + 6 produits panier) | **2/2 payés annulés** (émetteur) | OK (30-53 %) | **SUPPLIER_RISK** sur émetteur embrayage → `CONFIRM_BEFORE_PAYMENT` |
| **SASIC** (spl 59) | kit embrayage ×2 cmd | **1/1 payé annulé** | OK (40 %) | **SUPPLIER_RISK** sur kit embrayage → `CONFIRM_BEFORE_PAYMENT` |
| **PAP** (spl 53) | forte (cardan, plaquette, distrib) | 0 (aucune commande payée) | OK | `SELL_DIRECT` (à surveiller, pas de preuve négative) |
| **DCA / DistriCash** (spl 26) | faible (3 paniers, 0 commande) | 0 | OK | `DATA_INCOMPLETE` (pas atteint le paiement) |
| NED / SOREA / AFP / CS | marginale | 0 | OK | `DATA_INCOMPLETE` |
*CAL (spl 19) et Valeo (= marque, pas fournisseur) : **absents du tunnel 30 j** → non évaluables ici.*

## 8. Score gammes
| Gamme | Statut | Verdict |
|---|---|---|
| **Émetteur d'embrayage** (LUK/ACR) | très demandée + **2/2 ruptures payées** | 🔴 `CONFIRM_BEFORE_PAYMENT` |
| **Kit d'embrayage** (SASIC) | demandée + **1/1 rupture payée** | 🔴 `CONFIRM_BEFORE_PAYMENT` |
| Cardan, Plaquette, Maître-cylindre, Alternateur | demandées, pas de rupture prouvée | 🟢 `SELL_DIRECT` (surveiller) |

## 9. Lacunes de la capacité (checklist)
| Question | Réponse |
|---|---|
| couvre tous fournisseurs ? | partiel — `pri_frs` (code texte, sans FK) résout la plupart |
| couvre toutes marques ? | oui (`pm_name`) |
| calcule marge ? | **oui** (`pri_marge_n`) |
| disponibilité **fiable/fraîche** ? | **NON** — `pri_dispo='1'` optimiste, pas d'horodatage par ligne |
| délai fournisseur ? | **NON** |
| statut « vendable » automatisé ? | **NON** |
| applicable aux produits du tunnel ? | oui (paniers/commandes via piece_id ; vues = gamme-only) |

## 10. Verdict final & décision scoring
- **Cause prouvée** : signal `pri_dispo` non fiable (faux '1') **sur la gamme embrayage / fournisseurs ACR + SASIC**. Pas un problème de marge.
- **Décision : `IMPROVE` + `REUSE` — PAS `CREATE`.**
  - **REUSE immédiat (read-only / manuel)** : traiter émetteur+kit embrayage (ACR/SASIC) en **CONFIRM_BEFORE_PAYMENT** (le workflow d'équivalence manuelle existe déjà). Appliquer `pri_dispo='0'` comme filtre « ne pas vendre » là où il vaut '0'.
  - **IMPROVE (parké, owner-GO, hors OBSERVE)** : fraîcheur dispo par fournisseur sur les gammes à rupture — c'est exactement le moteur **Supplier-Truth (worktree)**. Ne PAS le merger/lancer pour ça maintenant (scraper externe + ~8 ventes gardées/an = disproportionné).
- **Aucune création** : ni nouvel agent, ni nouveau registre, ni gate panier global, ni modif paiement.

## 11. Backlog build PARKÉ (owner-GO)
1. `pri_refreshed_at` (fraîcheur dispo par ligne). 2. Dérivation read-only « sellable » = `pri_dispo='1'` **+** confiance fournisseur/gamme (priorité : embrayage). 3. Badge page « disponibilité à confirmer » sur gammes à rupture. 4. Merge moteur Supplier-Truth + creds — **seulement si le volume le justifie**.

---

## Mini-report départemental (format standard)
**Achats & Fournisseurs** — Période : 30 derniers jours · KPI : remboursements rupture · **Résultat : 3 paiements, 3 annulés « pas dispo », tous embrayage (ACR/SASIC), tous `pri_dispo='1'`** · Score : **Critique** · Évolution : 1ʳᵉ mesure · Preuve : ce rapport + `sales-funnel-scorecard.md` · Trou : signal `pri_dispo` faux positif (92.66 % '1') sur gamme embrayage · Cause probable : dispo jamais rafraîchie par fournisseur · Action : **REUSE** (CONFIRM_BEFORE_PAYMENT manuel sur embrayage ACR/SASIC ; filtre `pri_dispo='0'`) + **IMPROVE** parké (fraîcheur dispo) · Risque : moyen · Owner-GO requis : **oui** (tout gate/merge) · Prochaine preuve : taux rupture par fournisseur×gamme sur la prochaine fenêtre.
