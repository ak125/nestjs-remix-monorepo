/**
 * Configuration sections conseil R3 (S1-S8)
 * Shared by Guide design system components, ConseilSections, and the route.
 */

import {
  Info,
  AlertTriangle,
  CheckCircle,
  Wrench,
  ShieldAlert,
  ClipboardCheck,
  Package,
  HelpCircle,
  ExternalLink,
  Settings,
  Car,
  Stethoscope,
} from "lucide-react";

// --- Types ---

export interface GammeConseil {
  title: string;
  content: string;
  sectionType: string | null;
  order: number | null;
  qualityScore: number | null;
  sources: string[];
  /** Pre-computed anchor slug from server (single source of truth for TOC) */
  anchor?: string;
}

export interface BlogSection {
  level: 2 | 3;
  title: string;
  content: string;
  anchor: string;
  cta_anchor?: string | null;
  cta_link?: string | null;
  wall?: string | null;
}

// --- Section icons & styles ---

export const SECTION_ICONS: Record<string, typeof Info> = {
  S1: Info,
  S2: AlertTriangle,
  S3: CheckCircle,
  S4_DEPOSE: Wrench,
  S4_REPOSE: Wrench,
  S5: ShieldAlert,
  S6: ClipboardCheck,
  S7: Package,
  S8: HelpCircle,
  META: ExternalLink,
  S_GARAGE: Car,
  S2_DIAG: Stethoscope,
};

export const SECTION_STYLES: Record<
  string,
  { border: string; headerBg: string; label: string }
> = {
  S1: {
    border: "border-blue-200",
    headerBg: "bg-gradient-to-r from-blue-600 to-indigo-600",
    label: "Avant de commencer",
  },
  S2: {
    border: "border-amber-200",
    headerBg: "bg-gradient-to-r from-amber-500 to-orange-500",
    label: "Signes d'usure",
  },
  S3: {
    border: "border-emerald-300",
    headerBg: "bg-gradient-to-r from-emerald-600 to-green-600",
    label: "Compatibilité",
  },
  S4_DEPOSE: {
    border: "border-slate-200",
    headerBg: "bg-gradient-to-r from-slate-600 to-gray-700",
    label: "Démontage",
  },
  S4_REPOSE: {
    border: "border-slate-200",
    headerBg: "bg-gradient-to-r from-slate-600 to-gray-700",
    label: "Remontage",
  },
  S5: {
    border: "border-red-200",
    headerBg: "bg-gradient-to-r from-red-500 to-rose-500",
    label: "Erreurs à éviter",
  },
  S6: {
    border: "border-sky-200",
    headerBg: "bg-gradient-to-r from-sky-500 to-blue-500",
    label: "Vérification finale",
  },
  S7: {
    border: "border-green-200",
    headerBg: "bg-gradient-to-r from-green-600 to-emerald-600",
    label: "Pièces complémentaires",
  },
  S8: {
    border: "border-violet-200",
    headerBg: "bg-gradient-to-r from-violet-500 to-purple-500",
    label: "FAQ",
  },
  META: {
    border: "border-gray-200",
    headerBg: "bg-gradient-to-r from-gray-400 to-gray-500",
    label: "Articles associés",
  },
  S_GARAGE: {
    border: "border-amber-300",
    headerBg: "bg-gradient-to-r from-amber-500 to-yellow-500",
    label: "Quand aller au garage",
  },
  S2_DIAG: {
    border: "border-violet-200",
    headerBg: "bg-gradient-to-r from-violet-500 to-indigo-500",
    label: "Diagnostic rapide",
  },
};

const DEFAULT_SECTION_STYLE = {
  border: "border-green-200",
  headerBg: "bg-gradient-to-r from-green-600 to-emerald-600",
  label: "Conseil",
};

export function getSectionStyle(type: string | null) {
  if (!type) return DEFAULT_SECTION_STYLE;
  return SECTION_STYLES[type] || DEFAULT_SECTION_STYLE;
}

// --- Helper components ---

