# ✅ Checklist de Test - Page Utilisateur Unifiée

## 🔐 Authentification

### Login
- [ ] Connexion avec email/mot de passe
- [ ] Message d'erreur si identifiants incorrects
- [ ] Redirection vers le dashboard après connexion
- [ ] Session maintenue après rechargement de page

### Logout
- [ ] Bouton de déconnexion visible
- [ ] Déconnexion fonctionnelle
- [ ] Session détruite
- [ ] Redirection vers la page d'accueil
- [ ] Impossible d'accéder aux pages protégées après déconnexion

### Register
- [ ] Formulaire d'inscription accessible
- [ ] Validation des champs (email valide, mot de passe min 6 caractères)
- [ ] Compte créé avec succès
- [ ] Connexion automatique après inscription
- [ ] Redirection vers le profil/dashboard

---

## 👤 Page Profil (/profile)

### En-tête
- [ ] Nom de l'utilisateur affiché
- [ ] Bouton "Déconnexion" fonctionnel
- [ ] Message de bienvenue personnalisé

### Statistiques (Cards en haut)
- [ ] Card "Commandes totales" avec nombre correct
- [ ] Card "En cours" avec nombre correct
- [ ] Card "Total dépensé" avec montant formaté
- [ ] Icônes affichées correctement

---

## 📊 Onglet "Vue d'ensemble"

### Card Informations personnelles
- [ ] Nom complet affiché
- [ ] Email affiché
- [ ] Téléphone affiché (ou "Non renseigné")
- [ ] Bouton "Modifier mes informations" fonctionnel

### Card Adresse de livraison
- [ ] Adresse affichée si renseignée
- [ ] "Aucune adresse renseignée" si vide
- [ ] Code postal et ville affichés
- [ ] Pays affiché (ou "France" par défaut)
- [ ] Bouton "Gérer mes adresses" fonctionnel

### Card Commandes récentes
- [ ] 5 dernières commandes affichées
- [ ] Numéro de commande visible
- [ ] Statut affiché avec badge coloré
- [ ] Date et montant affichés
- [ ] Bouton "Détails" pour chaque commande
- [ ] Bouton "Voir tout" pour accéder à toutes les commandes
- [ ] Message "Aucune commande" si liste vide

---

## ⚙️ Onglet "Profil"

### Formulaire
- [ ] Champ Prénom pré-rempli
- [ ] Champ Nom pré-rempli
- [ ] Champ Email pré-rempli
- [ ] Champ Téléphone pré-rempli
- [ ] Champ Adresse pré-rempli
- [ ] Champ Ville pré-rempli
- [ ] Champ Code postal pré-rempli
- [ ] Champ Pays pré-rempli

### Validation
- [ ] Prénom requis (ne peut pas être vide)
- [ ] Nom requis
- [ ] Email requis et format valide
- [ ] Autres champs optionnels

### Soumission
- [ ] Bouton "Mettre à jour le profil" visible
- [ ] État de chargement pendant la soumission
- [ ] Message de succès après mise à jour
- [ ] Message d'erreur si échec
- [ ] Données actualisées dans la vue d'ensemble

---

## 📦 Onglet "Commandes"

- [ ] Message informatif affiché
- [ ] Icône Package visible
- [ ] Bouton "Voir toutes mes commandes" fonctionnel
- [ ] Redirection vers `/account/orders`

---

## 📍 Onglet "Adresses"

### Avec adresse
- [ ] Adresse principale affichée
- [ ] Badge "Par défaut" visible
- [ ] Adresse complète lisible

### Sans adresse
- [ ] Icône MapPin affichée
- [ ] Message "Aucune adresse enregistrée"
- [ ] Bouton "Ajouter une adresse" fonctionnel

---

## 🔒 Onglet "Sécurité"

### Formulaire changement de mot de passe
- [ ] Champ "Mot de passe actuel" visible
- [ ] Champ "Nouveau mot de passe" visible
- [ ] Champ "Confirmer mot de passe" visible
- [ ] Indication "Minimum 6 caractères"
- [ ] Bouton "Changer le mot de passe" visible

### Validation
- [ ] Mot de passe actuel requis
- [ ] Nouveau mot de passe min 6 caractères
- [ ] Confirmation doit correspondre
- [ ] Message d'erreur si mots de passe ne correspondent pas
- [ ] Message d'erreur si mot de passe actuel incorrect

### Soumission
- [ ] État de chargement pendant changement
- [ ] Message de succès après changement
- [ ] Message d'erreur si échec
- [ ] Session maintenue après changement

