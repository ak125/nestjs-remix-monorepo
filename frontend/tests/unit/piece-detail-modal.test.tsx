import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { PieceDetailModal } from "~/components/pieces/PieceDetailModal";

/**
 * PieceDetailModal — contrat <dialog> natif (fix INP tap carte produit).
 *
 * L'ouverture du Radix Dialog exécutait react-remove-scroll + FocusScope
 * (reflow forcé) dans le handler du tap carte produit = interaction dominante
 * de l'INP mobile /pieces (RUM p75 500ms, lab 296ms @6x). Migré sur
 * useNativeDialog (pattern Navbar/CartSidebarSimple, PR #799). Comme pour
 * use-native-dialog.test.tsx : jsdom n'implémente pas showModal()/close(),
 * on stub ; le gain INP réel est prouvé par sonde Playwright — ces tests
 * verrouillent le CONTRAT (dialog natif piloté par pieceId, fetch détail,
 * fermeture) et l'absence de retour à Radix Dialog.
 */
vi.mock("~/hooks/useCart", () => ({
  useCart: () => ({ addToCart: vi.fn().mockResolvedValue(true) }),
}));
vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("~/utils/analytics", () => ({
  trackViewItem: vi.fn(),
  trackAddToCart: vi.fn(),
}));
vi.mock("~/components/ui/BrandLogo", () => ({ BrandLogo: () => null }));

const pieceFixture = {
  id: 123,
  nom: "Compresseur de climatisation",
  marque: "LIZARTE",
  reference: "71.10.60.005",
  prix_ttc: 249.9,
  image: "260/6216001.JPG",
  dispo: true,
};

describe("PieceDetailModal — <dialog> natif", () => {
  let showModal: ReturnType<typeof vi.fn>;
  let closeFn: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.style.overflow = "";
    showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    // Fidèle au navigateur : close() retire [open] ET dispatch l'event close.
    closeFn = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });
    (
      HTMLDialogElement.prototype as unknown as Record<string, unknown>
    ).showModal = showModal;
    (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close =
      closeFn;
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: pieceFixture }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.style.overflow = "";
  });

  it("pieceId=null → <dialog> natif présent mais fermé, aucun fetch", () => {
    const { container } = render(
      <PieceDetailModal pieceId={null} onClose={vi.fn()} />,
    );

    const dialog = container.querySelector("dialog");
    expect(dialog).toBeTruthy();
    expect(showModal).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pieceId défini → showModal() + fetch du détail + rendu du contenu", async () => {
    render(<PieceDetailModal pieceId={123} onClose={vi.fn()} />);

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe("hidden");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/catalog/pieces/123",
      expect.objectContaining({ credentials: "include" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Compresseur de climatisation")).toBeTruthy(),
    );
  });

  it("event close natif (Échap) → onClose appelé + scroll déverrouillé", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <PieceDetailModal pieceId={123} onClose={onClose} />,
    );

    const dialog = container.querySelector("dialog")!;
    fireEvent(dialog, new Event("close"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe("");
  });

  it("bouton Fermer → dialog.close() natif", async () => {
    render(<PieceDetailModal pieceId={123} onClose={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Fermer" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(closeFn).toHaveBeenCalled();
  });

  it("réouverture 123 → null → 456 : close puis re-fetch + re-showModal", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <PieceDetailModal pieceId={123} onClose={onClose} />,
    );
    expect(showModal).toHaveBeenCalledTimes(1);

    rerender(<PieceDetailModal pieceId={null} onClose={onClose} />);
    expect(closeFn).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1); // event close natif, une seule fois

    rerender(<PieceDetailModal pieceId={456} onClose={onClose} />);
    expect(showModal).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/catalog/pieces/456",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("erreur fetch → état erreur affiché, son bouton Fermer passe par close() (onClose une seule fois)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("réseau"));
    const onClose = vi.fn();
    render(<PieceDetailModal pieceId={123} onClose={onClose} />);

    await waitFor(() =>
      expect(
        screen.getByText("Impossible de charger les details de la piece"),
      ).toBeTruthy(),
    );

    // Deux boutons matchent le nom "Fermer" (X via aria-label + bouton texte) :
    // cibler le bouton texte de l'état erreur.
    fireEvent.click(screen.getByText("Fermer", { selector: "button" }));

    expect(closeFn).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("verrou anti-régression : plus aucun import @radix-ui/react-dialog", () => {
    // vitest tourne avec cwd=frontend ; import.meta.url est http: sous jsdom.
    const source = readFileSync(
      resolve(process.cwd(), "app/components/pieces/PieceDetailModal.tsx"),
      "utf-8",
    );
    expect(source).not.toContain("@radix-ui/react-dialog");
    expect(source).toContain("useNativeDialog");
  });
});
