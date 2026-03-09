import { Link } from "@remix-run/react";
import { ShoppingBag, Stethoscope } from "lucide-react";
import { Button } from "~/components/ui/button";

export function EmptyCart() {
  return (
    <div className="min-h-[60dvh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 sm:p-12 max-w-lg mx-auto shadow-xl border text-center">
        <div className="bg-slate-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="h-12 w-12 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold mb-3 text-slate-800">
          Votre panier est vide
        </h2>
        <p className="text-slate-600 mb-2">
          Vous ne savez pas quelle pi{"\u00e8"}ce choisir ?
        </p>
        <p className="text-sm text-slate-500 mb-8">
          Lancez notre diagnostic gratuit ou parcourez notre catalogue.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" variant="blue" className="w-full sm:w-auto">
            <Link to="/" className="inline-flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Trouver une pi{"\u00e8"}ce
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Link
              to="/diagnostic-auto"
              className="inline-flex items-center gap-2"
            >
              <Stethoscope className="h-5 w-5" />
              Lancer un diagnostic
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
