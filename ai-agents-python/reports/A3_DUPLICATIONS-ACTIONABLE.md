# 🔄 A3 - Duplications de Code - Rapport Actionnable

**Date**: 2025-10-19 12:50:28
**Findings**: 1000 duplications

---

## 📈 Vue d'Ensemble

- **Duplications détectées**: 1000
- **Occurrences totales**: 22,432
- **Impact total**: 63,570

### Par Sévérité

| Sévérité | Duplications | Impact Total | Temps Estimé |
|----------|--------------|--------------|---------------|
| CRITICAL | 825 | 56285 | ~825h |
| HIGH | 175 | 7285 | ~88h |

---

## 🔝 Top 20 Duplications à Traiter

### 1. 🔴 Duplication (Impact: 635)

**Métriques**:
- Impact: **635**
- Occurrences: 239
- Fichiers touchés: 127
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
div className grid grid cols md grid cols...
```

**Fichiers Concernés** (127 fichiers):
1. `frontend/app/components/CheckoutOptimization.tsx`
2. `frontend/app/components/Footer.tsx`
3. `frontend/app/components/SystemMonitoring.tsx`
4. `frontend/app/routes/admin.system.tsx`
5. `frontend/app/routes/admin.invoices._index.tsx`
... et 122 autres fichiers

**✅ Actions Recommandées**:

**Type**: Duplication JSX/UI

1. Créer un composant réutilisable
2. Extraire dans `components/shared/`
3. Accepter props pour personnalisation
4. Remplacer dans tous les fichiers
5. Tester rendu visuel

**Exemple de composant**:
```tsx
// components/shared/DuplicatedComponent.tsx
export function DuplicatedComponent(props) {
  return (
    div className grid grid cols md grid cols......
  );
}
```

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 127 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~31.8h

---

### 2. 🔴 Duplication (Impact: 415)

**Métriques**:
- Impact: **415**
- Occurrences: 179
- Fichiers touchés: 83
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
div className flex items center justify between div...
```

**Fichiers Concernés** (83 fichiers):
1. `frontend/app/components/SeoWidget.tsx`
2. `frontend/app/routes/admin.system.tsx`
3. `frontend/app/routes/admin.invoices._index.tsx`
4. `frontend/app/routes/admin._index.tsx`
5. `frontend/app/routes/orders.new.tsx`
... et 78 autres fichiers

**✅ Actions Recommandées**:

**Type**: Duplication JSX/UI

1. Créer un composant réutilisable
2. Extraire dans `components/shared/`
3. Accepter props pour personnalisation
4. Remplacer dans tous les fichiers
5. Tester rendu visuel

**Exemple de composant**:
```tsx
// components/shared/DuplicatedComponent.tsx
export function DuplicatedComponent(props) {
  return (
    div className flex items center justify between di...
  );
}
```

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 83 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~20.8h

---

### 3. 🔴 Duplication (Impact: 395)

**Métriques**:
- Impact: **395**
- Occurrences: 109
- Fichiers touchés: 79
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
grid cols md grid cols lg grid cols...
```

**Fichiers Concernés** (79 fichiers):
1. `frontend/app/components/Footer.tsx`
2. `frontend/app/components/SystemMonitoring.tsx`
3. `frontend/app/routes/admin.system.tsx`
4. `frontend/app/routes/admin.invoices._index.tsx`
5. `frontend/app/routes/orders._index.tsx`
... et 74 autres fichiers

**✅ Actions Recommandées**:

1. Analyser le contexte de duplication
2. Identifier pattern commun
3. Créer abstraction (composant/fonction/hook)
4. Remplacer les occurrences
5. Tester

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 79 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~19.8h

---

### 4. 🔴 Duplication (Impact: 360)

**Métriques**:
- Impact: **360**
- Occurrences: 93
- Fichiers touchés: 72
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
grid grid cols md grid cols lg grid...
```

**Fichiers Concernés** (72 fichiers):
1. `frontend/app/components/Footer.tsx`
2. `frontend/app/components/SystemMonitoring.tsx`
3. `frontend/app/routes/admin.system.tsx`
4. `frontend/app/routes/admin.invoices._index.tsx`
5. `frontend/app/routes/orders._index.tsx`
... et 67 autres fichiers

