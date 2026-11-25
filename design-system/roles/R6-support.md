# R6 - Support/Help Page

> Intent: Help | Flow: Minimal/Clean

## Overview

R6 (Support) pages provide help, legal information, and customer service. They should be functional and trustworthy.

**Primary Goal:** Help users find answers or contact support efficiently.

## Page Structure

### Above Fold

1. **Page Header**
   - Clear title (H1)
   - Brief description

2. **Quick Actions** (if applicable)
   - Contact button
   - Chat widget trigger
   - Phone number

### Content Area

3. **Content Section**
   - Legal text (CGV, mentions légales)
   - FAQ accordion
   - Help articles

4. **Contact Information**
   - Email
   - Phone
   - Hours of operation
   - Address (if physical)

### Below Fold

5. **Related Help Topics**
   - Links to other support pages
   - Common questions

## Design Tokens

### Colors

Colors come from `packages/design-tokens/src/tokens.json`, by role, never as raw values (P44 of `.claude/governance/journal-des-principes.md`). Navy and orange are the brand colors. Orange marks the one primary action per screen, with navy text; other actions are outlined. Red is for errors and destructive actions only.

### Typography

Outfit for headings, DM Sans for body text, Roboto Mono for codes the user copies, from the tokens (P46). Every weight used is loaded.

## Required Elements

- [ ] Clear page title
- [ ] Contact information
- [ ] Readable text formatting
- [ ] Navigation breadcrumbs

## Forbidden Elements

- [ ] Marketing promotions
- [ ] Product recommendations
- [ ] Sales CTAs
- [ ] Pop-ups
- [ ] Tracking forms (beyond necessary)

## Page Types

| Type | Purpose | URL Example |
|------|---------|-------------|
| Contact | Customer service | `/contact` |
| CGV | Terms of service | `/conditions-generales-de-vente.html` |
| FAQ | Common questions | `/support/faq` |
| Returns | Return policy | `/support/retours` |
| Privacy | Privacy policy | `/politique-confidentialite` |

## Accessibility

- Legal text must be readable (16px minimum)
- High contrast (4.5:1+)
- Clear link styling
- Printable format

## Example URLs

```
/contact
/conditions-generales-de-vente.html
/support
/mentions-legales
```

## Version

- **Version:** 2.0.0
- **Last Updated:** 2026-01-28
