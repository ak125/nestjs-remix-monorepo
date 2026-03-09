import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
} from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Car,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Eye,
  EyeOff,
  Headphones,
  RefreshCw,
  Shield,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { getOptionalUser } from "../../auth/unified.server";

export const handle = {
  pageRole: createPageRoleMeta(PageRole.R6_SUPPORT, {
    clusterId: "auth",
    canonicalEntity: "register",
    contentType: "support",
    funnelStage: "decision",
    conversionGoal: "lead",
  }),
};

export const meta: MetaFunction = () => [
  { title: "Inscription | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

// Schema Zod — source de vérité unique
const RegisterSchemaBase = z.object({
  civility: z.enum(["M", "Mme", "Autre"], {
    errorMap: () => ({ message: "Civilité invalide" }),
  }),
  firstName: z
    .string()
    .trim()
    .min(2, "Le prénom doit contenir au moins 2 caractères")
    .max(100, "Le prénom est trop long"),
  lastName: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom est trop long"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Adresse email invalide")
    .max(255, "Adresse email trop longue"),
  phone: z
    .string()
    .trim()
    .max(30, "Numéro de téléphone trop long")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(128, "Le mot de passe est trop long")
    .regex(/[a-zA-Z]/, "Au moins une lettre requise")
    .regex(/[0-9]/, "Au moins un chiffre requis"),
  confirmPassword: z.string().min(1, "Veuillez confirmer le mot de passe"),
  newsletterOptIn: z.boolean().default(false),
  billingAddress: z.object({
    address1: z
      .string()
      .trim()
      .min(5, "L'adresse doit contenir au moins 5 caractères")
      .max(255, "L'adresse est trop longue"),
    address2: z
      .string()
      .trim()
      .max(255, "Le complément d'adresse est trop long")
      .optional()
      .or(z.literal("")),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "Le code postal doit contenir 5 chiffres"),
    city: z
      .string()
      .trim()
      .min(2, "La ville doit contenir au moins 2 caractères")
      .max(120, "Le nom de la ville est trop long"),
    country: z.string().trim().length(2, "Code pays invalide").default("FR"),
  }),
});

const RegisterSchema = RegisterSchemaBase.superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: "Les mots de passe ne correspondent pas",
    });
  }
});

// FieldValidators dérivé du schema — pas de duplication
const shape = RegisterSchemaBase.shape;
const FieldValidators: Record<string, z.ZodType> = {
  email: shape.email,
  password: shape.password,
  firstName: shape.firstName,
  lastName: shape.lastName,
  billingAddress: shape.billingAddress.shape.address1,
  billingPostalCode: shape.billingAddress.shape.postalCode,
  billingCity: shape.billingAddress.shape.city,
};

// Helper : FormData → objet validable
function parseRegisterFormData(formData: FormData) {
  return {
    civility: String(formData.get("civility") ?? "M"),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    newsletterOptIn: formData.get("newsletterOptIn") === "on",
    billingAddress: {
      address1: String(formData.get("billing.address1") ?? ""),
      address2: String(formData.get("billing.address2") ?? ""),
      postalCode: String(formData.get("billing.postalCode") ?? ""),
      city: String(formData.get("billing.city") ?? ""),
      country: String(formData.get("billing.country") ?? "FR"),
    },
  };
}

type FieldErrors = Record<string, string[] | undefined>;

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await getOptionalUser({ context });
  if (user) {
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get("redirectTo") || "/profile";
    return redirect(redirectTo);
  }
  return json({
    googleClientId: process.env.VITE_GOOGLE_CLIENT_ID || "",
  });
};

// --- Composants internes ---

