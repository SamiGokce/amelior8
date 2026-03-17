# Amelior8 Brand Guidelines

**MANDATORY: Consult this file before writing ANY frontend code. No exceptions.**

---

## Color System

### Primary Palette
| Name           | HEX       | RGB           | Usage                        |
|----------------|-----------|---------------|------------------------------|
| Burnt Orange   | `#CC5602` | 204, 86, 2    | Logo, headlines, CTAs        |
| Cloud Dancer   | `#F0EBE1` | 240, 235, 225 | Background, light surfaces   |
| Olive Drab     | `#6B6B52` | 107, 107, 82  | Secondary backgrounds, muted |
| Charcoal       | `#2C2C2A` | 44, 44, 42    | Dark backgrounds, text       |
| Dusty Teal     | `#7A9A94` | 122, 154, 148 | Accents, secondary elements  |

### Accessibility (WCAG 2.1)
| Combination                  | Ratio  | Grade    |
|------------------------------|--------|----------|
| Burnt Orange on Cloud Dancer | 4.8:1  | AA       |
| Charcoal on Cloud Dancer     | 12.1:1 | AAA      |
| Cloud Dancer on Charcoal     | 12.1:1 | AAA      |
| Dusty Teal on Cloud Dancer   | 4.6:1  | AA       |
| Burnt Orange on Charcoal     | 3.2:1  | AA Large |

---

## Typography System

### Font Stack
| Font               | Role                 | Usage                                         |
|--------------------|----------------------|-----------------------------------------------|
| Bricolage Grotesque | H1 / Display        | Primary typeface for main headlines & wordmark. Geometric precision with humanist warmth. |
| Helvetica Neue     | H2-H4 / UI Elements | Clean, neutral typeface for subheadings and interface. |
| Georgia            | Body / Long-form     | Elegant serif for body copy and narrative content. |

### Type Scale
| Level   | Size  | Weight | Notes                    |
|---------|-------|--------|--------------------------|
| H1      | 48px  | 700    | Display / Bricolage Grotesque |
| H2      | 36px  | 700    | Helvetica Neue           |
| H3      | 28px  | 700    | Helvetica Neue           |
| H4      | 20px  | 700    | Helvetica Neue           |
| Body    | 16px  | 500    | Georgia                  |
| Caption | 12px  | 600    | Uppercase, spaced        |

### Tracking
- H1/Display: **-50 tracking** (letter-spacing: -0.05em) — tight, cohesive, modern
- Body: default tracking
- Captions: slightly expanded tracking for readability

---

## Logo Usage

### Wordmark
- The wordmark **is** the brand. Text reads "Ameliorate" in Bricolage Grotesque.
- Always maintain **-50 tracking** (letter-spacing: -0.05em)
- Minimum digital size: **100px**
- Favicon: single letter "A"
- Clear space: equal to x-height of the wordmark on all sides

### Approved Variants
| Variant   | Background     | Text Color     |
|-----------|---------------|----------------|
| Primary   | Cloud Dancer  | Burnt Orange   |
| Reversed  | Charcoal      | White          |
| On Brand  | Burnt Orange  | White          |

### Do
- Use on solid, high-contrast backgrounds
- Maintain -50 tracking always
- Use approved color combinations
- Scale proportionally
- Keep minimum clear space (1x height)

### Don't
- Stretch, skew, or distort
- Change the letter spacing
- Add shadows, outlines, or effects
- Use on busy or low-contrast backgrounds
- Modify the typeface or weight

---

## Design Principles

### Glass + Brand Fusion
The app uses a liquid glass aesthetic layered on top of these brand colors.
Glass panels should tint toward **Cloud Dancer** with the brand palette
visible through transparency. Accent elements use **Burnt Orange**.
Dark surfaces use **Charcoal**. Muted areas use **Olive Drab** or **Dusty Teal**.

### Hierarchy
1. Burnt Orange for primary actions and emphasis
2. Charcoal for primary text
3. Olive Drab / Dusty Teal for secondary/muted elements
4. Cloud Dancer for backgrounds and light glass surfaces