export function SectionIcon({ type }: { type: string | null }) {
  const IconComponent = (type && SECTION_ICONS[type]) || Settings;
  return <IconComponent className="w-6 h-6" />;
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Normalise le contenu S4 legacy (- texte<br>) en <ol><li> pour le step-prose CSS */
export function normalizeStepHtml(html: string): string {
  if (html.includes("<ol>")) return html;

  const lines = html
    .split(/<br\s*\/?>/gi)
    .map((l) => l.trim())
    .filter(Boolean);
  const dashLines = lines.filter((l) => /^[-–—]\s/.test(l));

  if (dashLines.length < 3) return html;

  const items = lines
    .map((line) => {
      if (/^[-–—]\s/.test(line)) {
        return `<li>${line.replace(/^[-–—]\s*/, "")}</li>`;
      }
      return `</ol><p class="text-xs text-gray-500 mt-1 mb-2">${line}</p><ol>`;
    })
    .join("\n");

  return `<ol>${items}</ol>`.replace(/<ol>\s*<\/ol>/g, "");
}

/** Normalise le contenu S5 legacy (- texte<br>) en <ul><li> pour le danger-prose CSS */
export function normalizeDangerHtml(html: string): string {
  if (html.includes("<ul>")) return html;

  const lines = html
    .split(/<br\s*\/?>/gi)
    .map((l) => l.trim())
    .filter(Boolean);
  const dashLines = lines.filter((l) => /^[-–—]\s/.test(l));

  if (dashLines.length < 2) return html;

  const items = lines
    .map((line) => {
      if (/^[-–—]\s/.test(line)) {
        return `<li>${line.replace(/^[-–—]\s*/, "")}</li>`;
      }
      return `</ul><p class="text-xs text-red-700 mt-1 mb-2">${line}</p><ul>`;
    })
    .join("\n");

  return `<ul>${items}</ul>`.replace(/<ul>\s*<\/ul>/g, "");
}

/** Normalise le contenu S8 FAQ : <summary><b>Q</b> → <summary><h3>Q</h3> pour heading outline */
export function normalizeFaqHtml(html: string): string {
  return html.replace(
    /<summary>\s*<b>(.*?)<\/b>\s*<\/summary>/gi,
    '<summary><h3 class="text-sm font-bold inline">$1</h3></summary>',
  );
}

// --- Canonical section order (Page Contract R3) ---

const CANONICAL_ORDER: Record<string, number> = {
  S1: 10,
  S2: 20,
  S3: 30,
  S4_DEPOSE: 40,
  S4_REPOSE: 50,
  S6: 55,
  S5: 60,
  S_GARAGE: 65,
  S2_DIAG: 67,
  S7: 80,
  S8: 85,
  META: 99,
};

// --- Source de vérité canonique (Phase B) ---

interface CanonicalContent {
  s1Sections: GammeConseil[];
  bodySections: GammeConseil[] | BlogSection[];
  metaSections: GammeConseil[];
  sourceType: "conseil" | "article";
}

// --- Helpers strip HTML ---

/** Strip all HTML tags and decode common entities */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract the first sentence longer than minLen chars */
function firstSentence(text: string, minLen = 30): string | null {
  // Split on period, exclamation, question mark followed by space or end
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const trimmed = s.trim();
    if (trimmed.length >= minLen) return trimmed;
  }
  // Fallback: return full text if long enough
  return text.length >= minLen ? text.slice(0, 120) + "…" : null;
}

// --- JSON-LD schema helpers ---

/** Parse S4_DEPOSE sections into a HowTo JSON-LD schema */
export function parseHowToFromS4(
  conseil: GammeConseil[] | null,
  articleTitle: string,
  canonicalUrl: string,
): Record<string, unknown> | null {
  if (!conseil) return null;

  const deposeSection = conseil.find((c) => c.sectionType === "S4_DEPOSE");
  if (!deposeSection) return null;

  // Normalize to <ol><li> then extract <li> text
  const normalized = normalizeStepHtml(deposeSection.content);
  const liMatches = [...normalized.matchAll(/<li>(.*?)<\/li>/gi)];
  const steps = liMatches
    .map((m) => stripHtml(m[1]))
    .filter((t) => t.length > 5);

  if (steps.length < 2) return null;

  const totalMinutes = steps.length * 5;

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: deposeSection.title || `Comment démonter : ${articleTitle}`,
    description: `Procédure de démontage étape par étape — ${articleTitle}`,
    url: canonicalUrl,
    totalTime: `PT${totalMinutes}M`,
    step: steps.map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text,
    })),
  };
}

/** Parse S8 sections into a FAQPage JSON-LD schema */
export function parseFAQFromS8(
  conseil: GammeConseil[] | null,
): Record<string, unknown> | null {
  if (!conseil) return null;

  const faqSections = conseil.filter((c) => c.sectionType === "S8");
  if (faqSections.length === 0) return null;

  // Combine all S8 content
  const combined = faqSections.map((s) => s.content).join("\n");

  // Strip unresolved #LinkGamme_Y# markers
  const cleaned = combined.replace(/#LinkGamme_\d+#/g, "");

  // Extract Q&A: <details><summary><b>Q</b></summary><p>A</p></details>
  const qaRegex =
    /<details>\s*<summary>\s*<b>(.*?)<\/b>\s*<\/summary>\s*<p>(.*?)<\/p>\s*<\/details>/gi;
  const pairs: { q: string; a: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = qaRegex.exec(cleaned)) !== null) {
    const q = stripHtml(match[1]).trim();
    const a = stripHtml(match[2]).trim();
    if (q.length > 5 && a.length > 5) {
      pairs.push({ q, a });
    }
  }

  if (pairs.length < 3) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: a,
      },
    })),
  };
}

