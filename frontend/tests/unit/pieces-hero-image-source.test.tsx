import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PiecesHeader } from "~/components/pieces/PiecesHeader";
import { type GammeData, type VehicleData } from "~/types/pieces-route.types";
import { buildHeroImagePreload } from "~/utils/seo/pieces-schema.utils";

const storage =
  "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public";
const generated = "articles/gammes-produits/generated/d444250580ab051a.png";
const vehicle: VehicleData = {
  marque: "renault",
  modele: "clio iii",
  type: "1.5 dCi 90",
  typeName: "1.5 dCi 90",
  typeId: 34189,
  marqueId: 7,
  modeleId: 140004,
  typePowerPs: 90,
  typeFuel: "Diesel",
};
const gamme: GammeData = {
  id: 82,
  name: "Disque de frein",
  alias: "disque-de-frein",
  description: "",
};
const cases = [
  [
    "absolute source",
    `${storage}/uploads/${generated}`,
    `${storage}/uploads/${generated}`,
  ],
  [
    "proxy source",
    `/img/uploads/${generated}`,
    `${storage}/uploads/${generated}`,
  ],
  ["bucket path", `uploads/${generated}`, `${storage}/uploads/${generated}`],
  ["object path", generated, `${storage}/uploads/${generated}`],
  [
    "legacy filename",
    "disque.webp",
    `${storage}/uploads/articles/gammes-produits/catalogue/disque.webp`,
  ],
  [
    "nested legacy filename",
    "freinage/disque.webp",
    `${storage}/uploads/articles/gammes-produits/catalogue/freinage/disque.webp`,
  ],
];

function verifyHero(
  selectedVehicle: VehicleData,
  selectedGamme: GammeData,
  expectedSource: string,
) {
  const { container, unmount } = render(
    <PiecesHeader vehicle={selectedVehicle} gamme={selectedGamme} count={3} />,
  );
  const img = container.querySelector("picture img");
  const preload = buildHeroImagePreload(selectedVehicle, selectedGamme)[0];
  expect(img).not.toBeNull();
  expect(img?.getAttribute("src")).toBe(
    `https://www.automecanik.com/imgproxy/rs:fit:380/plain/${expectedSource}@webp`,
  );
  expect(preload.href).toBe(img?.getAttribute("src"));
  expect(preload.imageSrcSet).toBe(
    container
      .querySelector('source[type="image/webp"]')
      ?.getAttribute("srcset"),
  );
  expect(preload.imageSizes).toBe(
    container.querySelector('source[type="image/webp"]')?.getAttribute("sizes"),
  );
  expect(preload.imageSrcSet).not.toContain("/catalogue/https:");
  unmount();
}

describe("R2 hero image and preload source parity", () => {
  it.each(cases)("renders and preloads %s", (_name, input, expected) => {
    verifyHero(vehicle, { ...gamme, image: input }, expected);
  });
  it("keeps the vehicle photograph ahead of the gamme image", () => {
    verifyHero(
      { ...vehicle, modelePic: "clio.webp", marqueAlias: "renault" },
      { ...gamme, image: `${storage}/uploads/${generated}` },
      `${storage}/uploads/constructeurs-automobiles/marques-modeles/renault/clio.webp`,
    );
  });
  it.each(["no.webp", "models/no.webp", "models/undefined", "models/null"])(
    "uses the gamme when the vehicle image is invalid: %s",
    (modelePic) => {
      verifyHero(
        { ...vehicle, modelePic },
        { ...gamme, image: "disque.webp" },
        `${storage}/uploads/articles/gammes-produits/catalogue/disque.webp`,
      );
    },
  );
  it.each([
    undefined,
    "",
    "no.webp",
    "articles/no.webp",
    "articles/undefined",
    "articles/null",
  ])("does not preload a missing hero: %s", (image) => {
    const selectedGamme = { ...gamme, image };
    const { container, unmount } = render(
      <PiecesHeader vehicle={vehicle} gamme={selectedGamme} count={3} />,
    );
    expect(container.querySelector("picture")).toBeNull();
    expect(buildHeroImagePreload(vehicle, selectedGamme)).toEqual([]);
    unmount();
  });
});
