# R3 pillar consolidation evidence — 2026-06-03

> **Read-only evidence matrix.** Mesure uniquement — ne décide AUCUN fold/canonical/301.
> Site `sc-domain:automecanik.com` · fenêtres GSC 28j (2026-05-07→2026-06-03) + 90j (2026-03-06→2026-06-03) · live-robots: true.
> **`evidence_complete=false` ⇒ recommendation & url_* = OBSERVE** (aucun verdict fort sans tous les signaux).
> **Architecture recommendation ≠ URL posture** : `R3_ONLY` n'implique JAMAIS 301. `MERGE+301` = cible théorique, jamais une action.
> Overlap lexical (Jaccard) = **signal faible** : ne déclenche jamais MERGE+301 seul (exige HIGH overlap + 0 clic + même intention + R3 riche).

**Recommendations:** OBSERVE=10

## Synthèse

| gamme | architecture | url_R4 | url_R6 | risk | evidence | next_action |
|---|---|---|---|---|---|---|
| filtre-a-air (8) | OBSERVE | OBSERVE | OBSERVE | HIGH | complete | OBSERVE_GSC |
| filtre-a-huile (7) | OBSERVE | OBSERVE | OBSERVE | HIGH | complete | OBSERVE_GSC |
| disque-de-frein (82) | OBSERVE | OBSERVE | OBSERVE | HIGH | complete | OBSERVE_GSC |
| plaquette-de-frein (402) | OBSERVE | OBSERVE | KEEP | HIGH | complete | OBSERVE_GSC |
| batterie (1) | OBSERVE | OBSERVE | OBSERVE | HIGH | complete | OBSERVE_GSC |
| vanne-egr (1145) | OBSERVE | KEEP | OBSERVE | HIGH | complete | OBSERVE_GSC |
| turbo (2234) | OBSERVE | KEEP | OBSERVE | HIGH | complete | OBSERVE_GSC |
| amortisseur (854) | OBSERVE | OBSERVE | OBSERVE | HIGH | complete | OBSERVE_GSC |
| kit-de-distribution (307) | OBSERVE | OBSERVE | OBSERVE | HIGH | INCOMPLETE | COLLECT_SIGNALS (R4.index_follow, R6.index_follow) |
| kit-d-embrayage (479) | OBSERVE | OBSERVE | OBSERVE | HIGH | INCOMPLETE | COLLECT_SIGNALS (R4.index_follow, R6.index_follow) |

## Détail par gamme

### filtre-a-air (pg_id 8)

- **Architecture recommendation**: `OBSERVE`
- **URL posture**: R4 `OBSERVE` · R6 `OBSERVE`
- **Risk**: `HIGH` — overlap R3_R4 faible (intention probablement distincte) ; overlap R3_R6 faible (intention probablement distincte)
- **evidence_complete**: true
- **intent_targets**: diagnostic, achat, compatibilite

  | rôle | live | GSC 28j | GSC 90j | index/follow | inbound | overlap↔R3 |
  |---|---|---|---|---|---|---|
  | R3 | PRESENT_RICH | 0c / 0i / — | 0c / 0i / — | INDEX_FOLLOW | 0 | — |
  | R4 | PRESENT_THIN | 0c / 0i / — | 0c / 4i / 18.3 | INDEX_FOLLOW | 0 | LOW |
  | R6 | PRESENT_RICH | 0c / 0i / — | 0c / 0i / — | INDEX_FOLLOW | 0 | LOW |

### filtre-a-huile (pg_id 7)

- **Architecture recommendation**: `OBSERVE`
- **URL posture**: R4 `OBSERVE` · R6 `OBSERVE`
- **Risk**: `HIGH` — overlap R3_R4 faible (intention probablement distincte) ; overlap R3_R6 faible (intention probablement distincte)
- **evidence_complete**: true
- **intent_targets**: diagnostic, achat, compatibilite

  | rôle | live | GSC 28j | GSC 90j | index/follow | inbound | overlap↔R3 |
  |---|---|---|---|---|---|---|
  | R3 | PRESENT_RICH | 0c / 4i / 76.0 | 0c / 24i / 58.9 | INDEX_FOLLOW | 0 | — |
  | R4 | PRESENT_RICH | 0c / 0i / — | 0c / 0i / — | INDEX_FOLLOW | 0 | LOW |
  | R6 | PRESENT_RICH | 0c / 0i / — | 0c / 19i / 33.0 | INDEX_FOLLOW | 0 | LOW |

