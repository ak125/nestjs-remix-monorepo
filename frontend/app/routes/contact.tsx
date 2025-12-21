import { 
  json, 
  type ActionFunctionArgs, 
  type LoaderFunctionArgs,
  type MetaFunction 
} from "@remix-run/node";
import { 
  useLoaderData, 
  useActionData, 
  Form, 
  useNavigation,
  Link
} from "@remix-run/react";
import { useState, useRef, useEffect } from "react";
import { toast } from 'sonner';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { PublicBreadcrumb } from '~/components/ui/PublicBreadcrumb';
import { getSession } from "../server/session.server";

// Interface de contact temporaire pour éviter les erreurs d'import
interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  category: 'general' | 'technical' | 'billing' | 'complaint' | 'suggestion' | 'order' | 'product' | 'commercial' | 'other';
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  customerId?: string;
  orderNumber?: string;
  vehicleInfo?: {
    brand?: string;
    model?: string;
    year?: number;
    licensePlate?: string;
  };
  ipAddress?: string | null;
  userAgent?: string | null;
}

// Service temporaire pour le contact
async function createContact(contactData: ContactRequest): Promise<{ ticketNumber: string; ticket: any }> {
  // TODO: Intégrer avec le vrai API backend
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  
  const response = await fetch(`${baseUrl}/api/support/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(contactData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Erreur HTTP: ${response.status}`);
  }

  const result = await response.json();
  
  return {
    ticketNumber: result.ticket?.msg_id || `TEMP-${Date.now()}`,
    ticket: result.ticket || {}
  };
}

// Types pour les métadonnées
export const meta: MetaFunction = () => {
  return [
    { title: "Contactez-nous | Support Client" },
    {
      name: "description",
      content: "Contactez notre équipe support pour toute question sur vos commandes, produits ou services. Réponse rapide garantie."
    },
    { tagName: "link", rel: "canonical", href: "https://www.automecanik.com/contact" },
    { name: "robots", content: "index, follow" }
  ];
};

interface LoaderData {
  isAuthenticated: boolean;
  userEmail?: string;
  userName?: string;
  userId?: string;
  supportConfig: {
    phone: string;
    email: string;
    address: string;
    workingHours: string;
  };
}

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const session = await getSession(request);
  const userId = session.get("userId");
  
  const loaderData: LoaderData = {
    isAuthenticated: !!userId,
    userEmail: session.get("userEmail"),
    userName: session.get("userName"),
    userId: userId,
    supportConfig: {
      phone: "+33 1 23 45 67 89",
      email: "support@votre-entreprise.com",
      address: "123 Rue de l'Exemple\n75001 Paris\nFrance",
      workingHours: "Lun-Ven 9h-18h"
    }
  };
  
  return json(loaderData);
}

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const formData = await request.formData();
  const session = await getSession(request);
  
  // Validation des champs requis
  const fieldErrors: Record<string, string> = {};
  
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const subject = formData.get("subject") as string;
  const message = formData.get("message") as string;
  const category = formData.get("category") as string;
  
  if (!name || name.trim().length < 2) {
    fieldErrors.name = "Le nom doit contenir au moins 2 caractères";
  }
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Veuillez saisir une adresse email valide";
  }
  
  if (!subject || subject.trim().length < 5) {
    fieldErrors.subject = "L'objet doit contenir au moins 5 caractères";
  }
  
  if (!message || message.trim().length < 10) {
    fieldErrors.message = "Le message doit contenir au moins 10 caractères";
  }
  
  if (!category) {
    fieldErrors.category = "Veuillez sélectionner une catégorie";
  }
  
  if (Object.keys(fieldErrors).length > 0) {
    return json({ success: false, fieldErrors }, { status: 400 });
  }

  // Préparer les données de contact
  const contactData: ContactRequest = {
    name: name.trim(),
    email: email.trim(),
    phone: (formData.get("phone") as string)?.trim() || undefined,
    subject: subject.trim(),
    message: message.trim(),
    category: category as ContactRequest['category'],
    priority: (formData.get("priority") as ContactRequest['priority']) || 'normal',
    customerId: session.get("userId"),
    orderNumber: (formData.get("orderNumber") as string)?.trim() || undefined,
    vehicleInfo: {
      brand: (formData.get("vehicleBrand") as string)?.trim() || undefined,
      model: (formData.get("vehicleModel") as string)?.trim() || undefined,
      year: formData.get("vehicleYear") ? parseInt(formData.get("vehicleYear") as string) : undefined,
      licensePlate: (formData.get("licensePlate") as string)?.trim() || undefined,
    },
    ipAddress: request.headers.get("x-forwarded-for") || 
                request.headers.get("x-real-ip") || 
                request.headers.get("cf-connecting-ip"),
    userAgent: request.headers.get("user-agent"),
  };

  try {
    const result = await createContact(contactData);
    return json({ 
      success: true, 
      ticketNumber: result.ticketNumber,
      ticket: result.ticket 
    });
  } catch (error) {
    console.error("Erreur lors de la création du ticket:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Une erreur est survenue lors de l'envoi du message" 
    }, { status: 500 });
  }
}

