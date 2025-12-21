import { 
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect 
} from "@remix-run/node";
import { Link, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import { z } from "zod";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getOptionalUser } from "../../auth/unified.server";

// 🤖 SEO: Page transactionnelle non indexable
export const meta: MetaFunction = () => [
  { title: "Inscription | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  { tagName: "link", rel: "canonical", href: "https://www.automecanik.com/register" },
];

const _RegisterSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  confirmPassword: z.string(),
  firstName: z.string().min(2, "Prénom requis"),
  lastName: z.string().min(2, "Nom requis"),
  phone: z.string().optional(),
  civility: z.enum(["M", "Mme", "Autre"]),
  newsletterOptIn: z.boolean().optional(),
  // Adresse de facturation
  billingAddress: z.object({
    address1: z.string().min(5, "Adresse requise"),
    address2: z.string().optional(),
    postalCode: z.string().regex(/^\d{5}$/, "Code postal invalide"),
    city: z.string().min(2, "Ville requise"),
    country: z.string().default("FR"),
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await getOptionalUser({ context });
  if (user) {
    // Rediriger vers la page demandée ou le profil par défaut
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo') || '/profile';
    return redirect(redirectTo);
  }
  return null;
};

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    // Soumettre directement au backend via navigation native (comme le login)
    const tempForm = document.createElement('form');
    tempForm.method = 'POST';
    tempForm.action = '/register-and-login';
    tempForm.style.display = 'none';
    
    // Ajouter tous les champs du formulaire
    const fields = ['email', 'password', 'confirmPassword', 'firstName', 'lastName', 'phone', 'civility'];
    fields.forEach(field => {
      const value = formData.get(field);
      if (value) {
        const input = document.createElement('input');
        input.name = field;
        input.value = value as string;
        tempForm.appendChild(input);
      }
    });
    
    document.body.appendChild(tempForm);
    tempForm.submit();
  };

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 10;
    return Math.min(strength, 100);
  };

  const getStrengthColor = (strength: number) => {
    if (strength < 40) return "bg-destructive";
    if (strength < 70) return "bg-warning";
    return "bg-success";
  };

  const getStrengthLabel = (strength: number) => {
    if (strength < 40) return "Faible";
    if (strength < 70) return "Moyen";
    return "Fort";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Créer votre compte
          </h1>
          <p className="text-gray-600">Rejoignez-nous en quelques clics</p>
        </div>

        {/* Info Badge */}
        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
          <Badge className="w-full justify-center py-3 bg-primary/5 text-blue-700 hover:bg-info/20 border border-blue-200">
            <span className="flex items-center gap-2 text-sm">
              <span>ℹ️</span>
              <span>Après inscription, vous serez automatiquement connecté</span>
            </span>
          </Badge>
        </div>

        {/* Error Messages */}
        {error && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="pt-6">
                <p className="text-sm text-red-800 flex items-center gap-2">
                  <span className="text-lg">❌</span>
                  {error}
                </p>
              </CardContent>
            </Card>
          </div>
        )}



        {/* Registration Form */}
        <Card className="shadow-xl border-gray-200 backdrop-blur-sm bg-white/90">
          <CardHeader>
            <CardTitle>Informations du compte</CardTitle>
            <CardDescription>
              Remplissez le formulaire ci-dessous pour créer votre compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post" onSubmit={handleSubmit} className="space-y-8">
              {/* Informations personnelles */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                  Informations personnelles
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="civility">Civilité</Label>
                    <select 
                      id="civility" 
                      name="civility" 
                      required
                      disabled={isSubmitting}
                      className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50"
                    >
                      <option value="M">M.</option>
                      <option value="Mme">Mme</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      disabled={isSubmitting}
                      className="h-11 transition-all duration-200"
                      placeholder="Jean"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      disabled={isSubmitting}
                      className="h-11 transition-all duration-200"
                      placeholder="Dupont"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Adresse email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      disabled={isSubmitting}
                      autoComplete="email"
                      className="h-11 transition-all duration-200"
                      placeholder="vous@exemple.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone (optionnel)</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      disabled={isSubmitting}
                      autoComplete="tel"
                      className="h-11 transition-all duration-200"
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      disabled={isSubmitting}
                      autoComplete="new-password"
                      className="h-11 transition-all duration-200"
                      placeholder="••••••••"
                      onChange={(e) => setPasswordStrength(calculatePasswordStrength(e.target.value))}
                    />
                    {passwordStrength > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Force du mot de passe</span>
                          <span className={`font-medium ${
                            passwordStrength < 40 ? 'text-red-600' : 
                            passwordStrength < 70 ? 'text-yellow-600' : 
                            'text-green-600'
                          }`}>
                            {getStrengthLabel(passwordStrength)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${getStrengthColor(passwordStrength)}`}
                            style={{ width: `${passwordStrength}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500">Minimum 8 caractères</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      disabled={isSubmitting}
                      className="h-11 transition-all duration-200"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              {/* Adresse de facturation */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                  Adresse de facturation
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing.address1">Adresse</Label>
                    <Input
                      id="billing.address1"
                      name="billing.address1"
                      type="text"
                      required
                      disabled={isSubmitting}
                      className="h-11 transition-all duration-200"
                      placeholder="123 rue de la Paix"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing.address2">Complément d'adresse (optionnel)</Label>
                    <Input
                      id="billing.address2"
                      name="billing.address2"
                      type="text"
                      disabled={isSubmitting}
                      className="h-11 transition-all duration-200"
                      placeholder="Appartement, étage, etc."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="billing.postalCode">Code postal</Label>
                      <Input
                        id="billing.postalCode"
                        name="billing.postalCode"
                        type="text"
                        pattern="[0-9]{5}"
                        required
                        disabled={isSubmitting}
                        className="h-11 transition-all duration-200"
                        placeholder="75001"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="billing.city">Ville</Label>
                      <Input
                        id="billing.city"
                        name="billing.city"
                        type="text"
                        required
                        disabled={isSubmitting}
                        className="h-11 transition-all duration-200"
                        placeholder="Paris"
                      />
                    </div>
                  </div>

                  <input type="hidden" name="billing.country" value="FR" />
                </div>
              </div>

              {/* Newsletter */}
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <input
                  name="newsletterOptIn"
                  type="checkbox"
                  id="newsletterOptIn"
                  disabled={isSubmitting}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <Label htmlFor="newsletterOptIn" className="text-sm font-normal cursor-pointer">
                  Je souhaite recevoir les offres et actualités par email
                </Label>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 pt-6 border-t">
                <Link to="/login">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    Déjà un compte ? Se connecter
                  </Button>
                </Link>
                
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 h-11 px-8"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Création...
                    </span>
                  ) : (
                    "Créer mon compte"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          En créant un compte, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
        </p>
      </div>
    </div>
  );
}
