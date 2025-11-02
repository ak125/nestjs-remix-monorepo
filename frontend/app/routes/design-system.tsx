import { CheckCircle, XCircle, AlertTriangle, Info, Plus, Trash2, Download } from 'lucide-react';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';

export default function DesignSystemDemo() {
  return (
    <div className="container mx-auto p-8 space-y-12">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Design System Demo</h1>
        <p className="text-lg text-gray-600">
          Démonstration des composants avec les tokens sémantiques
        </p>
      </div>

      {/* Alert Section */}
      <section className="space-y-6">
        <div className="border-b pb-2">
          <h2 className="text-2xl font-semibold">Alert Component</h2>
          <p className="text-sm text-gray-500">Variantes: success, error, warning, info</p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Success Alert</h3>
            <Alert className="border-success-500 bg-success-50 text-success-900">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Opération réussie ! Vos modifications ont été enregistrées.
              </AlertDescription>
            </Alert>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Error Alert</h3>
            <Alert className="border-error-500 bg-error-50 text-error-900">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Une erreur est survenue lors du traitement de votre demande.
              </AlertDescription>
            </Alert>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Warning Alert</h3>
            <Alert className="border-warning-500 bg-warning-50 text-warning-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Attention : Cette action nécessite une confirmation.
              </AlertDescription>
            </Alert>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Info Alert</h3>
            <Alert className="border-info-500 bg-info-50 text-info-900">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Nouvelle fonctionnalité disponible ! Découvrez les dernières mises à jour.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </section>

      {/* Badge Section */}
      <section className="space-y-6">
        <div className="border-b pb-2">
          <h2 className="text-2xl font-semibold">Badge Component</h2>
          <p className="text-sm text-gray-500">10 variantes disponibles</p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Standard Variants</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Semantic Variants</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Succès</Badge>
              <Badge variant="warning">Avertissement</Badge>
              <Badge variant="info">Information</Badge>
              <Badge variant="error">Erreur</Badge>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Branding Variants</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="purple">Hybride</Badge>
              <Badge variant="orange">Diesel</Badge>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Note: Purple/Orange = Couleurs de branding intentionnelles (véhicules hybrides/diesel)
            </p>
          </div>
        </div>
      </section>

      {/* Button Section */}
      <section className="space-y-6">
        <div className="border-b pb-2">
          <h2 className="text-2xl font-semibold">Button Component</h2>
          <p className="text-sm text-gray-500">16 variantes + 4 tailles</p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Primary Variants</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="default">Default</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Outline Variants</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="greenOutline">Green Outline</Button>
              <Button variant="redOutline">Red Outline</Button>
              <Button variant="blueOutline">Blue Outline</Button>
              <Button variant="outline">Outline</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Design System Colors</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="blue">Blue</Button>
              <Button variant="green">Green</Button>
              <Button variant="red">Red</Button>
              <Button variant="yellow">Yellow</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Branding Colors</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="purple">Purple (Hybride)</Button>
              <Button variant="orange">Orange (Diesel)</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Special Variants</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button variant="oauth">OAuth</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Sizes</h3>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary" size="default">Default</Button>
              <Button variant="primary" size="lg">Large</Button>
              <Button variant="primary" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">With Icons</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4" />
                Supprimer
              </Button>
              <Button variant="blue">
                <Download className="h-4 w-4" />
                Télécharger
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">States</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">Normal</Button>
              <Button variant="primary" disabled>Disabled</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gray-50 rounded-lg p-6 space-y-4">
        <h2 className="text-2xl font-semibold">Migration Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-3xl font-bold text-success-600">95.4%</div>
            <div className="text-sm text-gray-600">Tokens sémantiques</div>
            <div className="text-xs text-gray-500 mt-1">2,115 / 2,217 migrations</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-3xl font-bold text-purple-600">4.6%</div>
            <div className="text-sm text-gray-600">Branding documenté</div>
            <div className="text-xs text-gray-500 mt-1">102 / 2,217 (purple/orange)</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-3xl font-bold text-blue-600">100%</div>
            <div className="text-sm text-gray-600">Build success</div>
            <div className="text-xs text-gray-500 mt-1">31/31 batches</div>
          </div>
        </div>
      </section>

      {/* Documentation Link */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Documentation</h2>
        <p className="text-sm text-gray-700 mb-4">
          Pour plus d'informations sur la migration et les tokens sémantiques :
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li>MIGRATION-REPORT.md - Rapport détaillé de migration</li>
          <li>BRANDING-COLORS.md - Documentation purple/orange</li>
          <li>MIGRATION-STATS.json - Statistiques complètes</li>
        </ul>
      </section>
    </div>
  );
}
