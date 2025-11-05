/**
 * 🍞 Page de démo Breadcrumb (Fil d'Ariane)
 * Exemples d'utilisation du composant Breadcrumb de Shadcn UI
 */

import { Link } from "@remix-run/react";
import { Home, ChevronRight, Slash } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
  BreadcrumbEllipsis,
} from "~/components/ui/breadcrumb";

export default function BreadcrumbDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">
            🍞 Démo Breadcrumb
          </h1>
          <p className="text-slate-600">
            Composant fil d'Ariane pour navigation contextuelle
          </p>
        </div>

        {/* Exemple 1 : Breadcrumb simple */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">
            1️⃣ Breadcrumb simple
          </h2>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Accueil</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/products">Produits</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Amortisseurs</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Exemple 2 : Avec icône Home */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">
            2️⃣ Avec icône Home
          </h2>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/" className="flex items-center gap-1">
                    <Home className="h-4 w-4" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/admin">Admin</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/admin/orders">Commandes</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>#12345</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Exemple 3 : Séparateur personnalisé (slash) */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">
            3️⃣ Séparateur personnalisé (/)
          </h2>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Accueil</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <Slash className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/catalog">Catalogue</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <Slash className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>Freinage</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Exemple 4 : Avec ellipsis (chemin tronqué) */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">
            4️⃣ Avec ellipsis (chemin long)
          </h2>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Accueil</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbEllipsis />
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/catalog/category">Catégorie</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Produit final</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Exemple 5 : Navigation e-commerce complète */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">
            5️⃣ Navigation e-commerce complète
          </h2>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/" className="flex items-center gap-1">
                    <Home className="h-4 w-4" />
                    <span>Accueil</span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/catalog">Pièces auto</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/catalog/freinage">Freinage</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/catalog/freinage/disques">Disques de frein</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>BREMBO 09.9772.11</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Exemple 6 : Admin dashboard */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">
            6️⃣ Admin Dashboard
          </h2>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/admin" className="flex items-center gap-1">
                    <Home className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/admin/orders">Gestion commandes</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Commande #12345</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Guide d'utilisation */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            📚 Guide d'utilisation
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✅ <strong>BreadcrumbLink</strong> : Utiliser <code>asChild</code> avec Link de Remix</li>
            <li>✅ <strong>BreadcrumbPage</strong> : Page actuelle (non cliquable)</li>
            <li>✅ <strong>BreadcrumbSeparator</strong> : Accepte des icônes personnalisées</li>
            <li>✅ <strong>BreadcrumbEllipsis</strong> : Pour tronquer les chemins longs</li>
            <li>✅ <strong>Accessibilité</strong> : aria-label, role="link", aria-current="page"</li>
            <li>✅ <strong>Responsive</strong> : flex-wrap automatique sur mobile</li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Link 
            to="/test/sonner" 
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
          >
            ← Retour Sonner
          </Link>
          <Link 
            to="/" 
            className="text-slate-600 hover:text-slate-700 font-medium flex items-center gap-2"
          >
            Accueil →
          </Link>
        </div>

      </div>
    </div>
  );
}
