/**
 * GuideChecklist — "Avant de commencer" (S1) or "Après montage" (S6).
 * variant="before" → blue info checklist with s1-prose
 * variant="after" → sky checklist with rodage-prose
 */

import { Info, ClipboardCheck, Clipboard, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type GammeConseil,
  stripHtml,
} from "~/components/blog/conseil/section-config";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { GuideCard } from "./GuideCard";

interface GuideChecklistProps {
  section: GammeConseil;
  variant: "before" | "after";
}

const CONFIG = {
  before: {
    icon: Info,
    gradient: "from-blue-600 to-indigo-600",
    border: "border-blue-200",
    labelColor: "text-blue-100",
    label: "Avant de commencer",
    bodyBg: "bg-blue-50/50",
    proseClass: "s1-prose",
    htmlClass: `text-sm text-gray-700 leading-relaxed
      [&_p]:mb-3 [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2
      [&_strong]:font-semibold [&_strong]:text-gray-900`,
  },
  after: {
    icon: ClipboardCheck,
    gradient: "from-sky-500 to-blue-500",
    border: "border-sky-200",
    labelColor: "text-sky-100",
    label: "Après montage",
    bodyBg: "bg-sky-50",
    proseClass: "rodage-prose",
    htmlClass: `text-sm text-sky-900 leading-relaxed
      [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-sky-800`,
  },
} as const;

export function GuideChecklist({ section, variant }: GuideChecklistProps) {
  const c = CONFIG[variant];
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = stripHtml(section.content);
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Checklist copiée !", { duration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <GuideCard
      title={section.title}
      anchor={section.anchor}
      icon={c.icon}
      label={c.label}
      gradient={c.gradient}
      border={c.border}
      labelColor={c.labelColor}
      bodyBg={c.bodyBg}
      sources={section.sources}
      subHeader={
        variant === "after" ? (
          <div className="flex justify-end px-5 py-2 bg-sky-50/80 border-b border-sky-100">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 bg-white border border-sky-200 rounded-md hover:bg-sky-50 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Clipboard className="w-3.5 h-3.5" />
              )}
              {copied ? "Copié !" : "Copier la checklist"}
            </button>
          </div>
        ) : undefined
      }
    >
      <div className={c.proseClass}>
        <HtmlContent
          html={section.content}
          className={c.htmlClass}
          trackLinks={true}
        />
      </div>
    </GuideCard>
  );
}
