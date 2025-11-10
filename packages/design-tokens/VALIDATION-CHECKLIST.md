# ✅ Checklist de Validation - Migration Tokens

## 🎯 Objectif : Garantir ZÉRO régression visuelle

---

## 📋 Processus de Validation par Composant

### Avant Migration
- [ ] **Screenshot** : Capturer l'état actuel dans tous les états
  - [ ] État normal
  - [ ] État hover
  - [ ] État focus
  - [ ] État actif/sélectionné
  - [ ] État disabled (si applicable)
  - [ ] Mode responsive (mobile/tablet/desktop)
- [ ] **Liste des couleurs** : Noter toutes les classes de couleur utilisées
- [ ] **Git status** : S'assurer d'être sur une branche propre

### Pendant Migration
- [ ] Modifier **UNE SEULE** propriété à la fois
- [ ] Recharger le navigateur après chaque modification
- [ ] Vérifier visuellement le rendu
- [ ] En cas d'écart, ajuster le token ou revenir en arrière

### Après Migration
- [ ] **Screenshot** : Capturer le nouvel état
- [ ] **Comparaison** : Vérifier que les screenshots sont identiques
- [ ] **Tests manuels** :
  - [ ] Hover fonctionne
  - [ ] Focus fonctionne
  - [ ] Clics fonctionnent
  - [ ] Navigation fonctionne
  - [ ] Aucun texte illisible (contraste)
- [ ] **Responsive** :
  - [ ] Mobile (< 640px)
  - [ ] Tablet (640px - 1024px)
  - [ ] Desktop (> 1024px)
- [ ] **Commit** avec message descriptif

---

## 🧪 Tests Visuels à Effectuer

### Pour la Navbar
- [ ] Logo visible et cliquable
- [ ] Liens de navigation hover correctement
- [ ] Bouton de recherche fonctionne
- [ ] Icône panier + badge visible
- [ ] Badge livraison gratuite visible (desktop)
- [ ] Icône téléphone visible et hover
- [ ] Menu mobile s'ouvre correctement
- [ ] Barre de progression au scroll fonctionne
- [ ] Aucun flash de couleur non stylée

### Pour le Footer
- [ ] Titres de sections visibles
- [ ] Liens hover correctement
- [ ] Icônes sociales visibles et hover
- [ ] Texte lisible (contraste suffisant)
- [ ] Séparateur visible
- [ ] Footer mobile différent du desktop

### Pour l'Index
- [ ] Hero section : dégradés corrects
- [ ] Boutons CTA visibles
- [ ] Cards produits : hover fonctionne
- [ ] Badges visibles
- [ ] Sections avec fond coloré OK
- [ ] Newsletter : input et bouton OK

---

## 🔍 Points de Vigilance

### Contraste
- [ ] Tous les textes sont lisibles
- [ ] Ratio de contraste ≥ 4.5:1 pour le texte normal
- [ ] Ratio de contraste ≥ 3:1 pour le texte large
- [ ] Utiliser `-contrast` pour les textes sur fond coloré

### Cohérence
- [ ] Même couleur pour même usage (ex: tous les liens info en bleu)
- [ ] Transitions et animations fonctionnent
- [ ] États hover cohérents

### Performance
- [ ] Pas de flash de contenu non stylé (FOUC)
- [ ] Temps de chargement identique
- [ ] Pas de console errors

---

## 📸 Outil de Screenshot Recommandé

### Méthode 1 : DevTools (Rapide)
1. Ouvrir DevTools (F12)
2. Cmd/Ctrl + Shift + P
3. Taper "screenshot"
4. Choisir "Capture full size screenshot"

### Méthode 2 : Extension (Comparaison)
- Installer "GoFullPage" ou "Awesome Screenshot"
- Permet de comparer facilement avant/après

### Méthode 3 : Script (Automatisé)
```bash
# Utiliser Playwright ou Puppeteer pour screenshots automatiques
npm run test:visual
```

---

## 🚨 Seuils d'Acceptation

### ✅ Migration Validée SI :
- Screenshots identiques à 99% (tolère antialiasing mineur)
- Aucun changement de layout
- Aucun texte illisible
- Tous les hover/focus fonctionnent
- Aucune régression responsive

### ❌ Migration à Revoir SI :
- Différence visuelle notable
- Contraste insuffisant
- Layout cassé sur un breakpoint
- Erreur console
- Hover/focus ne fonctionne plus

---

## 📊 Rapport de Validation

À remplir après chaque migration :

### Composant : [NOM]
**Date** : [DATE]  
**Branche** : [BRANCHE]  
**Commit** : [HASH]

#### Screenshots
- [ ] Avant : `screenshots/avant-[composant].png`
- [ ] Après : `screenshots/apres-[composant].png`

#### Tests Manuels
- [ ] Desktop Chrome
- [ ] Desktop Firefox
- [ ] Desktop Safari
- [ ] Mobile Chrome
- [ ] Mobile Safari

#### Résultat
- [ ] ✅ Validé - Aucune régression
- [ ] ⚠️ Ajustements mineurs nécessaires
- [ ] ❌ Régression détectée - Rollback

#### Notes
[Commentaires éventuels]

---

## 🔄 Commandes Git Utiles

### Créer une branche de migration
```bash
git checkout -b feat/migrate-navbar-tokens
```

### Commit progressif
```bash
# Après validation de chaque partie
git add frontend/app/components/Navbar.tsx
git commit -m "feat(tokens): migrate Navbar colors to semantic tokens

- Replace blue-600 with semantic-info
- Replace slate-600 with neutral-600
- All hover states tested
- No visual regression"
```

### Rollback si problème
```bash
# Annuler le dernier commit (garde les fichiers modifiés)
git reset --soft HEAD~1

# Annuler complètement
git reset --hard HEAD~1

# Revenir à un commit précis
git reset --hard <commit-hash>
```

---

## 📝 Exemples de Messages de Commit

### ✅ Bon
```
feat(tokens): migrate Footer to semantic tokens

- Replace lightTurquoise with semantic-info
- Replace gray-900 with neutral-900
- Tested on mobile and desktop
- Screenshots: before/after identical
```

### ❌ Mauvais
```
update footer
```

---

## 🎓 Formation des Développeurs

### Avant de Commencer
1. Lire `MIGRATION-GUIDE.md`
2. Comprendre les tokens sémantiques
3. Savoir utiliser les DevTools
4. Connaître les commandes Git

### Points Clés
- Migration = ZÉRO changement visuel
- Tester = capture before/after
- Rollback = facile si problème
- Progressif = un composant à la fois

---

## 📞 Support

En cas de doute :
1. Consulter `MIGRATION-GUIDE.md`
2. Vérifier les tokens dans `design-tokens.json`
3. Demander une review avant merge
4. Ne pas merger si incertain

---

**Rappel : Mieux vaut prendre 10 minutes de plus pour valider que créer une régression !**
