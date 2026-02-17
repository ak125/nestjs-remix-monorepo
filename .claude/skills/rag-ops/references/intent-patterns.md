# Intent Patterns Reference

Source de verite pour la classification des intents utilisateur dans le systeme RAG.

> **IMPORTANT :** Backend (`rag-proxy.service.ts`) et Frontend (`chat-intent.utils.ts`) DOIVENT rester en miroir. Toute modification doit etre faite aux DEUX endroits.

---

## 9 Intents Utilisateur

| # | Intent | Famille | Page Intent | Description |
|---|--------|---------|-------------|-------------|
| 1 | `fitment` | catalog | selection | Compatibilite vehicule, VIN, immatriculation |
| 2 | `troubleshoot` | diagnostic | diagnosis | Diagnostic panne, symptomes, bruits |
| 3 | `policy` | knowledge | support | Livraison, retour, garantie, CGV |
| 4 | `cost` | catalog | purchase | Prix, tarif, promo, budget |
| 5 | `compare` | knowledge | education | Comparaison, difference, versus |
| 6 | `maintain` | knowledge | education | Entretien, quand changer, frequence |
| 7 | `do` | knowledge | education | Comment faire, tutoriel, installation |
| 8 | `define` | knowledge | definition | Definition, c'est quoi, que signifie |
| 9 | `choose` | catalog | selection | Choisir, acheter, recommander (**fallback**) |

**Ordre de priorite :** L'intent matching s'arrete au premier match. L'ordre dans la liste est important — les intents plus specifiques (fitment, troubleshoot) sont testes avant les plus generiques (choose).

**Fallback :** Si aucun pattern ne match → `choose` (selection/achat generique).

---

## Regex Patterns par Intent

### `fitment` — Compatibilite vehicule
```regex
/\bcompatibilite\b/i
/\bcompatible\b/i
/\bmon vehicule\b/i
/\bvin\b/i
/\bimmatriculation\b/i
/\bmonte\b/i
```
**Exemples :** "Est-ce compatible avec ma Clio 3 ?", "Vérifier le VIN", "Ça monte sur Golf 6 ?"

### `troubleshoot` — Diagnostic
```regex
/\bdiagnosti/i
/\bpanne\b/i
/\bsymptome\b/i
/\bbruit\b/i
/\bvibration\b/i
/\bvoyant\b/i
/\bne demarre pas\b/i
```
**Exemples :** "Bruit au freinage", "Voyant moteur allumé", "La voiture ne démarre pas"

### `policy` — Politiques boutique
```regex
/\blivraison\b/i
/\bretour\b/i
/\bgaranti/i
/\brembourse/i
/\bcgv\b/i
/\bdelai\b/i
```
**Exemples :** "Délai de livraison ?", "Comment retourner un produit ?", "Quelle garantie ?"

### `cost` — Prix et tarifs
```regex
/\bprix\b/i
/\bcout\b/i
/\bcombien\b/i
/\btarif\b/i
/\bpromo\b/i
/\breduction\b/i
```
**Exemples :** "Combien coûte un filtre à huile ?", "Y a-t-il une promo ?", "Tarif plaquettes"

### `compare` — Comparaison
```regex
/\bcompar/i
/\bdifference\b/i
/\bversus\b/i
/\bvs\b/i
/\bmeilleur\b/i
```
**Exemples :** "Différence entre céramique et semi-métallique ?", "Bosch vs Brembo"

### `maintain` — Entretien
```regex
/\bentretien\b/i
/\bmaintenance\b/i
/\bintervalle\b/i
/\bquand changer\b/i
/\bfrequence\b/i
```
**Exemples :** "Quand changer la courroie de distribution ?", "Intervalle vidange"

### `do` — Instructions / How-to
```regex
/\bcomment faire\b/i
/\bcomment remplacer\b/i
/\btutoriel\b/i
/\bhow to\b/i
/\binstaller\b/i
/\bmonter\b/i
```
**Exemples :** "Comment remplacer les plaquettes ?", "Tutoriel montage amortisseurs"

### `define` — Definition
```regex
/\bc'?est quoi\b/i
/\bdefinition\b/i
/\bque signifie\b/i
/\bveut dire\b/i
```
**Exemples :** "C'est quoi un disque ventilé ?", "Définition ABS", "Que signifie ECE R90 ?"

### `choose` — Selection/achat (+ fallback)
```regex
/\bchoisir\b/i
/\bachat\b/i
/\bacheter\b/i
/\brecommand/i
/\bquel\b/i
/\bquelle\b/i
```
**Exemples :** "Quel disque de frein choisir ?", "Je veux acheter des plaquettes", "Recommandation filtre"

---

## Mappings

### Intent → IntentFamily (3 familles)

```
catalog    ← choose, cost, fitment
diagnostic ← troubleshoot
knowledge  ← define, do, maintain, compare, policy
```

### Intent → PageIntent (6 intents page)

```
selection  ← choose, fitment
purchase   ← cost
education  ← do, maintain, compare
definition ← define
diagnosis  ← troubleshoot
support    ← policy
```

### PageIntent → UserIntents (mapping inverse)

| PageIntent | UserIntents |
|------------|-------------|
| `definition` | define |
| `selection` | choose, fitment |
| `education` | do, maintain, compare |
| `purchase` | cost |
| `support` | policy |
| `diagnosis` | troubleshoot |

---

## Sections RAG disponibles

Les sections sont utilisees dans `GET /api/rag/section/:section` pour filtrer le retrieval :

| Section | Mapping page |
|---------|-------------|
| `diagnostic` | R5 Diagnostic |
| `guide-achat` | R3 Blog / Guide |
| `reference` | R4 Reference |
| `entretien` | Maintenance / Education |

---

## Fichiers source

| Fichier | Contenu |
|---------|---------|
| `backend/src/modules/rag-proxy/rag-proxy.service.ts` | `classifyIntent()`, `supportedUserIntents`, `intentStats` |
| `frontend/app/utils/chat-intent.utils.ts` | `INTENT_PATTERNS[]`, `classifyChatIntent()` |
| `frontend/app/utils/page-role.types.ts` | `UserIntent`, `IntentFamily`, `PageIntent`, tous les mappings |