**✅ Actions Recommandées**:

1. Analyser le contexte de duplication
2. Identifier pattern commun
3. Créer abstraction (composant/fonction/hook)
4. Remplacer les occurrences
5. Tester

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 72 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~18.0h

---

### 5. 🔴 Duplication (Impact: 355)

**Métriques**:
- Impact: **355**
- Occurrences: 93
- Fichiers touchés: 71
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
div div className grid grid cols md grid...
```

**Fichiers Concernés** (71 fichiers):
1. `frontend/app/components/SystemMonitoring.tsx`
2. `frontend/app/routes/admin.system.tsx`
3. `frontend/app/routes/admin.invoices._index.tsx`
4. `frontend/app/routes/reviews.create.tsx`
5. `frontend/app/routes/homepage.v3.tsx`
... et 66 autres fichiers

**✅ Actions Recommandées**:

**Type**: Duplication JSX/UI

1. Créer un composant réutilisable
2. Extraire dans `components/shared/`
3. Accepter props pour personnalisation
4. Remplacer dans tous les fichiers
5. Tester rendu visuel

**Exemple de composant**:
```tsx
// components/shared/DuplicatedComponent.tsx
export function DuplicatedComponent(props) {
  return (
    div div className grid grid cols md grid......
  );
}
```

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 71 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~17.8h

---

### 6. 🔴 Duplication (Impact: 335)

**Métriques**:
- Impact: **335**
- Occurrences: 88
- Fichiers touchés: 67
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
cols md grid cols lg grid cols gap...
```

**Fichiers Concernés** (67 fichiers):
1. `frontend/app/components/Footer.tsx`
2. `frontend/app/components/SystemMonitoring.tsx`
3. `frontend/app/routes/admin.system.tsx`
4. `frontend/app/routes/admin.invoices._index.tsx`
5. `frontend/app/routes/orders._index.tsx`
... et 62 autres fichiers

**✅ Actions Recommandées**:

1. Analyser le contexte de duplication
2. Identifier pattern commun
3. Créer abstraction (composant/fonction/hook)
4. Remplacer les occurrences
5. Tester

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 67 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~16.8h

---

### 7. 🔴 Duplication (Impact: 280)

**Métriques**:
- Impact: **280**
- Occurrences: 57
- Fichiers touchés: 56
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
h1 className text 3xl font bold text gray...
```

**Fichiers Concernés** (56 fichiers):
1. `frontend/app/components/CheckoutOptimization.tsx`
2. `frontend/app/routes/admin.system.tsx`
3. `frontend/app/routes/admin.invoices._index.tsx`
4. `frontend/app/routes/reviews.create.tsx`
5. `frontend/app/routes/orders._index.tsx`
... et 51 autres fichiers

**✅ Actions Recommandées**:

**Type**: Duplication JSX/UI

1. Créer un composant réutilisable
2. Extraire dans `components/shared/`
3. Accepter props pour personnalisation
4. Remplacer dans tous les fichiers
5. Tester rendu visuel

**Exemple de composant**:
```tsx
// components/shared/DuplicatedComponent.tsx
export function DuplicatedComponent(props) {
  return (
    h1 className text 3xl font bold text gray......
  );
}
```

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 56 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~14.0h

---

### 8. 🔴 Duplication (Impact: 240)

**Métriques**:
- Impact: **240**
- Occurrences: 56
- Fichiers touchés: 48
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
div className grid grid cols lg grid cols...
```

**Fichiers Concernés** (48 fichiers):
1. `frontend/app/routes/orders.new.tsx`
2. `frontend/app/routes/dashboard.tsx`
3. `frontend/app/routes/cart.tsx`
4. `frontend/app/routes/commercial.reports._index.tsx`
5. `frontend/app/routes/support.ai.tsx`
... et 43 autres fichiers

**✅ Actions Recommandées**:

**Type**: Duplication JSX/UI

1. Créer un composant réutilisable
2. Extraire dans `components/shared/`
3. Accepter props pour personnalisation
4. Remplacer dans tous les fichiers
5. Tester rendu visuel

