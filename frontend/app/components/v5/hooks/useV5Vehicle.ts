/**
 * V5 Vehicle Hook — ship 1
 *
 * Adapter sur ~/hooks/useVehicleContext.ts qui dérive le format V5
 * { label, sub } depuis { brand, model, type } existant.
 *
 * Si aucun véhicule sélectionné (ni URL, ni sessionStorage), on retourne
 * un fallback démo "Peugeot 308 II · 2017 · 1.6 BlueHDi 120" pour que les
 * maquettes V5 affichent un état renseigné. Le fallback est marqué
 * `isFallback: true` pour qu'un futur design puisse l'identifier.
 *
 * Au ship 3 : la plaque cliquera vers une modal qui écrit dans
 * sessionStorage 'selectedVehicle', le hook se mettra à jour automatiquement.
 */

import { useMemo } from "react";

import { useVehicleContext } from "~/hooks/useVehicleContext";

export type V5Vehicle = {
  label: string | null;
  sub: string | null;
  plate: string | null;
  isFallback: boolean;
};

const FALLBACK: V5Vehicle = {
  label: "Peugeot 308 II",
  sub: "2017 · 1.6 BlueHDi 120",
  plate: "AB-123-CD",
  isFallback: true,
};

const titleCase = (s: string | undefined): string =>
  (s ?? "").replace(
    /(^|[\s-])(\p{L})/gu,
    (_m, p1: string, p2: string) => p1 + p2.toUpperCase(),
  );

export function useV5Vehicle(): V5Vehicle {
  const ctx = useVehicleContext();

  return useMemo(() => {
    const brand = titleCase(ctx.brand);
    const model = titleCase(ctx.model);
    const type = titleCase(ctx.type);

    if (!brand) return FALLBACK;

    return {
      label: model ? `${brand} ${model}` : brand,
      sub: type || null,
      plate: null, // pas de plaque dans le contexte URL — slot ship 3
      isFallback: false,
    };
  }, [ctx.brand, ctx.model, ctx.type]);
}
