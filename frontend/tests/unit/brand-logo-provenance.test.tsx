import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrandLogo } from "~/components/ui/BrandLogo";
import { PiecesFilterSidebar } from "~/components/pieces/PiecesFilterSidebar";
import { usePiecesFilters } from "~/hooks/use-pieces-filters";
import { type PieceData } from "~/types/pieces-route.types";

const requested: string[] = [];
let succeed = true;
beforeEach(() => {
  requested.length = 0;
  succeed = true;
  // JSDOM does not load images. Keep the real Radix Avatar and control only
  // the browser image loader so requests and fallback behavior are observable.
  vi.stubGlobal(
    "Image",
    class extends EventTarget {
      complete = false;
      naturalWidth = 0;
      set src(value: string) {
        requested.push(value);
        queueMicrotask(() => {
          this.complete = true;
          this.naturalWidth = succeed ? 100 : 0;
          this.dispatchEvent(new Event(succeed ? "load" : "error"));
        });
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const storage =
  "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/";

describe("BrandLogo uses supplied image provenance", () => {
  it.each([
    null,
    "",
    "   ",
    "no.webp",
    "uploads/equipementiers-automobiles/no.webp",
  ])(
    "shows initials without an invented request for absent source %s",
    async (logoPath) => {
      const view = render(
        <BrandLogo
          logoPath={logoPath}
          brandName="MEAT & DORIA"
          type="equipementier"
        />,
      );
      await waitFor(() => expect(view.getByText("ME")).toBeTruthy());
      expect(requested).toEqual([]);
      expect(view.queryByRole("img")).toBeNull();
    },
  );

  it.each([
    ["supplier.webp", "equipementiers-automobiles/supplier.webp"],
    [
      "equipementiers-automobiles/original/supplier.webp",
      "equipementiers-automobiles/original/supplier.webp",
    ],
    [
      "uploads/equipementiers-automobiles/original/supplier.webp",
      "equipementiers-automobiles/original/supplier.webp",
    ],
    [
      "/img/uploads/equipementiers-automobiles/original/supplier.webp",
      "equipementiers-automobiles/original/supplier.webp",
    ],
  ])("preserves source %s", async (logoPath, objectPath) => {
    const view = render(
      <BrandLogo
        logoPath={logoPath}
        brandName="Supplier"
        type="equipementier"
      />,
    );
    await waitFor(() =>
      expect(view.getByRole("img").getAttribute("src")).toBe(
        `https://www.automecanik.com/imgproxy/rs:fit:200/q:90/plain/${storage}${objectPath}`,
      ),
    );
  });

  it("preserves an absolute source including its query", async () => {
    const source = `${storage}equipementiers-automobiles/original/supplier.webp?v=2`;
    const view = render(
      <BrandLogo logoPath={source} brandName="Supplier" type="equipementier" />,
    );
    await waitFor(() =>
      expect(view.getByRole("img").getAttribute("src")).toBe(source),
    );
  });

  it("keeps the constructor directory for a legacy filename", async () => {
    const view = render(<BrandLogo logoPath="honda.webp" brandName="Honda" />);
    await waitFor(() =>
      expect(view.getByRole("img").getAttribute("src")).toContain(
        `${storage}constructeurs-automobiles/marques-logos/honda.webp`,
      ),
    );
  });

  it("falls back to initials after one failed supplied image", async () => {
    succeed = false;
    const view = render(
      <BrandLogo
        logoPath="missing.webp"
        brandName="Supplier"
        type="equipementier"
      />,
    );
    await waitFor(() => expect(view.getByText("SU")).toBeTruthy());
    expect(requested).toHaveLength(1);
    expect(view.queryByRole("img")).toBeNull();
  });
});

const piece = (id: number, brand: string, logo?: string): PieceData => ({
  id,
  brand,
  marque_logo: logo,
  name: "Filter",
  price: 20,
  priceFormatted: "20 EUR",
  stock: "in stock",
  reference: `REF-${id}`,
});

describe("supplier logos reach the filter sidebar", () => {
  it("uses the first supplied logo and keeps it when search filters out that piece", async () => {
    const input = [
      piece(1, "MEAT & DORIA"),
      piece(2, "MEAT & DORIA", "md.webp"),
      piece(3, "WIX FILTERS"),
    ];
    const hook = renderHook(() => usePiecesFilters(input));
    expect(hook.result.current.brandLogos.get("MEAT & DORIA")).toBe("md.webp");
    expect(hook.result.current.brandLogos.has("WIX FILTERS")).toBe(false);
    await act(async () =>
      hook.result.current.updateFilters({ searchText: "REF-3" }),
    );
    expect(hook.result.current.filteredProducts.map((p) => p.id)).toEqual([3]);
    expect(hook.result.current.brandLogos.get("MEAT & DORIA")).toBe("md.webp");
    const view = render(
      <PiecesFilterSidebar
        activeFilters={hook.result.current.activeFilters}
        setActiveFilters={hook.result.current.setActiveFilters}
        uniqueBrands={hook.result.current.uniqueBrands}
        brandLogos={hook.result.current.brandLogos}
        piecesCount={input.length}
        resetAllFilters={hook.result.current.resetAllFilters}
      />,
    );
    await waitFor(() =>
      expect(
        view
          .getByRole("img", { name: "Logo MEAT & DORIA" })
          .getAttribute("src"),
      ).toContain("/md.webp"),
    );
    await waitFor(() => expect(view.getByText("WI")).toBeTruthy());
    expect(requested).toHaveLength(1);
  });

  it("ignores absent sentinels, keeps the first valid source, and refreshes with input", () => {
    const input = [
      piece(1, "Supplier", "no.webp"),
      piece(2, "Supplier", "first.webp"),
      piece(3, "Supplier", "second.webp"),
    ];
    const hook = renderHook(({ pieces }) => usePiecesFilters(pieces), {
      initialProps: { pieces: input },
    });
    expect(hook.result.current.brandLogos.get("Supplier")).toBe("first.webp");
    hook.rerender({ pieces: [piece(4, "New", "new.webp")] });
    expect([...hook.result.current.brandLogos]).toEqual([["New", "new.webp"]]);
  });
});
