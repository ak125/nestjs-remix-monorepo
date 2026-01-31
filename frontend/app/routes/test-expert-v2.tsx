/**
 * Test page for Expert Components V1 vs V2 Comparison
 * @description Side-by-side comparison to visualize design system differences
 *
 * V1: Original DCO V2 (generic green #34C759)
 * V2: Trust & Authority (Professional Blue #0369A1 + Trust Teal #0F766E)
 */

import { type MetaFunction } from "@remix-run/node";
import { useState } from "react";

// V1 & V2 Components
import {
  ProductStickyCTA,
  CompatibilitySheet,
  ProductTrustRow,
  CompactTrustBadges,
  FooterTrustRow,
  ProductStickyCTAV2,
  CompatibilitySheetV2,
  ProductTrustRowV2,
  CompactTrustBadgesV2,
  FooterTrustRowV2,
  GOOGLE_FONTS_URL,
} from "~/components/expert";

export const meta: MetaFunction = () => [
  { title: "Expert Components V1 vs V2 - DCO Design Comparison" },
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

export default function TestExpertV2() {
  const [sheetOpenV1, setSheetOpenV1] = useState(false);
  const [sheetOpenV2, setSheetOpenV2] = useState(false);
  const [activeTab, setActiveTab] = useState<"v1" | "v2" | "compare">(
    "compare",
  );

  return (
    <>
      {/* Google Fonts for V2 */}
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
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-slate-900">
              Expert Components: V1 vs V2
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              DCO V2 Design System Comparison - ui-ux-pro-max + frontend-design
              skills
            </p>

            {/* Tab Navigation */}
            <div className="flex gap-2 mt-4">
              {(["compare", "v1", "v2"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    activeTab === tab
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab === "compare" ? "Side by Side" : tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Design System Legend */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 gap-4 mb-8">
            {/* V1 Legend */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 rounded-full bg-[#34C759]" />
                <h3 className="font-bold text-slate-800">V1 - Original</h3>
              </div>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Generic Green CTA (#34C759)</li>
                <li>• System fonts</li>
                <li>• Basic trust badges</li>
                <li>• Simple animations</li>
              </ul>
            </div>

            {/* V2 Legend */}
            <div className="bg-white rounded-xl p-4 border-2 border-[#0F766E]">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex gap-1">
                  <div className="w-4 h-4 rounded-full bg-[#0F766E]" />
                  <div className="w-4 h-4 rounded-full bg-[#0369A1]" />
                </div>
                <h3 className="font-bold text-slate-800">
                  V2 - Trust & Authority
                </h3>
              </div>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Professional Blue CTA (#0369A1)</li>
                <li>• Trust Teal (#0F766E)</li>
                <li>• Lexend + Source Sans 3</li>
                <li>• Enhanced animations</li>
              </ul>
            </div>
          </div>

          {/* Content based on tab */}
          {activeTab === "compare" ? (
            <div className="grid grid-cols-2 gap-6">
              {/* V1 Column */}
              <div className="space-y-6">
                <div className="bg-red-50 rounded-lg px-3 py-2 text-sm font-medium text-red-700">
                  V1 - Original Design
                </div>

                {/* ProductTrustRow V1 */}
                <section className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-500 mb-4">
                    ProductTrustRow
                  </h3>
                  <ProductTrustRow
                    rating={4.7}
                    reviewCount={128}
                    warrantyYears={2}
                    returnDays={30}
                    isOemQuality={true}
                  />
                </section>

                {/* CompactTrustBadges V1 */}
                <section className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-500 mb-4">
                    CompactTrustBadges
                  </h3>
                  <CompactTrustBadges warrantyYears={2} isOemQuality={true} />
                </section>

                {/* FooterTrustRow V1 */}
                <section className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-500 mb-4">
                    FooterTrustRow
                  </h3>
                  <FooterTrustRow />
                </section>

                {/* CompatibilitySheet Trigger V1 */}
                <section className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-500 mb-4">
                    CompatibilitySheet
                  </h3>
                  <button
                    onClick={() => setSheetOpenV1(true)}
                    className="px-4 py-2 bg-[#34C759] text-white rounded-lg font-medium cursor-pointer"
                  >
                    Ouvrir Sheet V1
                  </button>
                </section>
              </div>

              {/* V2 Column */}
              <div className="space-y-6">
                <div className="bg-[#F0FDFA] rounded-lg px-3 py-2 text-sm font-medium text-[#0F766E]">
                  V2 - Trust & Authority Design
                </div>

                {/* ProductTrustRow V2 */}
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

                {/* CompactTrustBadges V2 */}
                <section className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-[#0F766E]">
                  <h3 className="text-sm font-semibold text-slate-500 mb-4">
                    CompactTrustBadgesV2
                  </h3>
                  <CompactTrustBadgesV2 warrantyYears={2} isOemQuality={true} />
                </section>

                {/* FooterTrustRow V2 */}
                <section className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-[#0F766E]">
                  <h3 className="text-sm font-semibold text-slate-500 mb-4">
                    FooterTrustRowV2 (Certificates)
                  </h3>
                  <FooterTrustRowV2 />
                </section>

                {/* CompatibilitySheet Trigger V2 */}
                <section className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-[#0F766E]">
                  <h3 className="text-sm font-semibold text-slate-500 mb-4">
                    CompatibilitySheetV2
                  </h3>
                  <button
                    onClick={() => setSheetOpenV2(true)}
                    className="px-4 py-2 bg-[#0369A1] text-white rounded-lg font-medium cursor-pointer hover:bg-[#075985] transition-colors"
                  >
                    Ouvrir Sheet V2
                  </button>
                </section>
              </div>
            </div>
          ) : activeTab === "v1" ? (
            <div className="max-w-lg mx-auto space-y-6">
              <section className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">V1 Components</h3>
                <div className="space-y-6">
                  <ProductTrustRow
                    rating={4.7}
                    reviewCount={128}
                    warrantyYears={2}
                    returnDays={30}
                    isOemQuality={true}
                  />
                  <hr className="border-slate-100" />
                  <CompactTrustBadges warrantyYears={2} isOemQuality={true} />
                  <hr className="border-slate-100" />
                  <FooterTrustRow />
                </div>
              </section>
            </div>
          ) : (
            <div className="max-w-lg mx-auto space-y-6">
              <section className="bg-white rounded-xl p-6 shadow-sm border-2 border-[#0F766E]">
                <h3
                  className="text-lg font-semibold mb-4"
                  style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
                >
                  V2 Components - Trust & Authority
                </h3>
                <div className="space-y-6">
                  <ProductTrustRowV2
                    rating={4.7}
                    reviewCount={128}
                    warrantyYears={2}
                    returnDays={30}
                    isOemQuality={true}
                  />
                  <hr className="border-slate-100" />
                  <CompactTrustBadgesV2 warrantyYears={2} isOemQuality={true} />
                  <hr className="border-slate-100" />
                  <FooterTrustRowV2 />
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Sticky CTAs Comparison */}
        <div className="fixed bottom-0 left-0 right-0 z-40">
          {activeTab === "compare" ? (
            <div className="grid grid-cols-2">
              {/* V1 Sticky CTA */}
              <div className="border-r border-slate-200">
                <ProductStickyCTA
                  price={4599}
                  originalPrice={5999}
                  stockQuantity={5}
                  isCompatible={true}
                  vehicleContext="Renault Clio 4"
                  productRef="BRK001-BOSCH"
                  onAddToCart={() => alert("V1: Ajouté au panier!")}
                />
              </div>
              {/* V2 Sticky CTA */}
              <div>
                <ProductStickyCTAV2
                  price={4599}
                  originalPrice={5999}
                  stockQuantity={5}
                  isCompatible={true}
                  vehicleContext="Renault Clio 4"
                  productRef="BRK001-BOSCH"
                  onAddToCart={() => alert("V2: Ajouté au panier!")}
                />
              </div>
            </div>
          ) : activeTab === "v1" ? (
            <ProductStickyCTA
              price={4599}
              originalPrice={5999}
              stockQuantity={5}
              isCompatible={true}
              vehicleContext="Renault Clio 4"
              productRef="BRK001-BOSCH"
              onAddToCart={() => alert("V1: Ajouté au panier!")}
            />
          ) : (
            <ProductStickyCTAV2
              price={4599}
              originalPrice={5999}
              stockQuantity={5}
              isCompatible={true}
              vehicleContext="Renault Clio 4"
              productRef="BRK001-BOSCH"
              onAddToCart={() => alert("V2: Ajouté au panier!")}
            />
          )}
        </div>

        {/* Compatibility Sheets */}
        <CompatibilitySheet
          open={sheetOpenV1}
          onOpenChange={setSheetOpenV1}
          isCompatible={true}
          productName="Plaquettes de frein Bosch (V1)"
          currentVehicle={mockVehicle}
          oemReferences={mockOemReferences}
          compatibleVehicles={mockCompatibleVehicles}
          onConfirmCompatibility={() => {
            setSheetOpenV1(false);
            alert("V1: Compatibilité confirmée!");
          }}
          onChangeVehicle={() => alert("V1: Changer de véhicule")}
        />

        <CompatibilitySheetV2
          open={sheetOpenV2}
          onOpenChange={setSheetOpenV2}
          isCompatible={true}
          productName="Plaquettes de frein Bosch (V2)"
          currentVehicle={mockVehicle}
          oemReferences={mockOemReferences}
          compatibleVehicles={mockCompatibleVehicles}
          onConfirmCompatibility={() => {
            setSheetOpenV2(false);
            alert("V2: Compatibilité confirmée!");
          }}
          onChangeVehicle={() => alert("V2: Changer de véhicule")}
        />
      </div>
    </>
  );
}
