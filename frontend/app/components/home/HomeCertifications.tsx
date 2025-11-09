/**
 * 🤝 HOME CERTIFICATIONS SECTION
 * 
 * Composant pour afficher les certifications et garanties sur la page d'accueil
 * 
 * Features :
 * - Grid responsive de 4 badges de certification
 * - Icons Lucide avec badges emoji
 * - Hover effects avec transition
 * - Design trustworthy pour rassurer les utilisateurs
 * 
 * Props : Aucune - Composant autonome
 */

import { Shield, Award, CheckCircle2, Star } from "lucide-react";
import { Card } from "../ui/card";

export default function HomeCertifications() {
  const certifications = [
    { icon: Shield, title: "Paiement sécurisé", subtitle: "Paybox certifié", badge: "🔒", color: "blue" },
    { icon: Award, title: "Qualité ISO", subtitle: "Normes ISO 9001", badge: "✓", color: "green" },
    { icon: CheckCircle2, title: "SSL Premium", subtitle: "Données cryptées", badge: "🔐", color: "purple" },
    { icon: Star, title: "Service client", subtitle: "Support expert 6j/7", badge: "⭐", color: "amber" },
  ];

  return (
    <section 
      id="partenaires-certifications" 
      className="py-16 bg-gradient-to-br from-slate-50 to-gray-100"
      aria-label="Nos certifications"
    >
      <div className="container mx-auto px-4 max-w-6xl">
        {/* En-tête simplifié */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Certifications & <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Garanties</span>
          </h2>
          <p className="text-base text-gray-600">
            Votre sécurité et satisfaction garanties
          </p>
        </div>

        {/* 4 Certifications principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {certifications.map((cert, idx) => (
            <Card 
              key={idx}
              className="text-center p-6 border-2 border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 bg-white"
            >
              <div className="text-3xl mb-3">{cert.badge}</div>
              <cert.icon className={`w-10 h-10 mx-auto mb-3 text-${cert.color}-600`} />
              <h3 className="font-bold text-gray-900 text-base mb-1">{cert.title}</h3>
              <p className="text-xs text-gray-500">{cert.subtitle}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
