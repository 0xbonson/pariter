# Pariter — Visual Identity & Design System Specification

**Philosophy:** Utilitarian, editorial, operational clarity.  
**Standard:** Absolute Anti-Slop (No glowing blobs, no purple-blue gradient soup, no glassmorphism, no fake metrics).  
**Date:** 2026-10-11  

---

## 1. Design Principles

1. **Information Density with Breathing Room:** Structured data tables, crisp dividing rules, deliberate whitespace. Avoid boxing every section into a rounded card.
2. **Financial Legibility:** Tabular figures (`tnum`) for all currency amounts. Monospace for addresses, transaction hashes, and gas units.
3. **Restrained Color Hierarchy:** Neutral foundation with single-purpose operational semantic accents. Color only conveys state (pending, verified, reverted).
4. **Physicality & Tactility:** Clean 1px hairline borders (`#E2E4E9`), crisp button states, high contrast text ratios exceeding WCAG AAA (7:1+).

---

## 2. Color Palette

```
Surface Background:   #F9F9FB (Warm off-white)
Surface Elevated:     #FFFFFF (Pure crisp white)
Border Subdued:       #E4E7EC (1px hairline rules)
Border Emphasized:    #D0D5DD
Text Primary:         #0F172A (Deep ink slate)
Text Secondary:       #475467 (Neutral steel)
Text Tertiary:        #98A2B3 (Muted metadata)

Operational Accent:   #1E3A8A (Deep Navy / Primary CTA)
Accent Hover:         #172554

Semantic Status:
- Verified / Success: #15803D (Forest Green) / Tint #F0FDF4 / Border #BBF7D0
- Pending / Mining:   #4338CA (Indigo) / Tint #EEF2FF / Border #C7D2FE
- Warning / Advisory: #B45309 (Warm Ochre) / Tint #FFFBEB / Border #FDE68A
- Reverted / Error:   #B91C1C (Crimson) / Tint #FEF2F2 / Border #FECACA
```

---

## 3. Typography Hierarchy

| Style | Font Family | Size | Weight | Tracking | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Wordmark** | Sans-Serif | 18px | 700 | -0.02em | Application header |
| **Page Header** | Sans-Serif | 24px | 600 | -0.02em | Primary screen title |
| **Section Label** | Sans-Serif | 13px | 600 | +0.04em | Uppercase section markers |
| **Body Text** | Sans-Serif | 14px | 400 | normal | Descriptions, guides |
| **Numeric Amount** | Sans-Serif (tnum) | 15px | 600 | -0.01em | USDC values & totals |
| **Code / Hash** | Monospace | 13px | 500 | -0.01em | Addresses, tx hashes, block numbers |

---

## 4. Logo & Symbolic Concept

- **Symbol Concept:** Three parallel horizontal lines anchored to a vertical distribution spine. Represents a 1-to-N batch execution settling simultaneously (*pariter*).
- **Scalability:** Optimized for 16px favicon, 32px navbar header, and vector SVG exports.
- **Independence:** Wordmark ("PARITER") and glyph function independently.
