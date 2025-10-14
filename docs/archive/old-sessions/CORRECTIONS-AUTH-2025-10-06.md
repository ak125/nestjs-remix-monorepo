# Corrections Authentification - 6 octobre 2025

## Problèmes identifiés et corrigés

### 1. ✅ Boucle de redirection infinie sur `/profile`

**Symptôme :** `ERR_TOO_MANY_REDIRECTS` lors de l'accès à `/profile`

**Cause :** Le `ProfileController` (backend) interceptait la route `/profile`, vérifiait l'authentification, puis redirigait vers `/profile`, créant une boucle infinie.

**Solution :**
- Retiré `ProfileController` du module auth (`auth.module.ts`)
- Retiré l'exclusion `/profile/` du `RemixController` pour que la route soit gérée par Remix (frontend)

**Fichiers modifiés :**
- `/backend/src/auth/auth.module.ts` - Retiré `ProfileController` de l'import et des controllers
- `/backend/src/remix/remix.controller.ts` - Retiré `request.url.startsWith('/profile/')` de la condition d'exclusion

### 2. ✅ Erreur "Session utilisateur non trouvée" sur le dashboard

**Symptôme :** 
```
❌ Erreur récupération stats dashboard: HttpException: Session utilisateur non trouvée
```

**Cause :** Le `UsersController.getDashboardStats` cherchait `req.session.passport.user.userId`, mais notre `CookieSerializer` stocke directement l'ID utilisateur dans `req.session.passport.user` (string), pas un objet avec une propriété `userId`.

**Solution :**
- Modifié `UsersController.getDashboardStats` pour utiliser `req.user` (fourni par Passport après désérialisation) au lieu de `req.session.passport.user.userId`

**Fichiers modifiés :**
- `/backend/src/controllers/users.controller.ts` - Changé de `req.session.passport.user.userId` vers `req.user.id`

## État actuel

### ✅ Ce qui fonctionne :

1. **Logout** : Fonctionne parfaitement
   - Route : `POST /auth/logout`
   - Session détruite correctement
   - Redirection vers `/`

2. **Register** : Fonctionne parfaitement
   - Route : `POST /register-and-login`
   - Utilisateur créé et connecté automatiquement
   - Session créée avec succès

3. **Profil** : Fonctionne maintenant
   - Route : `/profile`
   - Plus de boucle de redirection
   - Gérée par Remix (frontend)

4. **Dashboard** : Devrait fonctionner maintenant
   - Route : `/api/users/dashboard`
   - Récupère correctement l'utilisateur depuis `req.user`

5. **Authentification générale** :
   - Sérialisation/désérialisation fonctionnelle
   - Sessions Passport opérationnelles
   - Utilisateurs correctement désérialisés à chaque requête

## Architecture d'authentification

### Comment ça fonctionne :

1. **Login/Register** → Crée une session Passport
2. **CookieSerializer.serializeUser** → Stocke uniquement l'ID utilisateur dans la session
3. **CookieSerializer.deserializeUser** → Récupère l'utilisateur complet depuis la BDD à chaque requête
4. **req.user** → Objet utilisateur complet disponible dans tous les contrôleurs

### Accès à l'utilisateur dans les contrôleurs :

```typescript
// ✅ CORRECT
const user = (req as any).user;
const userId = req.user?.id;

// ❌ INCORRECT (ancien code)
const sessionUser = req.session?.passport?.user;
const userId = sessionUser?.userId; // userId n'existe pas
```

## Logs de vérification

Les logs confirment que tout fonctionne :

```
✅ User deserialized: monia123@gmail.com
✅ Session créée, redirection vers page d'accueil
--- POST /auth/logout DÉBUT ---
LogOut réussi, user après: null
Session détruite et cookie effacé
```

## Notes techniques

- La session stocke : `req.session.passport.user = "usr_1759774640723_njikmiz59"` (ID direct)
- Après désérialisation : `req.user = { id, email, firstName, ... }` (objet complet)
- Le `ProfileController` a été désactivé car il causait des conflits avec Remix
- Les routes frontend (`/profile`, `/register`) sont gérées par Remix
- Les routes API (`/api/auth/*`) sont gérées par NestJS

## Tests effectués

1. ✅ Logout d'un utilisateur connecté → Session détruite
2. ✅ Register d'un nouvel utilisateur → Compte créé et session active
3. ✅ Accès au profil → Plus de boucle de redirection
4. ✅ Désérialisation utilisateur → Fonctionne à chaque requête