**Exemple de composant**:
```tsx
// components/shared/DuplicatedComponent.tsx
export function DuplicatedComponent(props) {
  return (
    div className grid grid cols lg grid cols......
  );
}
```

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 48 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~12.0h

---

### 9. 🔴 Duplication (Impact: 235)

**Métriques**:
- Impact: **235**
- Occurrences: 60
- Fichiers touchés: 47
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
return div className min screen bg gray 50...
```

**Fichiers Concernés** (47 fichiers):
1. `frontend/app/routes/pieces.catalogue.tsx`
2. `frontend/app/routes/orders._index.tsx`
3. `frontend/app/routes/commercial.returns._index.tsx`
4. `frontend/app/routes/dashboard.tsx`
5. `frontend/app/routes/cart.tsx`
... et 42 autres fichiers

**✅ Actions Recommandées**:

**Type**: Duplication JSX/UI

1. Créer un composant réutilisable
2. Extraire dans `components/shared/`
3. Accepter props pour personnalisation
4. Remplacer dans tous les fichiers
5. Tester rendu visuel

**Exemple de composant**:
```tsx
// components/shared/DuplicatedComponent.tsx
export function DuplicatedComponent(props) {
  return (
    return div className min screen bg gray 50......
  );
}
```

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 47 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~11.8h

---

### 10. 🔴 Duplication (Impact: 235)

**Métriques**:
- Impact: **235**
- Occurrences: 52
- Fichiers touchés: 47
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
div div div className grid grid cols md...
```

**Fichiers Concernés** (47 fichiers):
1. `frontend/app/components/SystemMonitoring.tsx`
2. `frontend/app/routes/reviews.create.tsx`
3. `frontend/app/routes/homepage.v3.tsx`
4. `frontend/app/routes/orders._index.tsx`
5. `frontend/app/routes/commercial.returns._index.tsx`
... et 42 autres fichiers

**✅ Actions Recommandées**:

**Type**: Duplication JSX/UI

1. Créer un composant réutilisable
2. Extraire dans `components/shared/`
3. Accepter props pour personnalisation
4. Remplacer dans tous les fichiers
5. Tester rendu visuel

**Exemple de composant**:
```tsx
// components/shared/DuplicatedComponent.tsx
export function DuplicatedComponent(props) {
  return (
    div div div className grid grid cols md......
  );
}
```

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 47 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~11.8h

---

### 11. 🔴 Duplication (Impact: 225)

**Métriques**:
- Impact: **225**
- Occurrences: 60
- Fichiers touchés: 45
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
grid grid cols md grid cols gap div...
```

**Fichiers Concernés** (45 fichiers):
1. `frontend/app/components/CheckoutOptimization.tsx`
2. `frontend/app/routes/admin.system.tsx`
3. `frontend/app/routes/reviews.create.tsx`
4. `frontend/app/routes/orders.new.tsx`
5. `frontend/app/routes/orders._index.tsx`
... et 40 autres fichiers

**✅ Actions Recommandées**:

**Type**: Duplication JSX/UI

1. Créer un composant réutilisable
2. Extraire dans `components/shared/`
3. Accepter props pour personnalisation
4. Remplacer dans tous les fichiers
5. Tester rendu visuel

**Exemple de composant**:
```tsx
// components/shared/DuplicatedComponent.tsx
export function DuplicatedComponent(props) {
  return (
    grid grid cols md grid cols gap div......
  );
}
```

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 45 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~11.2h

---

### 12. 🔴 Duplication (Impact: 210)

**Métriques**:
- Impact: **210**
- Occurrences: 160
- Fichiers touchés: 42
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
fill none stroke currentColor viewBox 24 24 path...
```

**Fichiers Concernés** (42 fichiers):
1. `frontend/app/routes/support.tsx`
2. `frontend/app/routes/checkout.payment.tsx`
3. `frontend/app/routes/pieces.$brand.$model.$type.$category.tsx`
4. `frontend/app/routes/checkout.tsx`
5. `frontend/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx`
... et 37 autres fichiers

**✅ Actions Recommandées**:

1. Analyser le contexte de duplication
2. Identifier pattern commun
3. Créer abstraction (composant/fonction/hook)
4. Remplacer les occurrences
5. Tester

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 42 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~10.5h

