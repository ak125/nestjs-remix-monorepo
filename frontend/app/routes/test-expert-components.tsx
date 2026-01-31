/**
 * Test page for Expert components (DCO V2 Pack Confiance)
 * @description Page de test pour validation visuelle
 */

import { type MetaFunction } from "@remix-run/node";
import { useState } from "react";
import {
  ProductStickyCTA,
  CompatibilitySheet,
  ProductTrustRow,
  CompactTrustBadges,
  FooterTrustRow,
} from "~/components/expert";

export const meta: MetaFunction = () => [
  { title: "Test Expert Components - DCO V2" },
];

export default function TestExpertComponents() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold">Test Expert Components</h1>
        <p className="text-sm text-gray-500">DCO V2 - Pack Confiance</p>
      </div>

      {/* Content area */}
      <div className="p-4 space-y-6">
        {/* ProductTrustRow */}
        <section className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">ProductTrustRow</h2>
          <ProductTrustRow
            rating={4.7}
            reviewCount={128}
            warrantyYears={2}
            returnDays={30}
            isOemQuality={true}
          />
        </section>

        {/* CompactTrustBadges */}
        <section className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">CompactTrustBadges</h2>
          <CompactTrustBadges warrantyYears={2} isOemQuality={true} />
        </section>

        {/* FooterTrustRow */}
        <section className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">FooterTrustRow</h2>
          <FooterTrustRow />
        </section>

        {/* CompatibilitySheet Trigger */}
        <section className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">CompatibilitySheet</h2>
          <button
            onClick={() => setSheetOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Ouvrir le sheet de compatibilité
          </button>
        </section>
      </div>

      {/* Sticky CTA (fixed at bottom on mobile) */}
      <ProductStickyCTA
        price={4599}
        originalPrice={5999}
        stockQuantity={5}
        isCompatible={true}
        vehicleContext="Renault Clio 4"
        productRef="BRK001-BOSCH"
        onAddToCart={() => alert("Ajouté au panier!")}
      />

      {/* CompatibilitySheet */}
      <CompatibilitySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        isCompatible={true}
        productName="Plaquettes de frein Bosch"
        currentVehicle={{
          brand: "Renault",
          model: "Clio 4",
          generation: "Phase 2",
          yearFrom: 2016,
          yearTo: 2019,
          fuelType: "diesel",
          powerHp: 90,
          engineCode: "K9K",
          cnit: "M10RENCG025J456",
          typeMine: "MRE1234567",
        }}
        oemReferences={["0986494525", "7701207484", "7701208416"]}
        compatibleVehicles={[
          {
            brand: "Renault",
            model: "Clio 4",
            yearFrom: 2012,
            yearTo: 2019,
            fuelType: "essence",
          },
          {
            brand: "Renault",
            model: "Captur",
            yearFrom: 2013,
            yearTo: 2019,
            fuelType: "diesel",
          },
          {
            brand: "Nissan",
            model: "Juke",
            yearFrom: 2010,
            yearTo: 2019,
            fuelType: "essence",
          },
        ]}
        onConfirmCompatibility={() => {
          setSheetOpen(false);
          alert("Compatibilité confirmée!");
        }}
        onChangeVehicle={() => alert("Changer de véhicule")}
      />
    </div>
  );
}
