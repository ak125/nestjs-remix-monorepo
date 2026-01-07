---
title: "AI-COS Governance — Cheat Sheet"
status: active
version: 1.21.0
created: 2026-01-02
relates-to:
  - ./ai-cos-governance-rules.md
tags: [governance, cheat-sheet, quick-reference]
---

# AI-COS Governance — Cheat Sheet

> **Résumé 1 page** des 4000+ lignes de gouvernance.
> Pour les détails complets : [ai-cos-governance-rules.md](./ai-cos-governance-rules.md)

---

## Axiome Zéro (INVIOLABLE)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   L'IA NE CRÉE PAS LA VÉRITÉ.                                   │
│                                                                  │
│   Elle produit, analyse, propose.                                │
│   La vérité = validée par Structure + Humain.                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Règles Immutables (7 règles NON NÉGOCIABLES)

**❌ INTERDITS :**
1. Aucun agent ne décide seul
2. Aucun agent hors hiérarchie
3. Aucun agent sans indicateur
4. Aucun agent transversal sans rattachement

**✅ OBLIGATOIRES :**
5. Diagnostic = multi-validation
6. Contenu critique = Quality Officer obligatoire
7. 1 création = 1 fusion ou suppression

---

## Règles IA Exactes (16 règles)

**🧠 Prompt Global** : Tu n'es pas un décideur. Tu proposes/analyses/exécutes. Signale toute incertitude. Donnée douteuse = blocage sortie. Décision finale = humain.

| Catégorie | Règles | Seuils |
|-----------|--------|--------|
| **Anti-Hallucination** | IA1-4 | >20% doute = blocage |
| **Anti-Dérive SEO** | SEO1-4 | >3% densité, >80% dupli |
| **Anti-Illégal** | LEG1-4 | RGPD, prix, contrat = Human |
| **Anti-Danger** | DNG1-4 | Infra, suppression = 2x valid |

**Seuils** : IA>20%→blocage | SEO>3%→stuffing | SEO>80%→dupli | DNG=2x validation

---

## 🔴 Blocages SEO Obligatoires

**BLOCAGE SI** : ❌ Contradiction stock | ❌ Duplication >80% | ❌ Cannibalisation KW | ❌ Promesse non vérifiable

| Règle | Condition | Action |
|-------|-----------|--------|
| **SEOB1** | Produit ≠ stock DB | Blocage immédiat |
| **SEOB2** | Similarité >80% | Alerte + blocage |
| **SEOB3** | Même KW 2+ pages | Review CMO |
| **SEOB4** | Affirmation sans source | Flag QTO |

**Escalade** : QTO → CMO → Human CEO

---

## 🔴 Blocages DIAGNOSTIC Obligatoires

**BLOCAGE SI** : ❌ Confiance <85% | ❌ Symptôme ambigu | ❌ Pièce sécurité | ❌ Données manquantes

| Règle | Condition | Action |
|-------|-----------|--------|
| **DIAG1** | Score confiance <85% | Blocage immédiat |
| **DIAG2** | ≥2 diagnostics équiprobables | Review Lead |
| **DIAG3** | Frein/Direction/Suspension | Validation humaine |
| **DIAG4** | Specs constructeur absentes | Blocage affichage |

**Escalade** : QTO → CPO (Diagnostic Lead) → Human CEO

---

## 🔴 Blocages JURIDIQUE / BUSINESS Obligatoires

**BLOCAGE SI** : ❌ Mention légale non sourcée | ❌ Promesse contractuelle | ❌ Risque RGPD/responsabilité

| Règle | Condition | Action |
|-------|-----------|--------|
| **JUR1** | Référence loi sans source | Blocage + alerte |
| **JUR2** | Garantie/délai engageant | Review Human CEO |
| **JUR3** | Données personnelles RGPD | Validation DPO/Human |
| **JUR4** | Responsabilité civile/pénale | Blocage immédiat |

**Escalade** : QTO → Human CEO → Conseil juridique externe

---

## 🔴 Blocages CONTENU / RÉDACTION Obligatoires

**BLOCAGE SI** : ❌ Hallucination factuelle | ❌ Sources non vérifiables | ❌ Divergence SEO↔Produit | ❌ Rejet QTO

