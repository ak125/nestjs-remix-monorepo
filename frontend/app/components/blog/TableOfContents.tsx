import { ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface TOCSection {
  level: number;
  title: string;
  anchor: string;
}

interface TableOfContentsProps {
  sections: TOCSection[];
  className?: string;
}

/**
 * 📑 TableOfContents - Sommaire interactif avec scroll spy
 * Suit automatiquement la position de lecture et permet la navigation
 */
export function TableOfContents({ sections, className = '' }: TableOfContentsProps) {
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    // Scroll spy avec IntersectionObserver
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -80% 0px',
        threshold: 0.5
      }
    );

    // Observer toutes les sections
    sections.forEach((section) => {
      const element = document.getElementById(section.anchor);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleClick = (anchor: string) => {
    const element = document.getElementById(anchor);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (sections.length === 0) return null;

  return (
    <nav className={`bg-white rounded-lg shadow-lg sticky top-4 ${className}`}>
      <div className="p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-gray-900">
          📑 Sommaire
        </h3>
        <div className="space-y-2">
          {sections.map((section) => {
            const isActive = activeSection === section.anchor;
            const isH2 = section.level === 2;

            return (
              <button
                key={section.anchor}
                onClick={() => handleClick(section.anchor)}
                className={`
                  w-full text-left text-sm transition-all duration-200
                  ${isH2 ? 'font-medium text-gray-900' : 'ml-4 text-gray-600'}
                  ${isActive 
                    ? 'text-blue-600 font-semibold bg-blue-50 -ml-2 pl-2 py-1 rounded-r-lg border-l-2 border-blue-600' 
                    : 'hover:text-blue-600 hover:bg-gray-50 -ml-2 pl-2 py-1 rounded-r-lg'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  {isActive && <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                  <span className="line-clamp-2">{section.title}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Progression</span>
            <span>
              {sections.findIndex(s => s.anchor === activeSection) + 1} / {sections.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ 
                width: `${((sections.findIndex(s => s.anchor === activeSection) + 1) / sections.length) * 100}%` 
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