### disque-de-frein (pg_id 82)

- **Architecture recommendation**: `OBSERVE`
- **URL posture**: R4 `OBSERVE` · R6 `OBSERVE`
- **Risk**: `HIGH` — overlap R3_R4 faible (intention probablement distincte) ; overlap R3_R6 faible (intention probablement distincte)
- **evidence_complete**: true
- **intent_targets**: diagnostic, achat, reference, entretien

  | rôle | live | GSC 28j | GSC 90j | index/follow | inbound | overlap↔R3 |
  |---|---|---|---|---|---|---|
  | R3 | PRESENT_RICH | 0c / 4i / 4.0 | 0c / 116i / 48.0 | INDEX_FOLLOW | 0 | — |
  | R4 | PRESENT_RICH | 0c / 0i / — | 0c / 1i / 1.0 | INDEX_FOLLOW | 0 | LOW |
  | R6 | PRESENT_RICH | 0c / 0i / — | 0c / 4i / 6.0 | INDEX_FOLLOW | 0 | LOW |

### plaquette-de-frein (pg_id 402)

- **Architecture recommendation**: `OBSERVE`
- **URL posture**: R4 `OBSERVE` · R6 `KEEP`
- **Risk**: `HIGH` — R6 a des clics GSC ; overlap R3_R4 faible (intention probablement distincte) ; overlap R3_R6 faible (intention probablement distincte)
- **evidence_complete**: true
- **intent_targets**: diagnostic, achat, reference, entretien

  | rôle | live | GSC 28j | GSC 90j | index/follow | inbound | overlap↔R3 |
  |---|---|---|---|---|---|---|
  | R3 | PRESENT_RICH | 0c / 0i / — | 0c / 302i / 50.1 | INDEX_FOLLOW | 0 | — |
  | R4 | PRESENT_RICH | 0c / 0i / — | 0c / 0i / — | INDEX_FOLLOW | 0 | LOW |
  | R6 | PRESENT_THIN | 0c / 0i / — | 2c / 32i / 23.9 | INDEX_FOLLOW | 0 | LOW |

### batterie (pg_id 1)

- **Architecture recommendation**: `OBSERVE`
- **URL posture**: R4 `OBSERVE` · R6 `OBSERVE`
- **Risk**: `HIGH` — overlap R3_R4 faible (intention probablement distincte)
- **evidence_complete**: true
- **intent_targets**: diagnostic, achat, compatibilite

  | rôle | live | GSC 28j | GSC 90j | index/follow | inbound | overlap↔R3 |
  |---|---|---|---|---|---|---|
  | R3 | PRESENT_RICH | 0c / 0i / — | 0c / 0i / — | OBSERVE | 0 | — |
  | R4 | PRESENT_THIN | 0c / 0i / — | 0c / 53i / 70.1 | INDEX_FOLLOW | 0 | LOW |
  | R6 | DRAFT | OBSERVE | OBSERVE | OBSERVE | OBSERVE | MED |

### vanne-egr (pg_id 1145)

- **Architecture recommendation**: `OBSERVE`
- **URL posture**: R4 `KEEP` · R6 `OBSERVE`
- **Risk**: `HIGH` — R4 index/follow avec impressions ; overlap R3_R4 faible (intention probablement distincte) ; overlap R3_R6 faible (intention probablement distincte)
- **evidence_complete**: true
- **intent_targets**: diagnostic, achat, compatibilite

  | rôle | live | GSC 28j | GSC 90j | index/follow | inbound | overlap↔R3 |
  |---|---|---|---|---|---|---|
  | R3 | PRESENT_RICH | 0c / 0i / — | 0c / 19i / 14.2 | INDEX_FOLLOW | 0 | — |
  | R4 | PRESENT_RICH | 0c / 0i / — | 0c / 249i / 61.3 | INDEX_FOLLOW | 0 | LOW |
  | R6 | PRESENT_RICH | 0c / 0i / — | 0c / 38i / 15.7 | INDEX_FOLLOW | 0 | LOW |

