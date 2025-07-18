/**
 * Page de création d'une nouvelle commande
 * Formulaire pour créer une commande avec validation
 */

import { json, redirect, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Package, MapPin, CreditCard } from "lucide-react";

interface FormData {
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    productSku?: string;
    variantId?: string;
    variantName?: string;
  }>;
  deliveryAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    additionalInfo?: string;
  };
  deliveryMethod: string;
  deliveryPrice: number;
  notes?: string;
  promocode?: string;
  discountAmount: number;
}

interface ActionData {
  error?: string;
  fieldErrors?: {
    [key: string]: string;
  };
}

export const loader: LoaderFunction = async ({ context }) => {
  // Temporairement, permettre l'accès sans authentification pour les tests
  // En production, vous devriez ajouter une authentification :
  // const user = await requireUser({ context });
  
  // Ici, vous pourriez charger des données nécessaires comme les produits disponibles
  return json({
    // Ajouter des données de test pour les produits disponibles
    products: [
      { id: "1", name: "Produit A", price: 10.99, sku: "PROD-A" },
      { id: "2", name: "Produit B", price: 15.99, sku: "PROD-B" },
      { id: "3", name: "Produit C", price: 20.99, sku: "PROD-C" }
    ]
  });
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  
  try {
    // Parser les données du formulaire
    const items = JSON.parse(formData.get("items") as string);
    const deliveryAddress = JSON.parse(formData.get("deliveryAddress") as string);
    const deliveryMethod = formData.get("deliveryMethod") as string;
    const deliveryPrice = parseFloat(formData.get("deliveryPrice") as string);
    const notes = formData.get("notes") as string;
    const promocode = formData.get("promocode") as string;
    const discountAmount = parseFloat(formData.get("discountAmount") as string) || 0;

    const orderData: FormData = {
      items,
      deliveryAddress,
      deliveryMethod,
      deliveryPrice,
      notes: notes || undefined,
      promocode: promocode || undefined,
      discountAmount,
    };

    // Validation côté client
    if (!items || items.length === 0) {
      return json<ActionData>({ 
        error: "Au moins un article est requis" 
      }, { status: 400 });
    }

    if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.postalCode || !deliveryAddress.country) {
      return json<ActionData>({ 
        error: "Tous les champs de l'adresse de livraison sont requis" 
      }, { status: 400 });
    }

    // Envoyer la requête à l'API
    const response = await fetch("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return json<ActionData>({ 
        error: errorData.message || "Erreur lors de la création de la commande" 
      }, { status: 400 });
    }

    const order = await response.json();
    return redirect(`/orders/${order.id}`);
  } catch (error) {
    console.error("Error creating order:", error);
    return json<ActionData>({ 
      error: "Erreur lors de la création de la commande" 
    }, { status: 500 });
  }
};