function BenefitsPanel() {
  const benefits = [
    {
      icon: ClipboardList,
      text: "Suivez vos commandes en temps réel",
    },
    {
      icon: Car,
      text: "Enregistrez votre véhicule pour gagner du temps",
    },
    {
      icon: CreditCard,
      text: "Retrouvez facilement vos factures",
    },
    {
      icon: Zap,
      text: "Commandez plus vite à chaque visite",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 font-v9-heading tracking-tight">
          Pourquoi créer un compte ?
        </h2>
      </div>
      <ul className="space-y-4">
        {benefits.map((b) => (
          <li key={b.text} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 ring-1 ring-orange-100">
              <b.icon className="w-5 h-5 text-cta" />
            </span>
            <span className="text-sm text-slate-600 font-v9-body pt-2">
              {b.text}
            </span>
          </li>
        ))}
      </ul>
      {/* Aide */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
          Besoin d'aide ?
        </p>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2 text-sm text-slate-700">
            <Shield className="w-4 h-4 mt-0.5 shrink-0 text-cta" />
            <span>Paiement 100% sécurisé</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-slate-700">
            <RefreshCw className="w-4 h-4 mt-0.5 shrink-0 text-cta" />
            <span>Retours sous 30 jours</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-slate-700">
            <Headphones className="w-4 h-4 mt-0.5 shrink-0 text-cta" />
            <span>
              <a
                href="tel:+33148479627"
                className="font-medium text-cta hover:underline"
              >
                01 48 47 96 27
              </a>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function ReassuranceCTA() {
  const items = ["Inscription en 2 minutes", "Données protégées"];
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="flex items-center gap-1.5 text-xs text-slate-500 font-v9-body"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          {item}
        </span>
      ))}
    </div>
  );
}

// --- Page principale ---

