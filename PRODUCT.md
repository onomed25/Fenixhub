# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are community media curators, uploaders, and moderators.
- **Curators / Uploaders**: Search TMDB, assemble streams, merge audio/video tracks, tag releases, and submit or update movie/series entries.
- **Moderators / Admins**: Review community requests, moderate submitted catalog entries and stream links via the approval/reports queue, manage storage integrations, and monitor contributor activity.
- **Community Members / Requestors**: Submit media requests and report broken streams or invalid entries.

## Product Purpose

Fenix Studio (Fenixhub) provides a collaborative, resilient web studio for curating, organizing, and distributing streaming media metadata and stream links. Success means curators can rapidly index and assemble high-quality media streams (with multi-audio/subtitles) and reliably sync them to decentralized community storage with zero friction.

## Positioning

A decentralized and resilient media catalog engine backed directly by Hugging Face datasets and intelligent stream merging, eliminating dependency on fragile central database servers while empowering community curators with granular moderation and stream assembly tools.

## Operating Context

- Used on desktop and mobile web (responsive touch-friendly controls with adaptive floating dock / dynamic island nav).
- Curators frequently paste streaming URLs, m3u8/mp4 manifests, and TMDB IDs; upload metadata; and merge multi-track media streams.
- Administrators review incoming content batches, monitor dataset sync states, and audit reported streams.
- Curators work in high-focus curation sessions, requiring rapid keyboard accessibility, fast catalog filtering, and real-time status feedback.

## Capabilities and Constraints

- **Confirmed Functionality**:
  - TMDB catalog search and automated metadata enrichment.
  - Stream link generator with multi-source media merger (audio dubs, subtitles, stream dates).
  - Hugging Face Datasets integration for persistent, distributed storage (with SQLite/PostgreSQL caching layer).
  - Community media request tracking system.
  - Content moderation queue (approvals & reports).
  - Contributor rankings and gamified contribution tracking.
  - Role-based permissions (Admin, Moderator, Contributor).
- **Technical Constraints**:
  - Express.js backend with vanilla ES6+ frontend and Tailwind CSS.
  - Dark-mode-first environment with strict WCAG 2.1 AA focus indicators and high-contrast optics.
  - Content Security Policy (CSP) headers enforced via Helmet.

## Brand Commitments

- **Name**: Fenix Studio (repo: Fenixhub).
- **Identity & Voice**: Modern, sleek, cyber-cinematic dark aesthetic ("Ember/Obsidian" palette with glowing amber accents `#FF6A00`, `#FFB020` over deep obsidian `#05070D` and `#111827`).
- **Typography**: Clash Display for display/headings, Outfit for clean body copy and data labels.
- **Language**: Portuguese (pt-PT / pt-BR) localization for core interface copy and labels.

## Evidence on Hand

- Production web UI implementation in `index.html` and `public/css/style.css`, `public/js/app.js`.
- Express backend in `index.js` with security middleware (`src/security.js`), media merger (`src/media-merger.js`), and Hugging Face database connectors (`src/hfDatabase.js`).
- Assets: Logo at `/cdn/logo_new.png` and embedded icon styles.

## Product Principles

1. **Curator Efficiency Above All**: Rapid data entry, keyboard navigable forms, and immediate visual feedback on stream processing.
2. **Resilience by Design**: Storage failure or network drops should degrade gracefully; local states and decentralized HF backups guarantee continuity.
3. **Purity of Visual Feedback**: Clean, high-contrast dark optics where state, progress, and alerts are unambiguously clear without visual clutter.
4. **Transparent Governance**: Clear approval queues, provenance tracking for stream submissions, and visible contributor rankings to foster trust.

## Accessibility & Inclusion

- WCAG 2.1 AA compliance across dark mode color contrasts.
- High-visibility focus indicators (`:focus-visible` with primary amber accent).
- Responsive ergonomics supporting both precise mouse hover and mobile touch interactions (pointer coarse media queries).
