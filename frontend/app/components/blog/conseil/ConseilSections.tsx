/**
 * ConseilSections — Dispatcher for S2-S8 conseil sections.
 * Routes each sectionType to its Guide design system component.
 * Fallback: generic card for S3 (and any future types).
 */

import { FileText } from "lucide-react";
import { SectionImage } from "~/components/content/SectionImage";
import {
  GuideAlert,
  GuideSteps,
  GuideChecklist,
  MiniDiagnosticTable,
  GuideFaq,
  GuideParts,
  SoftCTA,
} from "~/components/guide";
import { annotateGlossaryTerms } from "~/components/guide/GlossaryTooltip";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { GarageCallout } from "./GarageCallout";
import {
  type GammeConseil,
  getSectionStyle,
  SectionIcon,
  slugifyTitle,
} from "./section-config";

interface ConseilSectionsProps {
  sections: GammeConseil[];
  pgAlias?: string;
  pgId?: number;
  hasR6Guide?: boolean;
}

export function ConseilSections({
  sections,
  pgAlias,
  pgId,
  hasR6Guide,
}: ConseilSectionsProps) {
  return (
    <>
      {sections.map((conseilItem, index) => {
        // --- Reusable image block for sections with approved images ---
        const sectionImage = conseilItem.image ? (
          <SectionImage
            src={conseilItem.image.src}
            alt={conseilItem.image.alt}
            caption={conseilItem.image.caption}
            placement="full"
            size="lg"
            priority={conseilItem.image.loading === "eager"}
          />
        ) : null;

        // --- Per-type dispatcher (Guide design system) ---
        if (conseilItem.sectionType === "S2") {
          return (
            <div key={index}>
              <GuideAlert section={conseilItem} severity="warning" />
              {sectionImage}
            </div>
          );
        }
        if (conseilItem.sectionType === "S5") {
          return (
            <GuideAlert key={index} section={conseilItem} severity="danger" />
          );
        }
        if (conseilItem.sectionType === "S6") {
          return (
            <GuideChecklist key={index} section={conseilItem} variant="after" />
          );
        }
        if (conseilItem.sectionType === "S4_DEPOSE") {
          return (
            <div key={index}>
              <GuideSteps section={conseilItem} variant="depose" />
              {sectionImage}
            </div>
          );
        }
        if (conseilItem.sectionType === "S4_REPOSE") {
          return (
            <GuideSteps key={index} section={conseilItem} variant="repose" />
          );
        }
        if (conseilItem.sectionType === "S_GARAGE") {
          return <GarageCallout key={index} section={conseilItem} />;
        }
        if (conseilItem.sectionType === "S2_DIAG") {
          return <MiniDiagnosticTable key={index} section={conseilItem} />;
        }
        if (conseilItem.sectionType === "S8") {
          return <GuideFaq key={index} section={conseilItem} />;
        }
        if (conseilItem.sectionType === "S7") {
          return (
            <GuideParts
              key={index}
              section={conseilItem}
              pgAlias={pgAlias}
              pgId={pgId}
            />
          );
        }

        // --- Generic card fallback (S3 + any future types) ---
        const style = getSectionStyle(conseilItem.sectionType);
        const content = annotateGlossaryTerms(conseilItem.content);

        return (
          <div
            key={index}
            id={conseilItem.anchor ?? slugifyTitle(conseilItem.title)}
            className="mb-8"
          >
            <Card
              className={`shadow-xl border-2 ${style.border} overflow-hidden`}
            >
              <CardHeader className={`${style.headerBg} text-white`}>
                <h2 className="flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight">
                  <SectionIcon type={conseilItem.sectionType} />
                  {conseilItem.title}
                </h2>
              </CardHeader>
              <CardContent className="p-6">
                <HtmlContent
                  html={content}
                  className="text-sm text-gray-700 leading-relaxed
                    [&_p]:mb-3 [&_a]:text-blue-600 [&_a]:underline-offset-2
                    [&_strong]:font-semibold [&_strong]:text-gray-900
                    [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
                    [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left
                    [&_th]:text-xs [&_th]:font-semibold [&_th]:text-gray-800 [&_th]:uppercase
                    [&_td]:px-3 [&_td]:py-2 [&_td]:border-t [&_td]:border-gray-100
                    [&_td]:align-top [&_td]:text-gray-700
                    [&_tr:hover_td]:bg-gray-50/50"
                  trackLinks={true}
                />
                {conseilItem.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] text-gray-400">
                    <FileText className="w-3 h-3" />
                    Rédaction : {conseilItem.sources.join(" · ")}
                  </div>
                )}
              </CardContent>
              {sectionImage && <div className="px-6 pb-2">{sectionImage}</div>}
              {conseilItem.sectionType === "S3" && pgAlias && pgId && (
                <div className="px-6 pb-4 flex flex-col gap-2">
                  <SoftCTA
                    label="Vérifier la compatibilité avec votre véhicule"
                    href={`/pieces/${pgAlias}-${pgId}.html`}
                    variant="inline"
                  />
                  {hasR6Guide && (
                    <SoftCTA
                      label="Consulter notre guide d'achat complet"
                      href={`/blog-pieces-auto/guide-achat/${pgAlias}`}
                      variant="inline"
                    />
                  )}
                </div>
              )}
            </Card>
          </div>
        );
      })}
    </>
  );
}
