/**
 * 🎨 TEST FORMKIT - Démo système de formulaires complet
 * 
 * Features:
 * - États normalisés (loading, error, success, disabled)
 * - Auto-format (immatriculation, VIN, téléphone)
 * - Inline validation temps réel
 * - Conform + Zod integration
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { useState, useEffect } from "react";
import { z } from "zod";
import { FormInput } from "~/components/forms/FormInput";
import { Button } from "@fafa/ui";

// ═══════════════════════════════════════════════════════════════════════════
// 🔍 SCHEMAS AVEC VALIDATIONS CUSTOM
// ═══════════════════════════════════════════════════════════════════════════

const immatriculationSchema = z.object({
  immat: z
    .string()
    .min(1, "Immatriculation requise")
    .regex(/^[A-Z]{2}-\d{3}-[A-Z]{2}$/, "Format: AA-123-BB")
    .refine(
      (val) => !["WW", "SS"].includes(val.slice(0, 2)),
      "Séries WW et SS interdites"
    ),
  vin: z
    .string()
    .length(17, "VIN = 17 caractères exactement")
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN invalide (pas de I, O, Q)"),
  typeMine: z
    .string()
    .min(5, "Type mine minimum 5 caractères")
    .max(12, "Type mine maximum 12 caractères")
    .regex(/^[A-Z0-9]+$/, "Lettres et chiffres uniquement"),
});

const contactSchema = z.object({
  name: z.string().min(2, "Nom requis (min 2 car.)"),
  phone: z
    .string()
    .regex(/^\d{2} \d{2} \d{2} \d{2} \d{2}$/, "Format: 06 12 34 56 78"),
  email: z.string().email("Email invalide"),
});

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 ACTION SERVEUR
// ═══════════════════════════════════════════════════════════════════════════

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  // Router selon intent
  if (intent === "immatriculation") {
    const submission = parseWithZod(formData, { schema: immatriculationSchema });

    if (submission.status !== "success") {
      return json({ lastResult: submission.reply() });
    }

    // Simuler recherche véhicule
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return json({
      lastResult: submission.reply(),
      success: true,
      vehicle: {
        brand: "Renault",
        model: "Clio V",
        year: 2023,
        vin: submission.value.vin,
        typeMine: submission.value.typeMine,
      },
    });
  }

  if (intent === "contact") {
    const submission = parseWithZod(formData, { schema: contactSchema });

    if (submission.status !== "success") {
      return json({ lastResult: submission.reply() });
    }

    return json({
      lastResult: submission.reply(),
      success: true,
      message: "Message envoyé !",
    });
  }

  return json({ error: "Intent invalide" }, { status: 400 });
}

// ═══════════════════════════════════════════════════════════════════════════
// 📄 PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function TestFormKitPage() {
  const [activeTab, setActiveTab] = useState<"states" | "autoformat" | "inline">("states");

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎨 FormKit-like System
          </h1>
          <p className="text-lg text-gray-600">
            États normalisés + Auto-format + Inline validation
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {(["states", "autoformat", "inline"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab === "states" && "🎨 États"}
              {tab === "autoformat" && "🔧 Auto-format"}
              {tab === "inline" && "⚡ Inline Validation"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {activeTab === "states" && <StatesDemo />}
          {activeTab === "autoformat" && <AutoFormatDemo />}
          {activeTab === "inline" && <InlineValidationDemo />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 DÉMO ÉTATS NORMALISÉS
// ═══════════════════════════════════════════════════════════════════════════

function StatesDemo() {
  const [currentState, setCurrentState] = useState<"default" | "loading" | "error" | "success" | "disabled">("default");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">États Visuels Normalisés</h2>

      {/* Contrôles */}
      <div className="flex gap-2 flex-wrap">
        {(["default", "loading", "error", "success", "disabled"] as const).map((state) => (
          <button
            key={state}
            onClick={() => setCurrentState(state)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              currentState === state
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {state}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
        <FormInput
          label="Email"
          placeholder="exemple@email.com"
          state={currentState}
          error={currentState === "error" ? "Cet email est déjà utilisé" : undefined}
          helperText="Nous ne partagerons jamais votre email"
          disabled={currentState === "disabled"}
          required
        />
      </div>

      {/* Explications */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm font-semibold mb-2">💡 États disponibles:</p>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>default</strong> : Neutre, prêt à remplir</li>
          <li>• <strong>loading</strong> : Spinner + opacity (soumission en cours)</li>
          <li>• <strong>validating</strong> : Bordure bleue (validation async)</li>
          <li>• <strong>error</strong> : Bordure rouge + icône + message</li>
          <li>• <strong>success</strong> : Bordure verte + check</li>
          <li>• <strong>disabled</strong> : Grisé + cursor-not-allowed</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 DÉMO AUTO-FORMAT
// ═══════════════════════════════════════════════════════════════════════════

function AutoFormatDemo() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [form, fields] = useForm({
    lastResult: actionData?.lastResult,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: immatriculationSchema });
    },
    shouldValidate: "onBlur",
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">Auto-Format Intelligent</h2>

      <Form method="post" id={form.id} onSubmit={form.onSubmit}>
        <input type="hidden" name="_intent" value="immatriculation" />

        <div className="space-y-4">
          <FormInput
            key={fields.immat.key}
            name={fields.immat.name}
            label="Immatriculation"
            placeholder="AB123CD"
            autoFormat="immatriculation"
            error={fields.immat.errors?.[0]}
            helperText="Format automatique: AA-123-BB"
            state={isSubmitting ? "loading" : "default"}
            required
          />

          <FormInput
            key={fields.vin.key}
            name={fields.vin.name}
            label="VIN (Numéro de châssis)"
            placeholder="VF1RFB00123456789"
            autoFormat="vin"
            error={fields.vin.errors?.[0]}
            helperText="17 caractères (pas de I, O, Q)"
            state={isSubmitting ? "loading" : "default"}
            required
          />

          <FormInput
            key={fields.typeMine.key}
            name={fields.typeMine.name}
            label="Type Mine"
            placeholder="M10RENAULT"
            autoFormat="type-mine"
            error={fields.typeMine.errors?.[0]}
            helperText="Code national d'identification (5-12 caractères)"
            state={isSubmitting ? "loading" : "default"}
            required
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Recherche..." : "🔍 Rechercher véhicule"}
          </Button>
        </div>
      </Form>

      {/* Résultat */}
      {actionData?.success && actionData.vehicle && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="font-semibold text-green-800 mb-2">✅ Véhicule trouvé !</p>
          <div className="text-sm space-y-1 text-green-700">
            <p><strong>Marque:</strong> {actionData.vehicle.brand}</p>
            <p><strong>Modèle:</strong> {actionData.vehicle.model}</p>
            <p><strong>Année:</strong> {actionData.vehicle.year}</p>
            <p><strong>VIN:</strong> {actionData.vehicle.vin}</p>
            <p><strong>Type Mine:</strong> {actionData.vehicle.typeMine}</p>
          </div>
        </div>
      )}

      {/* Explications */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm font-semibold mb-2">🔧 Formats supportés:</p>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>immatriculation</strong> : AA-123-BB (auto uppercase + tirets)</li>
          <li>• <strong>vin</strong> : 17 chars uppercase, pas de I/O/Q</li>
          <li>• <strong>type-mine</strong> : 5-12 chars (ex: M10RENAULT, K9KF7)</li>
          <li>• <strong>phone-fr</strong> : 06 12 34 56 78 (espaces auto)</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚡ DÉMO INLINE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function InlineValidationDemo() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [form, fields] = useForm({
    lastResult: actionData?.lastResult,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: contactSchema });
    },
    shouldValidate: "onBlur", // Validation à la perte de focus
    shouldRevalidate: "onInput", // Re-validation pendant la saisie
  });

  // États locaux pour démo validation async
  const [emailState, setEmailState] = useState<"default" | "validating" | "error" | "success">("default");

  // Simuler validation async (vérifier si email existe)
  const handleEmailBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const email = e.target.value;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    setEmailState("validating");

    // Simuler API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Simuler résultat (50% chance d'erreur)
    const isAvailable = Math.random() > 0.5;
    setEmailState(isAvailable ? "success" : "error");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">Validation Inline Temps Réel</h2>

      <Form method="post" id={form.id} onSubmit={form.onSubmit}>
        <input type="hidden" name="_intent" value="contact" />

        <div className="space-y-4">
          <FormInput
            key={fields.name.key}
            name={fields.name.name}
            label="Nom complet"
            placeholder="Jean Dupont"
            error={fields.name.errors?.[0]}
            helperText="Minimum 2 caractères"
            state={isSubmitting ? "loading" : "default"}
            required
          />

          <FormInput
            key={fields.email.key}
            name={fields.email.name}
            type="email"
            label="Email"
            placeholder="jean@exemple.com"
            error={
              emailState === "error"
                ? "Cet email est déjà utilisé"
                : fields.email.errors?.[0]
            }
            helperText="Vérification automatique de disponibilité"
            state={emailState}
            onBlur={handleEmailBlur}
            required
          />

          <FormInput
            key={fields.phone.key}
            name={fields.phone.name}
            type="tel"
            label="Téléphone"
            placeholder="0612345678"
            autoFormat="phone-fr"
            error={fields.phone.errors?.[0]}
            helperText="Format automatique avec espaces"
            state={isSubmitting ? "loading" : "default"}
            required
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Envoi..." : "Envoyer"}
          </Button>
        </div>
      </Form>

      {/* Succès */}
      {actionData?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="font-semibold text-green-800">✅ {actionData.message}</p>
        </div>
      )}

      {/* Explications */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm font-semibold mb-2">⚡ Validation progressive:</p>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>onBlur</strong> : Validation à la perte de focus</li>
          <li>• <strong>onInput</strong> : Re-validation pendant la saisie (après 1er blur)</li>
          <li>• <strong>Async</strong> : Email vérifié en temps réel (démo aléatoire)</li>
          <li>• <strong>États visuels</strong> : Spinner pendant validation, check si OK</li>
        </ul>
      </div>
    </div>
  );
}
