# Graph Report - Fenixhub  (2026-10-15)

## Corpus Check
- 205 files · ~288,133 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3270 nodes · 4872 edges · 208 communities (203 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `71474651`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- Client
- Handler
- package.json
- DB
- resumeSession
- Tracker
- onAnnotDown
- auth.go
- applyEditing
- Real-World GitHub Actions Attacks
- exportar_jsons.js
- initGlobalBar
- merger.go
- findVariantsWrapper
- modern-screenshot.umd.js
- el
- rules/graphify.md
- workflows/graphify.md
- live-browser.js
- captureElementToBlob
- renderDesignVisual
- Responsive Design
- handleManualEditActivity
- onboard.md
- new-work.md
- The Toolkit
- syncAgentPollingUi
- initDesignPanel
- createLiveBrowserSessionState
- Relatório de Modificações do Projeto Fenixhub
- Security Misconfiguration Reference
- Design System: Fenix Studio
- createLiveBrowserDomHelpers
- animate.md
- live.md
- Handle `generate`
- Generate Report
- impeccable/SKILL.md
- New visual work
- optimize.md
- initPageChat
- Insecure Deserialization Reference
- mountSvelteComponentVariant
- Scan mode (approach C: auto-extract, then confirm descriptive language)
- Dangerous Code Patterns
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
- Docker Security Reference
- Supply Chain Security Reference
- fenixhub
- Init flow
- Django Performance Review
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
- JavaScript/TypeScript Security Patterns
- $impeccable hooks
- Visualize: Direction Comps & Asset Production
- impeccable
- Data Protection Reference
- Impeccable Documenter
- API Security Reference
- Heuristics Scoring Guide
- Error Handling Security Reference
- Stage 3: Reader Testing
- fetch_pr_feedback.py
- Authentication Security Reference
- Server-Side Request Forgery (SSRF) Prevention Reference
- Authorization Security Reference
- Cryptographic Security Reference
- Cross-Site Scripting (XSS) Prevention Reference
- File Security Reference
- Security Logging Reference
- Modern Threats Reference
- Security Review Skill
- Python Security Patterns
- Business Logic Security Reference
- scan_skill
- Claude Settings Audit
- Django Access Control & IDOR Review
- Brand Guidelines
- Runner Infrastructure
- Recharts Patterns for Sentry Presentations
- Cross-Site Request Forgery (CSRF) Prevention Reference
- Permissions and Secrets
- Supply Chain: Third-Party Actions
- Sentry Presentation Builder
- Prompt Injection Patterns
- Injection Prevention Reference
- Structure Troubleshooting
- GitHub Actions Security Review
- Sentry Presentation Design System
- Expression Injection
- AI Prompt Injection via CI
- fetch_pr_checks.py
- Sentry Blog Writing Skill
- Credential Escalation
- Examples
- Workflow
- Review Checklist
- Pwn Request Attacks
- monitor_pr_checks.py
- Comment-Triggered Command Execution
- cleanup
- Optimization loop
- Skill Writer
- Common Permission Profiles
- Synthesis Path
- Process
- Process
- Archive Criteria Taxonomy
- Triage Frontend Issues
- Workflow
- Sources
- Authoring Path
- Skill Design Principles
- AGENTS.md Specification
- Things to Check When Investigating
- Iterate PR Specification
- PR Writer Specification
- Transformed Examples
- Prompt Optimizer Specification
- Skill Writer Evaluation
- Skill Writer Specification
- Django ORM - Context for Investigation
- Where Authorization Can Happen
- Document & Type a Sentry API Endpoint
- PR Writer
- Core Patterns
- Prompt Optimizer
- Skill Evals
- quick_validate.py
- project-template.md
- SPEC — triage-frontend-issues
- Sources
- Multi-Tenant Isolation - Context for Investigation
- Case Study: Documentation Skill Synthesis
- Case Study: Workflow/Process Skill Synthesis
- Reference Architecture
- Typing Exclusion Worker
- Maintaining AGENTS.md
- Find Bugs
- Model Family Notes
- Execution Shapes
- Output Contracts
- GitHub Review Requests
- reply_to_thread.py
- Claude Frontmatter And Invocation
- Case Study: Hook-Backed Skill Synthesis
- Case Study: Router Skill Synthesis
- Case Study: Subagent-Fork Skill Synthesis
- Iteration Evidence
- Mode Selection
- SPEC.md Template
- Sources
- Sentry Commit Messages
- Guia de Integração: Stremio Addon com Fenixhub
- PR Writer Evaluation
- Claude Hook-Backed Skills
- Iteration Path
- Argument-Driven Skill Layout
- Asset-Template Skill Layout
- Inline Skill Layout
- Reference-Backed Skill Layout
- Script-Backed Skill Layout
- Source Adaptation
- Source Discovery
- Link a GitHub Issue + Linear Ticket on a PR
- Claude Subagent-Fork Skills
- Description Optimization
- Registration and Validation
- Orchestrator-Workers
- Parallel Workflows
- Plan-Validate-Execute
- Prompt Chaining
- Routing Workflows
- Validation Loops
- SRED.md
- Create Branch
- fetch_review_requests.py
- Claude Argument Substitutions
- Claude Dynamic Context Injection
- bolder.md

## God Nodes (most connected - your core abstractions)
1. `Handler` - 40 edges
2. `setLiveState()` - 32 edges
3. `resumeSession()` - 32 edges
4. `connectSSE()` - 31 edges
5. `showToast()` - 30 edges
6. `el()` - 29 edges
7. `initGlobalBar()` - 29 edges
8. `handleKeyDown()` - 27 edges
9. `DB` - 27 edges
10. `buildInsertConfigureRow()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `InitDB()`  [EXTRACTED]
  main.go → internal/database/db.go
- `main()` --calls--> `NewHandler()`  [EXTRACTED]
  main.go → internal/handlers/handlers.go
- `enableInlineEdit()` --indirect_call--> `own()`  [INFERRED]
  .agents/skills/impeccable/scripts/live-browser.js → .agents/skills/impeccable/scripts/live-browser-dom.js
- `layoutFlowChildren()` --indirect_call--> `pickable()`  [INFERRED]
  .agents/skills/impeccable/scripts/live-browser.js → .agents/skills/impeccable/scripts/live-browser-dom.js
- `main()` --calls--> `RequireAdmin()`  [EXTRACTED]
  main.go → internal/auth/auth.go

## Import Cycles
- None detected.

## Communities (208 total, 4 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.08
Nodes (46): actionPendingFile(), approveFile(), cat, changeColabPeriod(), checkAdminSession(), checkMyPendings(), clearDiscordSession(), closeReportModal() (+38 more)

### Community 1 - "Client"
Cohesion: 0.18
Nodes (7): net/http.Client, time.Duration, time.Time, treeItem, extractItemTimestamp(), Client, NewClient()

### Community 3 - "package.json"
Cohesion: 0.25
Nodes (7): description, name, scripts, build, postinstall, start, version

### Community 4 - "DB"
Cohesion: 0.14
Nodes (3): database/sql.DB, DB, InitDB()

### Community 5 - "resumeSession"
Cohesion: 0.08
Nodes (71): abortSvelteComponentInjection(), applySavedSessionMeta(), clampVariantIndex(), clearHandled(), clearMountErrorCard(), clearSession(), completeParameterGenerationIfReady(), completeParameterPublication() (+63 more)

### Community 6 - "Tracker"
Cohesion: 0.14
Nodes (9): sync.Mutex, sync.RWMutex, time.Timer, ColaboradorRank, NewHandler(), Tracker, NewTracker(), cachePayload (+1 more)

### Community 7 - "onAnnotDown"
Cohesion: 0.18
Nodes (19): applyPlaceholderDimensions(), beginEditPin(), buildAnnotationsForCapture(), buildPinElement(), cancelEditingPin(), finalizeEditingPin(), initAnnotOverlay(), localCoords() (+11 more)

### Community 8 - "auth.go"
Cohesion: 0.16
Nodes (18): DiscordClaims, github.com/gin-gonic/gin.HandlerFunc, CheckPassword(), ExtractToken(), GenerateToken(), GetAdminPassword(), GetAjudantePassword(), GetAuthUser() (+10 more)

### Community 9 - "applyEditing"
Cohesion: 0.17
Nodes (17): applyEditing(), buildLocatorForLeaf(), buildPickedAnchorSnapshot(), copyEditContainerContext(), copyEditLeafContext(), documentRefForElement(), extractContext(), forbiddenManualTextChars() (+9 more)

### Community 10 - "Real-World GitHub Actions Attacks"
Cohesion: 0.05
Nodes (39): Attack, Attack, Attack, Attack, Attack 1: awesome-go — Go init() Injection, Attack, Attack, Attack 2: trivy — PAT Theft and Full Repo Compromise (+31 more)

### Community 11 - "exportar_jsons.js"
Cohesion: 0.32
Nodes (7): fs, main(), OUTPUT_DIR, path, tryExtractFromDatabase(), tryExtractFromFile(), zlib

### Community 12 - "initGlobalBar"
Cohesion: 0.07
Nodes (66): barPaletteForTheme(), beginNewLiveConfiguration(), cancelEditing(), cancelEditingToPicking(), cancelInsertConfigure(), cleanupAcceptedSession(), clearAnnotations(), clearInsertPicking() (+58 more)

### Community 13 - "merger.go"
Cohesion: 0.60
Nodes (5): getStreamKey(), InjectDateIntoStreams(), isPlaceholder(), MergeMediaContent(), MergeStreamArrays()

### Community 14 - "findVariantsWrapper"
Cohesion: 0.14
Nodes (20): applyParamDefaults(), applyParamValue(), buildParamsPanel(), commitAcceptedVariantToDom(), ensureInsertPlaceholder(), findVariantsWrapper(), formatRangeValue(), getVisibleVariantEl() (+12 more)

### Community 15 - "modern-screenshot.umd.js"
Cohesion: 0.09
Nodes (55): ae(), be(), bt(), Ce(), s(), Ct(), de(), dt() (+47 more)

### Community 16 - "el"
Cohesion: 0.07
Nodes (61): actionLabel(), applyConfigureBarChrome(), bindConfigureCountPillTooltip(), bindConfigureInlineControlHover(), bindConfigureModifierPillHover(), buildConfigureActionControl(), buildConfigureCountControl(), buildConfigureRow() (+53 more)

### Community 20 - "live-browser.js"
Cohesion: 0.04
Nodes (98): addManualContextText(), applyPlaceholderSizingStyles(), bindEditBadgeProxy(), bufferToBase64(), buildPlaceholderResizeHandles(), canRestoreManualEditElement(), captureChromeNodes(), clampPlaceholderSize() (+90 more)

### Community 21 - "captureElementToBlob"
Cohesion: 0.09
Nodes (26): abandonForeignSession(), averageRgb01(), captureAndEmit(), captureElementFromRenderedAncestor(), captureElementToBlob(), checkpointPayload(), compileShader(), cssColorToRgb01() (+18 more)

### Community 22 - "renderDesignVisual"
Cohesion: 0.08
Nodes (35): buildCollapsible(), buildColorModels(), buildListHtml(), buildRadiiModels(), buildTypographyModels(), cssSafe(), designEmptyMessage(), escapeHtml() (+27 more)

### Community 23 - "Responsive Design"
Cohesion: 0.08
Nodes (25): Assess Adaptation Challenge, Breakpoints: Content-Driven, Content Adaptation, Desktop Adaptation (Mobile → Desktop), Detect Input Method, Not Just Screen Size, Email Adaptation (Web → Email), Implement Adaptations, Layout Adaptation Patterns (+17 more)

### Community 24 - "handleManualEditActivity"
Cohesion: 0.19
Nodes (23): clearStoredManualApplyState(), fetchPendingCount(), handleManualEditActivity(), hidePendingApplyDock(), manualApplyLoadingText(), manualApplyStateKey(), manualEditEventForCurrentPage(), numberOrNull() (+15 more)

### Community 25 - "onboard.md"
Cohesion: 0.09
Nodes (22): Assess Onboarding Needs, Context Over Ceremony, Contextual Help, Design Onboarding Experiences, Documentation & Help, Empty State Design, Feature Discovery & Adoption, Guided Tours & Walkthroughs (+14 more)

### Community 26 - "new-work.md"
Cohesion: 0.13
Nodes (14): Recommended Actions, Craft (deprecated alias), Apply, Live-mode signature params, Set the spatial thesis, Two isolated assessments, Verify, Visitor mode (+6 more)

### Community 27 - "The Toolkit"
Cohesion: 0.10
Nodes (20): Animate complex properties, Assess What "Extraordinary" Means Here, For data-heavy interfaces, For functional UI, For performance-critical UI, For visual/marketing surfaces, Implement with Discipline, Interact with the device (+12 more)

### Community 28 - "syncAgentPollingUi"
Cohesion: 0.31
Nodes (9): agentHasWorkInFlight(), agentStatusText(), brandMarkSvg(), ensureAgentPollTooltip(), showAgentPollTooltip(), steerQueuedBehindGeneration(), steerTimeoutMessage(), syncAgentPollingUi() (+1 more)

### Community 29 - "initDesignPanel"
Cohesion: 0.48
Nodes (7): buildDesignHeader(), designPanelCss(), fetchDesignSystem(), initDesignPanel(), loadDesignPrefs(), renderDesignChrome(), toggleDesignPanel()

### Community 30 - "createLiveBrowserSessionState"
Cohesion: 0.21
Nodes (15): createLiveBrowserSessionState(), clearHandled(), clearScrollY(), clearSession(), isHandled(), loadSession(), markHandled(), nextCheckpointRevision() (+7 more)

### Community 31 - "Relatório de Modificações do Projeto Fenixhub"
Cohesion: 0.17
Nodes (11): 1. Migração do Backend (Node.js/Express para Go/Gin), 2. Correção de Rotas Estáticas e Inicialização, 3. Uploads de Mídia e Envio Direto (Sem Telegram), 4. Integração e Login com o Discord, 5. Endpoints de Populares e Recentes (Integração com Stremio Addon), 6. Estado do Frontend e Limpeza, 7. Atualizações Recentes no Servidor (`server`), Inicialização e Fallbacks, 8. Otimizações de Desempenho e Sincronia (Servidor & Addon) (+3 more)

### Community 32 - "Security Misconfiguration Reference"
Cohesion: 0.05
Nodes (38): Admin/Debug Endpoints, Configuration Files to Check, Content Security Policy, Cookie Security, CORS Misconfiguration, Dangerous Patterns, Dangerous Patterns, Dangerous Patterns (+30 more)

### Community 33 - "Design System: Fenix Studio"
Cohesion: 0.08
Nodes (24): Buttons, Cards & Glass Panels, Colors, Components, Design System: Fenix Studio, Do:, Do's and Don'ts, Don't: (+16 more)

### Community 34 - "createLiveBrowserDomHelpers"
Cohesion: 0.17
Nodes (10): createLiveBrowserDomHelpers(), cssId(), liveUiRoot(), makeFrozenAnchor(), own(), pickable(), rectIsUsableAnchor(), uiAppend() (+2 more)

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

### Community 39 - "impeccable/SKILL.md"
Cohesion: 0.15
Nodes (10): Craft floor, Refuse, Verify, Command guidance, No-argument routing: the context-aware menu, Workflow questions, Commands, How to design (+2 more)

### Community 40 - "New visual work"
Cohesion: 0.14
Nodes (14): 1. Decide what is already true, 2. Ask what will change the work, 3. Choose the right amount of invention, 4. Commit the world, 5. Record the decision, 6. Build with full commitment, 7. Inspect and finish, Both paths (+6 more)

### Community 41 - "optimize.md"
Cohesion: 0.14
Nodes (13): Animation Performance, Assess Performance Issues, Core Web Vitals Optimization, Cumulative Layout Shift (CLS < 0.1), Interaction to Next Paint (INP < 200ms), Largest Contentful Paint (LCP < 2.5s), Loading Performance, Network Optimization (+5 more)

### Community 42 - "initPageChat"
Cohesion: 0.09
Nodes (45): applyGlobalBarLabelState(), armPageChatForTyping(), attachSteerFocusDebug(), attachSteerFocusGuard(), clearSteerAwaitTimer(), collapsePageChat(), expandPageChat(), finishVoiceSession() (+37 more)

### Community 43 - "Insecure Deserialization Reference"
Cohesion: 0.06
Nodes (35): 1. Avoid Native Serialization, 2. Sign Serialized Data, 3. Type-Restricted Deserialization, 4. Input Validation, Dangerous Functions, Dangerous Patterns, Dangerous Patterns, Dangerous Patterns (+27 more)

### Community 44 - "mountSvelteComponentVariant"
Cohesion: 0.10
Nodes (32): applyOriginalAttrsToSvelteAnchor(), buildSvelteExpressionTextMap(), buildSveltePropValuesFromLiveElement(), buildSveltePropValuesV2(), cloneWithoutElements(), collectTextNodes(), collectVisibleTexts(), commitAcceptedSvelteComponentToDom() (+24 more)

### Community 45 - "Scan mode (approach C: auto-extract, then confirm descriptive language)"
Cohesion: 0.15
Nodes (13): Component translation rules, Narrative mapping, Scan mode (approach C: auto-extract, then confirm descriptive language), Schema, Step 1: Find the design assets, Step 2: Auto-extract what can be auto-extracted, Step 2b: Stage the frontmatter, Step 3: Ask the user for qualitative language (+5 more)

### Community 46 - "Dangerous Code Patterns"
Cohesion: 0.06
Nodes (33): Agent Configuration, Base64 Obfuscation, `!`command`` Pre-prompt Injection (Claude Code), Credential Files, Credential Theft, Dangerous Code Patterns, Dangerous Execution, Data Exfiltration (+25 more)

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

### Community 57 - "Docker Security Reference"
Cohesion: 0.06
Nodes (32): Base Image Issues, Build-Time Secrets, COPY vs ADD, Docker Compose Security, Docker Security Reference, Docker Socket Access, Dockerfile Security, .dockerignore (+24 more)

### Community 58 - "Supply Chain Security Reference"
Cohesion: 0.06
Nodes (32): Attack Vector, Build Pipeline Security, Common Typosquatting Patterns, Dependency Confusion, Detection, Detection Patterns, Generation, Grep Patterns for Detection (+24 more)

### Community 60 - "Init flow"
Cohesion: 0.20
Nodes (10): Completion gate, Init flow, Step 1: Load current state, Step 2: Explore the project, Step 3: Interview for product truth, Step 4: Write PRODUCT.md, Step 5: Record workflow defaults, Step 6: Wrap up or resume (+2 more)

### Community 61 - "Django Performance Review"
Cohesion: 0.06
Nodes (29): Django Performance Review, False Positives to Avoid, Impact Categories, Output Format, Pattern: get() in small loops, Priority 1: N+1 Queries (CRITICAL), Priority 2: Unbounded Querysets (CRITICAL), Priority 3: Missing Indexes (HIGH) (+21 more)

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

### Community 80 - "JavaScript/TypeScript Security Patterns"
Cohesion: 0.06
Nodes (30): Always Flag, Angular, Any Type Warnings, Auto-Escaped (Do Not Flag), Auto-Escaped (Do Not Flag), Auto-Escaped (Do Not Flag), Check Context, Express / Node.js (+22 more)

### Community 81 - "$impeccable hooks"
Cohesion: 0.33
Nodes (6): Constraints, Failure modes, Flow, $impeccable hooks, Routing, Triage findings

### Community 82 - "Visualize: Direction Comps & Asset Production"
Cohesion: 0.33
Nodes (5): After approval: the comp becomes a spec, Generate three compositional options, One approval point, Plates and provenance, Visualize: Direction Comps & Asset Production

### Community 83 - "impeccable"
Cohesion: 0.60
Nodes (5): impeccable script, check_download(), fetch_url(), probe_ok(), setup_help()

### Community 84 - "Data Protection Reference"
Cohesion: 0.06
Nodes (30): 1. Data Classification, 2. Minimize Data Collection, 3. Encryption at Rest, 4. Encryption in Transit, API Response Filtering, Authentication Credentials, Cache Headers, Cache Security (+22 more)

### Community 86 - "Impeccable Documenter"
Cohesion: 0.40
Nodes (4): Impeccable Documenter, Input Contract, Output Contract, Workflow

### Community 87 - "API Security Reference"
Cohesion: 0.07
Nodes (29): API Key Security, API Security Reference, Authentication, Authorization, Batching Attack Prevention, Content-Type Validation, CORS Configuration, Disable Introspection in Production (+21 more)

### Community 88 - "Heuristics Scoring Guide"
Cohesion: 0.50
Nodes (4): Heuristics Scoring Guide, Issue Severity (P0–P3), Reference Material, Score Summary

### Community 89 - "Error Handling Security Reference"
Cohesion: 0.07
Nodes (29): Authentication Bypass on Error, Cleanup on Error, Dangerous Patterns, Dangerous Patterns, Differential Error Messages, Error-Based SQL Injection Indicators, Error Handling Security Reference, Exception Swallowing (+21 more)

### Community 90 - "Stage 3: Reader Testing"
Cohesion: 0.07
Nodes (28): Attribution, Doc Co-Authoring Workflow, Exit Condition (Both Approaches), Final Review, Info Dumping, Initial Questions, Near Completion, Quality Checking (+20 more)

### Community 91 - "fetch_pr_feedback.py"
Cohesion: 0.13
Nodes (27): categorize_comment(), detect_logaf(), extract_feedback_item(), get_issue_comments(), get_pr_info(), get_repo_info(), get_review_comments(), get_review_threads() (+19 more)

### Community 92 - "Authentication Security Reference"
Cohesion: 0.07
Nodes (27): Account Lockout, Authentication Security Reference, Brute Force Protection, Concurrent Session Control, Cookie Security Attributes, Email Address Changes, Error Messages, Exponential Backoff (+19 more)

### Community 93 - "Server-Side Request Forgery (SSRF) Prevention Reference"
Cohesion: 0.07
Nodes (27): 1. Input Validation (Allowlist), 2. Block Internal Networks (Denylist), 3. Disable Redirects, 4. DNS Rebinding Protection, 5. Cloud Metadata Protection, Alternate Representations, Attack Scenarios, AWS IMDSv2 (+19 more)

### Community 94 - "Authorization Security Reference"
Cohesion: 0.07
Nodes (26): 1. Deny by Default, 2. Enforce Least Privilege, 3. Validate Permissions on Every Request, Access Control Models, Attribute-Based Access Control (ABAC), Authorization Security Reference, Authorization Testing, Common Vulnerabilities (+18 more)

### Community 95 - "Cryptographic Security Reference"
Cohesion: 0.07
Nodes (26): Asymmetric Encryption, Cipher Modes, Common Vulnerabilities, Core Principles, Cryptographic Security Reference, Cryptographically Secure PRNGs (CSPRNG), ECB Mode Patterns, Encryption Algorithms (+18 more)

### Community 96 - "Cross-Site Scripting (XSS) Prevention Reference"
Cohesion: 0.07
Nodes (26): Angular, Content Security Policy (CSP), Cross-Site Scripting (XSS) Prevention Reference, CSS Context, Dangerous Sources, Django/Jinja2, DOM-based XSS Prevention, Framework-Specific Considerations (+18 more)

### Community 97 - "File Security Reference"
Cohesion: 0.08
Nodes (25): Archive (ZIP) Handling, Characters to Block, Dangerous File Types, Defense in Depth Approach, File Permissions, File Security Reference, File Upload Security, Filename Sanitization (+17 more)

### Community 98 - "Security Logging Reference"
Cohesion: 0.08
Nodes (25): Alert Configuration, Attack Vector, Audit Trail Requirements, Dangerous Patterns, Events That Must Be Logged, Grep Patterns for Detection, Immutable Audit Logs, Insecure Patterns (+17 more)

### Community 99 - "Modern Threats Reference"
Cohesion: 0.08
Nodes (25): Authentication, Cross-Site WebSocket Hijacking (CSWSH), Detection, DOM Clobbering, DOM Clobbering, Grep Patterns for Detection, LLM Prompt Injection, LLM Prompt Injection (+17 more)

### Community 100 - "Security Review Skill"
Cohesion: 0.08
Nodes (25): 1. Detect Context, 2. Load Language Guide, 3. Load Infrastructure Guide (if applicable), 4. Research Before Flagging, 5. Verify Exploitability, 6. Report HIGH Confidence Only, Always Flag (Critical), Always Flag (High) (+17 more)

### Community 101 - "Python Security Patterns"
Cohesion: 0.08
Nodes (24): Always Flag, Auto-Escaped (Do Not Flag), Check Context, Common Mistakes, Django, Django Security Settings, FastAPI, Flag These (+16 more)

### Community 102 - "Business Logic Security Reference"
Cohesion: 0.08
Nodes (24): 1. Race Conditions, 2. Workflow Bypass, 3. Numeric Manipulation, 4. Price/Discount Manipulation, 5. Inventory/Resource Exhaustion, 6. Time-Based Attacks, 7. Parameter Tampering, Business Logic Security Reference (+16 more)

### Community 103 - "scan_skill"
Cohesion: 0.16
Nodes (24): check_frontmatter(), check_obfuscation(), check_prompt_injection(), check_scripts(), check_secrets(), check_structural_attacks(), compute_description_body_overlap(), extract_urls() (+16 more)

### Community 104 - "Claude Settings Audit"
Cohesion: 0.08
Nodes (23): Always Include (Sentry Projects), Baseline Commands (Always Include), Build Tools, Claude Settings Audit, Framework-Specific, Important Rules, Linear MCP (if Linear usage detected), MCP Server Suggestions (+15 more)

### Community 105 - "Django Access Control & IDOR Review"
Cohesion: 0.08
Nodes (23): Common Django Authorization Patterns, Confidence Levels, Django Access Control & IDOR Review, Example Investigation, Follow-Up Questions, How is authorization enforced?, Investigation Checklist, Investigation commands (+15 more)

### Community 106 - "Brand Guidelines"
Cohesion: 0.09
Nodes (22): Anti-Patterns, Brand Guidelines, Buttons, Confirmation Dialogs, Dash Usage, Empty States, Error Messages, Examples (+14 more)

### Community 107 - "Runner Infrastructure"
Cohesion: 0.09
Nodes (22): Artifact Poisoning, Artifact Safety, Artifact Scope Rules, Attack: Poisoning the Cache, Attack Vectors on Self-Hosted Runners, Cache Poisoning, Cache Safety, Cache Scope Rules (+14 more)

### Community 108 - "Recharts Patterns for Sentry Presentations"
Cohesion: 0.09
Nodes (22): 1. Stacked Area Chart (ComposedChart), 2. Bar Chart (Grouped/Stacked), 3. Line/Area Curve Chart, 4. Temporal Scenario Chart (stepAfter), 5. Reference Lines and Areas, Axis and Grid Defaults, Chart Container Pattern, Color Usage Rules (+14 more)

### Community 109 - "Cross-Site Request Forgery (CSRF) Prevention Reference"
Cohesion: 0.09
Nodes (22): 1. GET Requests for State Changes, 1. Synchronizer Token Pattern, 2. CORS Misconfiguration, 2. Double Submit Cookie Pattern (Stateless), 3. SameSite Cookie Attribute, 3. Token in URL, 4. Custom Request Headers, Attack Scenario (+14 more)

### Community 110 - "Permissions and Secrets"
Cohesion: 0.09
Nodes (21): Dangerous Permission Patterns, Default Permissions, Detection Patterns, Explicit Permission Scoping, GITHUB_TOKEN Permissions, OIDC Best Practices, OIDC Subject Claim Misconfiguration, Overview (+13 more)

### Community 111 - "Supply Chain: Third-Party Actions"
Cohesion: 0.09
Nodes (21): Account Takeover / Org Compromise, Actions That curl | bash at Runtime, Attack Vectors, Automated Pinning, Detection Patterns, Do Not Report: First-Party Version Tags, Exploitation Scenario Template, Fork-and-Replace (+13 more)

### Community 112 - "Sentry Presentation Builder"
Cohesion: 0.09
Nodes (21): App.jsx Structure, Data Assessment (CRITICAL), Data Comparison Slide, index.html, main.jsx, Navigation, Output Expectations, package.json (+13 more)

### Community 113 - "Prompt Injection Patterns"
Cohesion: 0.09
Nodes (21): Base64 Encoding, False Positive Guide, Hidden Content Vectors, Homoglyph Characters, HTML Comments, Indirect Injection, Instruction Override Patterns, Instructions in Example Output (+13 more)

### Community 114 - "Injection Prevention Reference"
Cohesion: 0.10
Nodes (20): Dangerous Characters, Injection Prevention Reference, Key Grep Patterns for Detection, Language-Specific Dangerous Functions, LDAP Injection, MongoDB Injection Patterns, NoSQL Injection, ORM Safety Considerations (+12 more)

### Community 115 - "Structure Troubleshooting"
Cohesion: 0.10
Nodes (20): Additive Drift, Advanced Mechanics Without Justification, Duplicating CLAUDE.md Or AGENTS.md, Evaluator Loop Without Stop Condition, Extraneous Files, First/Second Person Descriptions, Generic Bucket Reference, Hardcoded Paths (+12 more)

### Community 116 - "GitHub Actions Security Review"
Cohesion: 0.10
Nodes (19): Check 1: Pwn Request, Check 2: Expression Injection, Check 3: Unauthorized Command Execution, Check 4: Credential Escalation, Check 5: Config File Poisoning, Check 6: Supply Chain, Check 7: Permissions and Secrets, Check 8: Runner Infrastructure (+11 more)

### Community 117 - "Sentry Presentation Design System"
Cohesion: 0.10
Nodes (19): Animations, Color Palette, Color Philosophy, Comparison Tables, CSS Variables, Dot Indicators, Icons, JS Color Constants (for Charts.jsx) (+11 more)

### Community 118 - "Expression Injection"
Cohesion: 0.11
Nodes (18): Attacker-Controlled Expressions Quick Reference, Branch Name Injection, Commit Message Injection, Detection Patterns, Exploitation Scenario Template, Expression Injection, Filename Injection, Fix Examples (+10 more)

### Community 119 - "AI Prompt Injection via CI"
Cohesion: 0.11
Nodes (17): 1. Use pull_request, Not pull_request_target, 2. Protect Config Files with CODEOWNERS, 3. Restrict Tool Allowlists, 4. Don't Allow All Users, 5. Review Config File Changes in PRs, AI Prompt Injection via CI, Attack Vectors, CLAUDE.md / AGENTS.md Poisoning (+9 more)

### Community 120 - "fetch_pr_checks.py"
Cohesion: 0.19
Nodes (17): extract_failure_snippet(), get_checks(), get_failed_runs(), get_pr_info(), get_run_logs(), is_human_gate_check(), main(), Any (+9 more)

### Community 121 - "Sentry Blog Writing Skill"
Cohesion: 0.12
Nodes (16): AI Writing Patterns to Avoid, Banned Language, Formatting for Skimmability, Non-Negotiables (Quick Reference), Post Types, Section Headings Must Convey Information, Sentry Blog Writing Skill, SEO for Developer Content (+8 more)

### Community 122 - "Credential Escalation"
Cohesion: 0.12
Nodes (16): Credential Escalation, Credential Types and Blast Radius, Detection Patterns, Exploitation Scenario Template, GITHUB_TOKEN with Excessive Permissions, Overview, PAT in pull_request_target Workflow, Principle of Least Privilege (+8 more)

### Community 123 - "Examples"
Cohesion: 0.12
Nodes (15): 1. Preserve Functionality, 2. Apply Project Standards, 3. Enhance Clarity, 4. Maintain Balance, 5. Focus Scope, After: Clear Steps, After: Clear Switch Statement, After: Direct Check (+7 more)

### Community 124 - "Workflow"
Cohesion: 0.12
Nodes (15): Bundled Script, Confidence Levels, Output Format, Phase 1: Input & Discovery, Phase 2: Automated Static Scan, Phase 3: Frontmatter Validation, Phase 4: Prompt Injection Analysis, Phase 5: Behavioral Analysis (+7 more)

### Community 125 - "Review Checklist"
Cohesion: 0.13
Nodes (14): Approval, Common Patterns to Flag, Design Assessment, Feedback Guidelines, Identifying Problems, Long-Term Impact, Python/Django, References (+6 more)

### Community 126 - "Pwn Request Attacks"
Cohesion: 0.13
Nodes (14): Attack Vectors, Detection Patterns, Exploitation Scenario Template, Go init() Injection, Local Action Override, Makefile / Shell Script Override, npm preinstall / postinstall, Overview (+6 more)

### Community 127 - "monitor_pr_checks.py"
Cohesion: 0.25
Nodes (14): get_checks(), get_pr_info(), is_human_gate_check(), main(), print_check_summary(), print_no_checks_summary(), Any, Return true when a pending entry is a human review/approval gate. (+6 more)

### Community 128 - "Comment-Triggered Command Execution"
Cohesion: 0.14
Nodes (13): Additional Protections, Attack Vectors, Author Association Values, Command with Fork Checkout, Comment-Triggered Command Execution, Compound: Command + Expression Injection, Detection Patterns, Exploitation Scenario Template (+5 more)

### Community 129 - "cleanup"
Cohesion: 0.16
Nodes (20): acceptedDomAlreadyClean(), cleanup(), clearHandledWrapperReloadStamp(), clearScrollY(), deferredRecoverySuperseded(), discardedWrappers(), discardStateStyleId(), ensureAcceptedDomClean() (+12 more)

### Community 130 - "Optimization loop"
Cohesion: 0.14
Nodes (13): 1. Baseline, 2. Failure clustering, 3. Textual gradients, 4. Candidate beam, 5. Compare on the same slice, 6. Reflective memory, 7. Holdout validation, 8. Stop conditions (+5 more)

### Community 131 - "Skill Writer"
Cohesion: 0.14
Nodes (13): Artifact Layout References, Claude Code References, Core Workflow References, Example Profiles, Output format, Skill Writer, Step 1: Resolve target, path, and shape, Step 2: Run synthesis when needed (+5 more)

### Community 132 - "Common Permission Profiles"
Cohesion: 0.15
Nodes (12): Analysis / Review Skills, Assessment Checklist, Common Permission Profiles, Content Generation Skills, External-Facing Skills, Full-Access Skills, Least Privilege Assessment, Permission Analysis (+4 more)

### Community 133 - "Synthesis Path"
Cohesion: 0.15
Nodes (12): Baseline Source Pack For Skill-Authoring, Output Style, Required Output, Step 0: Classify, Step 1.2: Adapt Source Material When Needed, Step 1.5: Load Example Profiles, Step 1.6: Expand Coverage, Step 1: Collect Sources (+4 more)

### Community 134 - "Process"
Cohesion: 0.15
Nodes (12): Examples, Prerequisites, Process, References, Resources, SRED Project Organization, Step 1, Step 2 (+4 more)

### Community 135 - "Process"
Cohesion: 0.15
Nodes (12): Prerequisites, Process, Resources, SRED Work Summary, Step 1, Step 2, Step 3, Step 4 (+4 more)

### Community 136 - "Archive Criteria Taxonomy"
Cohesion: 0.15
Nodes (12): 1. Single-event fluke, 2. Test / synthetic / security-research, 3. Wrong-project / non-frontend errors, 4. Customer-environment third-party library noise, 5. Browser API / permission noise, 6. Transient backend 5xx, 7. Network noise / Failed to fetch, 8. Customer-environment proxy interference (+4 more)

### Community 137 - "Triage Frontend Issues"
Cohesion: 0.15
Nodes (12): 1. Load the queue, 2. Classify each issue, 3. Build the plan, 4. Apply on approval, 5. Report, Example reasons (use this voice), Hard Rules, Inputs (+4 more)

### Community 138 - "Workflow"
Cohesion: 0.17
Nodes (11): 1. Identify PR, 2. Handle Feedback, 3. Check CI Status, 4. Fix CI Failures, 5. Verify Locally, Then Commit and Push, 6. Monitor CI and Address Feedback, Bundled Scripts, Exit Conditions (+3 more)

### Community 139 - "Sources"
Cohesion: 0.17
Nodes (11): Changelog, Coverage matrix, Current source inventory, Decisions, Description QA, Open gaps, Selected profile, Should not trigger (+3 more)

### Community 140 - "Authoring Path"
Cohesion: 0.17
Nodes (11): Authoring Path, Class-Specific Requirements, Example Requirements, File Creation Rules, `integration-documentation`, Path Rules, Precision Pass, Required Output (+3 more)

### Community 141 - "Skill Design Principles"
Cohesion: 0.17
Nodes (11): Core Rule, Description Rules, Independence And Portability, Keep Vs Cut, Long Files, Match Structure To Fragility, Precision Before Addition, Preferred Instruction Shapes (+3 more)

### Community 142 - "AGENTS.md Specification"
Cohesion: 0.18
Nodes (10): AGENTS.md Specification, Evaluation, Intent, Known Limitations, Maintenance Notes, Reference Architecture, Runtime Contract, Scope (+2 more)

### Community 143 - "Things to Check When Investigating"
Cohesion: 0.18
Nodes (8): 1. What's in DEFAULT_PERMISSION_CLASSES?, 2. What does each permission class actually do?, 3. How is data fetched?, 4. What's in get_queryset()?, DRF Permissions - Context for Investigation, How DRF Permission Flow Works, Serializer Considerations, Things to Check When Investigating

### Community 144 - "Iterate PR Specification"
Cohesion: 0.18
Nodes (10): Intent, Iterate PR Specification, Known Limitations, Maintenance Notes, Reference Architecture, Runtime Contract, Scope, Source And Evidence Model (+2 more)

### Community 145 - "PR Writer Specification"
Cohesion: 0.18
Nodes (10): Evaluation, Intent, Known Limitations, Maintenance Notes, PR Writer Specification, Reference Architecture, Runtime Contract, Scope (+2 more)

### Community 146 - "Transformed Examples"
Cohesion: 0.18
Nodes (10): After, Anti-pattern, Before, Corrected version, Example 1: Happy-path new agent prompt, Example 2: Robust variant for a weak existing prompt, Example 3: Anti-pattern and corrected version, Input brief (+2 more)

### Community 147 - "Prompt Optimizer Specification"
Cohesion: 0.18
Nodes (10): Evaluation, Intent, Known Limitations, Maintenance Notes, Prompt Optimizer Specification, Reference Architecture, Runtime Contract, Scope (+2 more)

### Community 148 - "Skill Writer Evaluation"
Cohesion: 0.18
Nodes (10): Adoption Gate, AXIS Setup, Case Set, Evaluation Principles, Framework Choice, Quick Run, Result Template, Rubric (+2 more)

### Community 149 - "Skill Writer Specification"
Cohesion: 0.18
Nodes (10): Intent, Known Limitations, Maintenance Notes, Reference Architecture, Runtime Contract, Scope, Skill Writer Specification, Source And Evidence Model (+2 more)

### Community 150 - "Django ORM - Context for Investigation"
Cohesion: 0.20
Nodes (9): Custom Managers, Direct Fetch, Django ORM - Context for Investigation, Filtered Fetch, Middleware, Query Patterns to Understand, Questions When Investigating Queries, Related Objects (+1 more)

### Community 151 - "Where Authorization Can Happen"
Cohesion: 0.20
Nodes (9): CBV Mixins, Django Views - Context for Investigation, DRF-Specific Layers, Key Insight, Middleware, URL-Level, View Decorators, View Methods (+1 more)

### Community 152 - "Document & Type a Sentry API Endpoint"
Cohesion: 0.20
Nodes (9): 1. Carefully compare what the code does vs declared types, 2. Reuse the canonical response type, 3. Infer the type. Avoid `cast` and `# type: ignore`, 4. Legacy doc migration is all-or-nothing per path, Document & Type a Sentry API Endpoint, Lessons, Promoting to PUBLIC, Validate (+1 more)

### Community 153 - "PR Writer"
Cohesion: 0.20
Nodes (9): Body Shape, Boundaries, Core Rules, Create or Update, Examples, Inspect the Change, PR Writer, Reviewer Aids (+1 more)

### Community 154 - "Core Patterns"
Cohesion: 0.20
Nodes (9): Core Patterns, External file inventories, High-value prompt moves, Layer the prompt correctly, Layered prompts with multiple owners, Symptom to fix mapping, Tool policy placement, When markers help (+1 more)

### Community 155 - "Prompt Optimizer"
Cohesion: 0.20
Nodes (9): Failure Modes, Load Only What You Need, Prompt Optimizer, Step 1: Capture Contract, Step 2: Inventory External Context, Step 3: Choose Model Strategy, Step 4: Shape Prompt, Step 5: Optimize (+1 more)

### Community 156 - "Skill Evals"
Cohesion: 0.20
Nodes (9): Adoption Gate, Assertions And Judges, AXIS Shape, Case Format, Framework Choice, Minimal Case Set, Placement, Rubric (+1 more)

### Community 157 - "quick_validate.py"
Cohesion: 0.33
Nodes (9): find_local_file_references(), main(), parse_args(), Path, Quick structural validation for Agent Skills. Validates that SKILL.md exists,…, Validate a skill directory. Returns (valid, errors, warnings)., validate_local_file_references(), validate_skill() (+1 more)

### Community 158 - "project-template.md"
Cohesion: 0.20
Nodes (9): Experiments, Participants, Project Description, Project Documentation & Links, Project Goals, Results / Learnings / Success, Technical Uncertainties, Uncertainty #1 (+1 more)

### Community 159 - "SPEC — triage-frontend-issues"
Cohesion: 0.20
Nodes (9): Evaluation Expectations, Intent, Known Limitations, Maintenance Notes, Reference Architecture, Scope, Source / Evidence Model, SPEC — triage-frontend-issues (+1 more)

### Community 160 - "Sources"
Cohesion: 0.22
Nodes (8): Changelog, Coverage matrix, Current source inventory, Decisions, Open gaps, Selected profile, Sources, Stopping rationale

### Community 161 - "Multi-Tenant Isolation - Context for Investigation"
Cohesion: 0.22
Nodes (8): Automatic Scoping, Common Implementation Patterns, Multi-Tenant Isolation - Context for Investigation, Ownership Hierarchy, Questions When Investigating, Tenant from Session, Tenant from URL, The Core Multi-Tenant Question

### Community 162 - "Case Study: Documentation Skill Synthesis"
Cohesion: 0.22
Nodes (8): Case Study: Documentation Skill Synthesis, Concrete artifacts (sample), Coverage matrix used, Input collection approach, Scenario, Source-to-decision trace (sample), Synthesized artifacts produced, What made this high quality

### Community 163 - "Case Study: Workflow/Process Skill Synthesis"
Cohesion: 0.22
Nodes (8): Case Study: Workflow/Process Skill Synthesis, Concrete artifacts (sample), Coverage matrix used, Input collection approach, Scenario, Source-to-decision trace (sample), Synthesized artifacts produced, What made this high quality

### Community 164 - "Reference Architecture"
Cohesion: 0.22
Nodes (8): Final Checks, Lookup Test, Naming Rules, Placement Table, Reference Architecture, Reference Types, Router Rule, Split Rules

### Community 165 - "Typing Exclusion Worker"
Cohesion: 0.22
Nodes (8): Execution Workflow, Inputs Required, Purpose, Python Typing Best Practices, Required Output Template, Scope Rules (Hard Constraints), Stop Conditions (Escalate to Manager), Typing Exclusion Worker

### Community 166 - "Maintaining AGENTS.md"
Cohesion: 0.25
Nodes (7): Anti-Patterns, Default Sections, External Reference Rules, File Setup, Maintaining AGENTS.md, Workflow, Writing Rules

### Community 167 - "Find Bugs"
Cohesion: 0.25
Nodes (7): Find Bugs, Output Format, Phase 1: Complete Input Gathering, Phase 2: Attack Surface Mapping, Phase 3: Security Checklist (check EVERY item for EVERY file), Phase 4: Verification, Phase 5: Pre-Conclusion Audit

### Community 168 - "Model Family Notes"
Cohesion: 0.25
Nodes (7): Anthropic Claude, Cross-family adapter rules, Gemini, GPT-style non-reasoning models, Model Family Notes, OpenAI, Reasoning models

### Community 169 - "Execution Shapes"
Cohesion: 0.25
Nodes (7): Advanced-Shape Hard Stops, Complexity Budget, Defaulting To The Simplest Shape, Execution Shapes, Hybrid Shapes, Secondary Workflow Mechanics, Shape Decision Table

### Community 170 - "Output Contracts"
Cohesion: 0.25
Nodes (7): Choose The Contract, Decision Table, Flexible Template, Input/Output Example, Output Contracts, Strict Template, Structured Schema

### Community 171 - "GitHub Review Requests"
Cohesion: 0.29
Nodes (6): Fallback, GitHub Review Requests, Script output, Step 1: Identify the Team, Step 2: Run the Script, Step 3: Present Results

### Community 172 - "reply_to_thread.py"
Cohesion: 0.38
Nodes (6): main(), _normalize_body(), Normalize escaped newlines from shell input. Bash double quotes keep "\\n"…, Reply to one or more review threads in a single GraphQL call. Returns a per-…, Reply to PR review threads. Usage: uv run reply_to_thread.py THREAD_ID BODY…, reply_to_threads()

### Community 173 - "Claude Frontmatter And Invocation"
Cohesion: 0.29
Nodes (6): Claude Frontmatter And Invocation, Cross-provider parity, Invocation rules, Portability rule, Relevant fields, Use this file for

### Community 174 - "Case Study: Hook-Backed Skill Synthesis"
Cohesion: 0.29
Nodes (6): Case Study: Hook-Backed Skill Synthesis, Coverage matrix used, Input collection approach, Scenario, Synthesized artifacts produced, What made this high quality

### Community 175 - "Case Study: Router Skill Synthesis"
Cohesion: 0.29
Nodes (6): Case Study: Router Skill Synthesis, Coverage matrix used, Input collection approach, Scenario, Synthesized artifacts produced, What made this high quality

### Community 176 - "Case Study: Subagent-Fork Skill Synthesis"
Cohesion: 0.29
Nodes (6): Case Study: Subagent-Fork Skill Synthesis, Coverage matrix used, Input collection approach, Scenario, Synthesized artifacts produced, What made this high quality

### Community 177 - "Iteration Evidence"
Cohesion: 0.29
Nodes (6): Example Record Schema, File Roles, Iteration Evidence, Positive And Negative Findings, Promotion Rules, Storage Layout

### Community 178 - "Mode Selection"
Cohesion: 0.29
Nodes (6): Completion Checks, Execution shape selection, Mode Selection, Path mapping, Required outputs by path, Skill class selection

### Community 179 - "SPEC.md Template"
Cohesion: 0.29
Nodes (6): Design Rules, Relationship To Other Files, SPEC.md Template, Template, Update `SPEC.md` When, Use `SPEC.md` For

### Community 180 - "Sources"
Cohesion: 0.29
Nodes (6): Changelog, Coverage matrix, Current source inventory, Decisions, Open gaps, Sources

### Community 181 - "Sentry Commit Messages"
Cohesion: 0.33
Nodes (5): Before Committing, Creating the Commit, Footers, Message Rules, Sentry Commit Messages

### Community 182 - "Guia de Integração: Stremio Addon com Fenixhub"
Cohesion: 0.29
Nodes (6): 1. Como Funciona a Comunicação entre o Addon e o Fenixhub, 2. Código Pronto para Colar no seu Addon (Node.js / JavaScript), 3. Código Pronto para Colar no seu Addon (Python / FastAPI), 4. Dicas de Ouro para o Addon, Guia de Integração: Stremio Addon com Fenixhub, Por que esse modelo é o melhor?

### Community 183 - "PR Writer Evaluation"
Cohesion: 0.33
Nodes (5): Adoption Gate, Case Set, PR Writer Evaluation, Quick Run, What This Tests

### Community 184 - "Claude Hook-Backed Skills"
Cohesion: 0.33
Nodes (5): Async note, Claude Hook-Backed Skills, Required contract, Security rules, Use this file for

### Community 185 - "Iteration Path"
Cohesion: 0.33
Nodes (5): Example intake, Improvement rules, Iteration Path, Replay and Review, Required output

### Community 186 - "Argument-Driven Skill Layout"
Cohesion: 0.33
Nodes (5): Also load, Argument-Driven Skill Layout, Choose this layout when, Common layout, Required contract

### Community 187 - "Asset-Template Skill Layout"
Cohesion: 0.33
Nodes (5): Asset-Template Skill Layout, Avoid this layout when, Choose this layout when, File layout, Required contract

### Community 188 - "Inline Skill Layout"
Cohesion: 0.33
Nodes (5): Avoid this layout when, Choose this layout when, File layout, Inline Skill Layout, Required contract

### Community 189 - "Reference-Backed Skill Layout"
Cohesion: 0.33
Nodes (5): Avoid this layout when, Choose this layout when, File layout, Reference-Backed Skill Layout, Required contract

### Community 190 - "Script-Backed Skill Layout"
Cohesion: 0.33
Nodes (5): Avoid this layout when, Choose this layout when, File layout, Required contract, Script-Backed Skill Layout

### Community 191 - "Source Adaptation"
Cohesion: 0.33
Nodes (5): Adaptation Checklist, Goal, Precision Check, Rewrite Rules, Source Adaptation

### Community 192 - "Source Discovery"
Cohesion: 0.33
Nodes (5): Commit Log Mining, High-Signal Retrieval Passes, Source Discovery, Source Priority, Stop Conditions

### Community 193 - "Link a GitHub Issue + Linear Ticket on a PR"
Cohesion: 0.40
Nodes (4): Inputs, Link a GitHub Issue + Linear Ticket on a PR, Notes, Steps

### Community 194 - "Claude Subagent-Fork Skills"
Cohesion: 0.40
Nodes (4): Avoid when, Claude Subagent-Fork Skills, Required contract, Use this file for

### Community 195 - "Description Optimization"
Cohesion: 0.40
Nodes (4): Authoring rules, Description Optimization, Required output, Trigger quality loop

### Community 196 - "Registration and Validation"
Cohesion: 0.40
Nodes (4): Registration and Validation, Registration checklist, Required output, Validation checklist

### Community 197 - "Orchestrator-Workers"
Cohesion: 0.40
Nodes (4): Choose this workflow when, Example, Orchestrator-Workers, Required contract

### Community 198 - "Parallel Workflows"
Cohesion: 0.40
Nodes (4): Choose this workflow when, Common forms, Parallel Workflows, Required contract

### Community 199 - "Plan-Validate-Execute"
Cohesion: 0.40
Nodes (4): Choose this workflow when, Example, Plan-Validate-Execute, Required contract

### Community 200 - "Prompt Chaining"
Cohesion: 0.40
Nodes (4): Choose this workflow when, Example, Prompt Chaining, Required contract

### Community 201 - "Routing Workflows"
Cohesion: 0.40
Nodes (4): Choose this workflow when, Example, Required contract, Routing Workflows

### Community 202 - "Validation Loops"
Cohesion: 0.40
Nodes (4): Choose this workflow when, Example, Required contract, Validation Loops

### Community 203 - "SRED.md"
Cohesion: 0.40
Nodes (4): Definition of an SRED Project, Eligible Categories of Work, Key Points to Note, The Two Core Requirements

### Community 204 - "Create Branch"
Cohesion: 0.50
Nodes (3): Create Branch, References, Workflow

### Community 205 - "fetch_review_requests.py"
Cohesion: 0.67
Nodes (3): gh(), main(), Fetch unread GitHub review-requested notifications for open (unmerged) PRs,…

### Community 206 - "Claude Argument Substitutions"
Cohesion: 0.50
Nodes (3): Claude Argument Substitutions, Required contract, Supported substitutions

### Community 207 - "Claude Dynamic Context Injection"
Cohesion: 0.50
Nodes (3): Claude Dynamic Context Injection, Use sparingly, Use this file for

### Community 211 - "bolder.md"
Cohesion: 0.33
Nodes (5): Before you finish, Scope is sovereign, The amplification, The skeleton test, Why it reads flat

## Knowledge Gaps
- **1737 isolated node(s):** `fenixhub`, `ColaboradorRank`, `RankingItem`, `cachePayload`, `name` (+1732 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1942 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Init flow` connect `Init flow` to `new-work.md`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `fenixhub`, `ColaboradorRank`, `RankingItem` to the rest of the system?**
  _1737 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08163265306122448 - nodes in this community are weakly interconnected._
- **Should `DB` be split into smaller, more focused modules?**
  _Cohesion score 0.13846153846153847 - nodes in this community are weakly interconnected._
- **Should `resumeSession` be split into smaller, more focused modules?**
  _Cohesion score 0.07686116700201208 - nodes in this community are weakly interconnected._
- **Should `Tracker` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `Real-World GitHub Actions Attacks` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._