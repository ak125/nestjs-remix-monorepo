import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '@remix-run/react';
import guideContent from '~/data/guide-content.json';
import { CheckCircle2, Shield, AlertTriangle, Info, ExternalLink } from 'lucide-react';

interface PurchaseGuideProps {
  familleId?: string | number;
  familleName?: string;
  productName?: string;
  productAlias?: string;
  familleColor?: string;
  className?: string;
}

// Mapping produit -> catégorie de contenu
// Utilise productName (pg_name) pour une détection précise
function detectCategory(productName?: string, familleName?: string): 'plaquettes_frein' | 'disques_frein' | 'amortisseurs' | 'filtres_air' {
  // Priorité au nom du produit pour une détection précise
  const name = (productName || familleName || '').toLowerCase();
  
  if (name.includes('plaquette')) return 'plaquettes_frein';
  if (name.includes('disque')) return 'disques_frein';
  if (name.includes('amortisseur')) return 'amortisseurs';
  if (name.includes('filtre') && name.includes('air')) return 'filtres_air';
  
  // Fallback par défaut
  return 'plaquettes_frein';
}

export function PurchaseGuide({ 
  familleId,
  familleName,
  productName,
  productAlias,
  familleColor = 'from-blue-950 via-indigo-900 to-purple-900',
  className = ''
}: PurchaseGuideProps) {
  const [selectedRange, setSelectedRange] = useState<'economique' | 'qualite_plus' | 'premium'>('qualite_plus');
  
  // Détection automatique de la catégorie basée sur le nom du produit
  const category = detectCategory(productName, familleName);
  const categoryData = guideContent.categories[category];
  const guide = guideContent.guide;

  return (
    <div className={`container mx-auto px-4 ${className}`}>
      <div className="max-w-6xl mx-auto">
        
        {/* Header avec titre */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top duration-700">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            {categoryData.title}
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            {guide.subtitle}
          </p>
        </div>

        {/* ÉTAPE 1 : Compatibilité */}
        <section className="mb-8 animate-in fade-in slide-in-from-left duration-700 delay-100">
          <div className="relative bg-gradient-to-br from-blue-50 via-white to-blue-50/50 rounded-2xl shadow-lg border border-blue-200/50 overflow-hidden">
            {/* Effet de brillance */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            
            <div className="relative p-6 md:p-8">
              <div className="flex items-start gap-4 md:gap-6">
                {/* Badge numéro avec animation pulse */}
                <div className="flex-shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
                    <div className="relative w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-full flex items-center justify-center shadow-xl">
                      <span className="text-3xl md:text-4xl font-bold">1</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                    {categoryData.step1.title}
                  </h3>
                  <p className="text-gray-700 text-base md:text-lg leading-relaxed mb-5">
                    {categoryData.step1.content}
                  </p>
                  
                  {/* Highlight box avec icône */}
                  <div className="bg-gradient-to-r from-blue-100 to-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg mb-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Shield className="w-6 h-6 text-blue-600 flex-shrink-0" />
                      <p className="text-sm md:text-base font-semibold text-blue-900">
                        {categoryData.step1.highlight}
                      </p>
                    </div>
                  </div>
                  
                  {/* Liste de vérification avec checkmarks animés */}
                  <ul className="space-y-3">
                    {guide.steps?.[0]?.bullets?.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-gray-700 group">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mt-0.5 shadow-md group-hover:scale-110 transition-transform">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-base leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ÉTAPE 2 : Gammes */}
        <section className="mb-8 animate-in fade-in slide-in-from-bottom duration-700 delay-200">
          <div className="relative bg-gradient-to-br from-green-50 via-white to-green-50/50 rounded-2xl shadow-lg border border-green-200/50 overflow-hidden">
            <div className="relative p-6 md:p-8">
              
              {/* Header de l'étape */}
              <div className="mb-3">
                <div className="flex items-start gap-4 md:gap-6">
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
                      <div className="relative w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-green-500 to-green-700 text-white rounded-full flex items-center justify-center shadow-xl">
                        <span className="text-3xl md:text-4xl font-bold">2</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                      Choisissez votre gamme
                    </h3>
                    <p className="text-gray-700 text-base md:text-lg leading-relaxed mb-4">
                      Nous proposons 3 gammes adaptées à votre usage et votre budget. Chaque gamme offre qualité et sécurité, avec des caractéristiques spécifiques selon vos besoins.
                    </p>
                    
                    {/* Highlight box avec icône */}
                    <div className="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-600 p-4 rounded-r-lg shadow-sm">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                        <p className="text-sm md:text-base font-semibold text-green-900">
                          Toutes nos gammes sont certifiées et garantissent votre sécurité
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sélecteur de gammes - Cards avec hover effect */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4">
                
                {/* Économique */}
                <button
                  onClick={() => setSelectedRange('economique')}
                  className={`group relative p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden ${
                    selectedRange === 'economique'
                      ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100 shadow-xl scale-105'
                      : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-lg hover:scale-102'
                  }`}
                >
                  {/* Effet de brillance au hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  
                  <div className="relative">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 mb-2 sm:mb-3 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                      <span className="text-lg sm:text-xl font-bold text-gray-600">€</span>
                    </div>
                    <h4 className="font-bold text-lg sm:text-xl mb-1 sm:mb-2 text-gray-900">Économique</h4>
                    <p className="text-sm text-gray-600 mb-3">Usage urbain modéré</p>
                    <p className="text-lg font-bold text-green-600 mb-3">
                      {categoryData.step2_ranges.economique.price_range}
                    </p>
                    {/* Recommendation */}
                    {guide.steps?.[1]?.ranges?.[0]?.recommendation && (
                      <p className="text-xs text-gray-500 italic border-t border-gray-200 pt-2 mt-2">
                        {guide.steps[1].ranges[0].recommendation}
                      </p>
                    )}
                  </div>
                  
                  {/* Indicateur de sélection */}
                  <AnimatePresence>
                    {selectedRange === 'economique' && (
                      <motion.div 
                        className="absolute top-3 right-3"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      >
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>

                {/* Qualité+ */}
                <button
                  onClick={() => setSelectedRange('qualite_plus')}
                  className={`group relative p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden ${
                    selectedRange === 'qualite_plus'
                      ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100 shadow-xl scale-105'
                      : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-lg hover:scale-102'
                  }`}
                >
                  {/* Badge "Le plus choisi" */}
                  {categoryData.step2_ranges.qualite_plus.badge && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-lg animate-in zoom-in">
                        ⭐ {categoryData.step2_ranges.qualite_plus.badge}
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  
                  <div className="relative">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 mb-2 sm:mb-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                      <span className="text-base sm:text-lg font-bold text-blue-600">€€</span>
                    </div>
                    <h4 className="font-bold text-lg sm:text-xl mb-1 sm:mb-2 text-gray-900">Qualité+</h4>
                    <p className="text-sm text-gray-600 mb-3">Usage mixte recommandé</p>
                    <p className="text-lg font-bold text-green-600 mb-3">
                      {categoryData.step2_ranges.qualite_plus.price_range}
                    </p>
                    {/* Recommendation */}
                    {guide.steps?.[1]?.ranges?.[1]?.recommendation && (
                      <p className="text-xs text-gray-500 italic border-t border-gray-200 pt-2 mt-2">
                        {guide.steps[1].ranges[1].recommendation}
                      </p>
                    )}
                  </div>
                  
                  <AnimatePresence>
                    {selectedRange === 'qualite_plus' && (
                      <motion.div 
                        className="absolute top-3 right-3"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      >
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>

                {/* Premium */}
                <button
                  onClick={() => setSelectedRange('premium')}
                  className={`group relative p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden ${
                    selectedRange === 'premium'
                      ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100 shadow-xl scale-105'
                      : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-lg hover:scale-102'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  
                  <div className="relative">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 mb-2 sm:mb-3 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                      <span className="text-sm sm:text-base font-bold text-amber-600">€€€</span>
                    </div>
                    <h4 className="font-bold text-lg sm:text-xl mb-1 sm:mb-2 text-gray-900">Premium</h4>
                    <p className="text-sm text-gray-600 mb-3">Performances maximales</p>
                    <p className="text-lg font-bold text-green-600 mb-3">
                      {categoryData.step2_ranges.premium.price_range}
                    </p>
                    {/* Recommendation */}
                    {guide.steps?.[1]?.ranges?.[2]?.recommendation && (
                      <p className="text-xs text-gray-500 italic border-t border-gray-200 pt-2 mt-2">
                        {guide.steps[1].ranges[2].recommendation}
                      </p>
                    )}
                  </div>
                  
                  <AnimatePresence>
                    {selectedRange === 'premium' && (
                      <motion.div 
                        className="absolute top-3 right-3"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      >
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </div>

              {/* Détails de la gamme sélectionnée - Card animée */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedRange}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ 
                    duration: 0.3,
                    ease: [0.4, 0, 0.2, 1]
                  }}
                  className="relative rounded-xl overflow-hidden"
                >
                  {/* Bordure colorée avec gradient de la famille */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${familleColor} rounded-xl`}></div>
                  
                  {/* Contenu avec fond blanc et padding pour créer l'effet de bordure */}
                  <div className="relative bg-white rounded-lg m-1 p-4 sm:p-6 md:p-8 shadow-xl">
                    {/* Décoration coin supérieur avec couleur famille */}
                    <div 
                      className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -z-10 bg-gradient-to-br ${familleColor} opacity-10`}
                    ></div>
                  
                    <motion.div 
                      className="flex items-start gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6"
                      initial={{ x: -20 }}
                      animate={{ x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div className={`w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shadow-lg flex-shrink-0 ${
                        selectedRange === 'economique' 
                          ? 'bg-gradient-to-br from-gray-100 to-gray-200' 
                          : selectedRange === 'qualite_plus' 
                          ? 'bg-gradient-to-br from-blue-100 to-blue-200' 
                          : 'bg-gradient-to-br from-amber-100 to-amber-200'
                      }`}>
                        <span className={`font-bold ${
                          selectedRange === 'economique' 
                            ? 'text-xl sm:text-2xl text-gray-600' 
                            : selectedRange === 'qualite_plus' 
                            ? 'text-lg sm:text-xl text-blue-600' 
                            : 'text-base sm:text-lg text-amber-600'
                        }`}>
                          {selectedRange === 'economique' ? '€' : selectedRange === 'qualite_plus' ? '€€' : '€€€'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
                          Gamme {selectedRange === 'economique' ? 'Économique' : selectedRange === 'qualite_plus' ? 'Qualité+' : 'Premium'}
                        </h4>
                        <p className="text-gray-600 text-sm sm:text-base md:text-lg">
                          {categoryData.step2_ranges[selectedRange].subtitle}
                        </p>
                      </div>
                    </motion.div>

                    <motion.p 
                      className="text-gray-700 text-base md:text-lg leading-relaxed mb-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      {categoryData.step2_ranges[selectedRange].description}
                    </motion.p>

                    {/* Specs techniques - Grid avec icônes */}
                    <motion.div 
                      className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 mb-6 border border-gray-200"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <h5 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <Info className="w-4 h-4 text-white" />
                        </div>
                        Caractéristiques techniques
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        {categoryData.step2_ranges[selectedRange].specs.map((spec, idx) => (
                          <motion.div 
                            key={idx}
                            className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-green-200 hover:shadow-sm transition-all"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.35 + (idx * 0.05) }}
                          >
                            <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                            <span className="text-sm text-gray-700 leading-relaxed">{spec}</span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Prix mis en valeur */}
                    <motion.div 
                      className="flex items-center justify-between pt-4 border-t border-gray-200"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <span className="text-gray-600 font-medium text-sm sm:text-base">À partir de</span>
                      <div className="text-right">
                        <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-600 leading-tight">
                          {categoryData.step2_ranges[selectedRange].price_range}
                        </p>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* ÉTAPE 3 : Sécurité */}
        <section className="mb-8 animate-in fade-in slide-in-from-right duration-700 delay-300">
          <div className="relative bg-gradient-to-br from-red-50 via-white to-red-50/50 rounded-2xl shadow-lg border border-red-200/50 overflow-hidden">
            <div className="relative p-6 md:p-8">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="flex-shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
                    <div className="relative w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-red-500 to-red-700 text-white rounded-full flex items-center justify-center shadow-xl">
                      <span className="text-3xl md:text-4xl font-bold">3</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                    {categoryData.step3.title}
                  </h3>
                  <p className="text-gray-700 text-base md:text-lg leading-relaxed mb-6">
                    {categoryData.step3.content}
                  </p>

                  {/* Alertes avec couleurs et icônes - utilisant la couleur de la famille */}
                  <div className="space-y-4">
                    {categoryData.step3.alerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className="group relative rounded-xl overflow-hidden transition-all hover:shadow-lg"
                      >
                        {/* Bordure gauche colorée avec gradient de la famille */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${familleColor}`}></div>
                        
                        {/* Fond avec opacité variable selon le type */}
                        <div className={`relative p-4 md:p-5 ml-1 rounded-r-xl ${
                          alert.type === 'danger'
                            ? 'bg-gradient-to-r from-gray-100 to-gray-50'
                            : alert.type === 'warning'
                            ? 'bg-gradient-to-r from-gray-50 to-white'
                            : 'bg-gradient-to-r from-blue-50/30 to-white'
                        }`}>
                          <div className="flex items-start gap-3">
                            {/* Icône avec gradient de la famille */}
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br ${familleColor}`}>
                              {alert.type === 'danger' ? (
                                <AlertTriangle className="w-5 h-5 text-white" />
                              ) : alert.type === 'warning' ? (
                                <Shield className="w-5 h-5 text-white" />
                              ) : (
                                <Info className="w-5 h-5 text-white" />
                              )}
                            </div>
                            <p className="text-sm md:text-base font-semibold leading-relaxed text-gray-900">
                              {alert.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 🔗 Liens vers gammes connexes (maillage interne) */}
                  {'related_gammes' in categoryData.step3 && categoryData.step3.related_gammes && categoryData.step3.related_gammes.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Pièces complémentaires à vérifier
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {(categoryData.step3 as { related_gammes: { pg_id: number; pg_name: string; pg_alias: string }[] }).related_gammes.map((gamme: { pg_id: number; pg_name: string; pg_alias: string }) => (
                          <Link
                            key={gamme.pg_id}
                            to={`/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border border-gray-200 bg-white hover:bg-gradient-to-r hover:${familleColor} hover:text-white hover:border-transparent hover:shadow-md`}
                          >
                            {gamme.pg_name}
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Final - Lien vers l'article blog correspondant à la gamme */}
        <div className="text-center animate-in fade-in zoom-in duration-700 delay-400">
          <Link
            to={productAlias ? `/blog-pieces-auto/conseils/${productAlias}` : '/blog-pieces-auto/conseils'}
            className="group relative inline-flex items-center gap-2 sm:gap-3 px-5 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-base sm:text-lg rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden"
            title={`Voir le guide complet sur les ${categoryData.name.toLowerCase()}`}
          >
            {/* Effet de brillance */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            
            <svg className="w-4 h-4 sm:w-5 sm:h-5 relative text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="relative text-white">Guide complet {categoryData.name}</span>
            <svg className="w-4 h-4 sm:w-5 sm:h-5 relative text-white group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

      </div>
    </div>
  );
}
