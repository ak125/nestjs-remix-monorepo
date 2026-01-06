import { Car, CheckCircle, AlertTriangle, BookOpen, Info, Lightbulb, Factory, HelpCircle, Package } from 'lucide-react';

interface TOCItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface TableOfContentsProps {
  gammeName?: string;
  hasMotorizations?: boolean;
  hasSymptoms?: boolean;
  hasGuide?: boolean;
  hasInformations?: boolean;
  hasConseils?: boolean;
  hasEquipementiers?: boolean;
  hasFaq?: boolean;
  hasCatalogue?: boolean;
}

export default function TableOfContents({
  gammeName: _gammeName = 'pièces',
  hasMotorizations = true,
  hasSymptoms = true,
  hasGuide = true,
  hasInformations = true,
  hasConseils = true,
  hasEquipementiers = true,
  hasFaq = true,
  hasCatalogue = true,
}: TableOfContentsProps) {
  const items: TOCItem[] = [
    { id: 'vehicle-selector', label: 'Sélection véhicule', icon: <Car className="w-4 h-4" /> },
    ...(hasMotorizations ? [{ id: 'compatibilities', label: 'Compatibilités', icon: <CheckCircle className="w-4 h-4" /> }] : []),
    ...(hasSymptoms ? [{ id: 'symptoms', label: 'Symptômes', icon: <AlertTriangle className="w-4 h-4" /> }] : []),
    ...(hasGuide ? [{ id: 'quick-guide', label: 'Guide rapide', icon: <BookOpen className="w-4 h-4" /> }] : []),
    ...(hasInformations ? [{ id: 'essentials', label: 'Informations', icon: <Info className="w-4 h-4" /> }] : []),
    ...(hasConseils ? [{ id: 'advice', label: 'Conseils', icon: <Lightbulb className="w-4 h-4" /> }] : []),
    ...(hasEquipementiers ? [{ id: 'brands', label: 'Équipementiers', icon: <Factory className="w-4 h-4" /> }] : []),
    ...(hasFaq ? [{ id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-4 h-4" /> }] : []),
    ...(hasCatalogue ? [{ id: 'family', label: 'Autres pièces', icon: <Package className="w-4 h-4" /> }] : []),
  ];

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    // SSR-safe: document/window n'existent pas côté serveur
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Hauteur de la navbar sticky
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
    }
  };

  return (
    <nav
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-6 overflow-hidden"
      aria-label="Sommaire de la page"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-500 text-sm font-medium">Accès rapide :</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => handleClick(e, item.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-full text-sm text-gray-700 hover:text-blue-700 transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
          >
            {item.icon}
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
