# Unavailable Quarantine Plan — sortir les pièces indispo de la vente sans casser les actifs

> **Plan de conception (read-only) — AUCUNE suppression, AUCUN UPDATE, AUCUNE migration exécutés.**
> Réutilise des champs **déjà câblés et import-protégés** ; ne crée aucun module/table/colonne.
> Owner-GO requis pour toute exécution (mutation données = step gouverné `apply-supabase-migrations`).
> Période de référence : tunnel 30 j (cf. [supplier-availability-report.md](./supplier-availability-report.md)). Maj 2026-05-31.
> Département responsable principal : **Achats & Fournisseurs** (cf. [automecanik-departments-map.md](./automecanik-departments-map.md)) — cross-départements en §8.

## 0. Pourquoi
3 paiements reçus → 3 remboursés « pas dispo » (tous embrayage). Règle owner : **non-dispo confirmé = retiré
de la vente + sas de quarantaine + recheck + réintégration/suppression**, SANS suppression brutale (en pièce
auto : la pièce peut revenir, une marque a un équivalent, une page a une valeur SEO, la compatibilité sert à
proposer une alternative).

## 1. ⚠️ Mécanisme — réutilisation HONNÊTE (3 corrections vérifiées dans le code)
Trois leviers « évidents » **ne marchent pas** comme on l'imaginait — vérifié dans le runtime :
| Levier supposé | Réalité (code) | Conséquence |
|---|---|---|
| `pri_dispo='0'` retire du grid produit | **FAUX** : `rm_get_page_complete_v2` filtre seulement `piece_display=true` ; `pri_dispo` ne fait que trier/badger | `pri_dispo='0'` **ne retire pas** une pièce de la page produit |
| `pricing_state` gate le paiement/browse | **FAUX** : lu 1× (`pricing.repository.ts`), jamais appliqué | Ajouter une valeur au CHECK ne gate rien (*layer-before-value*) |
| Quarantaine survit à l'import | **FAUX** : `commit_price_chunk` force `pri_dispo='1'` et ne skip que `FROZEN`/`MANUAL_OVERRIDE` | Toute quarantaine via `pri_dispo`/nouvel état = **annulée silencieusement** au prochain import |

**→ Porteur de quarantaine V1 (pur reuse, import-safe, réversible) :**
- **`pieces.piece_display = false`** : seul vrai levier de retrait du grid R2 (`rm_get_page_complete_v2:278`, `products.service.ts:60`). Précédent réel : ~5 427 ghost pieces. À `count=0`, la page sert `NoProductsAlternatives` (§6).
- **+ `pieces_price.pricing_state = 'FROZEN'`** : **déjà import-protégé** (skip-list `commit_price_chunk`), **déjà dans le CHECK** → survit aux imports. Porte le verrou.
- **+ `pricing_state_reason` / `pricing_updated_by` / `pricing_updated_source`** (colonnes existantes, migration 20260522 L5a) : **note lisible humaine** (ex. « quarantaine rupture ACR/émetteur 2026-05-31, recheck hebdo ») + auteur + source. *Pas de magic-string parsée* (anti-pattern schéma-dans-string refusé).

**Zéro nouvelle valeur d'enum, zéro nouveau consumer en V1.** `SUPPLIER_UNAVAILABLE`/`CONFIRM_BEFORE_PAYMENT` ne sont **PAS** ajoutés (inutiles tant qu'aucun code ne les applique).

## 2. Règle Toyota Gate
| État disponibilité | Action (mécanisme réel) |
|---|---|
| **Disponible fiable** | VENDABLE — `piece_display=true`, `pricing_state='ACTIVE'`. Aucune mutation. |
| **Inconnue / incertaine** | À VÉRIFIER — rester visible, **report read-only** (pas de mutation V1). Un badge « à confirmer » = nouveau consumer = parké. |
| **Non-dispo confirmé** (refund / supplier confirme) | RETIRER — `piece_display=false` + `pricing_state='FROZEN'` + reason. Sort du grid ; page→alternatives. |
| **Non-dispo temporaire** | QUARANTAINE — même levier, reason horodatée + recheck (cron parké). Réversible. |
| **Non-dispo durable** | DÉSACTIVER — `piece_display=false`+`FROZEN` maintenus ; DELETE physique seulement §5 Niveau 3. |
| **Alternative dispo** | REDIRIGER — quarantaine + **conserver compatibilité** ; `NoProductsAlternatives` propose l'équivalent. |