export default function ContactPage() {
  const { isAuthenticated, userEmail, userName, supportConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showVehicleInfo, setShowVehicleInfo] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  const isSubmitting = navigation.state === "submitting";
  
  // Auto-scroll vers les erreurs
  useEffect(() => {
    if (actionData?.fieldErrors) {
      const firstErrorField = Object.keys(actionData.fieldErrors)[0];
      const element = document.getElementById(firstErrorField);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
    }
  }, [actionData?.fieldErrors]);

  // Gestion de l'upload progressif
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = file.type.match(/^(image|application\/pdf|text)/);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });
    
    if (validFiles.length !== files.length) {
      const rejected = files.length - validFiles.length;
      toast.warning(`${rejected} fichier(s) ignoré(s)`, {
        description: 'Type non supporté ou taille > 10MB',
        duration: 4000,
      });
    }
    
    setAttachments(prev => [...prev, ...validFiles].slice(0, 5)); // Max 5 fichiers
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Si le formulaire a été soumis avec succès
  if (actionData?.success && actionData.ticketNumber) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          {/* Breadcrumb */}
          <PublicBreadcrumb items={[{ label: "Contact" }]} />
          
          <div className="bg-white rounded-lg shadow-lg p-8 text-center border-t-4 border-green-500">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Message envoyé avec succès !</h2>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">Numéro de ticket</p>
              <p className="text-lg font-mono font-semibold text-gray-900">{actionData.ticketNumber}</p>
            </div>
            
            <div className="space-y-3 text-sm text-gray-600 mb-8">
              <p>Votre demande a été enregistrée et transmise à notre équipe support.</p>
              <p>Nous vous répondrons dans les plus brefs délais à l'adresse email indiquée.</p>
              <p className="font-medium">Temps de réponse moyen : 2-4 heures ouvrées</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button className="px-6 py-3   rounded-md" variant="blue" asChild><Link to="/">Retour à l'accueil</Link></Button>
              {isAuthenticated && (
                <Link 
                  to="/account/messages" 
                  className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 transition-colors"
                >
                  Mes messages
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header avec breadcrumb */}
        <div className="mb-8">
          <PublicBreadcrumb items={[
            { label: "Support", href: "/support" },
            { label: "Contact" }
          ]} />
          
          <h1 className="text-3xl font-bold text-gray-900">Contactez notre support</h1>
          <p className="mt-2 text-lg text-gray-600">
            Notre équipe est là pour vous aider. Décrivez votre demande et nous vous répondrons rapidement.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar avec informations */}
          <div className="lg:col-span-1 space-y-6">
            {/* Coordonnées */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center">
                <svg className="w-5 h-5 text-semantic-info mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Nos coordonnées
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Téléphone</p>
                    <p className="text-sm text-gray-600">{supportConfig.phone}</p>
                    <p className="text-xs text-gray-500">{supportConfig.workingHours}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <p className="text-sm text-gray-600">{supportConfig.email}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mt-1 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Adresse</p>
                    <pre className="text-sm text-gray-600 whitespace-pre-line">{supportConfig.address}</pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions rapides */}
<Alert className="rounded-lg p-4" variant="info">
              <h4 className="font-medium text-semantic-info mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Aide rapide
              </h4>
              <div className="space-y-3">
                <Link 
                  to="/support/faq" 
                  className="block text-sm font-medium text-semantic-info hover:text-semantic-info/80 hover:underline"
                >
                  📋 Consulter la FAQ →
                </Link>
                <Link 
                  to="/support/status" 
                  className="block text-sm font-medium text-semantic-info hover:text-semantic-info/80 hover:underline"
                >
                  🔍 Suivre une commande →
                </Link>
                <Link 
                  to="/support/returns" 
                  className="block text-sm font-medium text-semantic-info hover:text-semantic-info/80 hover:underline"
                >
                  ↩️ Politique de retour →
                </Link>
              </div>
            </Alert>

            {/* Statut du support */}