// --- Featured snippet helper ---

export interface SummaryPoint {
  label: string;
  text: string;
}

/** Extract one key sentence per section type for featured snippet */
export function extractSummaryPoints(
  conseil: GammeConseil[] | null,
): SummaryPoint[] {
  if (!conseil) return [];

  const targetTypes = ["S1", "S2", "S3", "S4_DEPOSE", "S5", "S6", "S_GARAGE"];
  const points: SummaryPoint[] = [];

  for (const type of targetTypes) {
    const section = conseil.find((c) => c.sectionType === type);
    if (!section) continue;

    const label = SECTION_STYLES[type]?.label ?? type;
    const plain = stripHtml(section.content);
    const sentence = firstSentence(plain);
    if (sentence) {
      points.push({ label, text: sentence });
    }
  }

  return points.length >= 3 ? points : [];
}

// --- Hero badges (heuristic) ---

export interface HeroBadge {
  label: string;
  value: string;
  color: "green" | "amber" | "red" | "blue" | "slate";
}

/** Derive hero badges from conseil sections (heuristic, no DB metadata) */
export function deriveHeroBadges(conseil: GammeConseil[] | null): HeroBadge[] {
  if (!conseil) return [];
  const badges: HeroBadge[] = [];

  // Difficulty from S4_DEPOSE step count
  const depose = conseil.find((c) => c.sectionType === "S4_DEPOSE");
  if (depose) {
    const normalized = normalizeStepHtml(depose.content);
    const stepCount = (normalized.match(/<li>/gi) || []).length;
    if (stepCount <= 4) {
      badges.push({ label: "Difficulté", value: "Facile", color: "green" });
    } else if (stepCount <= 8) {
      badges.push({
        label: "Difficulté",
        value: "Intermédiaire",
        color: "amber",
      });
    } else {
      badges.push({ label: "Difficulté", value: "Avancé", color: "red" });
    }
    // Estimated time: ~5 min per step
    const minutes = stepCount * 5;
    badges.push({
      label: "Temps estimé",
      value: minutes < 60 ? `~${minutes} min` : `~${Math.round(minutes / 60)}h`,
      color: "blue",
    });
  }

  // Safety from S5 presence
  const hasS5 = conseil.some((c) => c.sectionType === "S5");
  badges.push({
    label: "Sécurité",
    value: hasS5 ? "Précautions requises" : "Standard",
    color: hasS5 ? "amber" : "green",
  });

  return badges;
}

// --- Source de vérité canonique (Phase B) ---

export function resolveCanonicalSections(
  conseil: GammeConseil[] | null,
  articleSections: BlogSection[],
): CanonicalContent {
  const hasConseil =
    conseil?.some(
      (c) =>
        c.sectionType && c.sectionType !== "S1" && c.sectionType !== "META",
    ) ?? false;

  const body = hasConseil
    ? conseil!
        .filter(
          (c) =>
            c.sectionType && c.sectionType !== "S1" && c.sectionType !== "META",
        )
        .sort((a, b) => {
          const oa = CANONICAL_ORDER[a.sectionType ?? ""] ?? 90;
          const ob = CANONICAL_ORDER[b.sectionType ?? ""] ?? 90;
          return oa - ob;
        })
    : articleSections;

  const s1 = conseil?.filter((c) => c.sectionType === "S1") ?? [];
  const meta = conseil?.filter((c) => c.sectionType === "META") ?? [];

  // Dev-only: assert no section type rendered in both S1 and body
  if (
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    hasConseil
  ) {
    const s1Types = new Set(s1.map((s) => s.sectionType));
    const bodyTypes = new Set(
      (body as GammeConseil[])
        .filter((s) => s.sectionType)
        .map((s) => s.sectionType),
    );
    const overlap = [...s1Types].filter((t) => bodyTypes.has(t));
    if (overlap.length > 0) {
      console.warn(
        `[R3 anti-doublon] Section types in both S1 and body: ${overlap.join(", ")}`,
      );
    }
  }

  return {
    s1Sections: s1,
    bodySections: body,
    metaSections: meta,
    sourceType: hasConseil ? "conseil" : "article",
  };
}
