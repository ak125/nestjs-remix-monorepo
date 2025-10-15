import { ArrowRight, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";

interface HeroSectionProps {
  stats: {
    products: number;
    customers: number;
    brands: number;
    delivery: number;
  };
}

export function HeroSection({ stats }: HeroSectionProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 59,
    seconds: 59
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { hours: prev.hours, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.4"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
        }} />
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main Heading */}
          <h1 className="text-5xl md:text-6xl font-bold mb-6 animate-fade-in-up">
            Votre route vers des pièces auto de qualité commence ici
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 opacity-95 animate-fade-in-up animation-delay-200">
            Plus de {stats.products.toLocaleString('fr-FR')} pièces en stock • Livraison express • Prix imbattables
          </p>

          {/* Countdown Timer */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8 inline-block animate-fade-in-up animation-delay-400">
            <p className="text-sm font-semibold mb-3 text-yellow-300">🔥 OFFRE LIMITÉE - SE TERMINE DANS :</p>
            <div className="flex justify-center space-x-4">
              <div className="text-center">
                <div className="bg-white/20 rounded-lg px-4 py-3 min-w-[80px]">
                  <div className="text-4xl font-bold">{timeLeft.hours.toString().padStart(2, '0')}</div>
                  <div className="text-xs uppercase mt-1">Heures</div>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-white/20 rounded-lg px-4 py-3 min-w-[80px]">
                  <div className="text-4xl font-bold">{timeLeft.minutes.toString().padStart(2, '0')}</div>
                  <div className="text-xs uppercase mt-1">Minutes</div>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-white/20 rounded-lg px-4 py-3 min-w-[80px]">
                  <div className="text-4xl font-bold">{timeLeft.seconds.toString().padStart(2, '0')}</div>
                  <div className="text-xs uppercase mt-1">Secondes</div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="mb-12 animate-fade-in-up animation-delay-600">
            <a 
              href="/nouveautes" 
              className="inline-flex items-center bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-full font-semibold text-lg transition transform hover:scale-105 shadow-2xl"
            >
              Explorer les nouveautés
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 hover:bg-white/20 transition">
              <div className="text-3xl md:text-4xl font-bold text-yellow-400">{(stats.products / 1000).toFixed(0)}K+</div>
              <div className="text-sm mt-1 opacity-90">Pièces en stock</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 hover:bg-white/20 transition">
              <div className="text-3xl md:text-4xl font-bold text-green-400">{stats.brands}+</div>
              <div className="text-sm mt-1 opacity-90">Marques</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 hover:bg-white/20 transition">
              <div className="text-3xl md:text-4xl font-bold text-purple-400">{(stats.customers / 1000).toFixed(0)}K+</div>
              <div className="text-sm mt-1 opacity-90">Clients satisfaits</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 hover:bg-white/20 transition">
              <div className="text-3xl md:text-4xl font-bold text-orange-400">{stats.delivery}h</div>
              <div className="text-sm mt-1 opacity-90">Livraison</div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="mt-12 animate-bounce">
            <TrendingUp className="h-8 w-8 mx-auto opacity-50" />
          </div>
        </div>
      </div>
    </section>
  );
}
