# 🐛 Bugs Détectés Pendant les Tests

**Date**: 4 octobre 2025  
**Phase**: Tests validation Jour 1  
**Branch**: `refactor/user-module-dto-cleanup`

---

## ❌ Problèmes Identifiés

### 1️⃣ Bouton "Nouvel Utilisateur" Ne Fonctionne Pas

#### 📍 Localisation
- **Fichier**: `/frontend/app/routes/admin.users.tsx`
- **Ligne**: 260-265
- **Composant**: Bouton "Nouvel utilisateur"

#### 🔍 Problème
```tsx
<Link to="new">
  <Button size="sm">
    <UserPlus className="w-4 h-4 mr-2" />
    Nouvel utilisateur
  </Button>
</Link>
```

Le lien pointe vers `/admin/users/new` mais la route **n'existe pas**.

#### 📂 Fichier Manquant
`/frontend/app/routes/admin.users.new.tsx` ❌ **N'EXISTE PAS**

#### ⚠️ Impact
- Impossibilité de créer un nouvel utilisateur depuis l'interface admin
- Erreur 404 quand on clique sur le bouton
- Fonctionnalité critique manquante

#### ✅ Solution Proposée

**Option 1**: Créer le fichier `/frontend/app/routes/admin.users.new.tsx`

```tsx
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { Link } from '@remix-run/react';

// Action pour créer l'utilisateur
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const userData = {
    email: formData.get('email'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    password: formData.get('password'),
    phone: formData.get('phone'),
    // ... autres champs
  };

  try {
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      return json({ error: error.message || 'Erreur création utilisateur' }, { status: 400 });
    }

    const result = await response.json();
    return redirect(`/admin/users/${result.id}`);
  } catch (error) {
    return json({ error: 'Erreur serveur' }, { status: 500 });
  }
};

export default function NewUser() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/admin/users">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Créer un Nouvel Utilisateur</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Informations de l'Utilisateur
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
              {actionData.error}
            </div>
          )}

          <Form method="post" className="space-y-6">
            {/* Section Informations personnelles */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Informations personnelles</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input id="firstName" name="firstName" required disabled={isSubmitting} />
                </div>
                <div>
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input id="lastName" name="lastName" required disabled={isSubmitting} />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" required disabled={isSubmitting} />
              </div>

              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" name="phone" type="tel" disabled={isSubmitting} />
              </div>
            </div>

            {/* Section Mot de passe */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Sécurité</h3>
              
              <div>
                <Label htmlFor="password">Mot de passe *</Label>
                <Input 
                  id="password" 
                  name="password" 
                  type="password" 
                  required 
                  minLength={8}
                  disabled={isSubmitting} 
                />
                <p className="text-sm text-gray-500 mt-1">Minimum 8 caractères</p>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
              <Link to="/admin/users" className="flex-1">
                <Button type="button" variant="outline" className="w-full" disabled={isSubmitting}>
                  Annuler
                </Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Création...' : 'Créer l\'utilisateur'}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Option 2**: Rediriger vers la page d'inscription (temporaire)

```tsx
// Dans admin.users.tsx, modifier le lien:
<Link to="/auth/register?admin=true">
  <Button size="sm">
    <UserPlus className="w-4 h-4 mr-2" />
    Nouvel utilisateur
  </Button>
</Link>
```

---

### 2️⃣ Informations Utilisateur Incomplètes dans le Dashboard

#### 📍 Localisation
- **Frontend**: `/frontend/app/routes/account.dashboard.tsx` (ligne 95-140)
- **Backend**: `/backend/src/controllers/users.controller.ts` (ligne 109-138)
- **Route API**: `GET /api/legacy-users/dashboard`

#### 🔍 Problème

**Frontend attend**:
```typescript
interface LoaderData {
  user: User;  // ❌ Attendu mais pas fourni
  stats: DashboardStats;  // ❌ Structure incorrecte
  // ...
}
```

**Backend retourne**:
```typescript
{
  success: true,
  data: {
    totalUsers: 59142,
    totalOrders: 1440,
    activeUsers: 59142
  }
}
```

**Problème**: Le backend ne retourne **PAS** les informations de l'utilisateur connecté, seulement des stats globales.

#### ⚠️ Impact
- Dashboard utilisateur affiche des données vides
- `user.firstName`, `user.lastName`, `user.email` sont `undefined`
- Impossible d'afficher le profil de l'utilisateur connecté

#### ✅ Solution Proposée

Modifier `/backend/src/controllers/users.controller.ts` :

```typescript
/**
 * GET /api/legacy-users/dashboard
 * Récupère les statistiques pour le dashboard
 */
