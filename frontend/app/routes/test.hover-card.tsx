/**
 * 🎯 Test Page - Hover Cards
 * 
 * Démo des HoverCards pour previews rapides:
 * - UserHoverCard (utilisateurs dans tables admin)
 * - ProductHoverCard (produits dans listes/catalogues)
 * - OrderHoverCard (commandes dans dashboards)
 */

import { type MetaFunction } from '@remix-run/node';

import { OrderHoverCard } from '../components/orders/OrderHoverCard';
import { ProductHoverCard } from '../components/products/ProductHoverCard';
import { Separator } from '../components/ui/separator';
import { UserHoverCard } from '../components/users/UserHoverCard';

export const meta: MetaFunction = () => {
  return [{ title: 'Test Hover Cards - Preview Components' }];
};

// Mock data
const mockUsers = [
  {
    id: 1,
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean.dupont@example.com',
    level: 9,
    lastLogin: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min ago
    ordersCount: 25,
    totalSpent: 3450.80,
  },
  {
    id: 2,
    firstName: 'Marie',
    lastName: 'Martin',
    email: 'marie.martin@example.com',
    level: 5,
    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
    ordersCount: 12,
    totalSpent: 1250.50,
  },
  {
    id: 3,
    firstName: 'Paul',
    lastName: 'Bernard',
    email: 'paul.bernard@example.com',
    level: 0,
    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
    ordersCount: 5,
    totalSpent: 450.00,
  },
];

const mockProducts = [
  {
    id: 'prod-1',
    name: 'Amortisseur avant Renault Clio III',
    reference: 'AMO-CLIO3-001',
    price: 79.99,
    originalPrice: 99.99,
    stock: 15,
    rating: 4.5,
    reviewsCount: 24,
    imageUrl: 'https://picsum.photos/seed/product1/400/300',
    category: 'Suspension',
  },
  {
    id: 'prod-2',
    name: 'Plaquettes de frein Peugeot 307',
    reference: 'FRE-307-002',
    price: 45.50,
    stock: 3,
    rating: 4.8,
    reviewsCount: 67,
    imageUrl: 'https://picsum.photos/seed/product2/400/300',
    category: 'Freinage',
  },
  {
    id: 'prod-3',
    name: 'Filtre à huile universel',
    reference: 'FIL-UNI-003',
    price: 12.90,
    stock: 0,
    rating: 4.2,
    reviewsCount: 156,
    imageUrl: 'https://picsum.photos/seed/product3/400/300',
    category: 'Entretien',
  },
  {
    id: 'prod-4',
    name: 'Batterie 12V 70Ah Premium',
    reference: 'BAT-12V-004',
    price: 129.00,
    stock: 87,
    rating: 4.9,
    reviewsCount: 234,
    imageUrl: 'https://picsum.photos/seed/product4/400/300',
    category: 'Électrique',
  },
];

const mockOrders = [
  {
    id: 1,
    orderNumber: 'ORD-2024-001',
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    status: 'processing' as const,
    total: 245.80,
    itemsCount: 3,
    customerName: 'Jean Dupont',
    customerEmail: 'jean.dupont@example.com',
    shippingAddress: '15 rue de la Paix, 75002 Paris',
  },
  {
    id: 2,
    orderNumber: 'ORD-2024-002',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    status: 'shipped' as const,
    total: 89.90,
    itemsCount: 1,
    customerName: 'Marie Martin',
    customerEmail: 'marie.martin@example.com',
    shippingAddress: '42 avenue des Champs, 69001 Lyon',
  },
  {
    id: 3,
    orderNumber: 'ORD-2024-003',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    status: 'delivered' as const,
    total: 567.40,
    itemsCount: 8,
    customerName: 'Paul Bernard',
    customerEmail: 'paul.bernard@example.com',
    shippingAddress: '8 place du Marché, 33000 Bordeaux',
  },
  {
    id: 4,
    orderNumber: 'ORD-2024-004',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    status: 'cancelled' as const,
    total: 125.00,
    itemsCount: 2,
    customerName: 'Sophie Dubois',
    customerEmail: 'sophie.dubois@example.com',
  },
];

