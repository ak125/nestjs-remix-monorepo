import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, Link } from "@remix-run/react";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

// Types pour le panier
interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  price: number;
  product?: {
    name: string;
    description?: string;
    price: number;
    image_url?: string;
  };
}

interface CartSummary {
  total_items: number;
  total_quantity: number;
  subtotal: number;
  total: number;
  currency: string;
}

interface CartData {
  items: CartItem[];
  summary: CartSummary | null;
}

interface LoaderData {
  cart: CartData;
  success: boolean;
  error?: string;
}

interface ActionData {
  success?: boolean;
  error?: string;
  message?: string;
}

/**
 * Loader - Récupération des données du panier avec intégration directe
 */
export async function loader({ context, request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 'anonymous';

    // ✅ APPROCHE OPTIMISÉE : Intégration directe via RemixIntegrationService
    const result = await context.remixService.integration.getCartForRemix(userId);

    if (!result.success) {
      return json<LoaderData>({
        cart: { items: [], summary: { total_items: 0, total_quantity: 0, subtotal: 0, total: 0, currency: 'EUR' } },
        success: false,
        error: result.error || 'Erreur lors de la récupération du panier'
      });
    }

    return json<LoaderData>({
      cart: result.cart,
      success: true
    });
  } catch (error) {
    console.error('Erreur loader cart:', error);
    return json<LoaderData>({
      cart: { items: [], summary: { total_items: 0, total_quantity: 0, subtotal: 0, total: 0, currency: 'EUR' } },
      success: false,
      error: 'Erreur inattendue'
    });
  }
}

/**
 * Action - Gestion des actions du panier avec intégration directe
 */
export async function action({ context, request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const intent = formData.get('intent') as string;
    const userId = formData.get('userId') as string || 'anonymous';

    switch (intent) {
      case 'add': {
        const productId = Number(formData.get('product_id'));
        const quantity = Number(formData.get('quantity'));

        // ✅ APPROCHE OPTIMISÉE : Intégration directe
        const result = await context.remixService.integration.addToCartForRemix({
          productId,
          quantity,
          userId
        });

        return json<ActionData>(result);
      }

      case 'update': {
        const itemId = Number(formData.get('item_id'));
        const quantity = Number(formData.get('quantity'));

        // ✅ APPROCHE OPTIMISÉE : Intégration directe
        const result = await context.remixService.integration.updateCartItemForRemix({
          itemId,
          quantity,
          userId
        });

        return json<ActionData>(result);
      }

      case 'remove': {
        const itemId = Number(formData.get('item_id'));

        // ✅ APPROCHE OPTIMISÉE : Intégration directe
        const result = await context.remixService.integration.removeCartItemForRemix({
          itemId,
          userId
        });

        return json<ActionData>(result);
      }

      case 'clear': {
        // ✅ APPROCHE OPTIMISÉE : Intégration directe
        const result = await context.remixService.integration.clearCartForRemix(userId);

        return json<ActionData>(result);
      }

      default:
        return json<ActionData>({ 
          success: false, 
          error: 'Action non reconnue' 
        });
    }
  } catch (error) {
    console.error('Erreur action cart:', error);
    return json<ActionData>({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inattendue'
    });
  }
}

/**
 * Composant Cart - Interface du panier
 */
export default function Cart() {
  const { cart, success, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  if (!success && error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">Erreur</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button asChild className="mt-4">
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Panier vide
            </CardTitle>
            <CardDescription>
              Votre panier est actuellement vide
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/orders/new">Créer une commande</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
          <ShoppingBag className="w-8 h-8" />
          Mon Panier
          <Badge variant="secondary">{cart.summary?.total_items || 0} article(s)</Badge>
        </h1>

        {/* Messages d'état */}
        {actionData?.success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-6">
            {actionData.message}
          </div>
        )}
        {actionData?.error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
            {actionData.error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Articles du panier */}
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {item.product?.name || `Produit ${item.product_id}`}
                      </h3>
                      {item.product?.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {item.product.description}
                        </p>
                      )}
                      <p className="text-lg font-bold mt-2">
                        {item.price.toFixed(2)} €
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Contrôles de quantité */}
                      <div className="flex items-center gap-2">
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="update" />
                          <input type="hidden" name="item_id" value={item.id} />
                          <input type="hidden" name="quantity" value={item.quantity - 1} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            disabled={item.quantity <= 1 || isSubmitting}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                        </Form>

                        <span className="w-8 text-center font-semibold">
                          {item.quantity}
                        </span>

                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="update" />
                          <input type="hidden" name="item_id" value={item.id} />
                          <input type="hidden" name="quantity" value={item.quantity + 1} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            disabled={isSubmitting}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </Form>
                      </div>

                      {/* Bouton supprimer */}
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="remove" />
                        <input type="hidden" name="item_id" value={item.id} />
                        <Button
                          type="submit"
                          variant="destructive"
                          size="sm"
                          disabled={isSubmitting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </Form>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Résumé du panier */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Résumé de la commande</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Articles ({cart.summary?.total_quantity || 0})</span>
                  <span>{cart.summary?.subtotal?.toFixed(2) || '0.00'} €</span>
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{cart.summary?.total?.toFixed(2) || '0.00'} €</span>
                  </div>
                </div>

                <div className="space-y-2 mt-6">
                  <Button asChild className="w-full">
                    <Link to="/checkout">Passer commande</Link>
                  </Button>
                  
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/orders/new">Continuer mes achats</Link>
                  </Button>

                  <Form method="post" className="w-full">
                    <input type="hidden" name="intent" value="clear" />
                    <Button
                      type="submit"
                      variant="destructive"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      Vider le panier
                    </Button>
                  </Form>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