## 3. Les 6 statuts = modèle de **cycle de vie** (porté par l'existant, pas de nouveau champ)
| Statut | Porté par | Réalité |
|---|---|---|
| QUARANTINE_UNAVAILABLE | `piece_display=false` + `pricing_state='FROZEN'` + reason | retiré vente, réversible |
| RECHECK_PENDING | **report/queue read-only** (pas un champ DB en V1) | en attente revérif (cadence §7) |
| RETURNED_AVAILABLE | retour `piece_display=true` + `pricing_state='ACTIVE'` | réintégré après recheck OK |
| REPLACED_BY_ALTERNATIVE | reason = note « équivalent: <ref> » (lisible) + compat conservée | équivalent proposé |
| DELETE_CANDIDATE | **ligne de rapport read-only** (PAS une action/champ) | escalade après seuil |
| DELETED_OR_DISABLED | Niveau 3 DELETE (owner-GO) **ou** `piece_display=false`+`FROZEN` durable | état terminal |

## 4. Détection — entrée en quarantaine (déclencheurs)
`pri_dispo='0'` (signal dur, **même s'il ne retire pas le grid** — il marque la non-dispo) · remboursement « pas dispo » · rupture fournisseur confirmée · échecs répétés même gamme×fournisseur. **Action = report → owner-GO → `piece_display=false`+`FROZEN`+reason.**

## 5. Les 3 niveaux de retrait (réversibilité)
| Niveau | Quand | Mécanisme | Réversible |
|---|---|---|---|
| **N1 — Retrait du flux de vente** | rupture confirmée / refund | `piece_display=false` + `pricing_state='FROZEN'` + reason | ✅ |
| **N2 — Retrait durable d'affichage** | rupture longue, pièce fantôme | même levier maintenu (distinction = intention + cadence dans reason, pas un autre champ) | ✅ |
| **N3 — Suppression physique DB** | **UNIQUEMENT** obsolète + 0 trafic + 0 commande + 0 alternative + **owner-GO nominatif** | DELETE `pieces_price`/`pieces` après rapport validé | ❌ |
*N1 et N2 partagent le même levier (le seul réel) ; l'option « visible-mais-non-achetable + badge » exigerait un nouveau consumer → §10 parké. Jamais de N3 auto/masse/sur import.*

## 6. Page / SEO — déjà sûr par conception ✅ (vérifié)
- Page produit R2 à **0 produit** → **HTTP 200 + `X-Robots-Tag: noindex, follow`** + composant **`NoProductsAlternatives`** déjà déployé (`pieces-vehicle.loader.server.ts:250-364`, `components/pieces/NoProductsAlternatives.tsx`) : autres motorisations, autres pièces compatibles, générations liées, capture de lead. **Jamais 404.**
- Page gamme R1 reste **indexée** (pas de gate au compte produit). `410` réservé aux URLs orphelines/malformées (noindex+follow).
- **Désindexation par `noindex`, pas par suppression.** Pas de meta/H1/canonical/slug touchés.
- Garde : `NoProductsAlternatives` ne se déclenche qu'à `count=0` → quarantiner une pièce parmi d'autres laisse la page peuplée (normal) ; vider une page = quarantiner toutes ses pièces (rare, à surveiller).

## 7. Recheck (cadence) — **cron = parké, owner-GO**
| Type produit | Fréquence |
|---|---|
| forte demande / panier récent (ex. embrayage tunnel) | 1-3 jours |
| gamme stratégique (émetteur/kit embrayage, plaquette, support moteur) | hebdo |
| faible demande / longue traîne | mensuel |
| rupture longue (dépasse seuil) | escalade `DELETE_CANDIDATE` (rapport owner) |

## 8. Produits prioritaires & responsabilité cross-départements
**Quarantaine en PREMIER (proven, 3 refs)** : `3283439` (LUK/ACR émetteur), `3283441` (LUK/ACR émetteur), `8291920` (SASIC kit) — tous `pri_dispo='1'` faux-positif.
**Matrice risque (REPORT only, PAS de quarantaine de masse)** : ACR source **955/1868 (51 %)** des émetteurs (2/2 payés annulés) ; SASIC source 320/4788 des kits (1/1 annulé). → **ne PAS quarantiner les 955 refs sur 2 échecs** : surveiller en rapport, quarantiner seulement les refs prouvées + recheck.
| Département | Responsabilité |
|---|---|
| Achats & Fournisseurs | vérité dispo, déclenche quarantaine |
| Catalogue & Compatibilité | alternatives compatibles (conserver relations) |
| Pricing | marge des alternatives |
| Pages & SEO | ne pas casser les pages utiles (noindex>404) |
| Commercial & Ventes | éviter le paiement sur indispo (gate = parké) |
| Data & Analytics | mesurer sorties/réintégrations |
| Gouvernance / Risk | N3 DELETE seulement avec preuve + GO |

## 9. Décision scoring
| Cas | Décision |
|---|---|
| `pri_dispo='0'` | **IMPROVE** — porte la non-dispo en rapport ; retrait réel = `piece_display=false`+`FROZEN` (owner-GO) |
| Refund « pas dispo » (3 clutch) | **IMPROVE** — quarantaine des 3 refs prouvées |
| Rupture fournisseur répétée (ACR/SASIC) | **IMPROVE** — matrice risque supplier×gamme (report), pas retrait de masse |
| No-return après seuil | **DELETE_CANDIDATE** (rapport owner) |
| Page à trafic SEO | **SHOW_ALTERNATIVE** (déjà câblé), jamais 404 |
| Alternative existe | **REPLACE** (reason + compat conservée) |
| Incertain | **RECHECK** (report, pas de mutation) |
**Verdict global : IMPROVE + REUSE, PAS CREATE.** Le moteur Supplier-Truth (worktree) reste parké.

## 10. Backlog « build » PARKÉ (owner-GO, hors OBSERVE)
1. **Filtre browse sur dispo réelle** : patch gouverné `rm_get_page_complete_v2` (`WHERE … NOT FROZEN/SUPPLIER_UNAVAILABLE`) — si on veut un retrait piloté par `pricing_state` plutôt que `piece_display`.
2. **Gate paiement** (`CONFIRM_BEFORE_PAYMENT`) : **nouveau consumer** côté cart/checkout (le cart ne lit que `piece_stock`). Payment-adjacent → **GO nominatif**.
3. **Patch import** : ajouter l'état quarantaine à la skip-list de `commit_price_chunk:58` (si on n'utilise pas FROZEN).
4. **Cron recheck** + **vue dérivée « sellable »** (pri_dispo + pricing_state + stock + confiance fournisseur). = moteur Supplier-Truth, parké (disproportionné vs ~8 ventes gardées/an).

