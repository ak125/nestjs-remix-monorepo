import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { type GammeConseil } from "~/components/blog/conseil/section-config";
import { MiniDiagnosticTable } from "~/components/guide/MiniDiagnosticTable";

// HtmlContent dépend du routeur (useLocation) — hors sujet ici.
vi.mock("~/components/seo/HtmlContent", () => ({
  HtmlContent: ({ html }: { html: string }) => <div>{html}</div>,
}));

function section(over: Partial<GammeConseil> = {}): GammeConseil {
  return {
    title: "Diagnostic rapide du alternateur",
    content: "<table></table>",
    sectionType: "S2_DIAG",
    order: 2,
    qualityScore: null,
    sources: [],
    ...over,
  };
}

describe("MiniDiagnosticTable — ancre ADR-027 #diagnostic-rapide", () => {
  it("expose l'ancre stable des 301 R5 et garde l'ancre serveur du TOC", () => {
    const { container } = render(
      <MiniDiagnosticTable
        section={section({ anchor: "diagnostic-rapide-du-alternateur" })}
      />,
    );

    expect(container.querySelectorAll("#diagnostic-rapide")).toHaveLength(1);
    expect(
      container.querySelector("#diagnostic-rapide-du-alternateur"),
    ).not.toBeNull();
  });

  it("sans ancre serveur, l'id de la carte reste dérivé du titre", () => {
    const { container } = render(
      <MiniDiagnosticTable section={section({ anchor: undefined })} />,
    );

    expect(container.querySelectorAll("#diagnostic-rapide")).toHaveLength(1);
    expect(
      container.querySelector("#diagnostic-rapide-du-alternateur"),
    ).not.toBeNull();
  });

  it("titre slugifié en « diagnostic-rapide » : un seul id, pas de doublon", () => {
    const { container } = render(
      <MiniDiagnosticTable
        section={section({ title: "Diagnostic rapide", anchor: undefined })}
      />,
    );

    expect(container.querySelectorAll("#diagnostic-rapide")).toHaveLength(1);
  });
});
