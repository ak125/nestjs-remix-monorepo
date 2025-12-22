import { Link } from "@remix-run/react";
import { Car, ChevronRight, TrendingUp } from "lucide-react";
import React from "react";

interface MotorisationItem {
  title: string;
  marque_name: string;
  modele_name: string;
  type_name: string;
  puissance: string;
  periode: string;
  image: string;
  link: string;
  description: string;
  advice: string;
}

interface MotorisationsSectionProps {
  motorisations?: {
    title: string;
    items: MotorisationItem[];
  };
  familleColor?: string;
  familleName?: string;
}

export default function MotorisationsSection({
  motorisations,
  familleColor = "from-blue-950 via-indigo-900 to-purple-900",
  familleName = "pièces",
}: MotorisationsSectionProps) {
  if (!motorisations?.items || motorisations.items.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-2xl shadow-xl mb-8 overflow-hidden border border-gray-100">
      {/* Header avec gradient de la famille + décoration */}
      <div
        className={`relative bg-gradient-to-br ${familleColor} p-6 md:p-8 overflow-hidden`}
      >
        {/* Effet de brillance */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]"></div>

        {/* Décoration géométrique */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Icône animée */}
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-lg">
              <Car className="w-7 h-7 text-white" />
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                {motorisations.title}
              </h2>
              <p className="text-white/80 text-sm mt-1">
                Trouvez les {familleName.toLowerCase()} adaptés à votre véhicule
              </p>
            </div>
          </div>

          {/* Badge avec tendance */}
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2.5 rounded-full shadow-lg border border-white/20 w-fit">
            <TrendingUp className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-lg">
              {motorisations.items.length}
            </span>
            <span className="text-white/90 text-sm font-medium">véhicules</span>
          </div>
        </div>
      </div>

      {/* Grid de cartes - responsive et optimisé */}
      <div className="p-6 md:p-8 bg-gradient-to-b from-gray-50/50 to-white">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          {motorisations.items.map((motorisation, index) => (
            <Link
              key={index}
              to={motorisation.link}
              className="group relative bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-transparent hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              {/* Bordure gradient au hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${familleColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 rounded-xl`}
              ></div>
              <div className="absolute inset-0 bg-white m-0.5 rounded-lg group-hover:m-[3px] transition-all duration-300"></div>

              {/* Contenu */}
              <div className="relative p-5 md:p-6">
                <div className="flex items-start gap-4">
                  {/* Image agrandie avec effet hover */}
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${familleColor} rounded-xl opacity-0 group-hover:opacity-20 blur-xl transition-all duration-300`}
                      ></div>
                      <img
                        src={motorisation.image}
                        alt={`${motorisation.marque_name} ${motorisation.modele_name}`}
                        className="relative w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl border-2 border-gray-100 group-hover:border-gray-200 group-hover:scale-110 transition-all duration-300 shadow-md"
                        onError={(e) => {
                          // Fallback vers une image placeholder
                          e.currentTarget.src =
                            "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/render/image/public/uploads/constructeurs-automobiles/marques-modeles/default.webp?width=100&quality=85&t=31536000";
                          e.currentTarget.onerror = null; // Éviter les boucles infinies
                        }}
                      />
                    </div>
                  </div>

                  {/* Informations */}
                  <div className="flex-1 min-w-0">
                    {/* Titre avec meilleure hiérarchie */}
                    <h3 className="font-bold text-gray-900 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-600 transition-all duration-300 mb-2.5 text-base sm:text-lg leading-tight">
                      {motorisation.marque_name} {motorisation.modele_name}
                    </h3>

                    {/* Badges avec meilleur spacing */}
                    <div className="flex items-center gap-2 flex-wrap mb-2.5">
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${familleColor} text-white shadow-sm`}
                      >
                        {motorisation.type_name}
                      </div>
                      <div className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-sm">
                        {motorisation.puissance}
                      </div>
                    </div>

                    {/* Période plus visible */}
                    <p className="text-sm text-gray-600 mb-3 font-medium">
                      📅 {motorisation.periode}
                    </p>

                    {/* Description améliorée - pas de troncature */}
                    <p className="text-sm text-gray-700 leading-relaxed mb-4">
                      {motorisation.description ||
                        motorisation.advice ||
                        `Trouvez les ${familleName.toLowerCase()} compatibles avec votre ${motorisation.marque_name} ${motorisation.modele_name} ${motorisation.type_name}. Livraison rapide et garantie constructeur.`}
                    </p>

                    {/* CTA amélioré */}
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r ${familleColor} text-white font-bold text-sm shadow-md group-hover:shadow-xl transition-all duration-300 group-hover:scale-105`}
                    >
                      <span>Voir les pièces</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
