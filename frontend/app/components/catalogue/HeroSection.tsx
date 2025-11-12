// 🎯 HeroSection - Composant Hero réutilisable avec Design Tokens
// Utilise le Design System pour cohérence visuelle et maintenance facilitée

import { Shield } from 'lucide-react';
import type { ReactNode } from 'react';
import VehicleSelector from '../vehicle/VehicleSelector';

export interface HeroSectionProps {
  // 🎨 Apparence
  familleColor?: string; // Gradient Tailwind ex: "from-blue-950 via-indigo-900 to-purple-900"
  wallpaperUrl?: string; // Image de fond optionnelle
  
  // 📝 Contenu
  title: string;
  subtitle: string;
  badges?: Array<{
    icon?: ReactNode;
    label: string;
    color?: string; // Tailwind color ex: "red-300"
  }>;
  
  // 🖼️ Image produit
  productImage?: {
    src: string;
    alt: string;
  };
  
  // 🚗 VehicleSelector
  onVehicleSelect?: (vehicle: any) => void;
  
  // 🎯 Famille (pour badge contextuel)
  famille?: {
    mf_id: number;
    mf_name: string;
  };
  
  // 🎨 Style personnalisé
  className?: string;
}

export function HeroSection({
  familleColor = 'from-blue-950 via-indigo-900 to-purple-900',
  wallpaperUrl,
  title,
  subtitle,
  badges = [],
  productImage,
  onVehicleSelect,
  famille,
  className = '',
}: HeroSectionProps) {
  
  return (
    <section 
      className={`relative overflow-hidden bg-gradient-to-br ${familleColor} text-white py-space-12 md:py-space-16 lg:py-space-20 ${className}`}
      aria-label="Sélection véhicule"
    >
      {/* 🖼️ Image wallpaper en arrière-plan (si disponible) */}
      {wallpaperUrl && (
        <div className="absolute inset-0 z-0">
          <img
            src={wallpaperUrl}
            alt={title}
            className="w-full h-full object-cover opacity-25"
            loading="eager"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          {/* Overlay gradient pour lisibilité */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-transparent"></div>
        </div>
      )}
      
      {/* 🌀 Effet mesh gradient adaptatif */}
      <div 
        className="absolute inset-0 z-[1] opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(0,0,0,0.15) 0%, transparent 50%)`
        }}
        aria-hidden="true"
      />
      <div 
        className="absolute inset-0 z-[1] opacity-[0.07]" 
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
                           linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)`,
          backgroundSize: '3rem 3rem'
        }}
        aria-hidden="true"
      />
      
      {/* ✨ Formes décoratives organiques */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/[0.07] rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite] z-[1]" aria-hidden="true"></div>
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-black/[0.08] rounded-full blur-3xl animate-[pulse_12s_ease-in-out_infinite] z-[1]" aria-hidden="true"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-white/[0.03] rounded-full blur-3xl animate-[pulse_10s_ease-in-out_infinite] z-[1]" aria-hidden="true"></div>
      
      <div className="relative z-10 container mx-auto px-space-4 max-w-7xl">
        
        {/* 🏷️ Badges contextuels en haut */}
        {(badges.length > 0 || famille) && (
          <div className="flex flex-wrap justify-center items-center gap-space-3 mb-space-6 md:mb-space-8 animate-in fade-in duration-700">
            {/* Badge famille */}
            {famille && (
              <div className="inline-flex items-center gap-space-2 px-space-4 py-space-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-lg">
                <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${familleColor} animate-pulse shadow-lg`}></div>
                <span className="text-white/95 font-semibold text-sm tracking-wide">{famille.mf_name}</span>
              </div>
            )}
            
            {/* Badges personnalisés */}
            {badges.map((badge, index) => (
              <div 
                key={index}
                className="inline-flex items-center gap-space-2 px-space-4 py-space-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-lg"
              >
                {badge.icon}
                <span className={`text-${badge.color || 'white/95'} text-sm font-semibold`}>
                  {badge.label}
                </span>
              </div>
            ))}
          </div>
        )}
        
        {/* 📰 Titre H1 dynamique optimisé SEO */}
        <div className="text-center mb-space-6 md:mb-space-8 animate-in fade-in duration-700 delay-100">
          <h1 className="font-heading text-[var(--font-size-fluid-3xl)] md:text-[var(--font-size-fluid-4xl)] lg:text-[var(--font-size-fluid-5xl)] font-bold leading-tight">
            <span className="bg-gradient-to-r from-white via-white to-white/90 bg-clip-text text-transparent drop-shadow-2xl">
              {title}
            </span>
          </h1>
        </div>
        
        {/* 🎴 Cadre glassmorphism contenant Image + VehicleSelector */}
        <div className="max-w-5xl mx-auto mb-space-8 md:mb-space-10 animate-in fade-in duration-1000 delay-200">
          <div className="bg-gradient-to-br from-white/[0.18] to-white/[0.10] backdrop-blur-xl rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.4)] p-space-6 md:p-space-8 border border-white/30 hover:border-white/50 transition-all duration-500">
            
            {/* Sous-titre dynamique en haut du cadre */}
            <div className="text-center mb-space-6">
              <p className="text-white/95 text-base md:text-lg font-semibold drop-shadow-lg">
                {subtitle}
              </p>
            </div>
            
            {/* Layout horizontal : Image + VehicleSelector côte à côte */}
            <div className="flex flex-col lg:flex-row items-center gap-space-6 lg:gap-space-8">
              
              {/* 🖼️ Image produit à gauche (si fournie) */}
              {productImage && (
                <div className="flex-shrink-0 w-full lg:w-80">
                  <div className="relative group">
                    {/* Cercle décoratif arrière-plan */}
                    <div className="absolute inset-0 -z-10">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-white/10 rounded-full blur-3xl group-hover:bg-white/15 transition-all duration-700"></div>
                    </div>
                    
                    {/* Container image */}
                    <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-space-6 border border-white/20 shadow-lg group-hover:border-white/40 transition-all duration-500">
                      <div className="w-full aspect-square flex items-center justify-center">
                        <img
                          src={productImage.src}
                          alt={productImage.alt}
                          className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-105 transition-all duration-700"
                          loading="eager"
                        />
                      </div>
                    </div>
                    
                    {/* Particules décoratives */}
                    <div className="absolute -top-4 -left-4 w-8 h-8 bg-white/20 rounded-full blur-xl animate-[float_6s_ease-in-out_infinite]" aria-hidden="true"></div>
                    <div className="absolute -bottom-4 -right-4 w-10 h-10 bg-white/15 rounded-full blur-xl animate-[float_8s_ease-in-out_infinite]" aria-hidden="true"></div>
                  </div>
                </div>
              )}
              
              {/* 🚗 VehicleSelector à droite */}
              <div className="flex-1 w-full">
                <VehicleSelector 
                  className="w-full"
                  onVehicleSelect={onVehicleSelect}
                />
              </div>
              
            </div>
          </div>
        </div>
        
      </div>
    </section>
  );
}

// 🎯 Fonction helper pour créer badge sécurité automatiquement
export function createSecurityBadge() {
  return {
    icon: <Shield className="w-4 h-4 text-red-300" />,
    label: "Votre sécurité est notre priorité",
    color: "white/95"
  };
}
