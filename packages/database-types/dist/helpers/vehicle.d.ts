export declare function formatProductionDate(monthFrom?: string | null, yearFrom?: string | null, monthTo?: string | null, yearTo?: string | null): string;
export declare function formatProductionDateDetailed(monthFrom?: string | null, yearFrom?: string | null, monthTo?: string | null, yearTo?: string | null): string;
export declare function formatPower(powerPs?: number | string | null, powerKw?: number | string | null): string;
export declare function psToKw(ps: number): number;
export declare function kwToPs(kw: number): number;
export declare function literToCm3(liter?: string | null): number | undefined;
export declare function cm3ToLiter(cm3: number): string;
export declare function formatCylinder(liter?: string | null): string;
export declare function formatCodes(codes?: string[] | null): string;
export declare function parseCodes(codesString?: string | null): string[];
export declare function generateVehicleUrl(vehicle: {
    marque_alias: string;
    marque_id: number;
    modele_alias: string;
    modele_id: number;
    type_alias: string;
    type_id: number;
}): string;
export declare function generateProductVehicleUrl(params: {
    gamme_alias: string;
    gamme_id: number;
    marque_alias: string;
    marque_id: number;
    modele_alias: string;
    modele_id: number;
    type_alias: string;
    type_id: number;
}): string;
export declare function generateBrandUrl(brand: {
    marque_alias: string;
    marque_id: number;
}): string;
export declare function generateModelUrl(model: {
    marque_alias: string;
    marque_id: number;
    modele_alias: string;
    modele_id: number;
}): string;
export declare function generateSlug(name: string): string;
export declare function formatVehicleFullName(vehicle: {
    marque?: string;
    modele?: string;
    type?: string;
}): string;
export declare function formatVehicleShortName(vehicle: {
    marque?: string;
    modele?: string;
}): string;
export declare function isYearInRange(year: number, yearFrom?: number | string | null, yearTo?: number | string | null): boolean;
export declare function getAvailableYears(yearFrom?: number | string | null, yearTo?: number | string | null): number[];
//# sourceMappingURL=vehicle.d.ts.map