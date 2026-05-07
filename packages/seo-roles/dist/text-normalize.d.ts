export type SupportedLocale = "fr-FR";
export declare function normalizeSeoText(text: string): string;
export declare function normalizePhrase(text: string): string;
export declare function tokenize(text: string, locale?: SupportedLocale): string[];
export declare function stem(token: string, locale?: SupportedLocale): string;
export declare function tokenizeAndStem(text: string, locale?: SupportedLocale): ReadonlySet<string>;
//# sourceMappingURL=text-normalize.d.ts.map