---

### 13. 🔴 Duplication (Impact: 210)

**Métriques**:
- Impact: **210**
- Occurrences: 160
- Fichiers touchés: 42
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
none stroke currentColor viewBox 24 24 path strokeLinecap...
```

**Fichiers Concernés** (42 fichiers):
1. `frontend/app/routes/support.tsx`
2. `frontend/app/routes/checkout.payment.tsx`
3. `frontend/app/routes/pieces.$brand.$model.$type.$category.tsx`
4. `frontend/app/routes/checkout.tsx`
5. `frontend/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx`
... et 37 autres fichiers

**✅ Actions Recommandées**:

1. Analyser le contexte de duplication
2. Identifier pattern commun
3. Créer abstraction (composant/fonction/hook)
4. Remplacer les occurrences
5. Tester

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 42 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~10.5h

---

### 14. 🔴 Duplication (Impact: 210)

**Métriques**:
- Impact: **210**
- Occurrences: 160
- Fichiers touchés: 42
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
stroke currentColor viewBox 24 24 path strokeLinecap round...
```

**Fichiers Concernés** (42 fichiers):
1. `frontend/app/routes/support.tsx`
2. `frontend/app/routes/checkout.payment.tsx`
3. `frontend/app/routes/pieces.$brand.$model.$type.$category.tsx`
4. `frontend/app/routes/checkout.tsx`
5. `frontend/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx`
... et 37 autres fichiers

**✅ Actions Recommandées**:

1. Analyser le contexte de duplication
2. Identifier pattern commun
3. Créer abstraction (composant/fonction/hook)
4. Remplacer les occurrences
5. Tester

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 42 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~10.5h

---

### 15. 🔴 Duplication (Impact: 210)

**Métriques**:
- Impact: **210**
- Occurrences: 160
- Fichiers touchés: 42
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
currentColor viewBox 24 24 path strokeLinecap round strokeLinejoin...
```

**Fichiers Concernés** (42 fichiers):
1. `frontend/app/routes/support.tsx`
2. `frontend/app/routes/checkout.payment.tsx`
3. `frontend/app/routes/pieces.$brand.$model.$type.$category.tsx`
4. `frontend/app/routes/checkout.tsx`
5. `frontend/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx`
... et 37 autres fichiers

**✅ Actions Recommandées**:

1. Analyser le contexte de duplication
2. Identifier pattern commun
3. Créer abstraction (composant/fonction/hook)
4. Remplacer les occurrences
5. Tester

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 42 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~10.5h

---

### 16. 🔴 Duplication (Impact: 210)

**Métriques**:
- Impact: **210**
- Occurrences: 160
- Fichiers touchés: 42
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
viewBox 24 24 path strokeLinecap round strokeLinejoin round...
```

**Fichiers Concernés** (42 fichiers):
1. `frontend/app/routes/support.tsx`
2. `frontend/app/routes/checkout.payment.tsx`
3. `frontend/app/routes/pieces.$brand.$model.$type.$category.tsx`
4. `frontend/app/routes/checkout.tsx`
5. `frontend/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx`
... et 37 autres fichiers

**✅ Actions Recommandées**:

1. Analyser le contexte de duplication
2. Identifier pattern commun
3. Créer abstraction (composant/fonction/hook)
4. Remplacer les occurrences
5. Tester

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 42 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~10.5h

---

### 17. 🔴 Duplication (Impact: 210)

**Métriques**:
- Impact: **210**
- Occurrences: 160
- Fichiers touchés: 42
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
24 24 path strokeLinecap round strokeLinejoin round strokeWidth...
```

**Fichiers Concernés** (42 fichiers):
1. `frontend/app/routes/support.tsx`
2. `frontend/app/routes/checkout.payment.tsx`
3. `frontend/app/routes/pieces.$brand.$model.$type.$category.tsx`
4. `frontend/app/routes/checkout.tsx`
5. `frontend/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx`
... et 37 autres fichiers

**✅ Actions Recommandées**:

1. Analyser le contexte de duplication
2. Identifier pattern commun
3. Créer abstraction (composant/fonction/hook)
4. Remplacer les occurrences
5. Tester

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 42 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~10.5h

---

### 18. 🔴 Duplication (Impact: 210)

**Métriques**:
- Impact: **210**
- Occurrences: 43
- Fichiers touchés: 42
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
div h1 className text 3xl font bold text...
```

