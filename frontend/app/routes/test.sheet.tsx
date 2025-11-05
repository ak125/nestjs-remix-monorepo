/**
 * 📄 Page de démo Sheet (Drawer)
 * Exemples d'utilisation du composant Sheet de Shadcn UI
 * Parfait pour panier, menu mobile, panneau de configuration
 */

import { Link } from "@remix-run/react";
import { 
  ShoppingCart, 
  Menu, 
  Settings, 
  Package, 
  Trash2, 
  Plus, 
  Minus,
  X,
  CreditCard,
  Truck,
  Info,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "~/components/ui/sheet";

export default function SheetDemo() {
  const [cartItems, setCartItems] = useState([
    { id: 1, name: "Disques de frein BREMBO", ref: "09.9772.11", price: 89.90, qty: 2 },
    { id: 2, name: "Plaquettes ATE", ref: "13.0460-7293.2", price: 45.90, qty: 1 },
  ]);

  const updateQty = (id: number, delta: number) => {
    setCartItems(items =>
      items.map(item =>
        item.id === id
          ? { ...item, qty: Math.max(1, item.qty + delta) }
          : item
      )
    );
  };

  const removeItem = (id: number) => {
    setCartItems(items => items.filter(item => item.id !== id));
    toast.success("Article retiré du panier");
  };

  const total = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">
            📄 Démo Sheet (Drawer)
          </h1>
          <p className="text-slate-600">
            Panneau coulissant depuis les 4 côtés - Parfait pour panier, menu, settings
          </p>
        </div>

        {/* Grid d'exemples */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Sheet RIGHT (panier e-commerce) */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-800">
              1️⃣ Sheet RIGHT - Panier e-commerce
            </h2>
            <p className="text-sm text-slate-600">
              Le plus commun : panier coulissant depuis la droite
            </p>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button className="w-full">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Ouvrir panier ({cartItems.length})
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-lg">
                <SheetHeader>
                  <SheetTitle>Panier d'achat</SheetTitle>
                  <SheetDescription>
                    {cartItems.length} article{cartItems.length > 1 ? 's' : ''} dans votre panier
                  </SheetDescription>
                </SheetHeader>

                <div className="flex flex-col h-full">
                  {/* Liste articles */}
                  <div className="flex-1 overflow-y-auto my-6 space-y-4">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex gap-4 p-4 bg-slate-50 rounded-lg">
                        <Package className="h-12 w-12 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-slate-900 truncate">
                            {item.name}
                          </h4>
                          <p className="text-xs text-slate-500">Réf: {item.ref}</p>
                          <p className="text-sm font-semibold text-blue-600 mt-1">
                            {item.price.toFixed(2)} €
                          </p>

                          {/* Quantité */}
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQty(item.id, -1)}
                              disabled={item.qty === 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-sm font-medium w-8 text-center">
                              {item.qty}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQty(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Supprimer */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(item.id)}
                          className="self-start"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Total */}
                  <div className="space-y-3 my-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Sous-total</span>
                      <span className="text-slate-900">{total.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Livraison</span>
                      <span className="text-green-600 font-medium">Gratuit</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span className="text-slate-900">Total</span>
                      <span className="text-blue-600">{total.toFixed(2)} €</span>
                    </div>
                  </div>

                  <SheetFooter className="flex-col gap-2">
                    <SheetClose asChild>
                      <Button className="w-full" size="lg">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Passer commande
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button variant="outline" className="w-full">
                        Continuer mes achats
                      </Button>
                    </SheetClose>
                  </SheetFooter>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Sheet LEFT (menu mobile) */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-800">
              2️⃣ Sheet LEFT - Menu mobile
            </h2>
            <p className="text-sm text-slate-600">
              Navigation principale sur mobile
            </p>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Menu className="h-4 w-4 mr-2" />
                  Ouvrir menu
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>
                    Navigation principale
                  </SheetDescription>
                </SheetHeader>
                
                <div className="flex flex-col gap-2 mt-6">
                  <SheetClose asChild>
                    <Button variant="ghost" className="justify-start">
                      Accueil
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="ghost" className="justify-start">
                      Catalogue
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="ghost" className="justify-start">
                      Promotions
                    </Button>
                  </SheetClose>
                  <Separator className="my-2" />
                  <SheetClose asChild>
                    <Button variant="ghost" className="justify-start">
                      Mon compte
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="ghost" className="justify-start">
                      Mes commandes
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Sheet TOP */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-800">
              3️⃣ Sheet TOP - Annonce/Notification
            </h2>
            <p className="text-sm text-slate-600">
              Bannière dépliable depuis le haut
            </p>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Info className="h-4 w-4 mr-2" />
                  Voir annonce
                </Button>
              </SheetTrigger>
              <SheetContent side="top">
                <SheetHeader>
                  <SheetTitle>🎉 Promotion Flash !</SheetTitle>
                  <SheetDescription>
                    -20% sur toutes les pièces de freinage
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-slate-600">
                    Profitez de notre promotion exceptionnelle sur les disques, 
                    plaquettes et étriers de frein des plus grandes marques.
                  </p>
                  <SheetClose asChild>
                    <Button className="w-full">
                      Voir les produits en promo
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Sheet BOTTOM */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-800">
              4️⃣ Sheet BOTTOM - Actions contextuelles
            </h2>
            <p className="text-sm text-slate-600">
              Menu d'actions mobile (style mobile app)
            </p>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Options de livraison
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom">
                <SheetHeader>
                  <SheetTitle>Options de livraison</SheetTitle>
                  <SheetDescription>
                    Choisissez votre mode de livraison
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-3 mt-6">
                  <SheetClose asChild>
                    <Button variant="outline" className="justify-between h-auto py-4">
                      <div className="flex items-center gap-3">
                        <Truck className="h-5 w-5 text-blue-600" />
                        <div className="text-left">
                          <p className="font-medium">Livraison standard</p>
                          <p className="text-xs text-slate-500">3-5 jours ouvrés</p>
                        </div>
                      </div>
                      <span className="font-semibold text-green-600">Gratuit</span>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="outline" className="justify-between h-auto py-4">
                      <div className="flex items-center gap-3">
                        <Truck className="h-5 w-5 text-orange-600" />
                        <div className="text-left">
                          <p className="font-medium">Livraison express</p>
                          <p className="text-xs text-slate-500">24-48h</p>
                        </div>
                      </div>
                      <span className="font-semibold">9,90 €</span>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="outline" className="justify-between h-auto py-4">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-green-600" />
                        <div className="text-left">
                          <p className="font-medium">Retrait en magasin</p>
                          <p className="text-xs text-slate-500">Disponible en 2h</p>
                        </div>
                      </div>
                      <span className="font-semibold text-green-600">Gratuit</span>
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>

        </div>

        {/* Guide d'utilisation */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
          <h3 className="text-lg font-semibold text-purple-900 mb-3">
            📚 Guide d'utilisation
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-purple-800">
            <div>
              <h4 className="font-semibold mb-2">Composants</h4>
              <ul className="space-y-1">
                <li>✅ <strong>Sheet</strong> : Conteneur root</li>
                <li>✅ <strong>SheetTrigger</strong> : Bouton d'ouverture</li>
                <li>✅ <strong>SheetContent</strong> : Contenu du drawer</li>
                <li>✅ <strong>SheetHeader/Footer</strong> : En-tête/Pied</li>
                <li>✅ <strong>SheetClose</strong> : Fermeture automatique</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Props</h4>
              <ul className="space-y-1">
                <li>✅ <code>side</code> : "right" | "left" | "top" | "bottom"</li>
                <li>✅ <code>asChild</code> : Utiliser sur Trigger/Close</li>
                <li>✅ Animations natives incluses</li>
                <li>✅ Overlay + fermeture ESC automatique</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Use cases */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            💡 Cas d'usage recommandés
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold text-blue-600">Sheet RIGHT</h4>
              <ul className="space-y-1 text-slate-600">
                <li>• Panier d'achat e-commerce</li>
                <li>• Détails produit (quick view)</li>
                <li>• Formulaire de filtres</li>
                <li>• Panneau de configuration</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-green-600">Sheet LEFT</h4>
              <ul className="space-y-1 text-slate-600">
                <li>• Menu de navigation mobile</li>
                <li>• Sidebar utilisateur</li>
                <li>• Liste de catégories</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-orange-600">Sheet TOP</h4>
              <ul className="space-y-1 text-slate-600">
                <li>• Bannière promotionnelle</li>
                <li>• Barre de recherche étendue</li>
                <li>• Notifications importantes</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-purple-600">Sheet BOTTOM</h4>
              <ul className="space-y-1 text-slate-600">
                <li>• Menu d'actions (mobile)</li>
                <li>• Options de partage</li>
                <li>• Sélection de livraison</li>
                <li>• Bottom sheet (style iOS)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Link 
            to="/test/card" 
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
          >
            ← Card & Separator
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