## 11. Garde-fous (NE PAS faire)
Pas de suppression physique immédiate ni de masse · jamais 404 une page trafiquée sans alternative (noindex>404) · ne pas confondre temporaire (réversible) et durable/mort · **ne jamais supprimer les données de compatibilité** (`pieces_gamme`/relations) · **pas de nouveau système** (réutiliser `piece_display`+`pricing_state`+reason) · ne pas toucher le cart (orthogonal, `piece_stock`) · pas de magic-string parsée dans `pricing_state_reason` (note lisible only) · No silent fallback : toute quarantaine écrit reason+by+source · OBSERVE jusqu'au 2026-06-08 : **rien d'exécuté, design only**.

---

## Mini-report départemental (format standard)
**Achats & Fournisseurs — Quarantaine disponibilité** · Période : 30 derniers jours · KPI : pièces indispo dans le flux de vente · Résultat : 3 refs clutch prouvées indispo (pri_dispo='1' faux-positif) ; classe à risque ACR/émetteur (51 %) · Score : Critique · Évolution : 1ʳᵉ mesure · Preuve : ce plan + supplier-availability-report.md · Trou : pas de retrait fiable + import ré-active la dispo · Cause probable : `pri_dispo` non filtré sur grid + écrasé à l'import ; `pricing_state` sans consumer · Action : **IMPROVE/REUSE** — quarantaine via `piece_display=false`+`pricing_state='FROZEN'`+reason (owner-GO), report matrice risque · Risque : moyen (SEO sûr par conception) · Owner-GO requis : **oui** (toute mutation + tout gate/cron) · Prochaine preuve : effet d'une quarantaine pilote sur les 3 refs + recheck retour dispo.

