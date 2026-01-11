/**
 * FAQAccordion - Composant pour afficher une FAQ avec sections pliables
 *
 * @features
 * - Questions/réponses organisées par catégories
 * - Recherche pour filtrer les questions
 * - Mode single (une seule question ouverte à la fois)
 * - Animations fluides d'ouverture/fermeture
 * - Icônes ChevronDown avec rotation
 *
 * @example
 * <FAQAccordion
 *   categories={[
 *     {
 *       name: 'Commandes',
 *       questions: [
 *         { q: 'Comment passer commande ?', a: 'Réponse...' }
 *       ]
 *     }
 *   ]}
 *   searchable
 * />
 */

import { Search } from "lucide-react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Input } from "../ui/input";

export interface FAQQuestion {
  question: string;
  answer: string;
}

export interface FAQCategory {
  name: string;
  questions: FAQQuestion[];
}

interface FAQAccordionProps {
  /** Catégories de questions avec leurs réponses */
  categories: FAQCategory[];
  /** Afficher la barre de recherche */
  searchable?: boolean;
  /** Texte placeholder pour la recherche */
  searchPlaceholder?: string;
  /** Mode single (une seule question ouverte) */
  singleMode?: boolean;
  /** Classe CSS personnalisée */
  className?: string;
}

export function FAQAccordion({
  categories,
  searchable = true,
  searchPlaceholder = "Rechercher une question...",
  singleMode = true,
  className = "",
}: FAQAccordionProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filtrer les questions selon la recherche
  const filteredCategories = categories
    .map((category) => ({
      ...category,
      questions: category.questions.filter(
        (q) =>
          q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.answer.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((category) => category.questions.length > 0);

  const totalQuestions = filteredCategories.reduce(
    (acc, cat) => acc + cat.questions.length,
    0,
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Barre de recherche */}
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-20"
          />
          {searchQuery && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
              {totalQuestions} résultat{totalQuestions > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Message si aucun résultat */}
      {searchQuery && totalQuestions === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <Search className="mx-auto mb-3 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            Aucun résultat trouvé
          </h3>
          <p className="text-sm text-gray-600">
            Essayez avec d'autres mots-clés ou parcourez les catégories
            ci-dessous.
          </p>
        </div>
      )}

      {/* Catégories et questions */}
      {filteredCategories.map((category, catIndex) => (
        <div key={catIndex} className="space-y-3">
          {/* Titre de catégorie */}
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {category.name}
            </h3>
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
              {category.questions.length}
            </span>
          </div>

          {/* Questions de la catégorie */}
          <Accordion
            type={singleMode ? "single" : "multiple"}
            collapsible
            className="space-y-2"
          >
            {category.questions.map((item, qIndex) => (
              <AccordionItem
                key={`${catIndex}-${qIndex}`}
                value={`${catIndex}-${qIndex}`}
                className="rounded-lg border border-gray-200 bg-white px-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <AccordionTrigger className="py-4 text-left hover:no-underline">
                  <div className="flex items-start gap-3 pr-4">
                    <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-600">
                      Q
                    </div>
                    <span className="font-medium text-gray-900">
                      {item.question}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-2">
                  <div className="flex gap-3 pl-9">
                    <div className="w-full rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                      {item.answer}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}

      {/* Footer avec statistiques */}
      {!searchQuery && (
        <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              <span className="font-semibold text-gray-900">
                {categories.length}
              </span>{" "}
              catégorie{categories.length > 1 ? "s" : ""} •{" "}
              <span className="font-semibold text-gray-900">
                {categories.reduce((acc, cat) => acc + cat.questions.length, 0)}
              </span>{" "}
              question
              {categories.reduce((acc, cat) => acc + cat.questions.length, 0) >
              1
                ? "s"
                : ""}
            </span>
            <span className="text-xs text-gray-500">
              Utilisez ⌘F pour rechercher
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
