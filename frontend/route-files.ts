// Shared by route discovery and production CSS scanning. DEV keeps these pages.
// Video Hub and Command Center remain routed (and server-authorized) in builds.
export const productionIgnoredRouteFiles = [
  "**/admin.!(video-hub*|command-center.tsx)",
  "**/ui-kit.*",
  "**/ui-kit/**",
  "**/design-system.*",
];