| Règle | Condition | Action |
|-------|-----------|--------|
| **CONT1** | Fait non vérifiable | Blocage immédiat |
| **CONT2** | Référence introuvable | Blocage + flag |
| **CONT3** | Contenu ≠ fiche produit | Review CMO |
| **CONT4** | Validation QTO refusée | Retour rédaction |

**Escalade** : QTO → CMO → Human CEO

---

## Matrice d'Audit (5 critères)

| # | Critère | Question |
|---|---------|----------|
| 1️⃣ | UTILITÉ | Est-il utilisé ? |
| 2️⃣ | POSITION | Décide / Analyse / Exécute ? |
| 3️⃣ | REDONDANCE | Existe-t-il un clone ? |
| 4️⃣ | INDICATEUR | Mesure-t-on sa valeur ? |
| 5️⃣ | RATTACHEMENT | A-t-il un Lead ? |

**Scoring** : 0-3 🔴 Supprimer | 4-6 🟡 Risque | 7-9 🟠 Surveiller | 10+ ✅ Conforme

---

## Décisions Possibles (5 actions)

| Action | Quand |
|--------|-------|
| ✅ **CONSERVER** | Score 10+, conforme |
| 🔁 **FUSIONNER** | Clone détecté |
| 🔽 **RÉTROGRADER** | Surclassé |
| 🔒 **VERROUILLER** | Critique, expert |
| ❌ **SUPPRIMER** | Bruit pur |

**Protection TYPE 2** : On ne supprime PAS les agents rédaction/analyse utiles sans Human CEO

---

## Structure Cible (5 niveaux)

| Niveau | Rôle | Limite | Protection |
|--------|------|--------|------------|
| 0 | 🧠 Human CEO | 1 seul | Absolu |
| 1 | 🏛️ Executive Board | 6-7 max | Haute |
| 2 | 🎯 Leads Métiers | 1/domaine | Haute |
| 3 | 📊 Agents Support (TYPE 2) | Variable | **Protégés** |
| 4 | ⚙️ Agents Exécution (TYPE 3) | Variable | Jetables |

**Règles** : R1=Max 7 Niv.1 | R2=1 Lead/domaine | R3=Niv.3 protégés | R4=Niv.4 jetables | R5=Lead avant agents

**Bénéfices** : -25% bruit | +40% lisibilité | +vitesse décisionnelle

---

## Dashboard CEO (10 indicateurs max)

| Catégorie | Indicateurs |
|-----------|-------------|
| 🧠 Santé IA | Coût IA/jour, Alertes QTO, Conflits agents |
| 🚗 Diagnostic | Taux justesse, Cas bloqués |
| 📈 SEO | Pages indexées, Rejets contenu |
| 🛒 Business | Conversion, Panier moyen, ROI marketing |

**Règles** : D1=Max 10 | D2=Seuil vert+rouge | D3=1 action/rouge | D4=Vue quotidienne | D5=Tendance 7j

**Objectif** : Décider en 5 minutes, sans lire 100 pages

---

## Règle d'Alerte (Anti-Micro-Pilotage)

| État | Action |
|------|--------|
| ✅ Vert | Ne pas toucher — confiance |
| ⚠️ Jaune | Observer — pas d'action |
| 🔴 Rouge | Agir — arbitrage obligatoire |

**Règles** : A1=Vert→rien | A2=Jaune→veille | A3=Rouge→action | A4=1 alerte=1 décision | A5=Pas de préventif

**Principe** : Pas d'alerte = Pas d'action. Pas de micro-pilotage.

---

## Sorties Autorisées (Filtre CEO)

| Sortie | Autorisé |
|--------|----------|
| 📋 Synthèse IA-CEO | ✅ |
| ✅ Avis Quality Officer | ✅ |
| 💡 Reco C-Level | ✅ |
| ❌ Rapports bruts | Interdit |

**Règles** : S1=Synthétisé | S2=1 page max | S3=Contexte→Analyse→Reco | S4=Alerte=1 phrase | S5=Brut=interdit

**Principe** : Le CEO reçoit des DÉCISIONS, pas des DONNÉES.

---

