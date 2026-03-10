/**
 * ThemeExplorer — Grille "Explorer par thème" (10 familles de pièces)
 * Section SEO entre les tabs de contenu et la FAQ
 */
import { Link } from "@remix-run/react";
import {
  Disc,
  Settings,
  Cog,
  Gauge,
  Wind,
  Navigation,
  Car,
  Zap,
  Snowflake,
  RotateCcw,
} from "lucide-react";

const THEMES = [
  { name: "Freinage", slug: "plaquette-de-frein", icon: Disc },
  { name: "Embrayage", slug: "kit-embrayage", icon: Settings },
  { name: "Distribution", slug: "kit-de-distribution", icon: Cog },
  { name: "Moteur", slug: "turbo", icon: Gauge },
  { name: "Échappement", slug: "filtre-a-particules", icon: Wind },
  { name: "Direction", slug: "pompe-direction-assistee", icon: Navigation },
  { name: "Suspension", slug: "amortisseur", icon: Car },
  { name: "Électricité", slug: "alternateur", icon: Zap },
  { name: "Climatisation", slug: "compresseur-climatisation", icon: Snowflake },
  { name: "Transmission", slug: "volant-moteur", icon: RotateCcw },
] as const;

export function ThemeExplorer() {
  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            Explorer par thème
          </h2>
          <p className="text-gray-600 text-center mb-8">
            Retrouvez nos conseils classés par famille de pièces automobiles
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {THEMES.map((theme) => (
              <Link
                key={theme.slug}
                to={`/blog-pieces-auto/conseils/${theme.slug}`}
                prefetch="intent"
                className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all bg-gray-50 hover:bg-blue-50"
              >
                <theme.icon className="w-6 h-6 text-gray-500 group-hover:text-blue-600 transition-colors" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 transition-colors text-center">
                  {theme.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
