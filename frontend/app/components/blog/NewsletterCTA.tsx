/**
 * NewsletterCTA — CTA newsletter + contact/catalogue
 */
import { Link, Form } from "@remix-run/react";
import {
  Mail,
  Sparkles,
  Clock,
  Award,
  MessageCircle,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export function NewsletterCTA() {
  return (
    <section className="py-20 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-black/10" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />

      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="max-w-3xl mx-auto">
          <Mail className="w-16 h-16 mx-auto mb-6 animate-bounce" />
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ne manquez aucun article !
          </h2>
          <p className="text-xl mb-8 leading-relaxed text-white/90">
            Rejoignez{" "}
            <strong className="font-bold">
              plus de 10 000 passionnés d'automobile
            </strong>{" "}
            et recevez nos meilleurs conseils, guides exclusifs et actualités
            directement dans votre boîte mail.
          </p>

          <div className="max-w-md mx-auto mb-8">
            <Form className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder="Votre adresse email"
                className="flex-1 bg-white text-gray-900 border-0 shadow-lg py-6 text-lg"
                required
              />
              <Button
                type="submit"
                size="lg"
                className="bg-gray-900 hover:bg-black text-white px-8 py-6 text-lg font-bold shadow-2xl"
              >
                <Mail className="w-5 h-5 mr-2" />
                Je m'abonne
              </Button>
            </Form>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm text-white/80">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Gratuit
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />1 email/semaine
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4" />
                Sans spam
              </div>
            </div>
          </div>

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
