# UI Audit — _index

**File:** `_index.tsx`
**Route:** `/`
**Date:** 2026-01-29
**Scope:** UI-only (JSX + Tailwind + shadcn). No loader/action/meta changes.

---

## Summary

| Metric | Score |
|--------|-------|
| **Global** | **4.3/10** |
| Mobile First | 4.0 |
| Responsive | 1.5 |
| Touch Ux | 6.0 |
| Readability | 4.3 |
| Ecommerce Ux | 7.0 |
| A11y | 5.0 |
| Design System | 0.0 |

---

## Hard Rule Violations (2 violations)

| Rule | Line | Severity | Description |
|------|------|----------|-------------|
| **HR-001** | 469 | ❌ High | Grid sans base mobile grid-cols-1 |
| **HR-001** | 638 | ❌ High | Grid sans base mobile grid-cols-1 |

---

## Soft Rule Warnings (57 warnings)

| Rule | Count | Impact | Description |
|------|-------|--------|-------------|
| SR-001 | 13 | Medium | Préférer les couleurs sémantiques aux grays directs |
| SR-006 | 8 | Low | États hover devraient avoir une transition |
| SR-007 | 1 | Low | Préférer gap à space-x/space-y pour les layouts flex/grid |
| SR-009 | 17 | Low | Textes longs devraient être tronqués sur mobile |
| SR-010 | 2 | Medium | Éléments interactifs doivent avoir des états focus visibles |
| SR-011 | 2 | Medium | Images doivent avoir un attribut alt |
| SR-012 | 3 | Medium | Préférer les skeletons aux textes de chargement |
| SR-015 | 11 | Low | Tailles de texte pourraient bénéficier de responsive |

---

## Top Risks

🔴 **[HIGH]** grid-mobile-first: 2 violation(s) - Grid sans base mobile grid-cols-1

---

## Quick Wins

| ID | Impact | Effort | Description |
|----|--------|--------|-------------|
| QW-HR-001 | HIGH | LOW | Fix 2 grid-mobile-first violation(s): Ajouter grid-cols-1 avant les breakpoints: grid-cols-1 sm:grid-cols-2 lg:grid-cols-{N} |

---

## Detailed Violations

### HR-001: grid-mobile-first

**Line 469**
```
Fix: Ajouter grid-cols-1 avant les breakpoints: grid-cols-1 sm:grid-cols-2 lg:grid-cols-{N}
```

**Line 638**
```
Fix: Ajouter grid-cols-1 avant les breakpoints: grid-cols-1 sm:grid-cols-2 lg:grid-cols-{N}
```

---

## Verdict

**Score: 4.3/10** ❌ Needs Work - Significant issues found

**Action Required:** Fix 2 hard rule violation(s) before deployment.
