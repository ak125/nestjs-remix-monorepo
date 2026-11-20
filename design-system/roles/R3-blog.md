# R3 - Blog/Education Page

> Intent: Education | Flow: Content-First

## Overview

R3 (Blog) pages educate users about automotive topics. They build trust and authority, driving organic traffic.

**Primary Goal:** Provide valuable, educational content that positions Automecanik as an expert.

## Page Structure

### Above Fold

1. **Article Header**
   - Title (H1)
   - Reading time
   - Author: the organization Automecanik + logo (no person, no AI named as author — P41)
   - Publication date
   - Category tag

2. **Hero Image** (optional)
   - Featured image
   - Alt text describing content

### Content Area

3. **Article Body**
   - Markdown-rendered content
   - Proper heading hierarchy (H2, H3)
   - Images with captions
   - Code blocks (if applicable)

4. **Table of Contents** (for long articles)
   - Sticky sidebar on desktop
   - Collapsible on mobile

### Below Fold

5. **Related Products** (soft CTA)
   - "Pièces mentionnées dans cet article"
   - 2-3 product cards max

6. **About the Author**
   - The organization Automecanik: name, logo, short presentation
   - Link to other articles

7. **Related Articles**
   - 3-4 related posts
   - Same category or topic

## Design Tokens

### Colors

```css
--r3-primary: #1D1D1F;
--r3-secondary: #636366;
--r3-accent: #007AFF;
--r3-background: #FFFFFF;
```

### Typography

```css
--r3-heading: 'Merriweather', serif;
--r3-body: 'Source Sans Pro', sans-serif;
--r3-mono: 'Fira Code', monospace;
```

### Reading Comfort

```css
--r3-max-width: 720px;
--r3-line-height: 1.75;
--r3-paragraph-spacing: 1.5rem;
```

## Required Elements

- [ ] Clear H1 title
- [ ] Reading time estimate
- [ ] Author attribution: the organization Automecanik (P41)
- [ ] Publication date
- [ ] Proper heading hierarchy

## Forbidden Elements

- [ ] Aggressive sales CTAs above fold
- [ ] Popup modals on entry
- [ ] Auto-play videos with sound
- [ ] Excessive banner ads
- [ ] Product prices in content

## Performance Targets

| Metric | Target | Priority |
|--------|--------|----------|
| LCP | ≤ 2500ms | Blocking |
| CLS | ≤ 0.05 | Blocking |
| FCP | ≤ 1800ms | Monitoring |

## Schema.org

```json
{
  "@type": "Article",
  "headline": "...",
  "author": { "@type": "Organization", "name": "Automecanik" },
  "datePublished": "...",
  "publisher": { "@type": "Organization", "name": "Automecanik" }
}
```

## Example URLs

```
/blog-pieces-auto/article/comment-changer-plaquettes-frein/
/blog-pieces-auto/guide/entretien-voiture/
```

## Version

- **Version:** 2.0.1
- **Last Updated:** 2026-11-17 (author = organization Automecanik, P41 of `.claude/governance/journal-des-principes.md`)
