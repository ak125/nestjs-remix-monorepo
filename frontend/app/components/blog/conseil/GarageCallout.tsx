/**
 * GarageCallout — "Quand c'est mieux d'aller au garage"
 * Renders S_GARAGE sections with amber/professional styling.
 */

import { Car, Wrench } from "lucide-react";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { type GammeConseil, slugifyTitle } from "./section-config";

interface GarageCalloutProps {
  section: GammeConseil;
}

export function GarageCallout({ section }: GarageCalloutProps) {
  return (
    <div id={section.anchor ?? slugifyTitle(section.title)} className="mb-8">
      <div className="rounded-xl border-2 border-amber-300 overflow-hidden shadow-md">
        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-100 mb-0.5">
              Quand aller au garage
            </div>
            <h2 className="text-xl font-bold leading-tight">{section.title}</h2>
          </div>
        </div>
        <div className="bg-amber-50 px-6 py-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 border border-amber-200 rounded-full text-xs font-semibold text-amber-800 mb-4">
            <Wrench className="w-3 h-3" />
            Conseil professionnel
          </div>
          <HtmlContent
            html={section.content}
            className="text-sm text-amber-900 leading-relaxed
              [&_p]:mb-3 [&_strong]:font-bold [&_strong]:text-amber-800
              [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-amber-900 [&_li]:mb-1"
            trackLinks={true}
          />
        </div>
      </div>
    </div>
  );
}
