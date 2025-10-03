import { ShoppingCart, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "~/components/ui/card";

interface CTAButtonProps {
  anchor: string;
  link: string;
  className?: string;
}

export default function CTAButton({ anchor, link, className = "" }: CTAButtonProps) {
  return (
    <div className={`flex justify-center my-8 ${className}`}>
      <Card className="overflow-hidden border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:shadow-2xl transition-all duration-300 max-w-2xl w-full">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-6 group"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                    Offre spéciale
                  </span>
                </div>
                <p className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {anchor}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Livraison rapide • Garantie constructeur • Prix compétitifs
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-700 transition-colors shadow-lg">
              <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </a>
      </Card>
    </div>
  );
}
