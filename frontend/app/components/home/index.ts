export { default as HomepageJsonLd } from "./HomepageJsonLd";
export { default as HeroSection } from "./HeroSection";
export { default as CatalogueSection } from "./CatalogueSection";
export { default as BrandsGrid } from "./BrandsGrid";
export { default as BlogCarousel } from "./BlogCarousel";
export { default as FaqSection } from "./FaqSection";
// NB : `Footer` n'est PLUS ré-exporté ici. Il est chargé exclusivement en lazy
// via `~/components/home/LazyFooter` (specifier canonique unique). Le ré-exporter
// dans ce barrel recréait un import STATIQUE de `Footer.tsx` (INEFFECTIVE_DYNAMIC_IMPORT
// sous Rolldown) → chunk mixed static+dynamic dont l'`import()` peut résoudre
// `undefined` → crash `React.lazy` `_result.default`. Voir LazyFooter.tsx.
export { default as HomeResourcesAndVideoSection } from "./GuidesStrip";
export { default as WhyAutomecanikSection } from "./WhyAutomecanikSection";
export { default as DiagnosticBanner } from "./DiagnosticBanner";
export { default as QuickAccessGrid } from "./QuickAccessGrid";
export { default as PopularSearches } from "./PopularSearches";