export default function NewOrder() {
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  
  const [items, setItems] = useState([
    {
      id: Date.now(),
      productId: "",
      productName: "",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      productSku: "",
      variantId: "",
      variantName: "",
    }
  ]);

  const [deliveryAddress, setDeliveryAddress] = useState({
    street: "",
    city: "",
    postalCode: "",
    country: "France",
    additionalInfo: "",
  });

  const [deliveryMethod, setDeliveryMethod] = useState("standard");
  const [deliveryPrice, setDeliveryPrice] = useState(5.99);
  const [notes, setNotes] = useState("");
  const [promocode, setPromocode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);

  const addItem = () => {
    setItems([...items, {
      id: Date.now(),
      productId: "",
      productName: "",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      productSku: "",
      variantId: "",
      variantName: "",
    }]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === "quantity" || field === "unitPrice") {
          updatedItem.totalPrice = updatedItem.quantity * updatedItem.unitPrice;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + deliveryPrice - discountAmount;
  };

  const handleDeliveryMethodChange = (method: string) => {
    setDeliveryMethod(method);
    switch (method) {
      case "standard":
        setDeliveryPrice(5.99);
        break;
      case "express":
        setDeliveryPrice(12.99);
        break;
      case "pickup":
        setDeliveryPrice(0);
        break;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-3xl font-bold">Nouvelle Commande</h1>
        </div>
      </div>

      {actionData?.error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">{actionData.error}</p>
          </CardContent>
        </Card>
      )}

      <Form method="post" className="space-y-6">
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <input type="hidden" name="deliveryAddress" value={JSON.stringify(deliveryAddress)} />
        <input type="hidden" name="deliveryMethod" value={deliveryMethod} />
        <input type="hidden" name="deliveryPrice" value={deliveryPrice} />
        <input type="hidden" name="notes" value={notes} />
        <input type="hidden" name="promocode" value={promocode} />
        <input type="hidden" name="discountAmount" value={discountAmount} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Articles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Package className="w-5 h-5 mr-2" />
                    Articles
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-4 items-end border-b pb-4 last:border-b-0">
                      <div className="col-span-3">
                        <Label>Nom du produit</Label>
                        <Input
                          value={item.productName}
                          onChange={(e) => updateItem(item.id, "productName", e.target.value)}
                          placeholder="Nom du produit"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>SKU</Label>
                        <Input
                          value={item.productSku}
                          onChange={(e) => updateItem(item.id, "productSku", e.target.value)}
                          placeholder="SKU"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Quantité</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value))}
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Prix unitaire</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value))}
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Total</Label>
                        <div className="text-lg font-medium pt-2">
                          {item.totalPrice.toFixed(2)}€
                        </div>
                      </div>
                      <div className="col-span-1">
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Adresse de livraison */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Adresse de livraison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Rue</Label>
                    <Input
                      value={deliveryAddress.street}
                      onChange={(e) => setDeliveryAddress({...deliveryAddress, street: e.target.value})}
                      placeholder="123 Rue de la Paix"
                      required
                    />
                  </div>
                  <div>
                    <Label>Ville</Label>
                    <Input
                      value={deliveryAddress.city}
                      onChange={(e) => setDeliveryAddress({...deliveryAddress, city: e.target.value})}
                      placeholder="Paris"
                      required
                    />
                  </div>
                  <div>
                    <Label>Code postal</Label>
                    <Input
                      value={deliveryAddress.postalCode}
                      onChange={(e) => setDeliveryAddress({...deliveryAddress, postalCode: e.target.value})}
                      placeholder="75001"
                      required
                    />
                  </div>
                  <div>
                    <Label>Pays</Label>
                    <Input
                      value={deliveryAddress.country}
                      onChange={(e) => setDeliveryAddress({...deliveryAddress, country: e.target.value})}
                      placeholder="France"
                      required
                    />
                  </div>
                  <div>
                    <Label>Information additionnelle</Label>
                    <Input
                      value={deliveryAddress.additionalInfo}
                      onChange={(e) => setDeliveryAddress({...deliveryAddress, additionalInfo: e.target.value})}
                      placeholder="Appartement 3B"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes additionnelles pour la commande..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* Colonne latérale - Résumé */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  Livraison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Méthode de livraison</Label>
                    <Select value={deliveryMethod} onValueChange={handleDeliveryMethodChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard (5.99€)</SelectItem>
                        <SelectItem value="express">Express (12.99€)</SelectItem>
                        <SelectItem value="pickup">Retrait en magasin (Gratuit)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Prix de livraison</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={deliveryPrice}
                      onChange={(e) => setDeliveryPrice(parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Code promo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Code promo</Label>
                    <Input
                      value={promocode}
                      onChange={(e) => setPromocode(e.target.value)}
                      placeholder="WELCOME10"
                    />
                  </div>
                  <div>
                    <Label>Montant de la remise</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Résumé</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Sous-total:</span>
                    <span>{calculateSubtotal().toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Livraison:</span>
                    <span>{deliveryPrice.toFixed(2)}€</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Remise:</span>
                      <span>-{discountAmount.toFixed(2)}€</span>
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span>{calculateTotal().toFixed(2)}€</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button type="submit" className="w-full">
                Créer la commande
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate(-1)}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}
