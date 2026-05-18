// scripts/audit/utils/escape-markdown-cell.ts
//
// PR-9a — RFC-conformant escape for content rendered inside a GFM markdown
// table cell. Replaces ad-hoc `replace(/\|/g, "\\|")` patterns that CodeQL
// flagged as "Incomplete string escaping or encoding" (no backslash escape).
//
// Order matters: backslash MUST be escaped first, otherwise subsequent
// replacements (which insert `\` characters) would be double-escaped.
//
// Newlines are rendered as `<br/>` (GFM does not allow raw newlines in table
// cells). Backticks are escaped to prevent inline-code break-out.
export function escapeMarkdownCell(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/`/g, "\\`")
    .replace(/\r?\n/g, "<br/>");
}
