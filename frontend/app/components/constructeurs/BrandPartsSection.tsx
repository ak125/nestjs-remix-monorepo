import { Link } from '@remix-run/react';
import { Package, TrendingUp } from 'lucide-react';
import { PartImage } from '~/components/ui/ResponsiveImage';

interface Part {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  modele_name: string;
  type_name: string;
  part_url: string;
  image_url: string | null;
}

interface BrandPartsSectionProps {
  parts: Part[];
  brandName: string;
  brandAlias: string;
}

export default function BrandPartsSection({ 
  parts, 
  brandName,
  brandAlias 
}: BrandPartsSectionProps) {
  if (!parts || parts.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-2xl shadow-xl mb-8 overflow-hidden border border-gray-100">
      {/* Header avec gradient dynamique */}
      <div className="relative bg-gradient-to-br from-blue-950 via-indigo-900 to-purple-900 p-6 md:p-8 overflow-hidden">
        {/* Effet de brillance animé */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]"></div>
        
        {/* Décoration géométrique */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
        
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-lg">
              <Package className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                Pièces {brandName} populaires
              </h2>
              <p className="text-white/80 text-sm mt-1">
                Les pièces les plus recherchées pour votre {brandName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2.5 rounded-full shadow-lg border border-white/20 w-fit">
            <TrendingUp className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-lg">{parts.length}</span>
            <span className="text-white/90 text-sm font-medium">pièces</span>
          </div>
        </div>
      </div>

      {/* Grid de pièces */}
      <div className="p-6 md:p-8 bg-gradient-to-b from-gray-50/50 to-white">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {parts.map((part) => (
            <PartCard key={part.pg_id} part={part} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PartCard({ part }: { part: Part }) {
  return (
    <Link
      to={part.part_url}
      className="group relative bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-transparent hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* Bordure gradient au hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-indigo-900 to-purple-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 rounded-xl"></div>
      <div className="absolute inset-0 bg-white m-0.5 rounded-lg group-hover:m-[3px] transition-all duration-300"></div>
      
      {/* Contenu */}
      <div className="relative p-4">
        {/* Image responsive avec srcset */}
        <div className="flex items-center justify-center h-24 mb-3 bg-gray-50 rounded-lg overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-indigo-900 to-purple-900 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
          <PartImage 
            src={part.image_url || '/images/default-part.png'}
            alt={part.pg_name}
            className="relative h-full w-auto object-contain group-hover:scale-110 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 200px"
          />
        </div>
        
        {/* Titre */}
        <h4 className="font-semibold text-sm text-gray-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">
          {part.pg_name}
        </h4>
        
        {/* Info véhicule */}
        <p className="text-xs text-gray-500 mb-2 line-clamp-1">
          {part.modele_name} • {part.type_name}
        </p>
        
        {/* CTA */}
        <div className="flex items-center gap-1 text-blue-600 text-xs font-medium">
          <span className="group-hover:underline">Voir</span>
          <span className="transform group-hover:translate-x-1 transition-transform duration-300">→</span>
        </div>
      </div>
    </Link>
  );
}
