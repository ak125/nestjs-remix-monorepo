/**
 * GuideAlert — Danger (S5) or warning (S2) alert section.
 * severity="danger" → red, 3-col reading guide, danger-prose
 * severity="warning" → amber, table-friendly, symptom list
 */

import { ShieldAlert, AlertTriangle } from "lucide-react";
import {
  type GammeConseil,
  normalizeDangerHtml,
} from "~/components/blog/conseil/section-config";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { GuideCard } from "./GuideCard";

interface GuideAlertProps {
  section: GammeConseil;
  severity: "danger" | "warning";
}

const CONFIG = {
  danger: {
    icon: ShieldAlert,
    gradient: "from-red-600 to-rose-600",
    border: "border-red-400",
    labelColor: "text-red-100",
    label: "Risques si mal fait",
    bodyBg: "bg-red-50",
    textColor: "text-red-900",
    proseClass: "danger-prose",
    htmlClass: `text-sm text-red-900 leading-relaxed
      [&_p]:mb-3 [&_strong]:font-bold [&_strong]:text-red-800`,
  },
  warning: {
    icon: AlertTriangle,
    gradient: "from-amber-500 to-orange-500",
    border: "border-amber-200",
    labelColor: "text-amber-100",
    label: "Quand remplacer ?",
    bodyBg: "bg-amber-50/50",
    textColor: "text-gray-700",
    proseClass: "",
    htmlClass: `text-sm text-gray-700 leading-relaxed
      [&_p]:mb-3 [&_a]:text-amber-700 [&_a]:underline-offset-2
      [&_strong]:font-semibold [&_strong]:text-gray-900
      [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1
      [&_table]:w-full [&_th]:bg-amber-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-amber-800
      [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-amber-100 [&_td]:text-sm`,
  },
} as const;

const DangerSubHeader = () => (
  <div className="grid grid-cols-3 text-center text-[10px] font-semibold uppercase tracking-wider border-b border-red-200 bg-red-100/60">
    <span className="py-2 text-red-700">Erreur courante</span>
    <span className="py-2 text-red-700 border-x border-red-200">Risque</span>
    <span className="py-2 text-red-700">Correctif</span>
  </div>
);

export function GuideAlert({ section, severity }: GuideAlertProps) {
  const c = CONFIG[severity];
  const html =
    severity === "danger"
      ? normalizeDangerHtml(section.content)
      : section.content;

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
      subHeader={severity === "danger" ? <DangerSubHeader /> : undefined}
    >
      <div className={c.proseClass}>
        <HtmlContent html={html} className={c.htmlClass} trackLinks={true} />
      </div>
    </GuideCard>
  );
}
