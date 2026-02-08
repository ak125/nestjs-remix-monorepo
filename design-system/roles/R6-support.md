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

```css
--r6-primary: #1D1D1F;
--r6-secondary: #636366;
--r6-accent: #007AFF;
--r6-background: #FFFFFF;
```

### Typography

```css
--r6-heading: 'Merriweather', serif;
--r6-body: 'Source Sans Pro', sans-serif;
```

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
