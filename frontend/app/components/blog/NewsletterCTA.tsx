/**
 * NewsletterCTA — CTA de fin de l'index blog : contact + catalogue.
 * Aucun abonnement par e-mail n'existe (ni endpoint, ni envoi d'articles) :
 * le bloc n'en propose pas.
 */
import { MessageCircle, ExternalLink, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";

export function NewsletterCTA() {
  return (
    <section className="py-20 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-neutral-900/10" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />

      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="max-w-3xl mx-auto">
          <MessageCircle className="w-16 h-16 mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Besoin d'aide pour choisir une pièce ?
          </h2>
          <p className="text-xl mb-8 leading-relaxed text-white/90">
            Contactez nos experts ou parcourez le catalogue.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mt-8">
            <Link to="/contact">
              <Button
                size="lg"
                variant="outline"
                className="text-white border-2 border-white hover:bg-white hover:text-pink-600 px-8 py-4 rounded-xl text-lg font-semibold group"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Contacter nos experts
                <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/catalogue">
              <Button
                size="lg"
                className="bg-gradient-to-r from-white to-blue-50 text-pink-600 hover:shadow-2xl px-8 py-4 rounded-xl text-lg font-semibold group"
              >
                Explorer le catalogue
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
