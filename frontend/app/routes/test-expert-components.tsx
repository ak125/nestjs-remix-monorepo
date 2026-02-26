/**
 * Test page for Expert Components (Trust & Authority Design System)
 * @description Visual validation of V2 expert components
 */

import { type MetaFunction } from "@remix-run/node";
import { useState } from "react";

import {
  ProductStickyCTAV2,
  CompatibilitySheetV2,
  ProductTrustRowV2,
  CompactTrustBadgesV2,
  FooterTrustRowV2,
  GOOGLE_FONTS_URL,
} from "~/components/expert";

export const meta: MetaFunction = () => [
  { title: "Test Expert Components - Trust & Authority Design" },
];

// Mock data
const mockVehicle = {
  brand: "Renault",
  model: "Clio 4",
  generation: "Phase 2",
  yearFrom: 2016,
  yearTo: 2019,
  fuelType: "diesel" as const,
  powerHp: 90,
  engineCode: "K9K",
  cnit: "M10RENCG025J456",
  typeMine: "MRE1234567",
};

const mockCompatibleVehicles = [
  {
    brand: "Renault",
    model: "Clio 4",
    yearFrom: 2012,
    yearTo: 2019,
    fuelType: "essence" as const,
  },
  {
    brand: "Renault",
    model: "Captur",
    yearFrom: 2013,
    yearTo: 2019,
    fuelType: "diesel" as const,
  },
  {
    brand: "Nissan",
    model: "Juke",
    yearFrom: 2010,
    yearTo: 2019,
    fuelType: "essence" as const,
  },
];

const mockOemReferences = ["0986494525", "7701207484", "7701208416"];

export default function TestExpertComponents() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link href={GOOGLE_FONTS_URL} rel="stylesheet" />

      <div className="min-h-screen bg-slate-100 pb-32">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-slate-900">
              Expert Components
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Trust & Authority Design System
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* ProductTrustRowV2 */}
          <section className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-[#0F766E]">
            <h3 className="text-sm font-semibold text-slate-500 mb-4">
              ProductTrustRowV2
            </h3>
            <ProductTrustRowV2
              rating={4.7}
              reviewCount={128}
              warrantyYears={2}
              returnDays={30}
              isOemQuality={true}
            />
          </section>

          {/* CompactTrustBadgesV2 */}
          <section className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-[#0F766E]">
            <h3 className="text-sm font-semibold text-slate-500 mb-4">
              CompactTrustBadgesV2
            </h3>
            <CompactTrustBadgesV2 warrantyYears={2} isOemQuality={true} />
          </section>

          {/* FooterTrustRowV2 */}
          <section className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-[#0F766E]">
            <h3 className="text-sm font-semibold text-slate-500 mb-4">
              FooterTrustRowV2
            </h3>
            <FooterTrustRowV2 />
          </section>

          {/* CompatibilitySheetV2 Trigger */}
          <section className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-[#0F766E]">
            <h3 className="text-sm font-semibold text-slate-500 mb-4">
              CompatibilitySheetV2
            </h3>
            <button
              onClick={() => setSheetOpen(true)}
              className="px-4 py-2 bg-[#0369A1] text-white rounded-lg font-medium cursor-pointer hover:bg-[#075985] transition-colors"
            >
              Ouvrir Sheet
            </button>
          </section>
        </div>

        {/* Sticky CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <ProductStickyCTAV2
            price={4599}
            originalPrice={5999}
            stockQuantity={5}
            isCompatible={true}
            vehicleContext="Renault Clio 4"
            productRef="BRK001-BOSCH"
            onAddToCart={() => alert("Ajouté au panier!")}
          />
        </div>

        {/* Compatibility Sheet */}
        <CompatibilitySheetV2
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          isCompatible={true}
          productName="Plaquettes de frein Bosch"
          currentVehicle={mockVehicle}
          oemReferences={mockOemReferences}
          compatibleVehicles={mockCompatibleVehicles}
          onConfirmCompatibility={() => {
            setSheetOpen(false);
            alert("Compatibilité confirmée!");
          }}
          onChangeVehicle={() => alert("Changer de véhicule")}
        />
      </div>
    </>
  );
}
