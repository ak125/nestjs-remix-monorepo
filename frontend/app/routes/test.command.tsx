/**
 * 🔍 Test Page - Command Palette & Global Search
 * 
 * Démo du système de recherche globale avec:
 * - Raccourci Cmd+K / Ctrl+K
 * - Recherche en temps réel
 * - Filtres par catégorie
 * - Historique persistant
 * - Navigation clavier
 */

import { type MetaFunction } from '@remix-run/node';
import { Command, FileText, Package, Search, Settings, ShoppingCart, Users } from 'lucide-react';
import { useState } from 'react';

import { GlobalSearch } from '../components/layout/GlobalSearch';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Command as CommandUI,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../components/ui/command';
import { Separator } from '../components/ui/separator';

export const meta: MetaFunction = () => {
  return [{ title: 'Test Command Palette - Global Search' }];
};

export default function TestCommand() {
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isCommandDialogOpen, setIsCommandDialogOpen] = useState(false);

  return (
    <div className="container mx-auto py-12 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">🔍 Command Palette & Global Search</h1>
        <p className="text-gray-600 text-lg">
          Système de recherche globale avec raccourcis clavier Cmd+K / Ctrl+K
        </p>
      </div>

      {/* Statut du système */}
      <section className="mb-12 bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-600 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          ✅ Système Command/Search - Version Améliorée
        </h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Composants installés:</h3>
            <ul className="space-y-1 text-sm">
              <li>✅ <code className="bg-gray-100 px-2 py-0.5 rounded">command.tsx</code> (Shadcn UI)</li>
              <li>✅ <code className="bg-gray-100 px-2 py-0.5 rounded">GlobalSearch.tsx</code> (547 lignes)</li>
              <li>✅ <code className="bg-gray-100 px-2 py-0.5 rounded">useCommandPalette.ts</code> hook</li>
              <li>✅ <code className="bg-gray-100 px-2 py-0.5 rounded">/api/search/global</code> endpoint</li>
              <li>🆕 <code className="bg-blue-100 px-2 py-0.5 rounded text-blue-700">Navbar intégration</code></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">🆕 Nouvelles features:</h3>
            <ul className="space-y-1 text-sm">
              <li>⭐ Surlignage termes de recherche (jaune)</li>
              <li>🔢 Compteurs de résultats par catégorie</li>
              <li>⌨️ Raccourcis Cmd+1 à Cmd+6 (catégories)</li>
              <li>✨ Animations d'entrée/sortie</li>
              <li>🎨 UI améliorée avec gradients</li>
              <li>� Responsive optimisé</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-green-200 bg-white/50 p-3 rounded">
          <h3 className="font-semibold mb-2 text-sm">⚡ Optimisations performance:</h3>
          <ul className="grid md:grid-cols-3 gap-2 text-xs">
            <li>• Debounce 300ms</li>
            <li>• useCallback partout</li>
            <li>• Animation GPU (transform)</li>
            <li>• LocalStorage async</li>
            <li>• Lazy rendering résultats</li>
            <li>• Scroll virtualisé (max 20)</li>
          </ul>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Exemple 1: GlobalSearch (système principal) */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-4">1. GlobalSearch Component</h2>
        <p className="text-gray-600 mb-6">
          Système de recherche principale intégré dans la Navbar. Recherche multi-catégories avec historique.
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Button
              onClick={() => setIsGlobalSearchOpen(true)}
              className="w-full justify-between"
              variant="outline"
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                Ouvrir GlobalSearch
              </span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">📦 Catégories disponibles:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Produits</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-600" />
                  <span>Utilisateurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-purple-600" />
                  <span>Commandes</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-600" />
                  <span>Pages</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-600" />
                  <span>Paramètres</span>
                </div>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <span>Tout</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">⚡ Performance:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Debounce: 300ms (pas de spam API)</li>
                <li>• Limite: 20 résultats max</li>
                <li>• Historique: 10 dernières recherches</li>
                <li>• Délai API simulé: 200ms</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold mb-3">🎮 Navigation clavier:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Ouvrir/Fermer</span>
                  <Badge variant="outline">Cmd+K / Ctrl+K</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Descendre</span>
                  <Badge variant="outline">↓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Remonter</span>
                  <Badge variant="outline">↑</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sélectionner</span>
                  <Badge variant="outline">Enter</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fermer</span>
                  <Badge variant="outline">Esc</Badge>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold mb-3">🆕 Raccourcis catégories:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Tout</span>
                  <Badge variant="outline" className="bg-white">Cmd+1</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Produits</span>
                  <Badge variant="outline" className="bg-white">Cmd+2</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Utilisateurs</span>
                  <Badge variant="outline" className="bg-white">Cmd+3</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Commandes</span>
                  <Badge variant="outline" className="bg-white">Cmd+4</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pages</span>
                  <Badge variant="outline" className="bg-white">Cmd+5</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Paramètres</span>
                  <Badge variant="outline" className="bg-white">Cmd+6</Badge>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">📝 Historique:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Sauvegarde automatique dans localStorage</li>
                <li>• Affichage si champ vide</li>
                <li>• Clic pour recharger recherche</li>
                <li>• Bouton "Effacer l'historique"</li>
              </ul>
            </div>

            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">🔗 Intégration Navbar:</h3>
              <p className="text-sm mb-2">
                Le bouton de recherche est maintenant visible dans la Navbar principale:
              </p>
              <ul className="space-y-1 text-sm">
                <li>• Desktop: Bouton "Recherche ⌘K"</li>
                <li>• Mobile: Icône loupe simple</li>
                <li>• Raccourci global actif partout</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Exemple 2: CommandDialog basique */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-4">2. CommandDialog (Shadcn Primitives)</h2>
        <p className="text-gray-600 mb-6">
          Composant de base Shadcn pour créer des command palettes custom.
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <Button
              onClick={() => setIsCommandDialogOpen(true)}
              className="w-full"
              variant="outline"
            >
              <Command className="w-4 h-4 mr-2" />
              Ouvrir CommandDialog
            </Button>

            <div className="mt-6 bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
              <h3 className="font-semibold mb-2">🧩 Composants Shadcn:</h3>
              <ul className="space-y-1 text-sm font-mono">
                <li>• CommandDialog</li>
                <li>• CommandInput</li>
                <li>• CommandList</li>
                <li>• CommandEmpty</li>
                <li>• CommandGroup</li>
                <li>• CommandItem</li>
                <li>• CommandSeparator</li>
                <li>• CommandShortcut</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold mb-3">💡 Cas d'usage:</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <strong>GlobalSearch:</strong> Recherche universelle multi-catégories (produits, users, commandes)
              </li>
              <li>
                <strong>Command Palette:</strong> Actions rapides admin (créer produit, voir stats, export)
              </li>
              <li>
                <strong>Filtres avancés:</strong> Interface de filtrage complex avec groupes
              </li>
              <li>
                <strong>Navigation:</strong> Jump to page/section rapide
              </li>
            </ul>
          </div>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Exemple 3: Inline Command */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-4">3. Inline Command (Sans Dialog)</h2>
        <p className="text-gray-600 mb-6">
          Version inline pour intégration dans une page (ex: filtres sidebar).
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <CommandUI className="rounded-lg border shadow-md">
            <CommandInput placeholder="Rechercher une action..." />
            <CommandList>
              <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
              
              <CommandGroup heading="Suggestions">
                <CommandItem>
                  <Package className="mr-2 h-4 w-4" />
                  <span>Nouveau produit</span>
                  <CommandShortcut>⌘N</CommandShortcut>
                </CommandItem>
                <CommandItem>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Gérer les utilisateurs</span>
                </CommandItem>
                <CommandItem>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  <span>Voir les commandes</span>
                  <CommandShortcut>⌘O</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              
              <CommandSeparator />
              
              <CommandGroup heading="Paramètres">
                <CommandItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Préférences</span>
                  <CommandShortcut>⌘,</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </CommandUI>

          <div className="space-y-4">
            <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded">
              <h3 className="font-semibold mb-2">🎯 Avantages inline:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Pas de modal (intégré dans la page)</li>
                <li>• Parfait pour filtres sidebar</li>
                <li>• Navigation contextuelle</li>
                <li>• Groupes visuels clairs</li>
              </ul>
            </div>

            <div className="bg-gray-100 p-4 rounded">
              <h3 className="font-semibold mb-2">📦 Code minimal:</h3>
              <pre className="text-xs overflow-x-auto">
{`<Command>
  <CommandInput />
  <CommandList>
    <CommandGroup>
      <CommandItem>
        Action 1
      </CommandItem>
    </CommandGroup>
  </CommandList>
</Command>`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Instructions complètes */}
      <section className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-lg border border-blue-200">
        <h2 className="text-2xl font-bold mb-6">🧪 Tests Interactifs</h2>
        
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-200 rounded text-xs">⌘K</kbd>
              Raccourci global
            </h3>
            <ol className="space-y-1 text-sm list-decimal list-inside">
              <li>Appuyez sur <strong>Cmd+K</strong> (Mac) ou <strong>Ctrl+K</strong> (Win)</li>
              <li>Le modal GlobalSearch s'ouvre avec animation</li>
              <li>Tapez "renault" ou "dupont"</li>
              <li>Résultats en temps réel avec surlignage jaune</li>
              <li>Appuyez sur <strong>Esc</strong> pour fermer</li>
            </ol>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Filtres catégories
            </h3>
            <ol className="space-y-1 text-sm list-decimal list-inside">
              <li>Ouvrez GlobalSearch (bouton ou Cmd+K)</li>
              <li>Tapez "clio" (voir compteurs sur filtres)</li>
              <li>Utilisez <strong>Cmd+2</strong> pour "Produits"</li>
              <li>Utilisez <strong>Cmd+3</strong> pour "Utilisateurs"</li>
              <li>Badge bleu avec nombre de résultats</li>
            </ol>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              ⌨️ Navigation clavier
            </h3>
            <ol className="space-y-1 text-sm list-decimal list-inside">
              <li>Ouvrez GlobalSearch</li>
              <li>Tapez une recherche</li>
              <li>Utilisez <strong>↓</strong> et <strong>↑</strong></li>
              <li>Résultat surligné avec bordure bleue</li>
              <li>Animation slide + scale au survol</li>
            </ol>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold mb-4">📊 État du système:</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">✅ Fonctionnel:</h4>
              <ul className="space-y-1 text-sm">
                <li>✅ Composant <code>command.tsx</code> installé (Shadcn)</li>
                <li>✅ GlobalSearch créé et optimisé (547 lignes)</li>
                <li>✅ API <code>/api/search/global</code> avec mock data</li>
                <li>✅ Hook <code>useCommandPalette</code> disponible</li>
                <li>✅ Raccourci Cmd+K global configuré</li>
                <li>✅ Intégration dans Navbar (desktop + mobile)</li>
                <li>✅ Historique localStorage persistant</li>
                <li>✅ Navigation clavier complète</li>
                <li>🆕 Surlignage termes de recherche (mark jaune)</li>
                <li>🆕 Compteurs résultats par catégorie</li>
                <li>🆕 Raccourcis Cmd+1-6 pour catégories</li>
                <li>🆕 Animations smooth (fade-in, slide)</li>
                <li>🆕 UI améliorée (gradients, bordures)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">🎨 Améliorations visuelles:</h4>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• Filtre actif: fond bleu avec shadow</li>
                <li>• Compteurs: badge bleu avec nombre</li>
                <li>• Résultat sélectionné: bordure gauche bleue</li>
                <li>• Animation scale sur hover (1.02x)</li>
                <li>• Icônes colorées selon contexte</li>
                <li>• Transitions GPU (transform)</li>
                <li>• Footer gradient bleu/gris</li>
                <li>• Prix en bleu bold</li>
              </ul>
              
              <h4 className="font-medium mb-2 mt-4">🔜 Prochaines étapes:</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Connecter à Meilisearch (search typo-tolerant)</li>
                <li>• Ajouter filtres avancés (prix, date, stock)</li>
                <li>• Analytics recherches populaires</li>
                <li>• Suggestions auto-complètes IA</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="font-semibold mb-3">💻 Utilisation dans votre code:</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium mb-2">Intégration Navbar:</p>
              <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`const [isOpen, setIsOpen] = useState(false);

<GlobalSearch
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  placeholder="Rechercher..."
/>`}
              </pre>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Command basique:</p>
              <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Type a command..." />
  <CommandList>
    <CommandGroup heading="Actions">
      <CommandItem>Action 1</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* GlobalSearch Modal */}
      <GlobalSearch 
        isOpen={isGlobalSearchOpen} 
        onClose={() => setIsGlobalSearchOpen(false)}
        placeholder="Rechercher produits, utilisateurs, commandes..."
      />

      {/* CommandDialog Example */}
      <CommandDialog open={isCommandDialogOpen} onOpenChange={setIsCommandDialogOpen}>
        <CommandInput placeholder="Tapez une commande ou recherchez..." />
        <CommandList>
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          
          <CommandGroup heading="Actions rapides">
            <CommandItem>
              <Package className="mr-2 h-4 w-4" />
              <span>Créer un nouveau produit</span>
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Users className="mr-2 h-4 w-4" />
              <span>Ajouter un utilisateur</span>
              <CommandShortcut>⌘U</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <ShoppingCart className="mr-2 h-4 w-4" />
              <span>Créer une commande</span>
              <CommandShortcut>⌘O</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          
          <CommandSeparator />
          
          <CommandGroup heading="Navigation">
            <CommandItem>
              <FileText className="mr-2 h-4 w-4" />
              <span>Aller au tableau de bord</span>
              <CommandShortcut>⌘D</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Ouvrir les paramètres</span>
              <CommandShortcut>⌘,</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