**Fichiers Concernés** (42 fichiers):
1. `frontend/app/components/CheckoutOptimization.tsx`
2. `frontend/app/routes/admin.system.tsx`
3. `frontend/app/routes/reviews.create.tsx`
4. `frontend/app/routes/orders._index.tsx`
5. `frontend/app/routes/commercial.returns._index.tsx`
... et 37 autres fichiers

**✅ Actions Recommandées**:

**Type**: Duplication JSX/UI

1. Créer un composant réutilisable
2. Extraire dans `components/shared/`
3. Accepter props pour personnalisation
4. Remplacer dans tous les fichiers
5. Tester rendu visuel

**Exemple de composant**:
```tsx
// components/shared/DuplicatedComponent.tsx
export function DuplicatedComponent(props) {
  return (
    div h1 className text 3xl font bold text......
  );
}
```

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 42 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~10.5h

---

### 19. 🔴 Duplication (Impact: 205)

**Métriques**:
- Impact: **205**
- Occurrences: 68
- Fichiers touchés: 41
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
text 2xl font bold text gray 900 mb...
```

**Fichiers Concernés** (41 fichiers):
1. `frontend/app/routes/admin.system.tsx`
2. `frontend/app/routes/pieces.$.tsx`
3. `frontend/app/routes/pieces.catalogue.tsx`
4. `frontend/app/routes/pieces.$slug.tsx`
5. `frontend/app/routes/blog-pieces-auto.guide.$slug.tsx`
... et 36 autres fichiers

**✅ Actions Recommandées**:

1. Analyser le contexte de duplication
2. Identifier pattern commun
3. Créer abstraction (composant/fonction/hook)
4. Remplacer les occurrences
5. Tester

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 41 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~10.2h

---

### 20. 🔴 Duplication (Impact: 200)

**Métriques**:
- Impact: **200**
- Occurrences: 146
- Fichiers touchés: 40
- Lignes dupliquées: ~5
- Sévérité: 🔴 CRITICAL

**Fragment**:
```
div div className bg white rounded lg shadow...
```

**Fichiers Concernés** (40 fichiers):
1. `frontend/app/routes/admin.system.tsx`
2. `frontend/app/routes/admin.invoices._index.tsx`
3. `frontend/app/routes/reviews.create.tsx`
4. `frontend/app/routes/admin._index.tsx`
5. `frontend/app/routes/commercial.reports._index.tsx`
... et 35 autres fichiers

**✅ Actions Recommandées**:

**Type**: Duplication JSX/UI

1. Créer un composant réutilisable
2. Extraire dans `components/shared/`
3. Accepter props pour personnalisation
4. Remplacer dans tous les fichiers
5. Tester rendu visuel

**Exemple de composant**:
```tsx
// components/shared/DuplicatedComponent.tsx
export function DuplicatedComponent(props) {
  return (
    div div className bg white rounded lg shadow......
  );
}
```

**📝 Tâches Concrètes**:

- [ ] Créer fichier pour abstraction
- [ ] Extraire code commun
- [ ] Remplacer dans 40 fichiers
- [ ] Tester chaque remplacement
- [ ] Commit avec message clair

**⏱️ Temps Estimé**: ~10.0h

---

## 🎯 Plan d'Action Global

### Phase 1: Duplications CRITICAL (Impact > 200)

- **Nombre**: 19 duplications
- **Priorité**: 🔴 HAUTE
- **Timeline**: ~38h

**Actions**:
1. Traiter top 5 en priorité
2. Créer composants réutilisables
3. Review après chaque extraction

### Phase 2: Duplications HIGH (Impact 100-200)

- **Nombre**: 89 duplications
- **Priorité**: 🟠 MOYENNE
- **Timeline**: ~89h

### Phase 3: Duplications MEDIUM/MINOR

- **Nombre**: 891 duplications
- **Priorité**: 🟡 BASSE
- **Approche**: Opportuniste lors de refactoring

---

