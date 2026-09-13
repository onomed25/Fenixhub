---
name: Fenix Studio
description: Decentralized streaming media catalog engine with cyber-cinematic dark optics
colors:
  primary: "#FF6A00"
  primary-hover: "#FF8126"
  highlight: "#FFB020"
  danger: "#E83D1C"
  bg-obsidian: "#05070D"
  surface-slate: "#111827"
  surface-translucent: "rgba(17, 24, 39, 0.7)"
  input-bg: "#141824"
  input-focus: "#192030"
  text-ivory: "#FFF8F0"
  text-soft: "#D7DEE9"
  on-accent: "#111827"
typography:
  display:
    fontFamily: "Clash Display, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Clash Display, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Outfit, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "12px"
  lg: "20px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-accent}"
  button-nav:
    backgroundColor: "transparent"
    textColor: "{colors.text-soft}"
    rounded: "{rounded.full}"
    padding: "10px 20px"
  button-nav-active:
    backgroundColor: "rgba(255, 255, 255, 0.12)"
    textColor: "{colors.text-ivory}"
  input-unified:
    backgroundColor: "{colors.input-bg}"
    textColor: "{colors.text-ivory}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  card-glass:
    backgroundColor: "{colors.surface-translucent}"
    textColor: "{colors.text-ivory}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: Fenix Studio

## Overview

**Creative North Star: "The Cyber-Cinematic Forge"**

Fenix Studio operates as an advanced tactical workspace for community curators and moderators indexing streaming media. The interface exists in deep obsidian darkness, illuminated by precision ember and solar gold light sources. It blends the cinematic weight of high-end entertainment archives with the crisp efficiency of mission-critical developer tools.

Surfaces feel solid yet translucent, utilizing frosted glassmorphism (`backdrop-filter: blur(12px)` to `blur(24px)`) over faint radial ambient light leaks. Interactive elements react with physical tactile certainty: subtle spring scaling on click (`scale(0.97)`), high-visibility focus halos, and instant state confirmations.

**Key Characteristics:**
- **Cinematic Dark Immersion**: Deep `#05070D` canvas with fixed ambient radial ember gradients that eliminate flat emptiness without causing visual distraction.
- **Luminous Hierarchy**: Ember orange (`#FF6A00`) and solar gold (`#FFB020`) act as high-value beacons guiding the eye to primary actions, active tabs, and critical status changes.
- **Glass & Frost Depth**: Frosted translucent slate containers (`#111827` at 70% opacity) floating effortlessly above the obsidian background.
- **Responsive Ergonomics**: Adaptive bottom dynamic island navigation that floats centered on desktop and docks seamlessly above the mobile home indicator.

## Colors

The palette is anchored in deep cosmic dark tones contrasted by intense combustion hues that communicate energy, vitality, and precision.

### Primary
- **Ember Blaze** (`#FF6A00`): Primary actions, primary focus halos, active indicators, and high-priority states. Used with deliberate rarity.
- **Bright Ember** (`#FF8126`): Hover state for primary buttons and interactive accents.

### Secondary
- **Solar Gold** (`#FFB020`): Highlighting important secondary data points, contributor stars, rankings, and warm atmospheric gradients.

### Tertiary
- **Crimson Fire** (`#E83D1C`): Destructive actions, error badges, report flags, and danger alerts.

### Neutral
- **Obsidian Abyss** (`#05070D`): Root background canvas.
- **Midnight Slate** (`#111827`): Structured card surfaces, dialog panels, and headers.
- **Unified Input Charcoal** (`#141824`): Input field backdrops with subtle 10% white stroke.
- **Focused Input Navy** (`#192030`): Active focus background for form elements.
- **Dropdown Obsidian** (`#111622`): Distinct high-contrast background for `<select>` menu options.
- **Warm Ivory** (`#FFF8F0`): Primary headings and high-emphasis text.
- **Cool Slate** (`#D7DEE9`): Secondary labels, muted descriptions, and inactive navigation icons.

### Named Rules
**The Ember Rarity Rule.** Radiant orange (`#FF6A00`) is strictly reserved for primary calls-to-action, focus indicators, active navigation states, and critical badges. It is never used as an expansive background flood.

**The Dropdown Contrast Rule.** Dropdown select options always render with `#111622` background and pure `#FFFFFF` font weight 500+ to ensure instant optical legibility across all desktop and mobile browsers.

## Typography

**Display Font:** Clash Display (fallback: sans-serif)  
**Body Font:** Outfit (fallback: sans-serif)  
**Label/Mono Font:** Outfit / Tabular Numerics  

**Character:** Clash Display provides sharp, architectural authority and high-impact cinematic confidence in headings, while Outfit delivers smooth, humanist legibility with generous x-height for catalog details, technical labels, and streams.

### Hierarchy
- **Display** (700 weight, `clamp(1.75rem, 4vw, 2.5rem)`, 1.15 line-height, `-0.01em` letter-spacing): Main view titles and hero section headers.
- **Headline** (600 weight, `1.5rem` / 24px, 1.2 line-height, `-0.01em` letter-spacing): Modal titles, card section heads, panel titles.
- **Title** (600 weight, `1.125rem` / 18px, 1.3 line-height): Media card titles, grouping labels, table headings.
- **Body** (400 weight, `0.9375rem` / 15px, 1.5 line-height, max line length 70ch): Descriptions, stream information, dialog explanations.
- **Label** (600 weight, `0.75rem` / 12px, `0.02em` letter-spacing, uppercase when badge): Status chips, season/episode tags, table metadata.

