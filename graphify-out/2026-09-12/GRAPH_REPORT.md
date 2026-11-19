# Graph Report - Fenixhub  (2026-09-12)

## Corpus Check
- 69 files · ~199,044 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1477 nodes · 3083 edges · 90 communities (87 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 125 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c3e6183a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- telegram-service.js
- index.js
- package.json
- telegram-service-refactored.js
- viewsTracker.js
- dependencies
- security.js
- hfDatabase.js
- ProcessTracker
- isAdmin
- exportar_jsons.js
- media-merger.js
- resumeSession
- setLiveState
- modern-screenshot.umd.js
- el
- rules/graphify.md
- workflows/graphify.md
- live-browser.js
- documentRefForElement
- renderDesignVisual
- adapt.md
- handleManualEditActivity
- onboard.md
- new-work.md
- The Toolkit
- refreshParamsPanel
- buildSveltePropValuesV2
- createLiveBrowserSessionState
- captureElementToBlob
- onAnnotDown
- Design System: Fenix Studio
- createLiveBrowserDomHelpers
- animate.md
- live.md
- Handle `generate`
- Generate Report
- SKILL.md
- New visual work
- optimize.md
- initPageChat
- startVariantObserver
- connectSSE
- Scan mode (approach C: auto-extract, then confirm descriptive language)
- showBar
- critique.md
- Simplify the Design
- Hardening Dimensions
- Product
- clarify.md
- Nielsen's 10 Heuristics
- Generate Combined Critique Report
- document.md
- polish.md
- quieter.md
- scheduleAcceptCleanup
- mountSvelteComponentVariant
- telegram-service-refactored.test.js
- Init flow
- syncEditBadgeHitProxies
- Common Cognitive Load Violations
- iOS platform
- Operate mode depth (and Read notes)
- Shape
- adapt.native.md
- Android platform
- colorize.md
- Persona-Based Design Testing
- doctor.md
- Extract Flow
- live-setup.md
- Generate Report
- Cognitive Load Assessment
- Impeccable Asset Producer
- Impeccable Finish Reviewer
- Impeccable Manual Edit Applier
- live-browser-ignores.js
- Diagnostic Scan
- Responsive Design
- $impeccable hooks
- Visualize: Direction Comps & Asset Production
- impeccable
- injectSvelteComponentsFromManifest
- upload_hf_database.js
- Impeccable Documenter
- enableInlineEdit
- Heuristics Scoring Guide
- devDependencies

## God Nodes (most connected - your core abstractions)
1. `setLiveState()` - 32 edges
2. `resumeSession()` - 32 edges
3. `connectSSE()` - 31 edges
4. `showToast()` - 30 edges
5. `el()` - 29 edges
6. `initGlobalBar()` - 29 edges
7. `handleKeyDown()` - 27 edges
8. `buildInsertConfigureRow()` - 26 edges
9. `injectSvelteComponentsFromManifest()` - 26 edges
10. `cleanup()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `isAdmin()` --calls--> `checkPassword()`  [EXTRACTED]
  index.js → src/security.js
- `enableInlineEdit()` --indirect_call--> `own()`  [INFERRED]
  .agents/skills/impeccable/scripts/live-browser.js → .agents/skills/impeccable/scripts/live-browser-dom.js
- `getAuthUser()` --calls--> `extractToken()`  [EXTRACTED]
  index.js → src/security.js
- `getAuthUser()` --calls--> `verifyToken()`  [EXTRACTED]
  index.js → src/security.js
- `getNuviometaInfo()` --calls--> `sanitizeNuviometaParams()`  [EXTRACTED]
  index.js → src/security.js

## Import Cycles
- None detected.

## Communities (90 total, 2 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.08
Nodes (46): actionPendingFile(), approveFile(), cat, changeColabPeriod(), checkAdminSession(), checkMyPendings(), clearDiscordSession(), closeReportModal() (+38 more)

### Community 1 - "telegram-service.js"
Cohesion: 0.10
Nodes (20): apiId, { CustomFile }, downloadAndUploadUrl(), downloadFile(), fs, getMessageFromForward(), getSharedBot(), getSharedClient() (+12 more)

### Community 2 - "index.js"
Cohesion: 0.05
Nodes (36): app, authLimiter, cachedDiscordRoles, cachedFrontHtml, cachedHtml, catalogCache, compression, cookieParser (+28 more)

### Community 3 - "package.json"
Cohesion: 0.08
Nodes (23): allowScripts, sqlite3@6.0.1, description, jest, testPathIgnorePatterns, name, scripts, start (+15 more)

### Community 4 - "telegram-service-refactored.js"
Cohesion: 0.09
Nodes (21): apiId, { CustomFile }, downloadAndUploadUrl(), downloadFile(), fs, getMessageFromForward(), getSharedBot(), getSharedClient() (+13 more)

### Community 5 - "viewsTracker.js"
Cohesion: 0.17
Nodes (15): aliasMap, CACHE_DIR, CACHE_FILE, flush(), fs, getCanonicalKey(), getViews(), incrementViews() (+7 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, bcrypt, compression, cookie-parser, cors, dotenv, express, express-rate-limit (+8 more)

### Community 7 - "security.js"
Cohesion: 0.13
Nodes (15): getAuthUser(), bcrypt, jsonwebtoken, bcrypt, checkPassword(), checkPasswordAsync(), crypto, extractToken() (+7 more)

### Community 8 - "hfDatabase.js"
Cohesion: 0.24
Nodes (15): handleDeleteFile(), invalidateCatalogCache(), clearHfCache(), deleteFileFromHf(), fetchCatalogFromHf(), fetchPendingFromHf(), getContentFromHf(), getCountFromHf() (+7 more)

### Community 9 - "ProcessTracker"
Cohesion: 0.24
Nodes (3): handleSignal(), ProcessTracker, stopServer()

### Community 10 - "isAdmin"
Cohesion: 0.33
Nodes (6): getAdminPassword(), isAdmin(), isAjudante(), isPrivileged(), requireAdmin(), requireAdminOrAjudante()

### Community 11 - "exportar_jsons.js"
Cohesion: 0.28
Nodes (8): pg, fs, main(), OUTPUT_DIR, path, tryExtractFromDatabase(), tryExtractFromFile(), zlib

### Community 12 - "media-merger.js"
Cohesion: 0.39
Nodes (7): FORBIDDEN_KEYS, getStreamKey(), injectDateIntoStreams(), isPlaceholder(), mergeMediaContents(), mergeStreamArrays(), sanitizeSeriesStreams()

### Community 13 - "resumeSession"
Cohesion: 0.15
Nodes (23): applySavedSessionMeta(), checkpointPayload(), clampVariantIndex(), clearSession(), enterRecoveryWaitingForAnchor(), findActiveSessionSummary(), findAdoptableServerSession(), findAnyVariantsWrapper() (+15 more)

### Community 14 - "setLiveState"
Cohesion: 0.06
Nodes (95): abortSvelteComponentInjection(), agentStatusText(), applyEditing(), barPaletteForTheme(), beginNewLiveConfiguration(), brandMarkSvg(), buildDesignHeader(), buildInsertPlaceholderSnapshotFromDom() (+87 more)

### Community 15 - "modern-screenshot.umd.js"
Cohesion: 0.09
Nodes (55): ae(), be(), bt(), Ce(), s(), Ct(), de(), dt() (+47 more)

### Community 16 - "el"
Cohesion: 0.10
Nodes (38): actionLabel(), bindConfigureCountPillTooltip(), bindConfigureInlineControlHover(), bindConfigureModifierPillHover(), buildConfigureActionControl(), buildConfigureCountControl(), buildConfigureRow(), buildConfigureSubmitButton() (+30 more)

### Community 20 - "live-browser.js"
Cohesion: 0.05
Nodes (61): applyGlobalBarLabelState(), applyPlaceholderSizingStyles(), bufferToBase64(), buildColorModels(), buildLocatorForLeaf(), buildPlaceholderResizeHandles(), buildSavingRow(), buildTypographyModels() (+53 more)

### Community 21 - "documentRefForElement"
Cohesion: 0.09
Nodes (29): addManualContextText(), canRestoreManualEditElement(), collectManualContextPieces(), walk(), contextElementForManualEdit(), copyEditContainerContext(), copyEditLeafContext(), cssIdent() (+21 more)

### Community 22 - "renderDesignVisual"
Cohesion: 0.10
Nodes (30): buildCollapsible(), buildListHtml(), buildRadiiModels(), copyToClipboard(), cssSafe(), designEmptyMessage(), escapeHtml(), fontStack() (+22 more)

### Community 23 - "adapt.md"
Cohesion: 0.12
Nodes (15): Assess Adaptation Challenge, Content Adaptation, Desktop Adaptation (Mobile → Desktop), Email Adaptation (Web → Email), Implement Adaptations, Layout Adaptation Techniques, Mobile Adaptation (Desktop → Mobile), Navigation Adaptation (+7 more)

### Community 24 - "handleManualEditActivity"
Cohesion: 0.18
Nodes (25): clearStoredManualApplyState(), fetchPendingCount(), handleManualEditActivity(), hidePendingApplyDock(), manualApplyLoadingText(), manualApplyStateKey(), manualEditEventForCurrentPage(), numberOrNull() (+17 more)

### Community 25 - "onboard.md"
Cohesion: 0.09
Nodes (22): Assess Onboarding Needs, Context Over Ceremony, Contextual Help, Design Onboarding Experiences, Documentation & Help, Empty State Design, Feature Discovery & Adoption, Guided Tours & Walkthroughs (+14 more)

### Community 26 - "new-work.md"
Cohesion: 0.13
Nodes (14): Recommended Actions, Craft (deprecated alias), Apply, Live-mode signature params, Set the spatial thesis, Two isolated assessments, Verify, Visitor mode (+6 more)

### Community 27 - "The Toolkit"
Cohesion: 0.10
Nodes (20): Animate complex properties, Assess What "Extraordinary" Means Here, For data-heavy interfaces, For functional UI, For performance-critical UI, For visual/marketing surfaces, Implement with Discipline, Interact with the device (+12 more)

### Community 28 - "refreshParamsPanel"
Cohesion: 0.18
Nodes (18): applyParamDefaults(), applyParamValue(), buildParamsPanel(), closedClipPath(), completeParameterPublication(), formatRangeValue(), hideParamsPanel(), mountedParameterCount() (+10 more)

### Community 29 - "buildSveltePropValuesV2"
Cohesion: 0.18
Nodes (12): buildSvelteExpressionTextMap(), buildSveltePropValuesFromLiveElement(), buildSveltePropValuesV2(), cloneWithoutElements(), collectTextNodes(), collectVisibleTexts(), cssEscapeIdent(), escapeRegExp() (+4 more)

### Community 30 - "createLiveBrowserSessionState"
Cohesion: 0.21
Nodes (15): createLiveBrowserSessionState(), clearHandled(), clearScrollY(), clearSession(), isHandled(), loadSession(), markHandled(), nextCheckpointRevision() (+7 more)

### Community 31 - "captureElementToBlob"
Cohesion: 0.12
Nodes (20): averageRgb01(), captureChromeNodes(), captureElementFromRenderedAncestor(), captureElementToBlob(), compileShader(), cssColorToRgb01(), dominantRgb01(), findBackdropAncestor() (+12 more)

### Community 32 - "onAnnotDown"
Cohesion: 0.15
Nodes (21): applyPlaceholderDimensions(), beginEditPin(), buildAnnotationsForCapture(), buildPinElement(), cancelEditingPin(), clampPlaceholderSize(), finalizeEditingPin(), initAnnotOverlay() (+13 more)

### Community 33 - "Design System: Fenix Studio"
Cohesion: 0.08
Nodes (24): Buttons, Cards & Glass Panels, Colors, Components, Design System: Fenix Studio, Do:, Do's and Don'ts, Don't: (+16 more)

### Community 34 - "createLiveBrowserDomHelpers"
Cohesion: 0.16
Nodes (11): createLiveBrowserDomHelpers(), cssId(), liveUiRoot(), makeFrozenAnchor(), own(), pickable(), rectIsUsableAnchor(), uiAppend() (+3 more)

### Community 35 - "animate.md"
Cohesion: 0.12
Nodes (14): Accessibility and control, Choose material by meaning, Find the job, Implement to the runtime, Set the motion thesis, Timing and easing, Verify, Visitor mode (+6 more)

### Community 36 - "live.md"
Cohesion: 0.12
Nodes (15): Cleanup, Exit, First-time setup, Handle `accept`, Handle `discard`, Handle fallback, Handle `manual_edit_apply`, Handle `prefetch` (+7 more)

### Community 37 - "Handle `generate`"
Cohesion: 0.12
Nodes (16): 1. Read the screenshot (if present), 2. Wrap the element, 3. Load the action's reference, 4. Plan three variants: identity first, then mode, then axes, 5. Apply the freeform prompt (if present), 6. Deliver variants, 7. Parameters (composition-sized, 0-4 per variant), 8. Signal done (+8 more)

### Community 38 - "Generate Report"
Cohesion: 0.13
Nodes (14): 1. Accessibility (A11y), 2. Performance, 3. Theming, 4. Responsive Design, 5. Implementation Integrity (CRITICAL), Audit Health Score, Detailed Findings by Severity, Diagnostic Scan (+6 more)

### Community 39 - "SKILL.md"
Cohesion: 0.10
Nodes (15): Before you finish, Scope is sovereign, The amplification, The skeleton test, Why it reads flat, Craft floor, Refuse, Verify (+7 more)

### Community 40 - "New visual work"
Cohesion: 0.14
Nodes (14): 1. Decide what is already true, 2. Ask what will change the work, 3. Choose the right amount of invention, 4. Commit the world, 5. Record the decision, 6. Build with full commitment, 7. Inspect and finish, Both paths (+6 more)

### Community 41 - "optimize.md"
Cohesion: 0.14
Nodes (13): Animation Performance, Assess Performance Issues, Core Web Vitals Optimization, Cumulative Layout Shift (CLS < 0.1), Interaction to Next Paint (INP < 200ms), Largest Contentful Paint (LCP < 2.5s), Loading Performance, Network Optimization (+5 more)

### Community 42 - "initPageChat"
Cohesion: 0.07
Nodes (57): agentHasWorkInFlight(), armPageChatForTyping(), attachSteerFocusDebug(), attachSteerFocusGuard(), buildSteerProcessingDots(), buildSteerQueueHint(), clearSteerAwaitTimer(), clearSteerFocusRecoverTimer() (+49 more)

### Community 43 - "startVariantObserver"
Cohesion: 0.19
Nodes (20): commitAcceptedVariantToDom(), ensureInsertPlaceholder(), finalizeInsertSession(), findVariantsWrapper(), getVisibleVariantEl(), isInsertGeneratingSession(), isVariantShown(), pickPopulatedVariantsWrapper() (+12 more)

### Community 44 - "connectSSE"
Cohesion: 0.13
Nodes (23): abandonForeignSession(), connectSSE(), discardOrphanedSession(), dismissToast(), injectVariantsFromSource(), isJsxSourceFile(), isSvelteComponentManifestPath(), isTerminalSessionSummary() (+15 more)

### Community 45 - "Scan mode (approach C: auto-extract, then confirm descriptive language)"
Cohesion: 0.15
Nodes (13): Component translation rules, Narrative mapping, Scan mode (approach C: auto-extract, then confirm descriptive language), Schema, Step 1: Find the design assets, Step 2: Auto-extract what can be auto-extracted, Step 2b: Stage the frontmatter, Step 3: Ask the user for qualitative language (+5 more)

### Community 46 - "showBar"
Cohesion: 0.16
Nodes (22): applyConfigureBarChrome(), buildConfirmedRow(), buildCyclingRow(), buildDots(), buildGeneratingRow(), cycleVariant(), cyclingCounterText(), cyclingShownVariant() (+14 more)

### Community 47 - "critique.md"
Cohesion: 0.17
Nodes (11): Action Summary, Ask the User, Assessment A: Design Review, Assessment B: Detector + Browser Evidence, Assessment Orchestration, Deliver the Report, Hard Invariants, Persist the Snapshot (+3 more)

### Community 48 - "Simplify the Design"
Cohesion: 0.17
Nodes (11): Assess Current State, Code Simplification, Content Simplification, Document Removed Complexity, Information Architecture, Interaction Simplification, Layout Simplification, Plan Simplification (+3 more)

### Community 49 - "Hardening Dimensions"
Cohesion: 0.17
Nodes (11): Accessibility Resilience, Assess Hardening Needs, Edge Cases & Boundary Conditions, Error Handling, Hardening Dimensions, Input Validation & Sanitization, Internationalization (i18n), Performance Resilience (+3 more)

### Community 50 - "Product"
Cohesion: 0.17
Nodes (11): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+3 more)

### Community 51 - "clarify.md"
Cohesion: 0.18
Nodes (10): Actions and navigation, Audit the language, Errors and permissions, Forms, Help and instructional text, Loading, empty, and success states, Rewrite by function, Set the message hierarchy (+2 more)

### Community 52 - "Nielsen's 10 Heuristics"
Cohesion: 0.18
Nodes (11): 10. Help and Documentation, 1. Visibility of System Status, 2. Match Between System and Real World, 3. User Control and Freedom, 4. Consistency and Standards, 5. Error Prevention, 6. Recognition Rather Than Recall, 7. Flexibility and Efficiency of Use (+3 more)

### Community 53 - "Generate Combined Critique Report"
Cohesion: 0.18
Nodes (11): Design Health Score, Design Specificity Verdict, Generate Combined Critique Report, Minor Observations, Overall Impression, Persona Red Flags, Priority Issues, Questions to Consider (+3 more)

### Community 54 - "document.md"
Cohesion: 0.18
Nodes (10): Pitfalls, Seed mode, Step 1: Route through new-work's workshop, Step 2: Write seed DESIGN.md, Step 3: Confirm, Style guidelines, The frontmatter: token schema, The markdown body: eight sections (canonical order) (+2 more)

### Community 55 - "polish.md"
Cohesion: 0.18
Nodes (10): 1. Establish the system, 2. Gather the evidence, 3. Triage, 4. Polish the whole path, 5. Verify and finish, Color, imagery, and icons, Content and code, Flow and hierarchy (+2 more)

### Community 56 - "quieter.md"
Cohesion: 0.18
Nodes (10): Assess Current State, Color Refinement, Composition Refinement, Motion Reduction, Plan Refinement, Refine the Design, Simplification, Verify Quality (+2 more)

### Community 57 - "scheduleAcceptCleanup"
Cohesion: 0.31
Nodes (11): acceptedDomAlreadyClean(), clearHandledWrapperReloadStamp(), deferredRecoverySuperseded(), ensureAcceptedDomClean(), findAcceptedRuntimeWrappers(), handledWrapperReloadKey(), reloadAfterMissingAcceptedDom(), restoreAcceptedDomFromSnapshot() (+3 more)

### Community 58 - "mountSvelteComponentVariant"
Cohesion: 0.16
Nodes (22): applyOriginalAttrsToSvelteAnchor(), commitAcceptedSvelteComponentToDom(), componentModuleCandidates(), describeMountFailure(), detectDevServerBase(), elementMatchesOriginalMarkup(), findInsertAnchorInDom(), findLiveElementForOriginalMarkup() (+14 more)

### Community 59 - "telegram-service-refactored.test.js"
Cohesion: 0.18
Nodes (6): telegram, fs, http, https, MockTelegramClient, { TelegramClient, Api }

### Community 60 - "Init flow"
Cohesion: 0.20
Nodes (10): Completion gate, Init flow, Step 1: Load current state, Step 2: Explore the project, Step 3: Interview for product truth, Step 4: Write PRODUCT.md, Step 5: Record workflow defaults, Step 6: Wrap up or resume (+2 more)

### Community 61 - "syncEditBadgeHitProxies"
Cohesion: 0.27
Nodes (10): bindEditBadgeProxy(), editBadgeProxyTargets(), initEditBadge(), initEditBadgeHitProxies(), positionEditBadge(), proxyMouseEvent(), setImportantStyle(), styleEditBadgeProxy() (+2 more)

### Community 62 - "Common Cognitive Load Violations"
Cohesion: 0.22
Nodes (9): 1. The Wall of Options, 2. The Memory Bridge, 3. The Hidden Navigation, 4. The Jargon Barrier, 5. The Visual Noise Floor, 6. The Inconsistent Pattern, 7. The Multi-Task Demand, 8. The Context Switch (+1 more)

### Community 63 - "iOS platform"
Cohesion: 0.22
Nodes (9): Color & materials, Components & controls, iOS platform, Layout & structure, Motion, The iOS slop test, Touch targets, Typography (+1 more)

### Community 64 - "Operate mode depth (and Read notes)"
Cohesion: 0.22
Nodes (9): Color, Components, Layout, Motion, Operate mode depth (and Read notes), Product constraints, Product permissions, The product slop test (+1 more)

### Community 65 - "Shape"
Cohesion: 0.22
Nodes (8): Cadence, Confirm and stop, Phase 1: Discovery interview, Phase 2: Resolve the design direction, Phase 3: Write the brief, Round 1: purpose, people, and outcome, Round 2: material, behavior, and boundaries, Shape

### Community 66 - "adapt.native.md"
Cohesion: 0.25
Nodes (7): Adaptation Strategies, Assess Adaptation Challenge, Implement & Verify, Orientation & foldables, Phone → Tablet (iPad / large screens), Platform → platform (iOS ↔ Android), Web → native (porting a website or web app)

### Community 67 - "Android platform"
Cohesion: 0.25
Nodes (8): Android platform, Color & theming, Components & motion, Layout & structure, The Android slop test, Touch targets, Typography, Verifying the build

### Community 68 - "colorize.md"
Cohesion: 0.25
Nodes (7): Apply at system scale, Audit before choosing, Choose a strategy, Contrast and perception, Live-mode signature params, Verify, Visitor mode

### Community 69 - "Persona-Based Design Testing"
Cohesion: 0.25
Nodes (8): 1. Impatient Power User: "Alex", 2. Confused First-Timer: "Jordan", 3. Accessibility-Dependent User: "Sam", 4. Deliberate Stress Tester: "Riley", 5. Distracted Mobile User: "Casey", Persona-Based Design Testing, Project-Specific Personas, Selecting Personas

### Community 70 - "doctor.md"
Cohesion: 0.25
Nodes (7): Monorepo notes, Opting out of the boot check, Step 1: Run the pass, Step 2: Act by severity, Step 3: Deprecated fields are binding, Step 4: Do not overclaim on truth drift, What this owns, and what it does not

### Community 71 - "Extract Flow"
Cohesion: 0.25
Nodes (7): Extract Flow, Step 1: Discover the Design System, Step 2: Identify Patterns, Step 3: Plan Extraction, Step 4: Extract & Enrich, Step 5: Migrate, Step 6: Document

### Community 72 - "live-setup.md"
Cohesion: 0.25
Nodes (7): append-arrays, append-string, Config drift, Consent prompt (use this phrasing), CSP detection (first-time only), Troubleshooting, Write the config

### Community 73 - "Generate Report"
Cohesion: 0.29
Nodes (7): Audit Health Score, Detailed Findings by Severity, Executive Summary, Generate Report, Patterns & Systemic Issues, Platform Conformance Verdict, Positive Findings

### Community 74 - "Cognitive Load Assessment"
Cohesion: 0.29
Nodes (7): Cognitive Load Assessment, Cognitive Load Checklist, Extraneous Load: Bad Design, Germane Load: Learning Effort, Intrinsic Load: The Task Itself, The Working Memory Rule, Three Types of Cognitive Load

### Community 75 - "Impeccable Asset Producer"
Cohesion: 0.29
Nodes (6): Core Rule, Decision Comps, Impeccable Asset Producer, Input Contract, Output Contract, The job

### Community 76 - "Impeccable Finish Reviewer"
Cohesion: 0.29
Nodes (6): Checks, in order, Disposition, Impeccable Finish Reviewer, Input Contract, Output Contract, Verdict Pass

### Community 77 - "Impeccable Manual Edit Applier"
Cohesion: 0.29
Nodes (6): Checks, Entry Atomicity, Impeccable Manual Edit Applier, Input Contract, Output Contract, Workflow

### Community 78 - "live-browser-ignores.js"
Cohesion: 0.52
Nodes (6): globToRegex(), matchesScope(), normalizeIgnoreRule(), normalizeIgnoreValue(), pageCandidates(), resolveDetectIgnores()

### Community 79 - "Diagnostic Scan"
Cohesion: 0.33
Nodes (6): 1. Accessibility (VoiceOver / TalkBack), 2. Performance, 3. Appearance & Theming, 4. Platform Conformance (CRITICAL), 5. Adaptivity, Diagnostic Scan

### Community 80 - "Responsive Design"
Cohesion: 0.20
Nodes (10): Breakpoints: Content-Driven, Detect Input Method, Not Just Screen Size, Layout Adaptation Patterns, Mobile-First: Write It Right, Picture Element for Art Direction, Responsive Design, Responsive Images: Get It Right, Safe Areas: Handle the Notch (+2 more)

### Community 81 - "$impeccable hooks"
Cohesion: 0.33
Nodes (6): Constraints, Failure modes, Flow, $impeccable hooks, Routing, Triage findings

### Community 82 - "Visualize: Direction Comps & Asset Production"
Cohesion: 0.33
Nodes (5): After approval: the comp becomes a spec, Generate three compositional options, One approval point, Plates and provenance, Visualize: Direction Comps & Asset Production

### Community 83 - "impeccable"
Cohesion: 0.60
Nodes (5): impeccable script, check_download(), fetch_url(), probe_ok(), setup_help()

### Community 84 - "injectSvelteComponentsFromManifest"
Cohesion: 0.40
Nodes (6): completeParameterGenerationIfReady(), completeSourceInjection(), hideShaderOverlay(), injectSvelteComponentsFromManifest(), loadSvelteComponentParams(), removeStrayShaderNode()

### Community 85 - "upload_hf_database.js"
Cohesion: 0.33
Nodes (4): @huggingface/hub, fs, path, { uploadFiles }

### Community 86 - "Impeccable Documenter"
Cohesion: 0.40
Nodes (4): Impeccable Documenter, Input Contract, Output Contract, Workflow

### Community 87 - "enableInlineEdit"
Cohesion: 0.40
Nodes (5): collectEditableTextRows(), visit(), enableInlineEdit(), onInlineInput(), wrapMixedContentTextNodes()

### Community 88 - "Heuristics Scoring Guide"
Cohesion: 0.50
Nodes (4): Heuristics Scoring Guide, Issue Severity (P0–P3), Reference Material, Score Summary

### Community 90 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, jest, nodemon, supertest

## Knowledge Gaps
- **528 isolated node(s):** `dns`, `express`, `cors`, `path`, `multer` (+523 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 586 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Reference Material` connect `Heuristics Scoring Guide` to `Cognitive Load Assessment`, `Persona-Based Design Testing`, `critique.md`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `telegram` connect `telegram-service-refactored.test.js` to `telegram-service.js`, `package.json`, `telegram-service-refactored.js`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `New visual work` connect `New visual work` to `new-work.md`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `dns`, `express`, `cors` to the rest of the system?**
  _528 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08163265306122448 - nodes in this community are weakly interconnected._
- **Should `telegram-service.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09846153846153846 - nodes in this community are weakly interconnected._
- **Should `index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0507399577167019 - nodes in this community are weakly interconnected._