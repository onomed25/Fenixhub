# Graph Report - Fenixhub  (2026-09-09)

## Corpus Check
- 15 files · ~73,076 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 296 nodes · 424 edges · 20 communities (15 shown, 4 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.85)
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
- showCustomLoginModal
- startServer
- sanitizeNuviometaParams
- loadCachedHtmlFile
- rules/graphify.md
- workflows/graphify.md

## God Nodes (most connected - your core abstractions)
1. `showToast()` - 9 edges
2. `updateAdminUI()` - 9 edges
3. `ProcessTracker` - 8 edges
4. `uploadFileAndGetLink()` - 8 edges
5. `uploadFileAndGetLink()` - 8 edges
6. `escapeHTML()` - 7 edges
7. `showCustomLoginModal()` - 7 edges
8. `updateDiscordUI()` - 7 edges
9. `getHfDbConfig()` - 7 edges
10. `closeModal()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `isAdmin()` --calls--> `checkPassword()`  [EXTRACTED]
  index.js → src/security.js
- `getAuthUser()` --calls--> `extractToken()`  [EXTRACTED]
  index.js → src/security.js
- `getAuthUser()` --calls--> `verifyToken()`  [EXTRACTED]
  index.js → src/security.js
- `getNuviometaInfo()` --calls--> `sanitizeNuviometaParams()`  [EXTRACTED]
  index.js → src/security.js

## Import Cycles
- None detected.

## Communities (20 total, 4 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.09
Nodes (39): actionPendingFile(), approveFile(), cat, changeColabPeriod(), checkAdminSession(), checkMyPendings(), clearDiscordSession(), closeReportModal() (+31 more)

### Community 1 - "telegram-service.js"
Cohesion: 0.07
Nodes (26): telegram, apiId, { CustomFile }, downloadAndUploadUrl(), downloadFile(), fs, getMessageFromForward(), getSharedBot() (+18 more)

### Community 2 - "index.js"
Cohesion: 0.05
Nodes (29): apiLimiter, app, authLimiter, cachedDiscordRoles, cachedFrontHtml, cachedHtml, catalogCache, compression (+21 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (31): allowScripts, sqlite3@6.0.1, description, devDependencies, jest, nodemon, supertest, jest (+23 more)

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
Cohesion: 0.15
Nodes (12): bcrypt, jsonwebtoken, bcrypt, checkPassword(), checkPasswordAsync(), crypto, generateToken(), getDatabaseSslConfig() (+4 more)

### Community 8 - "hfDatabase.js"
Cohesion: 0.29
Nodes (13): clearHfCache(), deleteFileFromHf(), fetchCatalogFromHf(), fetchPendingFromHf(), getContentFromHf(), getCountFromHf(), getHfDbConfig(), getItemTimestampHf() (+5 more)

### Community 9 - "ProcessTracker"
Cohesion: 0.24
Nodes (3): handleSignal(), ProcessTracker, stopServer()

### Community 10 - "isAdmin"
Cohesion: 0.22
Nodes (9): getAdminPassword(), getAuthUser(), isAdmin(), isAjudante(), isPrivileged(), requireAdmin(), requireAdminOrAjudante(), extractToken() (+1 more)

### Community 11 - "exportar_jsons.js"
Cohesion: 0.28
Nodes (8): pg, fs, main(), OUTPUT_DIR, path, tryExtractFromDatabase(), tryExtractFromFile(), zlib

### Community 12 - "media-merger.js"
Cohesion: 0.39
Nodes (7): FORBIDDEN_KEYS, getStreamKey(), injectDateIntoStreams(), isPlaceholder(), mergeMediaContents(), mergeStreamArrays(), sanitizeSeriesStreams()

### Community 13 - "showCustomLoginModal"
Cohesion: 0.67
Nodes (6): showCustomLoginModal(), closeModal(), handleCancel(), handleKeyDown(), handleSubmit(), handleToggleVisibility()

### Community 14 - "startServer"
Cohesion: 0.50
Nodes (4): executarLimpezaMaisVistosNode(), initDB(), startServer(), verificarELimparMaisVistos()

## Knowledge Gaps
- **118 isolated node(s):** `dns`, `express`, `cors`, `path`, `multer` (+113 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 153 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `telegram` connect `telegram-service.js` to `package.json`, `telegram-service-refactored.js`?**
  _High betweenness centrality (0.282) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `pg` connect `exportar_jsons.js` to `index.js`, `package.json`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **What connects `dns`, `express`, `cors` to the rest of the system?**
  _118 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09407665505226481 - nodes in this community are weakly interconnected._
- **Should `telegram-service.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06606606606606606 - nodes in this community are weakly interconnected._
- **Should `index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._