## Agent Profile v1.6 (9 sections + lifecycle)

| Section | Contenu |
|---------|---------|
| 🆔 Identité | Nom, Domaine, Type |
| 🎯 Mission | "Cet agent existe pour…" (1 ligne max) |
| 🔗 Rattachement | Lead + Sponsor + Squad |
| 🔍 Entrées/Sorties | Flux de données |
| ⚖️ Autorité | Décision/Proposition/Escalade |
| 📊 Indicateurs | 1-2 KPIs typés + seuils |
| ✅❌ Permissions & Blocages | Règles + Interdits + Blocages |
| 📝 Audit | Score, date, statut |
| 🧪 **Statut Lifecycle** | Actif / En observation / À fusionner / À supprimer (NEW) |

**Statuts** : ☐ Actif | ☐ En observation | ☐ À fusionner | ☐ À supprimer

**Règles** : ST1=1 statut obligatoire | ST2=Actif par défaut | ST3=Observation max 30j | ST4=Fusion=Lead | ST5=Suppression TYPE1-2=Human CEO

**Mapping** : CTO→Tech | CPO→Diagnostic,Support | CMO→SEO | CFO→Business | QTO→QA

**Conformité** : 👉 Création agent = fiche obligatoire | 👉 Dérive = mise à jour fiche

**Règles** : CP1=Création→fiche | CP2=Dérive→MAJ fiche | Agent sans fiche = inexistant

---

## C-Level — 4 Verrous Chacun

| Rôle | Responsabilités | Verrou Principal |
|------|-----------------|------------------|
| **IA-CTO** | Code qualité, dette technique, sécurité | Qualité code obligatoire |
| **IA-CPO** | UX validée, satisfaction, cohérence produit | UX testée obligatoire |
| **IA-CMO** | SEO mesuré, visibilité, réputation | SEO mesuré obligatoire |
| **IA-CFO** | Coûts IA, ROI par agent, budget | Budget validé obligatoire |

**Règle commune** : Propose, ne décide jamais. Human CEO valide.

---

## Typologie Agents — 4 Types

| Type | Rôle | Indicateurs |
|------|------|-------------|
| TYPE 1 | **Décisionnel** | ROI, Impact business, Décision validée |
| TYPE 2 | **Analyse/Rédaction** | Validation, Clarté, Utilisation réelle |
| TYPE 3 | **Exécution** | Temps gagné, Volume traité, Erreur/succès |
| TYPE 4 | **Contrôle** | Scans exécutés, Alertes levées, Résolution rapide |

**Règle** : Pas d'indicateur = Suppression

---

## Règles d'Or (4 commandements)

1. **PAS D'INDICATEUR = SUPPRESSION**
2. **IA-CEO propose, Human CEO décide**
3. **Doute = Escalade Human CEO**
4. **Production sans validation = Interdit**

---

## Modes Opératoires

| Mode | Autonomie IA | Validation Humaine |
|------|--------------|-------------------|
| **SAFE** | Lecture seule | Aucune action |
| **ASSISTED** | Propose | Toujours requise |
| **AUTO-DRIVE** | Actions faibles | Moyen/Critique = humain |
| **FORECAST** | Simulation | Aucune exécution |

**Mode par défaut : ASSISTED**

---

## Kill-Switch (3 niveaux)

| Niveau | Déclencheur | Action |
|--------|-------------|--------|
| **N1** | Human CEO exclusif | Coupure totale immédiate |
| **N2** | Détection anomalie grave | Isolation automatique |
| **N3** | Seuil KPI critique dépassé | Alerte + gel |

---

## Workflow Standard

```
Agent → Output → QTO vérifie → Validation humaine → Production
         ↓
      Doute ?
         ↓
   Escalade Human CEO
```

---

## Contacts Escalade

| Criticité | Délai | Contact |
|-----------|-------|---------|
| Faible | 24h | Manager |
| Moyen | 4h | C-Level concerné |
| Critique | 1h | Human CEO |
| Urgence | Immédiat | Kill-Switch |

---

> **Version** : 1.21.0 | **Dernière mise à jour** : 2026-01-02
> **Document complet** : [ai-cos-governance-rules.md](./ai-cos-governance-rules.md)
