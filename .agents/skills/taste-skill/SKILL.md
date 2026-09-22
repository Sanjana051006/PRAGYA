---
name: design-taste-frontend
description: Anti-slop frontend skill for mission-critical interfaces, command centers, and operational dashboards. The agent reads the brief, infers the right design direction, and ships interfaces that do not look templated. High agency, anti-default, tactile feedback, and strict visual hierarchy.
---

# tasteskill: Anti-Slop Frontend Skill

> Operational duty-desk, meteorological intelligence, and command-center interfaces.
> Every rule below is **contextual**. First read the brief, then pull only what fits.

## 0. BRIEF INFERENCE (Operational Command Center)
- **Page Kind**: Mission-Critical Meteorological Intelligence & Warning Console (IMD Forecaster Duty-Desk / NDMA SACHET).
- **Audience**: Operational forecasters, emergency management officers, district collectors, disaster response teams.
- **Language**: Authoritative, clean government-standard command center, high information density, calibrated alert semantics.
- **Design System / Aesthetic Family**: Native CSS design tokens, Navy & Monsoon Teal palette, Archivo display, Source Sans 3 body, IBM Plex Mono tabular figures.

## 1. THE THREE DIALS
- `DESIGN_VARIANCE: 4` (Authoritative alignment, structured grid layout, zero decorative chaos)
- `MOTION_INTENSITY: 3` (Restrained, purposeful status pulses and transitions; zero gratuitous bouncy animations)
- `VISUAL_DENSITY: 8` (Mission-critical cockpit: dense telemetry, live data tables, time-series charts, 80% credible bands)

## 2. COLOR CALIBRATION (Authoritative Monsoon Palette)
- `--navy: #0B2C4D` (Primary brand / masthead / deep ink)
- `--navy-700: #123A63` (Sub-headers / strong structural borders)
- `--teal: #1B6E8C` (Monsoon Active / Primary actions / synoptic accent)
- `--teal-100: #E4EFF2` (Code badges / subtle active highlights)
- `--slate: #52657A` (Muted labels / secondary metadata)
- `--line: #D7DDE3` (Subtle dividers)
- `--line-strong: #B9C2CB` (Table headers / card outlines)
- `--surface: #FFFFFF` (Card surfaces, data view panels)
- `--bg: #F3F5F7` (App backdrop)
- **IMD Warning Semantics**:
  - `--green: #2E6B3E` (Normal / No Warning)
  - `--yellow: #D99B00` (Watch / Be Updated)
  - `--orange: #B5730E` (Alert / Be Prepared)
  - `--red: #9C2A2A` (Warning / Take Action)

## 3. TYPOGRAPHY & TABULAR DATA
- Headers: `Archivo`, sans-serif, bold tracking-tight.
- Body & Labels: `Source Sans 3`, system-ui, sans-serif.
- Numerics, Coordinates, Timestamps, Skill Scores: `IBM Plex Mono`, monospace with `font-variant-numeric: tabular-nums`.

## 4. TACTILE INTERACTIVITY & ANTI-SLOP DISCIPLINE
- Tactile feedback on `:active`: `transform: translateY(1px) scale(0.99)`.
- No wrapped CTA buttons. No duplicate CTA labels.
- Clear empty, loading, and error states for all interactive data views.
- No generic AI-purple gradients or centered hero fluff; dense, immediate operational visibility upon page load.