### Named Rules
**The Numeric Centering Rule.** Numeric selectors (seasons, episodes, contributor ranks) must always use bold weight (`font-weight: 700`) and optical center alignment (`text-align: center`) for instantaneous scanning.

## Layout

The spatial model uses an 8px rhythm (4px micro-steps) designed for both dense data operations and wide-canvas media browsing.

- **Main Content Container**: Max width `1440px` centered with responsive horizontal padding (`16px` mobile, `32px` desktop).
- **Navigation Placement**: Floating dynamic island docked at `bottom: 24px` on desktop; anchored to `bottom: 0` with safe-area padding on mobile.
- **Grid Layouts**:
  - Catalog Media Grid: Responsive grid from 2 columns (`minmax(140px, 1fr)`) on mobile up to 6 columns on large displays (`minmax(180px, 1fr)`).
  - Split Forms: Two-column responsive layout for generator inputs (source URLs on left, stream metadata/preview on right).

## Elevation & Depth

Fenix Studio rejects heavy opaque drop shadows in favor of translucent tonal layering, frosted backdrop filters, and delicate ambient light leaks.

### Shadow Vocabulary
- **Focus Halo Glow** (`box-shadow: 0 0 0 4px rgba(255, 106, 0, 0.15)`): Applied on active `:focus-visible` form inputs.
- **Active Select Glow** (`box-shadow: 0 0 0 3px rgba(255, 106, 0, 0.18)`): Applied on active `<select>` elements.
- **Dynamic Island Elevation** (`box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25)`): Subtle ambient separation for desktop floating dock.
- **Mobile Island Under-Dock** (`box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5)`): Strong upward shadow anchoring bottom dock on mobile screens.

### Named Rules
**The Ambient Light Rule.** Depth is created through translucent glassmorphism (`backdrop-filter: blur(24px)`) and subtle radial ember gradients, never through heavy muddy drop shadows.

## Shapes

- **Pill Geometry (`9999px`)**: Navigation island pill buttons, status filter chips, primary action buttons.
- **Glass Panels (`24px`)**: Modal backdrops, primary container shells, floating island on desktop.
- **Form Inputs (`12px`)**: Text inputs, numeric selectors, and dropdown containers.
- **Mobile Dock Top Corners (`20px 20px 0 0`)**: Seamless bottom anchoring on viewports `< 640px`.

## Components

### Buttons
- **Shape**: Full pill (`rounded-full` / `9999px`) or refined squircle (`12px` on mobile nav).
- **Primary**: Background `#FF6A00`, text `#111827`, font weight 600, padding `10px 24px`.
- **Hover / Focus**: Background `#FF8126`, scale feedback `transform: scale(0.97)` on `:active`.
- **Navigation Pill Button**: Transparent background, text `#D7DEE9`. When active, `background: rgba(255, 255, 255, 0.12)`, text `#FFF8F0`, with `box-shadow: 0 2px 8px rgba(0,0,0,0.25)`.

### Inputs & Fields
- **Style**: `.input-unified` with background `#141824`, border `1px solid rgba(255, 255, 255, 0.1)`, backdrop blur `12px`, radius `12px`, padding `12px 16px`.
- **Focus Treatment**: Background `#192030`, border color `#FF6A00`, and `box-shadow: 0 0 0 4px rgba(255, 106, 0, 0.15)`.
- **Selects**: Clean custom arrow indicator with right padding `2.2rem`, white font `#FFFFFF`, and option menu background `#111622`.

### Cards & Glass Panels
- **Corner Style**: `24px` border radius (`rounded-3xl`).
- **Background**: `rgba(17, 24, 39, 0.7)` with `backdrop-filter: blur(24px)`.
- **Border**: `1px solid rgba(255, 255, 255, 0.08)`.
- **Internal Padding**: `24px` (desktop), `16px` (mobile).

### Navigation
- **Dynamic Island**: Floating dock centered horizontally with backdrop blur `20px`, glass border, and pill tab buttons.
- **Mobile Adaptation**: Anchored at bottom `0`, full viewport width, `safe-area-inset-bottom` support, with touch target sizes $\ge 44 \times 44\text{px}$.

## Do's and Don'ts

### Do:
- **Do** enforce `outline: 2px solid var(--primary)` with `outline-offset: 2px` on `:focus-visible` for WCAG 2.1 AA compliance.
- **Do** ensure all `<select>` dropdown options have explicit dark backgrounds (`#111622`) and `#FFFFFF` text color.
- **Do** provide tactile active state spring scaling (`transform: scale(0.97)`) on clickable buttons and interactive items.
- **Do** maintain the 44px minimum touch target size on mobile navigation and interactive controls.
- **Do** keep font pairings strictly to Clash Display for display/headlines and Outfit for body/UI labels.

### Don't:
- **Don't** use solid white backgrounds or bright light-mode containers anywhere in the application.
- **Don't** use the primary ember orange (`#FF6A00`) as a large decorative background flood.
- **Don't** rely solely on hover states for catalog actions; always provide coarse touch support (`@media (hover: none)`).
- **Don't** use generic low-contrast gray text on dark backgrounds; maintain `#D7DEE9` or brighter for legible copy.
