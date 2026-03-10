/**
 * BlogSearchBar — Barre de recherche + filtre type
 */
import { Form } from "@remix-run/react";
import { Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface BlogSearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
}

export function BlogSearchBar({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
}: BlogSearchBarProps) {
  return (
    <section className="py-6 bg-white border-b">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-slate-50 rounded-xl p-4 border border-gray-200">
            <Form method="get" className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  name="q"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Rechercher des articles, guides, conseils..."
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-0 text-gray-900 bg-white/90 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-lg"
                />
              </div>

              <select
                name="type"
                value={selectedType}
                onChange={(e) => onTypeChange(e.target.value)}
                className="px-6 py-4 rounded-xl border-0 text-gray-900 bg-white/90 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="">Tous les types</option>
                <option value="advice">Conseils</option>
                <option value="guide">Guides</option>
                <option value="constructeur">Constructeurs</option>
                <option value="glossaire">Glossaire</option>
              </select>

              <Button
                type="submit"
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-8 py-4 rounded-xl text-lg font-semibold"
              >
                <Search className="w-5 h-5 mr-2" />
                Rechercher
              </Button>
            </Form>
          </div>
        </div>
      </div>
    </section>
  );
}
