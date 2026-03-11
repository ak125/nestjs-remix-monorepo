export type FamilyDomain = 'moteur' | 'chassis' | 'transmission' | 'electrique';
export interface FamilyMeta {
    baseColor: string;
    gradient: string;
    icon: string;
    emoji: string;
    pic: string;
    domain: FamilyDomain;
    keywords: string[];
    seoTerms: string[];
    seoSwitch: string;
}
export declare const FAMILY_REGISTRY: Record<number, FamilyMeta>;
export declare function findFamilyIdByKeyword(input: string): number | undefined;
export declare function getFamilyMeta(mfId: number): FamilyMeta;
export declare const FAMILY_DOMAIN_GROUPS: {
    label: string;
    icon: string;
    familyIds: number[] | null;
}[];
export declare const FAMILY_IDS_ORDERED: number[];
//# sourceMappingURL=family-registry.d.ts.map