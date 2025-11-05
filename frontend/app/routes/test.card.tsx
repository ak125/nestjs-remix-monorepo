/**
 * 🃏 Page de démo Card & Separator
 * Exemples d'utilisation des composants Card et Separator de Shadcn UI
 */

import { Link } from "@remix-run/react";
import { Package, ShoppingCart, CreditCard, Truck, Star } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

export default function CardSeparatorDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">
            🃏 Démo Card & Separator
          </h1>
          <p className="text-slate-600">
            Composants structurels pour organiser l'interface
          </p>
        </div>

        {/* Grid de Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1 : Simple */}
          <Card>
            <CardHeader>
              <CardTitle>Card simple</CardTitle>
              <CardDescription>Avec titre et description</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Composant Card de base avec header, content et footer. 
                Parfait pour afficher des informations structurées.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">En savoir plus</Button>
            </CardFooter>
          </Card>

          {/* Card 2 : Produit */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-600" />
                <div>
                  <CardTitle>Disques de frein</CardTitle>
                  <CardDescription>BREMBO 09.9772.11</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Prix</span>
                  <span className="font-semibold text-slate-900">89,90 €</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Stock</span>
                  <span className="text-green-600 font-medium">En stock</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Ajouter au panier
              </Button>
            </CardFooter>
          </Card>

          {/* Card 3 : Statistiques */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                Commandes du jour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-900">42</div>
              <p className="text-sm text-blue-700 mt-1">
                +12% par rapport à hier
              </p>
            </CardContent>
          </Card>

        </div>

        {/* Separator : Exemples */}
        <Card>
          <CardHeader>
            <CardTitle>Séparateurs (Separator)</CardTitle>
            <CardDescription>Lignes horizontales et verticales pour structurer le contenu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Horizontal (par défaut) */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 mb-2">Horizontal (défaut)</h3>
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Section 1</p>
                <Separator />
                <p className="text-sm text-slate-600">Section 2</p>
                <Separator />
                <p className="text-sm text-slate-600">Section 3</p>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Vertical */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 mb-2">Vertical</h3>
              <div className="flex items-center gap-4 h-12">
                <span className="text-sm text-slate-600">Gauche</span>
                <Separator orientation="vertical" />
                <span className="text-sm text-slate-600">Centre</span>
                <Separator orientation="vertical" />
                <span className="text-sm text-slate-600">Droite</span>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Avec texte */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 mb-2">Avec texte centré</h3>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">
                    OU CONTINUER AVEC
                  </span>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Card avancée : Commande */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Commande #12345</CardTitle>
                <CardDescription>Passée le 5 novembre 2025</CardDescription>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                Livrée
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Articles */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Articles</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Package className="h-10 w-10 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">Disques de frein BREMBO</p>
                    <p className="text-xs text-slate-500">Réf: 09.9772.11 • Qté: 2</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">179,80 €</span>
                </div>
                
                <Separator />
                
                <div className="flex items-center gap-3">
                  <Package className="h-10 w-10 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">Plaquettes de frein ATE</p>
                    <p className="text-xs text-slate-500">Réf: 13.0460-7293.2 • Qté: 1</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">45,90 €</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Récapitulatif */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Sous-total</span>
                <span className="text-slate-900">225,70 €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Livraison</span>
                <span className="text-slate-900">9,90 €</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span className="text-slate-900">Total</span>
                <span className="text-slate-900">235,60 €</span>
              </div>
            </div>

            <Separator />

            {/* Livraison */}
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">Livré le 3 nov. 2025</p>
                <p className="text-xs text-slate-500">N° de suivi: 1Z999AA10123456784</p>
              </div>
            </div>

          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="outline" className="flex-1">Télécharger facture</Button>
            <Button variant="outline" className="flex-1">Suivre colis</Button>
          </CardFooter>
        </Card>

        {/* Grid horizontal avec Separators verticaux */}
        <div className="grid grid-cols-4 gap-6">
          <Card className="col-span-4 md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">4.8</CardTitle>
              <CardDescription>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map((i) => (
                    <Star key={i} className={`h-4 w-4 ${i <= 4 ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
                  ))}
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600">1,234 avis</p>
            </CardContent>
          </Card>

          <Card className="col-span-4 md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">24h</CardTitle>
              <CardDescription>Expédition</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600">Sous 1 jour ouvré</p>
            </CardContent>
          </Card>

          <Card className="col-span-4 md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">2 ans</CardTitle>
              <CardDescription>Garantie</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600">Pièces d'origine</p>
            </CardContent>
          </Card>

          <Card className="col-span-4 md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">14j</CardTitle>
              <CardDescription>Retour</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600">Satisfait ou remboursé</p>
            </CardContent>
          </Card>
        </div>

        {/* Guide d'utilisation */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-900">📚 Guide d'utilisation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-green-800">
              <div>
                <h4 className="font-semibold mb-2">Card</h4>
                <ul className="space-y-1">
                  <li>✅ CardHeader : Titre + description</li>
                  <li>✅ CardContent : Contenu principal</li>
                  <li>✅ CardFooter : Actions (boutons)</li>
                  <li>✅ hover:shadow-lg pour interactivité</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Separator</h4>
                <ul className="space-y-1">
                  <li>✅ Horizontal (défaut)</li>
                  <li>✅ orientation="vertical" pour vertical</li>
                  <li>✅ Combine avec absolute pour texte centré</li>
                  <li>✅ className pour personnaliser</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Link 
            to="/test/breadcrumb" 
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
          >
            ← Breadcrumb
          </Link>
          <Link 
            to="/test/sonner" 
            className="text-slate-600 hover:text-slate-700 font-medium flex items-center gap-2"
          >
            Sonner →
          </Link>
        </div>

      </div>
    </div>
  );
}
