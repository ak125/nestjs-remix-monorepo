/**
 * 📋 GUIDE D'UTILISATION - Système de Formulaires
 * 
 * Architecture:
 * - Components: Input, Textarea, Checkbox (low-level, accessible)
 * - Wrappers: FormField (auto label/error), FormProvider (RHF + Remix)
 * - Hooks: useRemixForm (validation client + serveur)
 * - Schemas: Zod (auth.ts, etc.)
 */

## 🎯 Approche Recommandée

### 1. **Nouveaux formulaires** → Utiliser le système complet

```tsx
// route: login.tsx
import { FormProvider, FormField } from "~/components/forms";
import { useRemixForm } from "~/hooks/useRemixForm";
import { loginSchema } from "~/schemas/auth";

export default function LoginPage() {
  const form = useRemixForm(loginSchema);
  
  return (
    <FormProvider form={form} onSubmit={() => {}}>
      <FormField name="email" type="email" label="Email" required />
      <FormField name="password" type="password" label="Mot de passe" required />
      <FormField name="remember" type="checkbox" label="Se souvenir de moi" />
      <Button type="submit" disabled={form.isSubmitting}>Connexion</Button>
    </FormProvider>
  );
}

// action (serveur)
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const result = validateFormData(loginSchema, formData);
  if (!result.success) {
    return json({ errors: result.errors }, { status: 400 });
  }
  // ... authentification
}
```

### 2. **Formulaires existants** → Migration progressive

**Priorité 1** (Impact utilisateur):
- ✅ Login (/routes/_public+/login.tsx)
- ✅ Register (/routes/_public+/register.tsx)
- ✅ Contact (/routes/contact.tsx)

**Priorité 2** (Admin/interne):
- ⏳ Profile Edit (/routes/account.profile.edit.tsx)
- ⏳ Search filters (divers)

**Priorité 3** (Optionnel):
- ⏸️ Formulaires homepage (newsletter, etc.)

### 3. **Composants manquants** → Créer au besoin

À ajouter si nécessaire:
- Select (dropdown avec recherche)
- RadioGroup (choix unique)
- Switch (toggle on/off)
- DatePicker (calendrier)
- FileUpload (avec preview)

**Pattern**:
```tsx
// FormField avec custom children
<FormField name="country" label="Pays">
  <Select {...register("country")}>
    <option value="FR">France</option>
    <option value="BE">Belgique</option>
  </Select>
</FormField>
```

## 📊 Comparaison Approches

| Approche | Avantages | Inconvénients | Recommandé |
|----------|-----------|---------------|------------|
| **Migration complète** | Cohérence, maintenabilité | Temps élevé (2-3 jours), risque régression | ❌ Non |
| **Progressive (nouveaux)** | Pas de régression, quick wins | Codebase mixte temporaire | ✅ **OUI** |
| **Wrapper composants existants** | Backward compatible | Complexité accrue | ⚠️ Si besoin |
| **Big Bang** | Rapide si automatisé | Haut risque, tests massifs | ❌ Non |

## 🚀 Plan d'Action Recommandé

### Phase 1: Patterns (✅ FAIT)
- [x] FormField wrapper
- [x] FormProvider wrapper
- [x] useRemixForm hook
- [x] Schemas Zod (auth.ts)
- [x] Page démo (/test/forms)

### Phase 2: Migration Critiques (NEXT - 2-3h)
1. **Login** → Remplacer par FormField
2. **Register** → Simplifier avec FormProvider
3. **Contact** → Utiliser schemas Zod

### Phase 3: Composants Manquants (si besoin)
- Select avec recherche
- DatePicker (react-day-picker)
- FileUpload avec preview

### Phase 4: Documentation Équipe
- Vidéo démo 5min
- Exemples cookbook
- Guidelines migration

## 💡 Quick Wins Immédiats

**Login simplifié** (avant/après):

❌ **AVANT** (70 lignes):
```tsx
<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" name="email" type="email" />
  {errors.email && <span>{errors.email}</span>}
</div>
```

✅ **APRÈS** (1 ligne):
```tsx
<FormField name="email" type="email" label="Email" required />
```

**Validation** (avant/après):

❌ **AVANT**:
```tsx
// Validation manuelle dans action
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fieldErrors.email = "Email invalide";
}
```

✅ **APRÈS**:
```tsx
// Schema Zod (réutilisable)
const result = validateFormData(loginSchema, formData);
```

## 🎓 Formation Équipe

**Temps estimé**: 30min par dev

1. **Tour du code** (10min): Montrer FormField, useRemixForm, schemas
2. **Live coding** (15min): Migrer 1 formulaire ensemble
3. **Q&A** (5min): Clarifications

## 📈 Métriques de Succès

- ✅ Code réduit de ~50% par formulaire
- ✅ Zéro régression (tests existants passent)
- ✅ Accessibilité améliorée (ARIA auto)
- ✅ DX améliorée (moins de boilerplate)

## ⚠️ Pièges à Éviter

1. **Ne PAS tout migrer d'un coup** → Progressive
2. **Ne PAS changer les schemas existants** → Backward compatible
3. **Ne PAS oublier les tests** → Tester chaque migration
4. **Ne PAS bloquer sur composants manquants** → Créer au besoin

## 🔗 Ressources

- [React Hook Form Docs](https://react-hook-form.com/)
- [Zod Docs](https://zod.dev/)
- [Remix Forms Guide](https://remix.run/docs/en/main/guides/data-writes)
- Page démo: http://localhost:5173/test/forms