### Card Informations du compte
- [ ] Type de compte affiché (Particulier/Professionnel)
- [ ] Niveau utilisateur affiché
- [ ] Statut affiché avec badge coloré (Actif/Inactif)

---

## 📱 Responsive Design

### Mobile (< 640px)
- [ ] Menu en onglets compact
- [ ] Textes lisibles
- [ ] Boutons accessibles
- [ ] Cards empilées verticalement
- [ ] Formulaires utilisables
- [ ] Pas de dépassement horizontal

### Tablette (640px - 1024px)
- [ ] Layout adapté
- [ ] Navigation confortable
- [ ] Espacement correct
- [ ] Grille responsive

### Desktop (> 1024px)
- [ ] Layout complet
- [ ] Menu latéral visible (sur /account/*)
- [ ] Utilisation optimale de l'espace
- [ ] Grille multi-colonnes

---

## 🎨 Design & UX

### Visuels
- [ ] Couleurs cohérentes
- [ ] Typographie lisible
- [ ] Espacements harmonieux
- [ ] Icônes appropriées
- [ ] Badges colorés selon le statut

### Interactions
- [ ] Boutons avec effet hover
- [ ] Transitions fluides
- [ ] États de chargement visibles
- [ ] Feedback immédiat sur les actions

### Messages
- [ ] Messages de succès en vert
- [ ] Messages d'erreur en rouge
- [ ] Messages clairs et compréhensibles
- [ ] Fermeture possible

---

## 🔗 Navigation

### Entre onglets
- [ ] Clic sur onglet change le contenu
- [ ] Onglet actif visuellement distinct
- [ ] Scroll en haut de page au changement d'onglet
- [ ] URL ne change pas (gestion locale)

### Liens externes
- [ ] "Voir toutes mes commandes" → `/account/orders`
- [ ] "Détails" commande → `/account/orders/{id}`
- [ ] "Déconnexion" → `/auth/logout`
- [ ] Tous les liens fonctionnels

---

## ⚡ Performance

- [ ] Chargement initial rapide (< 2s)
- [ ] Pas de flash de contenu non stylisé
- [ ] Images optimisées
- [ ] Formulaires réactifs
- [ ] Pas de freeze pendant les actions

---

## 🔒 Sécurité

- [ ] Accès refusé si non connecté
- [ ] Redirection vers login si session expirée
- [ ] Données personnelles protégées
- [ ] CSRF token sur les formulaires
- [ ] Pas de données sensibles dans l'URL

---

## 🐛 Tests d'erreurs

### Réseau
- [ ] Message d'erreur si connexion perdue
- [ ] Retry possible après erreur
- [ ] Pas de crash de l'application

### Validation
- [ ] Messages d'erreur clairs
- [ ] Champs en erreur surlignés
- [ ] Focus sur le premier champ en erreur

### Sessions
- [ ] Gestion propre de l'expiration
- [ ] Redirection vers login si nécessaire
- [ ] Message informatif

---

## 📊 Tests de données

### Avec données complètes
- [ ] Tout s'affiche correctement
- [ ] Pas de champs vides inattendus
- [ ] Formatage correct des dates/prix

### Avec données partielles
- [ ] Messages "Non renseigné" appropriés
- [ ] Pas d'erreur JavaScript
- [ ] Interface toujours utilisable

### Sans données
- [ ] Messages vides informatifs
- [ ] Suggestions d'action (ajouter une adresse, etc.)
- [ ] Pas de crash

---

## 🌐 Accessibilité (WCAG 2.1)

- [ ] Navigation au clavier possible
- [ ] Focus visible sur les éléments
- [ ] Labels sur tous les champs de formulaire
- [ ] Contraste des couleurs suffisant
- [ ] Textes alternatifs sur les images
- [ ] Ordre logique du contenu
- [ ] Pas de piège au clavier

---

## 🔧 Compatibilité navigateurs

### Chrome
- [ ] Affichage correct
- [ ] Fonctionnalités opérationnelles

### Firefox
- [ ] Affichage correct
- [ ] Fonctionnalités opérationnelles

### Safari
- [ ] Affichage correct
- [ ] Fonctionnalités opérationnelles

### Edge
- [ ] Affichage correct
- [ ] Fonctionnalités opérationnelles

---

## 📝 Notes de test

### Bugs trouvés

(Notez ici les bugs découverts pendant les tests)

---

### Suggestions d'amélioration

(Notez ici vos idées d'amélioration)

---

**Date du test**: _______________  
**Testeur**: _______________  
**Version**: 1.0.0  
**Navigateur**: _______________  
**Device**: _______________
