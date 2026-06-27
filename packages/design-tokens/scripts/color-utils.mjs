/**
 * Color math shared by the token build + schema drift-guards + tests.
 *
 * These three functions are a faithful port of the original `build-tokens.js`
 * generator and are VERIFIED to reproduce the committed `tokens.css` oracle
 * exactly (contrast: 56/56 vars; hexToHSL(primary.500) = "218 58% 14%").
 * They are the only non-mechanical logic in the token pipeline.
 */

/** WCAG relative luminance of a #rrggbb hex (sRGB). */
export function calculateLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Foreground (#000000 / #ffffff) for a background hex — threshold 0.179. */
export function getContrastColor(hex) {
  return calculateLuminance(hex) > 0.179 ? "#000000" : "#ffffff";
}

/** "#rrggbb" -> "H S% L%" HSL-channel string (shadcn/ui convention). */
export function hexToHSL(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