---

## ✅ Pilote exécuté — 2026-05-31 (GO nominatif owner)
Périmètre strict : **3 références prouvées uniquement** · aucune autre ref · aucune suppression physique · cart/payment intouchés · `pri_dispo` non modifié.

| piece_id | pièce | AVANT | APRÈS |
|---|---|---|---|
| 3283439 | Émetteur embrayage LUK/ACR | `piece_display=true` · `pricing_state=ACTIVE` | `piece_display=false` · `pricing_state=FROZEN` + reason |
| 3283441 | Émetteur embrayage LUK/ACR | `piece_display=true` · `pricing_state=ACTIVE` | `piece_display=false` · `pricing_state=FROZEN` + reason |
| 8291920 | Kit embrayage SASIC | `piece_display=true` · `pricing_state=ACTIVE` | `piece_display=false` · `pricing_state=FROZEN` + reason |

`pricing_state_reason` = « Quarantaine rupture fournisseur (refund pas-dispo 2026-05-31, embrayage ACR/SASIC). Reversible… ». `pricing_updated_by='quarantine-pilot-owner-go'`, `pricing_updated_source='audit/unavailable-quarantine-plan.md'`.
**Effet** : retirées du grid R2 (RPC filtre `piece_display=true`) + du feed merchant ; verrou import-protégé (`FROZEN`) ; page reste 200/noindex/`NoProductsAlternatives` si vide. **Vérif live page = prochaine preuve** (sur le site tournant).

### ROLLBACK (réintégration, owner-GO)
```sql
UPDATE pieces SET piece_display = true WHERE piece_id IN (3283439,3283441,8291920);
UPDATE pieces_price SET pricing_state='ACTIVE', pricing_state_reason=NULL,
  pricing_updated_by=NULL, pricing_updated_source=NULL
WHERE pri_piece_id_i IN (3283439,3283441,8291920) AND pri_type='0';
```
Recheck hebdo : si le fournisseur reconfirme la dispo → exécuter le rollback (RETURNED_AVAILABLE).

### ✅ Vérification live DEV (render proof) — 2026-05-31, DEV:3000 (health 200)
Preuve data-layer (RPC `rm_get_page_complete_v2`, que la page consomme) + HTTP réel.
| Page réelle (vue récemment) | RPC count | Pièce gelée dans grid | HTTP | Robots | Alternatives |
|---|---|---|---|---|---|
| `…/emetteur-d-embrayage-234/peugeot-128/406…/…-5354.html` (1 autre pièce reste) | 1 | **absente** (0 occ. id/ref) | **200** | `public, indexé` (count>0) | grid normal |
| `…/emetteur-d-embrayage-234/renault-140/safrane-ii…/…-5643.html` (gelée était seule) | **0** | **absente** | **200** | **`x-robots-tag: noindex, follow`** | **`NoProductsAlternatives` rendu** (57 KB) |
| `…/kit-d-embrayage-479/…-3766` (gelée seule) | **0** | absente | (idem 0-produit) | noindex | alternatives |

**Conclusions** (objectifs owner) : ✅ pages restent **200** (jamais 404) · ✅ **noindex** si 0 produit, **indexé** si produits restants · ✅ **`NoProductsAlternatives` apparaît** · ✅ **aucune pièce gelée dans le grid** (data-layer + HTML) · ✅ **cart/payment intouchés**. Le retrait du grid est confirmé en bout de chaîne (DB → RPC → page HTML), pas seulement au niveau DB.
