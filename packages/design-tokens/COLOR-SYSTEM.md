# 🎨 Système de Couleurs Sémantiques

## ✅ Garantie WCAG AA/AAA

**Toutes les couleurs sémantiques sont conformes WCAG 2.1 Level AA minimum** (ratio ≥ 4.5:1 pour texte normal).

---

## 📋 Rôles Sémantiques Stricts

### 🎯 ACTION - CTA Unique
**Couleur:** `#D63027` (Rouge principal assombri)  
**Contraste:** 4.87:1 ✅ AA  
**Texte:** `#FFFFFF` (Blanc)

**Utilisation:**
- ✅ Boutons d'action principaux (CTA)
- ✅ Boutons de soumission de formulaire
- ✅ Actions critiques nécessitant attention

**À éviter:**
- ❌ Navigation secondaire
- ❌ Liens de texte courant
- ❌ Éléments informatifs non-actionnables

**Exemple CSS:**
```css
.btn-primary {
  background: var(--color-semantic-action);
  color: var(--color-semantic-action-contrast);
}
```

**Exemple Tailwind:**
```jsx
<Button className="bg-[var(--color-semantic-action)] text-[var(--color-semantic-action-contrast)]">
  Acheter maintenant
</Button>
```

---

### ℹ️ INFO - Navigation & Information
**Couleur:** `#0F4C81` (Bleu secondaire foncé)  
**Contraste:** 8.86:1 ✅ AAA  
**Texte:** `#FFFFFF` (Blanc)

**Utilisation:**
- ✅ Liens de navigation
- ✅ Badges informatifs
- ✅ Tooltips et popovers
- ✅ Messages informationnels neutres

**À éviter:**
- ❌ CTA principaux
- ❌ Messages d'erreur ou de succès
- ❌ Éléments critiques

**Exemple CSS:**
```css
.badge-info {
  background: var(--color-semantic-info);
  color: var(--color-semantic-info-contrast);
}
```

---

### ✅ SUCCESS - Confirmations & Validations
**Couleur:** `#1E8449` (Vert foncé)  
**Contraste:** 4.72:1 ✅ AA  
**Texte:** `#FFFFFF` (Blanc)

**Utilisation:**
- ✅ Messages de succès
- ✅ Confirmations d'action
- ✅ États validés (formulaires, paiements)
- ✅ Indicateurs positifs

**À éviter:**
- ❌ Actions destructives
- ❌ Navigation principale

**Exemple CSS:**
```css
.alert-success {
  background: var(--color-semantic-success);
  color: var(--color-semantic-success-contrast);
  border-left: 4px solid var(--color-semantic-success);
}
```

---

### ⚠️ WARNING - Avertissements
**Couleur:** `#D68910` (Orange foncé)  
**Contraste:** 7.44:1 ✅ AAA  
**Texte:** `#000000` (Noir)

**Utilisation:**
- ✅ Avertissements modérés
- ✅ Actions réversibles mais importantes
- ✅ Alertes de validation (champs incomplets)
- ✅ États temporaires nécessitant attention

**À éviter:**
- ❌ Erreurs critiques (utiliser `danger`)
- ❌ Messages de succès

**Exemple CSS:**
```css
.toast-warning {
  background: var(--color-semantic-warning);
  color: var(--color-semantic-warning-contrast);
}
```

---

### 🚨 DANGER - Erreurs & Actions Destructives
**Couleur:** `#C0392B` (Rouge foncé)  
**Contraste:** 5.44:1 ✅ AA  
**Texte:** `#FFFFFF` (Blanc)

**Utilisation:**
- ✅ Messages d'erreur
- ✅ Actions destructives (suppression, annulation)
- ✅ États critiques
- ✅ Validation d'erreur de formulaire

**À éviter:**
- ❌ CTA principaux (utiliser `action`)
- ❌ Avertissements légers (utiliser `warning`)

**Exemple CSS:**
```css
.btn-delete {
  background: var(--color-semantic-danger);
  color: var(--color-semantic-danger-contrast);
}
```

---

### ⚪ NEUTRAL - États Neutres & Disabled
**Couleur:** `#4B5563` (Gris 600)  
**Contraste:** 7.56:1 ✅ AAA  
**Texte:** `#FFFFFF` (Blanc)

**Utilisation:**
- ✅ Boutons désactivés
- ✅ Éléments inactifs
- ✅ États neutres (non sélectionné)
- ✅ Texte secondaire sur fond sombre

**À éviter:**
- ❌ Éléments actionnables principaux
- ❌ Messages de statut (utiliser success/warning/danger)

**Exemple CSS:**
```css
.btn:disabled {
  background: var(--color-semantic-neutral);
  color: var(--color-semantic-neutral-contrast);
  cursor: not-allowed;
}
```

---

## 🔄 Contraste Automatique

Le système génère automatiquement les couleurs de texte optimales pour chaque couleur sémantique :

