/**
 * Dashboard Design System Tab — extracted from admin._index.tsx
 */
import {
  Palette,
  Package,
  FileText,
  Code,
  Play,
  Eye,
  CheckCircle,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";

export function DashboardDesignTab() {
  return (
    <div className="space-y-6">
      {/* Header Design System */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-purple-100 p-3 rounded-lg">
            <Palette className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-purple-900">
              Design System Manager
            </h2>
            <p className="text-purple-600">
              Gestion centralisée des tokens, styles et composants
            </p>
          </div>
          <Badge variant="success" size="sm" className="ml-auto">
            @fafa/design-tokens v1.0.0
          </Badge>
        </div>
      </div>

      {/* Statistiques Design System */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-purple-200">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="h-5 w-5 text-purple-600" />
            <span className="font-medium">Couleurs</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">120+</div>
          <div className="text-sm text-gray-600 mt-2">Tokens de couleur</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-5 w-5 text-blue-600" />
            <span className="font-medium">Spacing</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">30+</div>
          <div className="text-sm text-gray-600 mt-2">Tokens d'espacement</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-5 w-5 text-green-600" />
            <span className="font-medium">Typography</span>
          </div>
          <div className="text-2xl font-bold text-green-900">15+</div>
          <div className="text-sm text-gray-600 mt-2">Tokens de typo</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-orange-200">
          <div className="flex items-center gap-2 mb-3">
            <Code className="h-5 w-5 text-orange-600" />
            <span className="font-medium">Build Status</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <span className="text-lg font-bold text-green-900">Ready</span>
          </div>
        </div>
      </div>

      {/* Actions rapides Design System */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Play className="h-5 w-5 text-blue-600" />
            Commandes de Build
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => {
                const command = "cd packages/design-tokens && npm run build";
                navigator.clipboard.writeText(command);
                toast.success("Commande copiée !", {
                  description: command,
                  duration: 3000,
                });
              }}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-200 rounded-lg transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary p-2 rounded-lg">
                  <Play className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Build Tokens</p>
                  <p className="text-xs text-gray-600">Copier la commande</p>
                </div>
              </div>
              <Badge variant="outline">npm run build</Badge>
            </button>

            <button
              onClick={() => {
                window.open("http://localhost:3001", "_blank");
              }}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border border-green-200 rounded-lg transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-success p-2 rounded-lg">
                  <Eye className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Preview Frontend</p>
                  <p className="text-xs text-gray-600">
                    Voir l'application en direct
                  </p>
                </div>
              </div>
              <Badge variant="success" size="sm">
                Port 3001
              </Badge>
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  "cd packages/design-tokens && npm run build",
                );
                toast.success("Commande copiée !", { duration: 2000 });
              }}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border border-purple-200 rounded-lg transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-purple-600 p-2 rounded-lg">
                  <Code className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Copier Commande</p>
                  <p className="text-xs text-gray-600">Terminal command</p>
                </div>
              </div>
              <Badge variant="outline">Copier</Badge>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            Documentation
          </h3>
          <div className="space-y-3">
            <a
              href="https://github.com/ak125/nestjs-remix-monorepo/blob/main/DESIGN-SYSTEM-USAGE-GUIDE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-gray-900">
                  Guide d'utilisation
                </span>
              </div>
              <Badge variant="outline">GitHub</Badge>
            </a>

            <a
              href="https://github.com/ak125/nestjs-remix-monorepo/blob/main/DESIGN-SYSTEM-QUICK-REF.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="font-medium text-gray-900">
                  Quick Reference
                </span>
              </div>
              <Badge variant="success">Aide-mémoire</Badge>
            </a>

            <a
              href="https://github.com/ak125/nestjs-remix-monorepo/blob/main/packages/design-tokens/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors"
            >
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-gray-900">
                  Package README
                </span>
              </div>
              <Badge variant="outline">Technique</Badge>
            </a>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-1">Astuce</p>
              <p className="text-xs text-blue-700">
                Utilisez les tokens sémantiques (p-md, bg-primary-500) plutôt
                que des valeurs hardcodées
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Aperçu des Tokens */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5 text-purple-600" />
          Palette de Couleurs
        </h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              name: "Primary (Navy)",
              color: "bg-primary-500",
              hex: "#0F1E38",
              token: "primary-500",
              usage: "Navigation, liens, UI structurelle",
            },
            {
              name: "CTA (Orange)",
              color: "bg-cta",
              hex: "#F97316",
              token: "cta",
              usage: "Boutons d'action, CTA, conversion",
            },
            {
              name: "Success",
              color: "bg-success",
              hex: "#27AE60",
              token: "success",
              usage: "Validations, succès",
            },
            {
              name: "Warning",
              color: "bg-warning",
              hex: "#F39C12",
              token: "warning",
              usage: "Alertes, attention",
            },
            {
              name: "Error",
              color: "bg-error",
              hex: "#C0392B",
              token: "error",
              usage: "Erreurs, incompatibilité",
            },
            {
              name: "Info",
              color: "bg-info",
              hex: "#3498DB",
              token: "info",
              usage: "Informations",
            },
          ].map((c) => (
            <div key={c.token} className="space-y-2">
              <h4 className="font-medium text-gray-900 mb-3">{c.name}</h4>
              <div className="flex items-center gap-2">
                <div
                  className={`w-12 h-12 rounded-lg ${c.color} shadow-md`}
                ></div>
                <div>
                  <p className="text-sm font-medium">{c.hex}</p>
                  <p className="text-xs text-gray-600">{c.token}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">{c.usage}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Spacing Grid */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" />
          Échelle d'Espacement (8px Grid)
        </h3>
        <div className="space-y-4">
          {[
            {
              name: "XS",
              value: "4px",
              class: "p-xs",
              usage: "Micro-espaces (badges)",
            },
            {
              name: "SM",
              value: "8px",
              class: "p-sm",
              usage: "Serré (label → input)",
            },
            {
              name: "MD",
              value: "16px",
              class: "p-md",
              usage: "Standard (padding cartes)",
            },
            {
              name: "LG",
              value: "24px",
              class: "p-lg",
              usage: "Sections/blocs",
            },
            {
              name: "XL",
              value: "32px",
              class: "p-xl",
              usage: "Grilles/marges",
            },
            {
              name: "2XL",
              value: "40px",
              class: "p-2xl",
              usage: "Large grilles",
            },
            {
              name: "3XL",
              value: "48px",
              class: "p-3xl",
              usage: "Hero sections",
            },
          ].map((spacing, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
            >
              <div
                className="bg-primary-500 rounded"
                style={{ width: spacing.value, height: "32px" }}
              ></div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900 w-12">
                    {spacing.name}
                  </span>
                  <code className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">
                    {spacing.class}
                  </code>
                  <span className="text-sm text-gray-600">{spacing.value}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{spacing.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography Preview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-green-600" />
          Typographie
        </h3>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-2">
              Headings - Outfit (font-heading)
            </p>
            <h1 className="font-heading font-bold text-3xl">
              Titre Principal H1
            </h1>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-2">
              Body - Inter (font-sans)
            </p>
            <p className="font-sans text-base">
              Texte de description avec une lisibilité optimale pour le contenu
              principal de l'application.
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-2">
              Data - Roboto Mono (font-mono)
            </p>
            <code className="font-mono text-sm">
              Réf OEM: 7701208265 | Stock: 42 unités | 149,99 €
            </code>
          </div>
        </div>
      </div>

      {/* Exemples de Composants */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Code className="h-5 w-5 text-orange-600" />
          Exemples de Composants
        </h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Bouton CTA</h4>
            <button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
              Ajouter au panier
            </button>
            <code className="block text-xs bg-gray-100 p-2 rounded">
              className="bg-primary-500 hover:bg-primary-600"
            </code>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Badge Compatible</h4>
            <span className="inline-flex bg-success text-white px-4 py-2 rounded-full text-sm">
              Compatible
            </span>
            <code className="block text-xs bg-gray-100 p-2 rounded">
              className="bg-success text-white"
            </code>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Alerte Délai</h4>
            <div className="bg-warning/10 border border-warning text-warning-foreground p-4 rounded-md">
              Livraison sous 5-7 jours
            </div>
            <code className="block text-xs bg-gray-100 p-2 rounded">
              className="bg-warning/10 border border-warning"
            </code>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Card Produit</h4>
            <div className="bg-white border border-neutral-200 rounded-lg shadow-md p-4">
              <h5 className="font-heading font-bold mb-2">
                Plaquettes de frein
              </h5>
              <p className="font-mono text-sm text-gray-600 mb-2">
                Réf: 7701208265
              </p>
              <p className="font-mono text-xl font-bold">45,99 €</p>
            </div>
            <code className="block text-xs bg-gray-100 p-2 rounded">
              className="bg-white border rounded-lg p-4"
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