export default function TestHoverCard() {
  return (
    <div className="container mx-auto py-12 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">🎯 Hover Cards - Preview Components</h1>
        <p className="text-gray-600 text-lg">
          Aperçus rapides au survol pour utilisateurs, produits et commandes.
        </p>
      </div>

      {/* Exemple 1: UserHoverCard */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2">1. User Hover Card</h2>
        <p className="text-gray-600 mb-6">
          Preview utilisateur avec avatar, rôle, stats et dernière connexion.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Table exemple */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h3 className="font-semibold">Liste des utilisateurs</h3>
            </div>
            <div className="divide-y">
              {mockUsers.map((user) => (
                <div key={user.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold">
                        {user.firstName[0]}{user.lastName[0]}
                      </div>
                      <div>
                        <UserHoverCard user={user}>
                          <button className="font-medium hover:text-blue-600 transition-colors text-left">
                            {user.firstName} {user.lastName}
                          </button>
                        </UserHoverCard>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {user.ordersCount} commandes
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
              <h3 className="font-semibold mb-2">✨ Features:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Avatar avec initiales colorées</li>
                <li>• Badge rôle (Admin, Modérateur, User)</li>
                <li>• Email + dernière connexion</li>
                <li>• Stats: commandes + montant dépensé</li>
                <li>• Bouton "Voir profil" avec lien</li>
                <li>• Delay hover: 200ms (rapide)</li>
              </ul>
            </div>

            <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded">
              <h3 className="font-semibold mb-2">🎯 Use cases:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Tables admin utilisateurs</li>
                <li>• Liste commentaires/reviews</li>
                <li>• Historique d'actions</li>
                <li>• Mentions dans notifications</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Exemple 2: ProductHoverCard */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2">2. Product Hover Card</h2>
        <p className="text-gray-600 mb-6">
          Preview produit avec image, prix, stock et note.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Grid de produits */}
          <div className="grid grid-cols-2 gap-4">
            {mockProducts.map((product) => (
              <div key={product.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <ProductHoverCard product={product}>
                  <button className="text-left w-full">
                    {product.imageUrl && (
                      <div className="aspect-video bg-gray-100 rounded mb-3 overflow-hidden">
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <h4 className="font-medium text-sm hover:text-blue-600 transition-colors line-clamp-2">
                      {product.name}
                    </h4>
                    <p className="text-lg font-bold text-blue-600 mt-2">
                      {product.price.toFixed(2)}€
                    </p>
                  </button>
                </ProductHoverCard>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded">
              <h3 className="font-semibold mb-2">✨ Features:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Image produit responsive</li>
                <li>• Badge réduction (%) si applicable</li>
                <li>• Prix avec ancien prix barré</li>
                <li>• Badge stock (couleur selon niveau)</li>
                <li>• Note avec étoiles + nb reviews</li>
                <li>• Badge catégorie</li>
                <li>• Bouton "Voir produit"</li>
                <li>• Delay hover: 300ms (modéré)</li>
              </ul>
            </div>

            <div className="bg-orange-50 border-l-4 border-orange-600 p-4 rounded">
              <h3 className="font-semibold mb-2">🎨 États visuels:</h3>
              <ul className="space-y-1 text-sm">
                <li>• ✅ <strong>En stock</strong>: badge vert (≥50)</li>
                <li>• ⚠️ <strong>Stock faible</strong>: badge jaune (&lt;5)</li>
                <li>• ❌ <strong>Rupture</strong>: badge rouge (0)</li>
                <li>• 🔥 <strong>Promo</strong>: badge rouge coin supérieur</li>
              </ul>
            </div>

            <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded">
              <h3 className="font-semibold mb-2">🎯 Use cases:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Grilles de produits (catalogue)</li>
                <li>• Résultats de recherche</li>
                <li>• Produits recommandés</li>
                <li>• Listes de favoris</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Exemple 3: OrderHoverCard */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2">3. Order Hover Card</h2>
        <p className="text-gray-600 mb-6">
          Preview commande avec statut, montant et infos client.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Table commandes */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h3 className="font-semibold">Commandes récentes</h3>
            </div>
            <div className="divide-y">
              {mockOrders.map((order) => (
                <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <OrderHoverCard order={order}>
                      <button className="text-left">
                        <div className="font-medium hover:text-blue-600 transition-colors">
                          #{order.orderNumber}
                        </div>
                        <div className="text-sm text-gray-500">{order.customerName}</div>
                      </button>
                    </OrderHoverCard>
                    <div className="text-right">
                      <div className="font-bold text-blue-600">{order.total.toFixed(2)}€</div>
                      <div className="text-xs text-gray-500">{order.itemsCount} articles</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded">
              <h3 className="font-semibold mb-2">✨ Features:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Numéro commande + date formatée</li>
                <li>• Badge statut coloré par état</li>
                <li>• Montant total (fond gradient)</li>
                <li>• Infos client (nom + email)</li>
                <li>• Nombre d'articles</li>
                <li>• Adresse livraison (si présente)</li>
                <li>• Bouton "Voir détails"</li>
                <li>• Delay hover: 200ms (rapide)</li>
              </ul>
            </div>

            <div className="bg-pink-50 border-l-4 border-pink-600 p-4 rounded">
              <h3 className="font-semibold mb-2">🎨 Statuts:</h3>
              <ul className="space-y-1 text-sm">
                <li>• 🕐 <strong>En attente</strong>: gris</li>
                <li>• 🔄 <strong>En traitement</strong>: bleu</li>
                <li>• 📦 <strong>Expédiée</strong>: violet</li>
                <li>• ✅ <strong>Livrée</strong>: vert</li>
                <li>• ❌ <strong>Annulée</strong>: rouge</li>
              </ul>
            </div>

            <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded">
              <h3 className="font-semibold mb-2">🎯 Use cases:</h3>
              <ul className="space-y-1 text-sm">
                <li>• Dashboard admin (dernières commandes)</li>
                <li>• Liste commandes utilisateur</li>
                <li>• Historique d'achats</li>
                <li>• Notifications commandes</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-12" />

      {/* Instructions d'utilisation */}
      <section className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-lg border border-blue-200">
        <h2 className="text-2xl font-bold mb-6">🧪 Guide d'utilisation</h2>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="font-semibold mb-3">📱 Comportement:</h3>
            <ul className="space-y-2 text-sm">
              <li><strong>Desktop:</strong> Hover pour afficher (delay configurable)</li>
              <li><strong>Mobile:</strong> Tap pour afficher (touch support)</li>
              <li><strong>Accessibilité:</strong> Focus clavier supporté</li>
              <li><strong>Animation:</strong> Fade-in smooth (200ms)</li>
              <li><strong>Position:</strong> Auto-adjust selon viewport</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3">⚙️ Configuration:</h3>
            <ul className="space-y-2 text-sm">
              <li><code>openDelay</code>: 200-300ms recommandé</li>
              <li><code>closeDelay</code>: 100ms pour smooth UX</li>
              <li><code>showViewButton</code>: true/false</li>
              <li><code>align</code>: start | center | end</li>
              <li><code>side</code>: top | right | bottom | left</li>
            </ul>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold mb-4">💻 Code exemple:</h3>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">UserHoverCard:</p>
              <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`<UserHoverCard user={user}>
  <button className="hover:text-blue-600">
    {user.firstName} {user.lastName}
  </button>
</UserHoverCard>`}
              </pre>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">ProductHoverCard:</p>
              <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`<ProductHoverCard product={product}>
  <Link to={\`/products/\${product.id}\`}>
    {product.name}
  </Link>
</ProductHoverCard>`}
              </pre>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">OrderHoverCard:</p>
              <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`<OrderHoverCard order={order} showViewButton={false}>
  <span className="font-medium">
    #{order.orderNumber}
  </span>
</OrderHoverCard>`}
              </pre>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="font-semibold mb-3">🎨 Personnalisation:</h3>
          <p className="text-sm text-gray-700 mb-2">
            Les HoverCards sont construites avec Radix UI + Tailwind CSS. Vous pouvez:
          </p>
          <ul className="grid md:grid-cols-2 gap-2 text-sm text-gray-600">
            <li>• Modifier les délais d'ouverture/fermeture</li>
            <li>• Changer la largeur (<code>w-80</code>)</li>
            <li>• Ajuster les couleurs et gradients</li>
            <li>• Ajouter/retirer des informations</li>
            <li>• Masquer le bouton d'action</li>
            <li>• Customiser les badges de statut</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
