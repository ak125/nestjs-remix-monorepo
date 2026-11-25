# R4 - Reference/Definition Page

> Intent: Definition | Flow: Structured Knowledge

## Overview

R4 (Reference) pages provide authoritative definitions and technical specifications. They're optimized for featured snippets and knowledge panels.

**Primary Goal:** Provide clear, structured definitions that answer "What is X?" queries.

## Page Structure

### Above Fold

1. **Definition Header**
   - Term (H1)
   - Pronunciation (optional)
   - Quick definition (1-2 sentences)

2. **Key Facts Card**
   - Type/Category
   - Common synonyms
   - Related terms

### Content Area

3. **Detailed Explanation**
   - In-depth definition
   - How it works
   - Components/Parts

4. **Visual Diagram** (if applicable)
   - Labeled diagram
   - Component breakdown

5. **Related Terms**
   - Glossary links
   - See also section

### Below Fold

6. **FAQ Section**
   - Common questions
   - Accordion format

7. **Soft Product Link**
   - "Trouver des pièces liées"
   - Single CTA to category

## Design Tokens

### Colors

Colors come from `packages/design-tokens/src/tokens.json`, by role, never as raw values (P44 of `.claude/governance/journal-des-principes.md`). Navy and orange are the brand colors. Orange marks the one primary action per screen, with navy text; other actions are outlined. Red is for errors and destructive actions only.

### Typography

Outfit for headings, DM Sans for body text, Roboto Mono for codes the user copies, from the tokens (P46). Every weight used is loaded.

## Required Elements

- [ ] Clear term definition
- [ ] Structured data (DefinedTerm)
- [ ] Related terms section
- [ ] Breadcrumbs
- [ ] FAQ section

## Forbidden Elements

- [ ] Filters or faceted navigation
- [ ] Product prices
- [ ] Cart buttons
- [ ] Marketing banners
- [ ] Promotional content

## Schema.org

```json
{
  "@type": "DefinedTerm",
  "name": "...",
  "description": "...",
  "inDefinedTermSet": {
    "@type": "DefinedTermSet",
    "name": "Automecanik Glossaire Auto"
  }
}
```

## Example URLs

```
/reference-auto/abs/
/reference-auto/disque-de-frein/
/reference-auto/capteur-pmh/
```

## Version

- **Version:** 2.0.0
- **Last Updated:** 2026-01-28