```css
/* Contraste automatique - généré par build-tokens.js */
--color-semantic-action-contrast: #ffffff;
--color-semantic-info-contrast: #ffffff;
--color-semantic-success-contrast: #ffffff;
--color-semantic-warning-contrast: #000000; /* Noir pour contraste optimal */
--color-semantic-danger-contrast: #ffffff;
--color-semantic-neutral-contrast: #ffffff;
```

**Utilisation recommandée:**
```jsx
<div style={{
  background: 'var(--color-semantic-warning)',
  color: 'var(--color-semantic-warning-contrast)' // Automatiquement noir
}}>
  Avertissement avec contraste optimal
</div>
```

---

## 📊 Tableau Récapitulatif

| Rôle     | Couleur   | Texte     | Ratio   | WCAG | Usage Principal                |
|----------|-----------|-----------|---------|------|--------------------------------|
| Action   | `#D63027` | `#FFFFFF` | 4.87:1  | AA   | CTA unique, boutons principaux |
| Info     | `#0F4C81` | `#FFFFFF` | 8.86:1  | AAA  | Navigation, liens, badges info |
| Success  | `#1E8449` | `#FFFFFF` | 4.72:1  | AA   | Confirmations, validations     |
| Warning  | `#D68910` | `#000000` | 7.44:1  | AAA  | Avertissements, attention      |
| Danger   | `#C0392B` | `#FFFFFF` | 5.44:1  | AA   | Erreurs, actions destructives  |
| Neutral  | `#4B5563` | `#FFFFFF` | 7.56:1  | AAA  | États neutres, disabled        |

---

## 🧪 Tests WCAG

Le système inclut un outil de vérification automatique :

```bash
# Vérifier les contrastes
node /tmp/verify-new-colors.js
```

**Résultat attendu:**
- ✅ 6/6 couleurs conformes WCAG AA minimum
- ✅ 3/6 couleurs conformes WCAG AAA (info, warning, neutral)
- ❌ 0/6 couleurs non conformes

---

## 🎯 Bonnes Pratiques

### ✅ DO

1. **Utiliser les couleurs selon leur rôle sémantique**
   ```jsx
   // ✅ Bon: CTA principal
   <Button variant="action">Acheter</Button>
   
   // ✅ Bon: Message de succès
   <Alert variant="success">Commande confirmée</Alert>
   ```

2. **Toujours utiliser les paires couleur/contraste**
   ```css
   /* ✅ Bon: Contraste automatique */
   .cta {
     background: var(--color-semantic-action);
     color: var(--color-semantic-action-contrast);
   }
   ```

3. **Respecter la hiérarchie des couleurs**
   - Action > Info > Success/Warning/Danger
   - 1 seul CTA action par écran
   - Liens secondaires en Info

### ❌ DON'T

1. **Mélanger les rôles sémantiques**
   ```jsx
   // ❌ Mauvais: Utiliser danger pour un CTA
   <Button variant="danger">Acheter maintenant</Button>
   
   // ✅ Bon: Utiliser action
   <Button variant="action">Acheter maintenant</Button>
   ```

2. **Ignorer les contrastes automatiques**
   ```css
   /* ❌ Mauvais: Texte noir sur fond warning (excellent contraste, mais pas le bon noir) */
   .warning {
     background: var(--color-semantic-warning);
     color: #333; /* Mauvais contraste */
   }
   
   /* ✅ Bon: Utiliser le contraste automatique */
   .warning {
     background: var(--color-semantic-warning);
     color: var(--color-semantic-warning-contrast);
   }
   ```

3. **Utiliser action pour tout**
   ```jsx
   // ❌ Mauvais: Action pour navigation
   <Link className="text-action">Voir détails</Link>
   
   // ✅ Bon: Info pour navigation
   <Link className="text-info">Voir détails</Link>
   ```

---

## 🚀 Migration depuis l'ancien système

### Mapping des couleurs

| Ancien nom | Nouvelle couleur | Notes                           |
|------------|------------------|---------------------------------|
| `primary`  | `action`         | Pour CTA uniquement             |
| `error`    | `danger`         | Renommé pour clarté             |
| `info`     | `info`           | Inchangé, maintenant AAA        |
| `success`  | `success`        | Assombri pour WCAG AA           |
| `warning`  | `warning`        | Assombri, texte noir maintenant |

### Exemple de migration

**Avant:**
```jsx
<Button className="bg-primary-600">CTA</Button>
<Alert type="error">Erreur</Alert>
```

**Après:**
```jsx
<Button className="bg-[var(--color-semantic-action)]">CTA</Button>
<Alert variant="danger">Erreur</Alert>
```

---

## 📖 Ressources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ADA Compliance](https://www.ada.gov/resources/web-guidance/)

---

**Dernière mise à jour:** $(date +%Y-%m-%d)  
**Conformité:** WCAG 2.1 Level AA minimum  
**Taux de réussite:** 100% (6/6 couleurs conformes)
