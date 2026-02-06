import { Award, Shield, Users, Wrench } from "lucide-react";

interface AboutSectionProps {
  className?: string;
  title?: string;
}

/**
 * Composant AboutSection - Reproduit la section 5 PHP
 * Section descriptive "À propos" avec texte informatif
 */
export function AboutSection({
  className = "",
  title = "À propos de notre service",
}: AboutSectionProps) {
  return (
    <div
      className={`bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-16 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête de section */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            {title}
          </h2>
          <div className="mt-3 h-1 w-24 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded"></div>
          <p className="text-xl text-gray-600 mt-6 max-w-3xl mx-auto leading-relaxed">
            Votre partenaire de confiance pour toutes vos pièces automobiles.
            Nous nous engageons à vous fournir des pièces de qualité supérieure
            au meilleur prix, avec un service client exceptionnel.
          </p>
        </div>

        {/* Contenu principal en deux colonnes */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Colonne texte */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900">
              Plus de 20 ans d'expertise dans l'automobile
            </h3>

            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Depuis notre création, nous avons développé une expertise unique
                dans la distribution de pièces automobiles. Notre équipe de
                spécialistes vous accompagne dans le choix des pièces adaptées à
                votre véhicule.
              </p>

              <p>
                Que vous soyez un particulier passionné d'automobile ou un
                professionnel du secteur, nous mettons notre savoir-faire à
                votre service pour vous garantir des pièces de qualité OE
                (Original Equipment) ou équivalent.
              </p>

              <p>
                Notre catalogue comprend plus de 400 000 références couvrant
                toutes les marques et tous les modèles. Nous travaillons
                exclusivement avec des fabricants reconnus pour leur fiabilité
                et leur innovation.
              </p>
            </div>
          </div>

          {/* Colonne statistiques visuelles */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-lg text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">400K+</div>
              <div className="text-gray-600 font-medium">Pièces en stock</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">120+</div>
              <div className="text-gray-600 font-medium">
                Marques référencées
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                25K+
              </div>
              <div className="text-gray-600 font-medium">
                Clients satisfaits
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">98%</div>
              <div className="text-gray-600 font-medium">
                Taux de satisfaction
              </div>
            </div>
          </div>
        </div>

        {/* Nos engagements */}
        <div className="border-t border-gray-200 pt-16">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Nos engagements qualité
          </h3>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Engagement 1 */}
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4 group-hover:bg-primary/30 transition-colors">
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Qualité garantie
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                Toutes nos pièces sont certifiées et testées selon les normes
                constructeurs
              </p>
            </div>

            {/* Engagement 2 */}
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mb-4 group-hover:bg-success/30 transition-colors">
                <Wrench className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Expertise technique
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                Nos conseillers techniques vous guident dans le choix de vos
                pièces
              </p>
            </div>

            {/* Engagement 3 */}
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4 group-hover:bg-orange-200 transition-colors">
                <Users className="h-8 w-8 text-orange-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Service client
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                Une équipe dédiée pour répondre à toutes vos questions
                rapidement
              </p>
            </div>

            {/* Engagement 4 */}
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4 group-hover:bg-purple-200 transition-colors">
                <Award className="h-8 w-8 text-purple-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Prix compétitifs
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                Les meilleurs prix du marché avec notre garantie du prix le plus
                bas
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AboutSection;
