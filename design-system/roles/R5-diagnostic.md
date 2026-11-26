# R5 - Diagnostic/Symptom Page (Pack Diagnostic)

> Intent: Diagnosis | Flow: Symptom Wizard

## Overview

R5 (Diagnostic) pages help users identify the right part based on symptoms. This is a differentiating feature for Automecanik.

**Primary Goal:** Guide users from symptom to solution through an interactive wizard.

## Page Structure

### Above Fold

1. **Symptom Selector**
   - Primary symptom selection
   - Vehicle context (if known)
   - "Describe your problem"

2. **Wizard Progress**
   - Step indicator
   - Current step highlight
   - Steps: Symptom → Details → Diagnosis → Parts

### Content Area

3. **Diagnostic Flow**
   - Conditional questions
   - Visual aids (images, videos)
   - "Does this describe your issue?"

4. **Matched Parts**
   - Parts likely causing the symptom
   - Confidence score
   - "87% likely - Plaquettes de frein usées"

5. **Confidence Meter**
   - Visual indicator of diagnosis confidence
   - Explanation of confidence level

### Below Fold

6. **Alternative Causes**
   - Other possible issues
   - When to see a mechanic

7. **Related Diagnostics**
   - Similar symptom pages
   - "Si ce n'est pas ça..."

## Design Tokens

### Colors

Colors come from `packages/design-tokens/src/tokens.json`, by role, never as raw values (P44 of `.claude/governance/journal-des-principes.md`). Navy and orange are the brand colors. Orange marks the one primary action per screen, with navy text; other actions are outlined. Red is for errors and destructive actions only.

### Typography

Outfit for headings, DM Sans for body text, Roboto Mono for codes the user copies, from the tokens (P46). Every weight used is loaded.

## Components

| Component | Purpose |
|-----------|---------|
| SymptomSelector | Initial symptom input |
| WizardProgress | Step indicator |
| DiagnosticQuestion | Conditional question card |
| MatchedPartCard | Suggested part with confidence |
| ConfidenceMeter | Visual confidence indicator |

## Required Elements

- [ ] Symptom input/selection
- [ ] Wizard progress indicator
- [ ] Confidence score
- [ ] Matched parts section
- [ ] Alternative causes

## Forbidden Elements

- [ ] Catalog grids
- [ ] Product listings (before diagnosis)
- [ ] Filters
- [ ] Heavy navigation
- [ ] Unrelated products

## Effects

Every effect below stops when the user asks for reduced motion (`prefers-reduced-motion: reduce`, P45). Durations and shadows come from the tokens (P46).

### Wizard Progress
```css
animation: step-reveal var(--transition-base) ease-out;
```

### Confidence Meter
A fill animation, with its duration from the tokens.

## Performance Targets

| Metric | Target | Priority |
|--------|--------|----------|
| LCP | ≤ 2500ms | Blocking |
| CLS | ≤ 0.05 | Blocking |
| INP | ≤ 200ms | Critical (interactive) |

## Example URLs

```
/diagnostic-auto/bruit-freinage/
/diagnostic-auto/vibration-volant/
/diagnostic-auto/voyant-moteur/
```

## Version

- **Version:** 2.0.0
- **Flow Pack:** diagnostic
- **Last Updated:** 2026-01-28