export default function RegisterPage() {
  const { googleClientId } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");
  const redirectTo = searchParams.get("redirectTo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [formStarted, setFormStarted] = useState(false);

  // Analytics : page view au mount
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: "register_page_view",
        register_origin: redirectTo
          ? redirectTo.includes("panier")
            ? "cart"
            : redirectTo.includes("checkout")
              ? "checkout"
              : redirectTo.includes("diagnostic")
                ? "diagnostic"
                : "other"
          : "direct",
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const form = e.currentTarget;
    const formData = new FormData(form);
    const rawValues = parseRegisterFormData(formData);

    // Marquer tous les champs comme touched au submit
    setTouchedFields(
      new Set([
        "email",
        "password",
        "confirmPassword",
        "firstName",
        "lastName",
        "billingAddress",
        "billingPostalCode",
        "billingCity",
      ]),
    );

    // Validation client Zod
    const result = RegisterSchema.safeParse(rawValues);
    if (!result.success) {
      const flattened = result.error.flatten();
      setFieldErrors(flattened.fieldErrors);
      trackEvent("register_validation_error", {
        fields: Object.keys(flattened.fieldErrors).join(","),
      });
      // Scroll to first error field
      const errorFields = Object.keys(flattened.fieldErrors);
      if (errorFields.length > 0) {
        setTimeout(() => {
          const firstField = errorFields[0];
          const el = document.querySelector(
            `[name="${firstField}"], [name="billing.${firstField.replace("billing", "").toLowerCase()}"]`,
          );
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          (el as HTMLInputElement)?.focus();
        }, 100);
      }
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    trackEvent("register_submit");

    // Soumettre via navigation native (comme le login)
    const tempForm = document.createElement("form");
    tempForm.method = "POST";
    tempForm.action = redirectTo
      ? `/register-and-login?redirectTo=${encodeURIComponent(redirectTo)}`
      : "/register-and-login";
    tempForm.style.display = "none";

    // Tous les champs du formulaire
    const fields = [
      "email",
      "password",
      "confirmPassword",
      "firstName",
      "lastName",
      "phone",
      "civility",
      "billing.address1",
      "billing.address2",
      "billing.postalCode",
      "billing.city",
      "billing.country",
      "website",
    ];
    fields.forEach((field) => {
      const value = formData.get(field);
      if (value) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = field;
        input.value = value as string;
        tempForm.appendChild(input);
      }
    });

    // Checkbox newsletterOptIn
    if (formData.get("newsletterOptIn")) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "newsletterOptIn";
      input.value = "on";
      tempForm.appendChild(input);
    }

    // Guest session pour fusion de panier
    const cookieHeader = document.cookie;
    const sessionCookie = cookieHeader
      .split(";")
      .find((c) => c.trim().startsWith("connect.sid="));

    if (sessionCookie) {
      try {
        const cookieValue = sessionCookie.split("=")[1];
        const decoded = decodeURIComponent(cookieValue);
        const match = decoded.match(/^s:([^.]+)\./);
        if (match) {
          const guestSessionInput = document.createElement("input");
          guestSessionInput.type = "hidden";
          guestSessionInput.name = "guestSessionId";
          guestSessionInput.value = match[1];
          tempForm.appendChild(guestSessionInput);
        }
      } catch {
        // Ignore cookie parsing errors
      }
    }

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
    if (strength < 40) return "bg-red-500";
    if (strength < 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthLabel = (strength: number) => {
    if (strength < 40) return "Faible";
    if (strength < 70) return "Moyen";
    return "Fort";
  };

  const getError = (field: string) =>
    touchedFields.has(field) ? fieldErrors[field]?.[0] : undefined;

  // Validation onBlur par champ
  const handleBlur = (fieldName: string, form: HTMLFormElement) => {
    setTouchedFields((prev) => new Set(prev).add(fieldName));
    const formData = new FormData(form);

    // Map du nom de champ vers la valeur du formulaire
    const fieldValueMap: Record<string, string> = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      billingAddress: String(formData.get("billing.address1") ?? ""),
      billingPostalCode: String(formData.get("billing.postalCode") ?? ""),
      billingCity: String(formData.get("billing.city") ?? ""),
    };

    // Cas special : confirmPassword doit matcher password
    if (fieldName === "confirmPassword") {
      const pw = String(formData.get("password") ?? "");
      const cpw = String(formData.get("confirmPassword") ?? "");
      if (cpw && pw !== cpw) {
        setFieldErrors((prev) => ({
          ...prev,
          confirmPassword: ["Les mots de passe ne correspondent pas"],
        }));
      } else {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.confirmPassword;
          return next;
        });
      }
      return;
    }

    const validator = FieldValidators[fieldName];
    if (!validator) return;

    const value = fieldValueMap[fieldName] ?? "";
    const result = validator.safeParse(value);
    if (!result.success) {
      setFieldErrors((prev) => ({
        ...prev,
        [fieldName]: result.error.issues.map((i) => i.message),
      }));
      trackEvent("register_field_error", { field: fieldName });
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  // Analytics helpers
  const trackEvent = (event: string, data?: Record<string, string>) => {
    if (typeof window !== "undefined" && (window as any).dataLayer) {
      (window as any).dataLayer.push({ event, ...data });
    }
  };

  const handleFirstFocus = () => {
    if (!formStarted) {
      setFormStarted(true);
      const origin = redirectTo
        ? redirectTo.includes("panier")
          ? "cart"
          : redirectTo.includes("checkout")
            ? "checkout"
            : redirectTo.includes("diagnostic")
              ? "diagnostic"
              : "other"
        : "direct";
      trackEvent("register_form_start", { register_origin: origin });
    }
  };

  // Hero contextuel selon l'origine
  const isCheckoutFlow = redirectTo
    ? /panier|checkout|commande/.test(redirectTo)
    : false;
  const heroTitle = isCheckoutFlow
    ? "Créez votre compte pour finaliser votre commande"
    : "Créez votre espace AutoMecanik";
  const heroSubtitle = isCheckoutFlow
    ? "Vous pourrez ensuite suivre vos livraisons et retrouver vos factures."
    : "Gagnez du temps pour vos prochaines commandes et retrouvez les pièces compatibles avec votre véhicule.";

  // Lien secondaire contextuel
  const secondaryLink = redirectTo?.includes("panier")
    ? { to: redirectTo, label: "Retour au panier" }
    : redirectTo
      ? { to: redirectTo, label: "Continuer mes achats" }
      : null;

  return (
    <>
      {/* Hero sombre — aligné charte homepage */}
      <section className="bg-gradient-to-b from-v9-navy to-v9-navy-light">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 pt-8 pb-16 lg:pt-12 lg:pb-20 text-center">
          <h1 className="text-[28px] lg:text-[42px] font-extrabold leading-[1.1] tracking-tight text-white font-v9-heading">
            {heroTitle}
          </h1>
          <p className="text-[14px] lg:text-[16px] text-white/60 font-v9-body max-w-xl mx-auto mt-3">
            {heroSubtitle}
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {[
              "Commande plus rapide",
              "Suivi de commande",
              "Véhicules enregistrés",
            ].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 lg:px-4 lg:py-2.5 text-[12px] lg:text-[13px] font-medium text-white/70"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Card flottante — remonte sur le hero */}
      <div className="relative z-10 -mt-8 lg:-mt-12 pb-16">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8">
          {/* Erreur serveur */}
          {error && (
            <div className="max-w-2xl mx-auto mb-6">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 font-v9-body">
                {decodeURIComponent(error)}
              </div>
            </div>
          )}

          <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(2,6,23,0.08)] overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr]">
              {/* Aside gauche : benefices */}
              <aside className="hidden lg:block bg-slate-50/80 border-r border-slate-200 p-8">
                <BenefitsPanel />
              </aside>

              {/* Section droite : formulaire */}
              <section className="p-6 sm:p-8 lg:p-10">
                {/* Benefices mobile : version compacte */}
                <div className="lg:hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-6">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2.5">
                    Avec votre compte
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-600 font-v9-body">
                    <span className="flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-cta" />
                      Suivi commandes
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-cta" />
                      Véhicules enregistrés
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cta" />
                      Commande rapide
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-cta" />
                      Factures disponibles
                    </span>
                  </div>
                </div>

                <div className="mb-6">
                  <h2 className="text-xl font-v9-heading font-bold tracking-tight text-slate-900">
                    Créez votre espace en quelques instants
                  </h2>
                </div>

                {/* Google Sign-In */}
                {googleClientId && (
                  <div className="mb-6">
                    <GoogleSignInButton
                      clientId={googleClientId}
                      text="signup_with"
                      onError={(err) => setGoogleError(err)}
                    />
                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-slate-500">
                          Ou par email
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Google error */}
                {googleError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {googleError}
                  </div>
                )}

                <form
                  method="post"
                  onSubmit={handleSubmit}
                  className="space-y-8"
                >
                  {/* Bandeau erreur global au submit */}
                  {Object.keys(fieldErrors).length > 0 &&
                    touchedFields.size > 3 && (
                      <div
                        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-2"
                        role="alert"
                      >
                        <svg
                          className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <div>
                          <p className="font-semibold">
                            Veuillez corriger les erreurs suivantes :
                          </p>
                          <ul className="mt-1 list-disc list-inside text-red-700">
                            {Object.entries(fieldErrors).map(
                              ([field, errors]) => (
                                <li key={field}>{(errors as string[])?.[0]}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      </div>
                    )}

                  {/* Honeypot anti-spam */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
                    aria-hidden="true"
                  />

                  {/* Bloc 1 — Vos informations */}
                  <fieldset className="space-y-3">
                    <legend className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                      Vos informations
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr] gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="civility">Civilité</Label>
                        <select
                          id="civility"
                          name="civility"
                          required
                          disabled={isSubmitting}
                          className="w-full h-12 px-3 border border-slate-200 rounded-2xl bg-white text-sm text-slate-700 focus:border-cta focus:ring-4 focus:ring-cta/10 focus:outline-none disabled:opacity-50 transition-colors"
                        >
                          <option value="M">M.</option>
                          <option value="Mme">Mme</option>
                          <option value="Autre">Autre</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="firstName">Prénom</Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          required
                          disabled={isSubmitting}
                          placeholder="Jean"
                          className="h-12 rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                          autoComplete="given-name"
                          onFocus={handleFirstFocus}
                          onBlur={(e) =>
                            handleBlur("firstName", e.target.closest("form")!)
                          }
                        />
                        {getError("firstName") && (
                          <p className="text-sm text-red-600 font-medium">
                            {getError("firstName")}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="lastName">Nom</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          required
                          disabled={isSubmitting}
                          placeholder="Dupont"
                          className="h-12 rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                          autoComplete="family-name"
                          onFocus={handleFirstFocus}
                          onBlur={(e) =>
                            handleBlur("lastName", e.target.closest("form")!)
                          }
                        />
                        {getError("lastName") && (
                          <p className="text-sm text-red-600 font-medium">
                            {getError("lastName")}
                          </p>
                        )}
                      </div>
                    </div>
                  </fieldset>

                  {/* Bloc 2 — Votre connexion */}
                  <fieldset className="space-y-3">
                    <legend className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                      Votre connexion
                    </legend>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Adresse email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        disabled={isSubmitting}
                        autoComplete="email"
                        placeholder="vous@exemple.com"
                        className="h-12 rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                        onFocus={handleFirstFocus}
                        onBlur={(e) =>
                          handleBlur("email", e.target.closest("form")!)
                        }
                      />
                      {getError("email") ? (
                        <p className="text-sm text-red-600 font-medium">
                          {getError("email")}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Pour confirmer vos commandes
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="password">Mot de passe</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            required
                            disabled={isSubmitting}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            className="h-12 pr-10 rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                            onFocus={handleFirstFocus}
                            onBlur={(e) =>
                              handleBlur("password", e.target.closest("form")!)
                            }
                            onChange={(e) =>
                              setPasswordStrength(
                                calculatePasswordStrength(e.target.value),
                              )
                            }
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowPassword((p) => !p)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-cta/50 focus:outline-none rounded-lg transition-colors"
                            aria-label={
                              showPassword
                                ? "Masquer le mot de passe"
                                : "Afficher le mot de passe"
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {passwordStrength > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Force</span>
                              <span
                                className={`font-medium ${
                                  passwordStrength < 40
                                    ? "text-red-600"
                                    : passwordStrength < 70
                                      ? "text-yellow-600"
                                      : "text-green-600"
                                }`}
                              >
                                {getStrengthLabel(passwordStrength)}
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${getStrengthColor(passwordStrength)}`}
                                style={{ width: `${passwordStrength}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {getError("password") ? (
                          <p className="text-sm text-red-600 font-medium">
                            {getError("password")}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400">
                            8 caractères min., 1 lettre et 1 chiffre
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword">Confirmation</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            disabled={isSubmitting}
                            placeholder="••••••••"
                            className="h-12 pr-10 rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                            onFocus={handleFirstFocus}
                            onBlur={(e) =>
                              handleBlur(
                                "confirmPassword",
                                e.target.closest("form")!,
                              )
                            }
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowConfirmPassword((p) => !p)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-cta/50 focus:outline-none rounded-lg transition-colors"
                            aria-label={
                              showConfirmPassword
                                ? "Masquer la confirmation"
                                : "Afficher la confirmation"
                            }
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {getError("confirmPassword") && (
                          <p className="text-sm text-red-600 font-medium">
                            {getError("confirmPassword")}
                          </p>
                        )}
                      </div>
                    </div>
                  </fieldset>

                  {/* Bloc 3 — Votre adresse */}
                  <fieldset className="space-y-3">
                    <legend className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                      Votre adresse
                    </legend>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="billing.address1">Adresse</Label>
                        <Input
                          id="billing.address1"
                          name="billing.address1"
                          required
                          disabled={isSubmitting}
                          placeholder="123 rue de la Paix"
                          className="h-12 rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                          autoComplete="street-address"
                          onBlur={(e) =>
                            handleBlur(
                              "billingAddress",
                              e.target.closest("form")!,
                            )
                          }
                        />
                        {getError("billingAddress") && (
                          <p className="text-sm text-red-600 font-medium">
                            {getError("billingAddress")}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="billing.address2">
                          Complément{" "}
                          <span className="text-slate-400 font-normal">
                            (optionnel)
                          </span>
                        </Label>
                        <Input
                          id="billing.address2"
                          name="billing.address2"
                          disabled={isSubmitting}
                          placeholder="Appartement, étage, etc."
                          className="h-12 rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                        />
                      </div>
                      <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="billing.postalCode">
                            Code postal
                          </Label>
                          <Input
                            id="billing.postalCode"
                            name="billing.postalCode"
                            pattern="[0-9]{5}"
                            required
                            disabled={isSubmitting}
                            placeholder="75001"
                            className="h-12 rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                            autoComplete="postal-code"
                            onBlur={(e) =>
                              handleBlur(
                                "billingPostalCode",
                                e.target.closest("form")!,
                              )
                            }
                          />
                          {getError("billingPostalCode") && (
                            <p className="text-sm text-red-600 font-medium">
                              {getError("billingPostalCode")}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="billing.city">Ville</Label>
                          <Input
                            id="billing.city"
                            name="billing.city"
                            required
                            disabled={isSubmitting}
                            placeholder="Paris"
                            className="h-12 rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                            autoComplete="address-level2"
                            onBlur={(e) =>
                              handleBlur(
                                "billingCity",
                                e.target.closest("form")!,
                              )
                            }
                          />
                          {getError("billingCity") && (
                            <p className="text-sm text-red-600 font-medium">
                              {getError("billingCity")}
                            </p>
                          )}
                        </div>
                      </div>
                      <input type="hidden" name="billing.country" value="FR" />
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">
                          Téléphone{" "}
                          <span className="text-slate-400 font-normal">
                            (optionnel)
                          </span>
                        </Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          disabled={isSubmitting}
                          autoComplete="tel"
                          placeholder="06 12 34 56 78"
                          className="h-12 max-w-full sm:max-w-xs rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                        />
                      </div>
                    </div>
                  </fieldset>

                  {/* Newsletter */}
                  <Checkbox
                    id="newsletterOptIn"
                    name="newsletterOptIn"
                    disabled={isSubmitting}
                    label="Je souhaite recevoir les offres et actualités AutoMecanik"
                  />

                  {/* CGV — consentement explicite (RGPD) */}
                  <div className="space-y-1">
                    <Checkbox
                      id="acceptTerms"
                      name="acceptTerms"
                      required
                      disabled={isSubmitting}
                      label={
                        <span>
                          J'accepte les{" "}
                          <Link
                            to="/cgv"
                            target="_blank"
                            className="text-cta hover:text-cta-hover underline"
                          >
                            conditions générales de vente
                          </Link>{" "}
                          et la{" "}
                          <Link
                            to="/confidentialite"
                            target="_blank"
                            className="text-cta hover:text-cta-hover underline"
                          >
                            politique de confidentialité
                          </Link>
                        </span>
                      }
                    />
                  </div>

                  {/* CTA */}
                  <div className="space-y-3 pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-14 bg-cta hover:bg-cta-hover text-white font-bold text-base rounded-2xl shadow-[0_12px_30px_rgba(249,115,22,0.28)] transition-colors"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <svg
                            className="animate-spin h-5 w-5"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Création en cours...
                        </span>
                      ) : (
                        "Créer mon compte"
                      )}
                    </Button>

                    <ReassuranceCTA />
                  </div>

                  {/* Liens secondaires */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm pt-2">
                    <Link
                      to={
                        redirectTo
                          ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
                          : "/login"
                      }
                      className="text-cta hover:text-cta-hover font-medium"
                    >
                      Déjà client ? Connectez-vous
                    </Link>
                    {secondaryLink && (
                      <>
                        <span className="hidden sm:inline text-slate-300">
                          |
                        </span>
                        <Link
                          to={secondaryLink.to}
                          className="text-slate-500 hover:text-slate-700"
                        >
                          {secondaryLink.label}
                        </Link>
                      </>
                    )}
                  </div>

                  {/* Mention légale (renforcée par checkbox CGV) */}
                  <p className="text-center text-[11px] text-slate-400 font-v9-body pt-2">
                    Vos données sont protégées conformément à nos{" "}
                    <Link to="/cgv" className="underline hover:text-slate-600">
                      conditions d'utilisation
                    </Link>{" "}
                    et notre{" "}
                    <Link
                      to="/confidentialite"
                      className="underline hover:text-slate-600"
                    >
                      politique de confidentialité
                    </Link>
                    .
                  </p>
                </form>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
