/**
 * SettingsAccordion - Composant pour les paramètres admin avec sections pliables
 * 
 * @features
 * - Paramètres du compte (nom, email, mot de passe)
 * - Paramètres de notifications (email, push, SMS)
 * - Paramètres de sécurité (2FA, sessions, logs)
 * - Sauvegarde automatique des modifications
 * - Indicateur de changements non sauvegardés
 * 
 * @example
 * <SettingsAccordion
 *   settings={userSettings}
 *   onSettingChange={handleSettingChange}
 *   onSave={handleSave}
 * />
 */

import { User, Bell, Shield, Check, AlertCircle, Save } from 'lucide-react';
import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';

export interface AccountSettings {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  language: 'fr' | 'en';
}

export interface NotificationSettings {
  emailOrders: boolean;
  emailPromotions: boolean;
  emailNewsletter: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number; // en minutes
  showLoginHistory: boolean;
  allowMultipleSessions: boolean;
}

export interface AllSettings {
  account: AccountSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
}

interface SettingsAccordionProps {
  /** Paramètres actuels */
  settings: AllSettings;
  /** Callback lors du changement d'un paramètre */
  onSettingChange?: (settings: AllSettings) => void;
  /** Callback pour sauvegarder */
  onSave?: () => void;
  /** Indique si des changements sont en attente */
  hasUnsavedChanges?: boolean;
  /** Classe CSS personnalisée */
  className?: string;
}

export function SettingsAccordion({
  settings,
  onSettingChange,
  onSave,
  hasUnsavedChanges = false,
  className = '',
}: SettingsAccordionProps) {
  const [localSettings, setLocalSettings] = useState<AllSettings>(settings);

  const updateSettings = (newSettings: AllSettings) => {
    setLocalSettings(newSettings);
    onSettingChange?.(newSettings);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header avec indicateur de changements */}
      {hasUnsavedChanges && (
        <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-900">
              Vous avez des modifications non sauvegardées
            </span>
          </div>
          <button
            onClick={onSave}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            <Save className="h-4 w-4" />
            Enregistrer
          </button>
        </div>
      )}

      {/* Accordéons de paramètres */}
      <Accordion type="multiple" defaultValue={['account']} className="space-y-2">
        {/* Paramètres du compte */}
        <AccordionItem
          value="account"
          className="rounded-lg border border-gray-200 bg-white px-4 shadow-sm"
        >
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">Compte</h3>
                <p className="text-xs text-gray-500">
                  Informations personnelles et préférences
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6 pt-2">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Prénom
                  </label>
                  <input
                    type="text"
                    value={localSettings.account.firstName}
                    onChange={(e) =>
                      updateSettings({
                        ...localSettings,
                        account: {
                          ...localSettings.account,
                          firstName: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={localSettings.account.lastName}
                    onChange={(e) =>
                      updateSettings({
                        ...localSettings,
                        account: {
                          ...localSettings.account,
                          lastName: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={localSettings.account.email}
                  onChange={(e) =>
                    updateSettings({
                      ...localSettings,
                      account: {
                        ...localSettings.account,
                        email: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Téléphone (optionnel)
                </label>
                <input
                  type="tel"
                  value={localSettings.account.phone || ''}
                  onChange={(e) =>
                    updateSettings({
                      ...localSettings,
                      account: {
                        ...localSettings.account,
                        phone: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="+33 6 12 34 56 78"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Langue
                </label>
                <select
                  value={localSettings.account.language}
                  onChange={(e) =>
                    updateSettings({
                      ...localSettings,
                      account: {
                        ...localSettings.account,
                        language: e.target.value as 'fr' | 'en',
                      },
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Paramètres de notifications */}
        <AccordionItem
          value="notifications"
          className="rounded-lg border border-gray-200 bg-white px-4 shadow-sm"
        >
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                <Bell className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
                <p className="text-xs text-gray-500">
                  Gérer vos préférences de communication
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6 pt-2">
            <div className="space-y-3">
              {[
                {
                  key: 'emailOrders' as const,
                  label: 'Commandes par email',
                  description: 'Confirmation et suivi de commandes',
                },
                {
                  key: 'emailPromotions' as const,
                  label: 'Promotions par email',
                  description: 'Offres spéciales et réductions',
                },
                {
                  key: 'emailNewsletter' as const,
                  label: 'Newsletter',
                  description: 'Actualités et nouveautés',
                },
                {
                  key: 'pushNotifications' as const,
                  label: 'Notifications push',
                  description: 'Alertes instantanées sur votre appareil',
                },
                {
                  key: 'smsNotifications' as const,
                  label: 'Notifications SMS',
                  description: 'Alertes importantes par SMS',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                >
                  <div
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      localSettings.notifications[item.key]
                        ? 'border-purple-600 bg-purple-600'
                        : 'border-gray-300'
                    }`}
                  >
                    {localSettings.notifications[item.key] && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.notifications[item.key]}
                    onChange={(e) =>
                      updateSettings({
                        ...localSettings,
                        notifications: {
                          ...localSettings.notifications,
                          [item.key]: e.target.checked,
                        },
                      })
                    }
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Paramètres de sécurité */}
        <AccordionItem
          value="security"
          className="rounded-lg border border-gray-200 bg-white px-4 shadow-sm"
        >
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">Sécurité</h3>
                <p className="text-xs text-gray-500">
                  Authentification et confidentialité
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6 pt-2">
            <div className="space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                <div
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    localSettings.security.twoFactorEnabled
                      ? 'border-green-600 bg-green-600'
                      : 'border-gray-300'
                  }`}
                >
                  {localSettings.security.twoFactorEnabled && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.security.twoFactorEnabled}
                  onChange={(e) =>
                    updateSettings({
                      ...localSettings,
                      security: {
                        ...localSettings.security,
                        twoFactorEnabled: e.target.checked,
                      },
                    })
                  }
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    Authentification à deux facteurs (2FA)
                  </div>
                  <div className="text-xs text-gray-500">
                    Renforcez la sécurité de votre compte
                  </div>
                </div>
              </label>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Timeout de session (minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={localSettings.security.sessionTimeout}
                  onChange={(e) =>
                    updateSettings({
                      ...localSettings,
                      security: {
                        ...localSettings.security,
                        sessionTimeout: parseInt(e.target.value) || 30,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                <div
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    localSettings.security.showLoginHistory
                      ? 'border-green-600 bg-green-600'
                      : 'border-gray-300'
                  }`}
                >
                  {localSettings.security.showLoginHistory && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.security.showLoginHistory}
                  onChange={(e) =>
                    updateSettings({
                      ...localSettings,
                      security: {
                        ...localSettings.security,
                        showLoginHistory: e.target.checked,
                      },
                    })
                  }
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    Afficher l'historique de connexion
                  </div>
                  <div className="text-xs text-gray-500">
                    Voir les dernières connexions à votre compte
                  </div>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                <div
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    localSettings.security.allowMultipleSessions
                      ? 'border-green-600 bg-green-600'
                      : 'border-gray-300'
                  }`}
                >
                  {localSettings.security.allowMultipleSessions && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.security.allowMultipleSessions}
                  onChange={(e) =>
                    updateSettings({
                      ...localSettings,
                      security: {
                        ...localSettings.security,
                        allowMultipleSessions: e.target.checked,
                      },
                    })
                  }
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    Autoriser plusieurs sessions
                  </div>
                  <div className="text-xs text-gray-500">
                    Connectez-vous sur plusieurs appareils simultanément
                  </div>
                </div>
              </label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