<Alert className="rounded-lg p-4" variant="success">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-success rounded-full mr-2"></div>
                <span className="text-sm font-medium text-green-800">Support disponible</span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                Temps de réponse moyen : 2-4h
              </p>
            </Alert>
          </div>

          {/* Formulaire principal */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <Form ref={formRef} method="post" className="space-y-6">
                {/* Erreur générale */}
                {actionData?.error && (
<Alert className="text-red-700 px-4 py-3 rounded-md" variant="error">
                    <div className="flex">
                      <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{actionData.error}</span>
                    </div>
                  </Alert>
                )}

                {/* Informations personnelles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Nom complet *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      defaultValue={userName || ""}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-semantic-info focus:border-semantic-info ${
                        actionData?.fieldErrors?.name ? 'border-red-300' : 'border-neutral-300'
                      }`}
                      placeholder="Votre nom complet"
                    />
                    {actionData?.fieldErrors?.name && (
                      <p className="mt-1 text-sm text-red-600">{actionData.fieldErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Adresse email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      defaultValue={userEmail || ""}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-semantic-info focus:border-semantic-info ${
                        actionData?.fieldErrors?.email ? 'border-red-300' : 'border-neutral-300'
                      }`}
                      placeholder="votre@email.com"
                    />
                    {actionData?.fieldErrors?.email && (
                      <p className="mt-1 text-sm text-red-600">{actionData.fieldErrors.email}</p>
                    )}
                  </div>
                </div>

                {/* Téléphone et catégorie */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-semantic-info focus:border-semantic-info"
                      placeholder="06 12 34 56 78"
                    />
                    <p className="mt-1 text-xs text-gray-500">Optionnel - pour un contact plus rapide</p>
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Catégorie *
                    </label>
                    <select
                      id="category"
                      name="category"
                      required
                      className={`w-full px-3 py-2 border rounded-md focus:ring-semantic-info focus:border-semantic-info ${
                        actionData?.fieldErrors?.category ? 'border-red-300' : 'border-neutral-300'
                      }`}
                    >
                      <option value="">Sélectionnez une catégorie</option>
                      <option value="general">Question générale</option>
                      <option value="order">Commande / Livraison</option>
                      <option value="product">Produit / Pièce détachée</option>
                      <option value="technical">Support technique</option>
                      <option value="billing">Facturation / Paiement</option>
                      <option value="commercial">Demande commerciale</option>
                      <option value="complaint">Réclamation / SAV</option>
                      <option value="suggestion">Suggestion d'amélioration</option>
                      <option value="other">Autre</option>
                    </select>
                    {actionData?.fieldErrors?.category && (
                      <p className="mt-1 text-sm text-red-600">{actionData.fieldErrors.category}</p>
                    )}
                  </div>
                </div>

                {/* Priorité et numéro de commande */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                      Priorité
                    </label>
                    <select
                      id="priority"
                      name="priority"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-semantic-info focus:border-semantic-info"
                    >
                      <option value="normal">Normale</option>
                      <option value="high">Haute</option>
                      <option value="urgent">Urgente</option>
                      <option value="low">Basse</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Numéro de commande
                    </label>
                    <input
                      type="text"
                      id="orderNumber"
                      name="orderNumber"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-semantic-info focus:border-semantic-info"
                      placeholder="CMD-2024-001234"
                    />
                    <p className="mt-1 text-xs text-gray-500">Si votre demande concerne une commande</p>
                  </div>
                </div>

                {/* Objet */}
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Objet de votre demande *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:ring-semantic-info focus:border-semantic-info ${
                      actionData?.fieldErrors?.subject ? 'border-red-300' : 'border-neutral-300'
                    }`}
                    placeholder="Résumez votre demande en quelques mots"
                  />
                  {actionData?.fieldErrors?.subject && (
                    <p className="mt-1 text-sm text-red-600">{actionData.fieldErrors.subject}</p>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    Description détaillée *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={6}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:ring-semantic-info focus:border-semantic-info ${
                      actionData?.fieldErrors?.message ? 'border-red-300' : 'border-neutral-300'
                    }`}
                    placeholder="Décrivez votre demande de manière détaillée. Plus vous donnerez d'informations, plus nous pourrons vous aider efficacement."
                  />
                  {actionData?.fieldErrors?.message && (
                    <p className="mt-1 text-sm text-red-600">{actionData.fieldErrors.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Minimum 10 caractères</p>
                </div>

                {/* Options avancées */}
                <div className="border-t pt-6">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <svg 
                      className={`w-4 h-4 mr-2 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Options avancées {showAdvancedOptions ? '(masquer)' : '(afficher)'}
                  </button>

                  {showAdvancedOptions && (
                    <div className="mt-4 space-y-6">
                      {/* Informations véhicule */}
                      <div>
                        <div className="flex items-center mb-4">
                          <input
                            type="checkbox"
                            id="showVehicleInfo"
                            checked={showVehicleInfo}
                            onChange={(e) => setShowVehicleInfo(e.target.checked)}
                            className="rounded border-neutral-300 text-semantic-info focus:ring-semantic-info"
                          />
                          <label htmlFor="showVehicleInfo" className="ml-2 text-sm font-medium text-gray-700">
                            Ma demande concerne un véhicule spécifique
                          </label>
                        </div>

                        {showVehicleInfo && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md">
                            <div>
                              <label htmlFor="vehicleBrand" className="block text-sm font-medium text-gray-700 mb-1">
                                Marque
                              </label>
                              <input
                                type="text"
                                id="vehicleBrand"
                                name="vehicleBrand"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-semantic-info focus:border-semantic-info"
                                placeholder="Peugeot, Renault, etc."
                              />
                            </div>

                            <div>
                              <label htmlFor="vehicleModel" className="block text-sm font-medium text-gray-700 mb-1">
                                Modèle
                              </label>
                              <input
                                type="text"
                                id="vehicleModel"
                                name="vehicleModel"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-semantic-info focus:border-semantic-info"
                                placeholder="308, Clio, etc."
                              />
                            </div>

                            <div>
                              <label htmlFor="vehicleYear" className="block text-sm font-medium text-gray-700 mb-1">
                                Année
                              </label>
                              <input
                                type="number"
                                id="vehicleYear"
                                name="vehicleYear"
                                min="1900"
                                max="2030"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-semantic-info focus:border-semantic-info"
                                placeholder="2020"
                              />
                            </div>

                            <div>
                              <label htmlFor="licensePlate" className="block text-sm font-medium text-gray-700 mb-1">
                                Plaque d'immatriculation
                              </label>
                              <input
                                type="text"
                                id="licensePlate"
                                name="licensePlate"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-semantic-info focus:border-semantic-info"
                                placeholder="AB-123-CD"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Pièces jointes */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pièces jointes
                        </label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-neutral-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                          <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex text-sm text-gray-600">
                              <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-semantic-info hover:text-semantic-info/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-semantic-info">
                                <span>Cliquez pour ajouter des fichiers</span>
                                <input
                                  id="file-upload"
                                  name="file-upload"
                                  type="file"
                                  multiple
                                  accept="image/*,application/pdf,.txt,.doc,.docx"
                                  className="sr-only"
                                  onChange={handleFileChange}
                                />
                              </label>
                              <p className="pl-1">ou glissez-déposez</p>
                            </div>
                            <p className="text-xs text-gray-500">
                              Images, PDF, documents jusqu'à 10MB chacun (max 5 fichiers)
                            </p>
                          </div>
                        </div>

                        {/* Liste des fichiers sélectionnés */}
                        {attachments.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Fichiers sélectionnés :</p>
                            <div className="space-y-2">
                              {attachments.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                  <div className="flex items-center">
                                    <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <span className="text-sm text-gray-700">{file.name}</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      ({(file.size / 1024 / 1024).toFixed(1)} MB)
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeAttachment(index)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* GDPR et soumission */}
                <div className="border-t pt-6">
                  <div className="flex items-start mb-6">
                    <input
                      type="checkbox"
                      id="gdpr"
                      required
                      className="rounded border-neutral-300 text-semantic-info focus:ring-semantic-info mt-1"
                    />
                    <label htmlFor="gdpr" className="ml-2 text-sm text-gray-600">
                      J'accepte que mes données personnelles soient utilisées pour traiter ma demande conformément à notre{" "}
                      <Link to="/legal/privacy" className="text-semantic-info hover:underline">
                        politique de confidentialité
                      </Link>
                      . *
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      * Champs obligatoires
                    </p>
                    <Button className="relative px-8 py-3   rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" variant="blue" type="submit"
                      disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Envoi en cours...
                        </>
                      ) : (
                        "Envoyer le message"
                      )}
                    </Button>
                  </div>
                </div>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
