import { Award, Rocket, BookOpen, Facebook, Twitter, Linkedin } from "lucide-react";

export function WhyChooseUs() {
  const features = [
    {
      icon: <Award className="h-12 w-12" />,
      title: "Qualité Premium",
      description: "Pièces d'origine certifiées avec garantie constructeur",
      color: "from-yellow-400 to-orange-500"
    },
    {
      icon: <Rocket className="h-12 w-12" />,
      title: "Rapidité Express",
      description: "Livraison en 24h-48h partout en France",
      color: "from-blue-400 to-indigo-500"
    },
    {
      icon: <BookOpen className="h-12 w-12" />,
      title: "Expertise Auto",
      description: "Conseils de mécaniciens professionnels",
      color: "from-purple-400 to-pink-500"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Pourquoi AutoMecanik est votre choix numéro un
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Nous combinons qualité, rapidité et expertise pour vous offrir une expérience d'achat inégalée
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition transform hover:-translate-y-2 group"
            >
              <div className={`bg-gradient-to-br ${feature.color} text-white w-20 h-20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition`}>
                {feature.icon}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Social Share */}
        <div className="text-center">
          <p className="text-gray-600 mb-4 font-semibold">Partagez avec vos amis :</p>
          <div className="flex justify-center space-x-4">
            <Button className="p-3 rounded-full transition" variant="blue">
              <Facebook className="h-5 w-5" />
            </Button>
            <button className="bg-sky-500 hover:bg-sky-600 text-white p-3 rounded-full transition">
              <Twitter className="h-5 w-5" />
            </button>
            <button className="bg-blue-700 hover:bg-blue-800 text-white p-3 rounded-full transition">
              <Linkedin className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