@Get('dashboard')
@UseGuards(AuthenticatedGuard)  // ✅ Ajouter guard pour avoir l'utilisateur
async getDashboardStats(@Request() req) {
  try {
    console.log(`📊 Récupération des statistiques dashboard`);

    // ✅ Récupérer l'utilisateur connecté depuis la session
    const currentUser = req.user;  // Fourni par AuthenticatedGuard
    
    if (!currentUser) {
      throw new UnauthorizedException('Utilisateur non connecté');
    }

    // Récupérer les détails complets de l'utilisateur
    const userDetails = await this.legacyUserService.getUserById(currentUser.id);

    // Stats globales
    const totalUsers = await this.legacyUserService.getTotalActiveUsersCount();
    const totalOrders = await this.legacyOrderService.getTotalOrdersCount();
    const activeUsers = await this.legacyUserService.getTotalActiveUsersCount();

    // ✅ Stats spécifiques à l'utilisateur
    const userOrders = await this.legacyUserService.getUserOrders(currentUser.id);
    const userMessages = await this.legacyUserService.getUserMessages(currentUser.id);

    return {
      success: true,
      user: {  // ✅ Ajouter les infos utilisateur
        id: userDetails.id,
        email: userDetails.email,
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
        status: userDetails.isActive ? 'active' : 'inactive',
        lastLoginAt: userDetails.lastLoginAt,
        createdAt: userDetails.createdAt,
        isPro: userDetails.isPro,
        isActive: userDetails.isActive,
        level: userDetails.level,
      },
      stats: {  // ✅ Structure attendue par le frontend
        messages: {
          total: userMessages.length,
          unread: userMessages.filter(m => !m.isRead).length,
          threads: userMessages.filter(m => !m.parentId).length,
        },
        orders: {
          total: userOrders.length,
          pending: userOrders.filter(o => o.status === 'pending').length,
          completed: userOrders.filter(o => o.status === 'completed').length,
          revenue: userOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        },
        profile: {
          completeness: this.calculateProfileCompleteness(userDetails),
          hasActiveSubscription: false,  // À implémenter si nécessaire
          securityScore: 80,  // À calculer
        }
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`❌ Erreur récupération stats dashboard:`, error);

    throw new HttpException(
      'Erreur lors de la récupération des statistiques',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

// Méthode helper
private calculateProfileCompleteness(user: any): number {
  let score = 0;
  if (user.firstName) score += 20;
  if (user.lastName) score += 20;
  if (user.email) score += 20;
  if (user.phone) score += 20;
  if (user.address) score += 20;
  return score;
}
```

---

## 📊 Résumé des Bugs

| # | Problème | Sévérité | Impact | Fichier(s) |
|---|----------|----------|--------|------------|
| 1 | Route `/admin/users/new` manquante | 🔴 **Critique** | Impossible de créer un utilisateur | `admin.users.tsx`, route manquante |
| 2 | Endpoint `/api/legacy-users/dashboard` incomplet | 🟠 **Majeur** | Dashboard utilisateur vide | `users.controller.ts`, `account.dashboard.tsx` |

---

## ✅ Plan de Correction

### Priorité 1 (Bloquant pour Jour 2)
- [ ] **Bug #2**: Corriger l'endpoint dashboard pour retourner les infos utilisateur
  - Durée: 30 minutes
  - Impact: Dashboard utilisateur fonctionnel

### Priorité 2 (Important mais non bloquant)
- [ ] **Bug #1**: Créer la route `/admin/users/new`
  - Durée: 1-2 heures
  - Impact: Fonctionnalité admin complète

---

## 🔧 Actions Immédiates

### Pour continuer Jour 2
1. ✅ Noter ces bugs (ce document)
2. 🔧 Corriger **Bug #2** (dashboard) en priorité
3. ✅ Valider que login/register fonctionnent (OK d'après les logs)
4. 🚀 Continuer avec Jour 2 (délégation services)
5. 🔜 Corriger **Bug #1** (new user) après Jour 2

### Décision
**Les bugs identifiés ne sont PAS liés aux modifications du Jour 1** (nettoyage DTOs). Ce sont des bugs existants dans le code.

✅ **Validation Jour 1**: Les modifications DTOs fonctionnent correctement
- firstName/lastName mappés correctement
- Aucune erreur de compilation
- Authentification OK
- Liste utilisateurs OK

🚀 **Recommandation**: Corriger le Bug #2 (dashboard) puis continuer avec Jour 2

---

**Créé par**: GitHub Copilot  
**Date**: 4 octobre 2025  
**Statut**: Bugs documentés, corrections en attente