### turbo (pg_id 2234)

- **Architecture recommendation**: `OBSERVE`
- **URL posture**: R4 `KEEP` · R6 `OBSERVE`
- **Risk**: `HIGH` — R4 index/follow avec impressions ; overlap R3_R4 faible (intention probablement distincte) ; overlap R3_R6 faible (intention probablement distincte)
- **evidence_complete**: true
- **intent_targets**: diagnostic, achat, compatibilite

  | rôle | live | GSC 28j | GSC 90j | index/follow | inbound | overlap↔R3 |
  |---|---|---|---|---|---|---|
  | R3 | PRESENT_RICH | 0c / 0i / — | 0c / 122i / 32.9 | OBSERVE | 0 | — |
  | R4 | PRESENT_RICH | 0c / 0i / — | 0c / 179i / 63.4 | INDEX_FOLLOW | 0 | LOW |
  | R6 | PRESENT_RICH | 0c / 0i / — | 0c / 6i / 26.5 | INDEX_FOLLOW | 0 | LOW |

### amortisseur (pg_id 854)

- **Architecture recommendation**: `OBSERVE`
- **URL posture**: R4 `OBSERVE` · R6 `OBSERVE`
- **Risk**: `HIGH` — overlap R3_R4 faible (intention probablement distincte) ; overlap R3_R6 faible (intention probablement distincte)
- **evidence_complete**: true
- **intent_targets**: diagnostic, achat, compatibilite

  | rôle | live | GSC 28j | GSC 90j | index/follow | inbound | overlap↔R3 |
  |---|---|---|---|---|---|---|
  | R3 | PRESENT_RICH | 0c / 0i / — | 0c / 6i / 6.2 | INDEX_FOLLOW | 0 | — |
  | R4 | PRESENT_RICH | 0c / 0i / — | 0c / 0i / — | INDEX_FOLLOW | 0 | LOW |
  | R6 | PRESENT_THIN | 0c / 0i / — | 0c / 44i / 21.1 | INDEX_FOLLOW | 0 | LOW |

### kit-de-distribution (pg_id 307)

- **Architecture recommendation**: `OBSERVE`
- **URL posture**: R4 `OBSERVE` · R6 `OBSERVE`
- **Risk**: `HIGH` — overlap R3_R4 faible (intention probablement distincte)
- **evidence_complete**: false — missing: R4.index_follow, R6.index_follow
- **intent_targets**: diagnostic, achat, compatibilite

  | rôle | live | GSC 28j | GSC 90j | index/follow | inbound | overlap↔R3 |
  |---|---|---|---|---|---|---|
  | R3 | PRESENT_RICH | 0c / 0i / — | 0c / 171i / 55.0 | INDEX_FOLLOW | 0 | — |
  | R4 | PRESENT_THIN | 0c / 0i / — | 0c / 9i / 70.6 | OBSERVE | 0 | LOW |
  | R6 | PRESENT_RICH | 0c / 0i / — | 0c / 14i / 24.6 | OBSERVE | 0 | MED |

### kit-d-embrayage (pg_id 479)

- **Architecture recommendation**: `OBSERVE`
- **URL posture**: R4 `OBSERVE` · R6 `OBSERVE`
- **Risk**: `HIGH` — R6 a des clics GSC ; overlap R3_R4 faible (intention probablement distincte) ; overlap R3_R6 faible (intention probablement distincte)
- **evidence_complete**: false — missing: R4.index_follow, R6.index_follow
- **intent_targets**: diagnostic, achat, compatibilite

  | rôle | live | GSC 28j | GSC 90j | index/follow | inbound | overlap↔R3 |
  |---|---|---|---|---|---|---|
  | R3 | PRESENT_RICH | 0c / 208i / 40.5 | 1c / 519i / 49.6 | OBSERVE | 0 | — |
  | R4 | PRESENT_THIN | 0c / 0i / — | 0c / 16i / 55.8 | OBSERVE | 0 | LOW |
  | R6 | PRESENT_RICH | 0c / 0i / — | 1c / 78i / 17.2 | OBSERVE | 0 | LOW |

---
_Read-only evidence. Toute décision fold/canonical/301 reste owner-gated + ADR, par lot ≤5 + surveillance GSC, APRÈS lecture de cette matrice._
