/**
 * 🧪 TEST FORMULAIRES - Démonstration React Hook Form + Zod + Remix
 * 
 * Page showcase de tous les patterns de formulaires validés et accessibles
 */

import { Button } from "@fafa/ui";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { useState } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useRemixForm, validateFormData } from "~/hooks/useRemixForm";
import { loginSchema, contactSchema, searchSchema, registerSchema, type SearchFormData } from "~/schemas/auth";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('_intent') as string;

  // Router selon l'intent
  switch (intent) {
    case 'login': {
      const result = validateFormData(loginSchema, formData);
      if (!result.success) {
        return json({ errors: result.errors }, { status: 400 });
      }
      
      // Simuler authentification
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return json({ 
        success: true, 
        message: `Connexion réussie pour ${result.data.email}` 
      });
    }

    case 'contact': {
      const result = validateFormData(contactSchema, formData);
      if (!result.success) {
        return json({ errors: result.errors }, { status: 400 });
      }
      
      return json({ 
        success: true, 
        message: 'Message envoyé avec succès !' 
      });
    }

    default:
      return json({ error: 'Intent invalide' }, { status: 400 });
  }
}

export default function TestFormsPage() {
  const [activeTab, setActiveTab] = useState<'login' | 'contact' | 'search' | 'register'>('login');

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🧪 Test Formulaires
          </h1>
          <p className="text-lg text-gray-600">
            React Hook Form + Zod + Remix - Tous les patterns validés et accessibles
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {(['login', 'contact', 'search', 'register'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab === 'login' && '🔐 Login'}
              {tab === 'contact' && '📞 Contact'}
              {tab === 'search' && '🔍 Search'}
              {tab === 'register' && '✨ Register'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {activeTab === 'login' && <LoginFormDemo />}
          {activeTab === 'contact' && <ContactFormDemo />}
          {activeTab === 'search' && <SearchFormDemo />}
          {activeTab === 'register' && <RegisterFormDemo />}
        </div>

        {/* Features */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold text-lg mb-2">✅ Validation Client & Serveur</h3>
            <p className="text-sm text-gray-600">
              Zod schemas partagés entre frontend et backend. Erreurs fusionnées automatiquement.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold text-lg mb-2">♿ Accessible ARIA</h3>
            <p className="text-sm text-gray-600">
              Labels, erreurs avec screen readers, focus management, aria-invalid, aria-describedby.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-bold text-lg mb-2">⚡ Performant</h3>
            <p className="text-sm text-gray-600">
              React Hook Form = minimal re-renders. Progressive enhancement avec Remix Forms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 LOGIN FORM DEMO
// ═══════════════════════════════════════════════════════════════════════════

function LoginFormDemo() {
  const { register, formState: { errors }, isSubmitting, serverError } = useRemixForm(loginSchema);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Formulaire de Connexion</h2>
      
      <Form method="post" className="space-y-4 max-w-md">
        <input type="hidden" name="_intent" value="login" />
        
        <Input
          {...register('email')}
          type="email"
          label="Email"
          placeholder="exemple@email.com"
          error={errors.email?.message}
          autoComplete="email"
          required
        />
        
        <Input
          {...register('password')}
          type="password"
          label="Mot de passe"
          placeholder="••••••••"
          error={errors.password?.message}
          helperText="Minimum 8 caractères"
          autoComplete="current-password"
          required
        />
        
        <Checkbox
          {...register('remember')}
          label="Se souvenir de moi"
        />

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {serverError}
          </div>
        )}
        
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Connexion...' : 'Se connecter'}
        </Button>
      </Form>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm font-semibold mb-2">💡 Test:</p>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• Essayez de soumettre sans remplir → Erreurs client</li>
          <li>• Email invalide → Validation Zod</li>
          <li>• Mot de passe &lt; 8 char → Erreur</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 📞 CONTACT FORM DEMO
// ═══════════════════════════════════════════════════════════════════════════

function ContactFormDemo() {
  const { register, formState: { errors }, isSubmitting } = useRemixForm(contactSchema);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Formulaire de Contact</h2>
      
      <Form method="post" className="space-y-4 max-w-md">
        <input type="hidden" name="_intent" value="contact" />
        
        <Input
          {...register('name')}
          label="Nom complet"
          placeholder="Jean Dupont"
          error={errors.name?.message}
          required
        />
        
        <Input
          {...register('email')}
          type="email"
          label="Email"
          placeholder="jean@exemple.com"
          error={errors.email?.message}
          required
        />
        
        <Input
          {...register('phone')}
          type="tel"
          label="Téléphone"
          placeholder="06 12 34 56 78"
          error={errors.phone?.message}
          helperText="Format français: 06 12 34 56 78"
        />
        
        <Input
          {...register('subject')}
          label="Sujet"
          placeholder="Demande de renseignement"
          error={errors.subject?.message}
          required
        />
        
        <Textarea
          {...register('message')}
          label="Message"
          placeholder="Votre message..."
          error={errors.message?.message}
          rows={5}
          required
        />
        
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Envoi...' : 'Envoyer le message'}
        </Button>
      </Form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔍 SEARCH FORM DEMO (Client-side only)
// ═══════════════════════════════════════════════════════════════════════════

function SearchFormDemo() {
  const { register, handleSubmit, formState: { errors } } = useRemixForm(searchSchema);
  const [results, setResults] = useState<SearchFormData | null>(null);

  const onSubmit = (data: SearchFormData) => {
    console.log('Search:', data);
    setResults(data);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Formulaire de Recherche</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <Input
          {...register('query')}
          label="Recherche"
          placeholder="Ex: filtre à huile"
          error={errors.query?.message}
          required
        />
        
        <div className="grid grid-cols-2 gap-4">
          <Input
            {...register('priceMin')}
            type="number"
            label="Prix min (€)"
            placeholder="0"
            error={errors.priceMin?.message}
          />
          
          <Input
            {...register('priceMax')}
            type="number"
            label="Prix max (€)"
            placeholder="100"
            error={errors.priceMax?.message}
          />
        </div>
        
        <Checkbox
          {...register('inStockOnly')}
          label="En stock uniquement"
        />
        
        <Button type="submit" className="w-full">
          🔍 Rechercher
        </Button>
      </form>

      {results && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="font-semibold mb-2">✅ Résultats de recherche:</p>
          <pre className="text-sm bg-white p-3 rounded overflow-x-auto">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ✨ REGISTER FORM DEMO
// ═══════════════════════════════════════════════════════════════════════════

function RegisterFormDemo() {
  const { register, formState: { errors }, watch } = useRemixForm(registerSchema);
  const password = watch('password');

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Formulaire d'Inscription</h2>
      
      <form className="space-y-4 max-w-md">
        <div className="grid grid-cols-2 gap-4">
          <Input
            {...register('firstName')}
            label="Prénom"
            placeholder="Jean"
            error={errors.firstName?.message}
            required
          />
          
          <Input
            {...register('lastName')}
            label="Nom"
            placeholder="Dupont"
            error={errors.lastName?.message}
            required
          />
        </div>
        
        <Input
          {...register('email')}
          type="email"
          label="Email"
          placeholder="jean@exemple.com"
          error={errors.email?.message}
          required
        />
        
        <Input
          {...register('password')}
          type="password"
          label="Mot de passe"
          placeholder="••••••••"
          error={errors.password?.message}
          helperText="Min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre"
          required
        />
        
        <Input
          {...register('confirmPassword')}
          type="password"
          label="Confirmer le mot de passe"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          required
        />

        {/* Password strength indicator */}
        {password && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-700">Force du mot de passe:</p>
            <div className="flex gap-1">
              <div className={`h-2 flex-1 rounded ${password.length >= 8 ? 'bg-green-500' : 'bg-gray-200'}`} />
              <div className={`h-2 flex-1 rounded ${/[A-Z]/.test(password) ? 'bg-green-500' : 'bg-gray-200'}`} />
              <div className={`h-2 flex-1 rounded ${/[a-z]/.test(password) ? 'bg-green-500' : 'bg-gray-200'}`} />
              <div className={`h-2 flex-1 rounded ${/[0-9]/.test(password) ? 'bg-green-500' : 'bg-gray-200'}`} />
            </div>
          </div>
        )}
        
        <Checkbox
          {...register('acceptTerms')}
          label="J'accepte les conditions d'utilisation"
          error={errors.acceptTerms?.message}
          required
        />
        
        <Button type="submit" className="w-full">
          Créer mon compte
        </Button>
      </form>
    </div>
  );
}
