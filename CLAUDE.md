# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Helpdesk Jarvis is a web-based helpdesk management system with a React frontend and Express.js backend that integrates PowerShell scripts for Windows system administration. The application provides IT support teams with tools for user management, system monitoring, and Active Directory integration.

## Development Commands

### Running the Application
- `npm start` - Start both frontend and backend servers concurrently
- `npm run start:backend` - Start only backend server (port 3001)
- `npm run start:frontend` - Start only frontend server (port 3000)
- `npm run dev` - Development mode with auto-restart for both servers
- `npm run dev:backend` - Backend development mode with nodemon
- `npm run dev:frontend` - Frontend development server

### Building

#### Development Building
- `cd frontend && npm run build` - Build frontend for production
- Backend runs directly with `node server.js`

#### Standalone Executable Building
- `npm run release` - Build versioned standalone executable (recommended)
- `npm run dist:win:versioned` - Same as release, builds with version number
- `npm run dist:win` - Build without version (always outputs helpdesk-jarvis.exe)
- **Output**:
  - Versioned EXE: `releases/helpdesk-jarvis-v{version}.exe` (e.g., `helpdesk-jarvis-v1.1.0.exe`)
  - Latest copy: `releases/helpdesk-jarvis.exe` (always points to latest build)
- **Versioning**: Version number is read from `package.json` and automatically included in filename
- **Important**: Uses **node22-win-x64** target via **@yao-pkg/pkg** (the maintained fork of the archived vercel/pkg, which capped at node18). Node 22 matches the host dev runtime, so the host-compiled native binaries (ABI 127) load without cross-ABI juggling.
- **Note**: The executable is fully self-contained and can be run on machines without Node.js installed
- **Automated Post-Build**: The build process automatically:
  - Fixes CSP headers in index.html for Google Fonts support
  - Updates server.js with the correct React bundle filename from asset-manifest.json
  - Creates both versioned and latest copies of the executable
  - No manual intervention needed for CI/CD pipelines

### Setup
- `install-manual.cmd` - Automated Windows installation script
- Navigate to `http://localhost:3000/setup` for initial configuration

## Architecture

### Backend (Express.js + PowerShell Integration)
- **Entry Point**: `Backend/server.js`
- **Routes**: RESTful API in `Backend/routes/`
- **PowerShell Scripts**: Located in `Backend/functions/`
- **Authentication**: JWT + Express sessions with LDAP/AD integration
- **Database**: SQLite3 stored locally
- **Real-time**: Socket.IO for live updates

### Frontend (React SPA)
- **Built with**: Create React App
- **Components**: Reusable UI components in `src/components/`
- **Pages**: Route-level components in `src/pages/`
- **Routing**: React Router DOM v6
- **Real-time**: Socket.IO client for backend communication

### Key Configuration
- **setupConfig.js**: Main configuration file (server, database, AD settings)
- **Backend/.env**: Backend environment variables
- **frontend/.env**: Frontend environment variables

## Important Patterns

### PowerShell Script Execution
- Scripts are executed via child processes from `Backend/powershell.js`
- All PowerShell scripts are in `Backend/functions/` directory
- Scripts handle Windows administration tasks (user unlocking, system status, etc.)

### Authentication Flow
- JWT-based authentication with configurable expiration
- Active Directory integration via LDAP
- Role-based permissions ("ITSD Help Desk" group access)
- Protected routes on both frontend and backend

### Real-time Features
- Socket.IO handles bidirectional communication
- Live updates for locked user monitoring
- Real-time dashboard status updates
- Configurable refresh intervals for monitoring

### Security Considerations
- Input sanitization middleware on all routes
- CORS configured for specific origins
- PowerShell execution with parameter validation
- Session management with custom store

## Development Notes

- Backend serves on `http://172.25.129.95:3001`
- Frontend proxy configuration handles API calls
- Database migrations handled through `Backend/db/` setup scripts
- Client tools (PsInfo, PsLoggedon) available in `Tools/` directory
- Docker support available via `docker-compose.yml`

## Testing

The project uses GitHub Actions for PowerShell Script Analyzer on `.ps1` files. No specific test commands are configured - check individual package.json files for available test scripts.

## Refactor In Progress (started 2026-07-15)

A coherence/hardening refactor is underway. State for the next session:

### Threat model (confirmed with maintainer)
- The helpdesk tech's **Active Directory account** is the real authorization boundary for what PowerShell can actually do; the **single-machine service-desk environment** keeps scope contained.
- The exe is **portable / domain-agnostic** — built once, then dropped into another domain. Security work must survive that move (no shared/hardcoded secrets, no dev-only endpoints live by default).
- **Remote agents on the LAN do connect**, so the server intentionally binds `0.0.0.0`. The remote channel is `/api/remote/*`, protected by `x-api-key` (verifyApiKey). The regular data routes are for the local React frontend.

### Done
- **Shared frontend API client**: `frontend/src/utils/api.js` (apiGet/apiPost/apiPut/apiPatch/apiDelete, apiRequestRaw for header/cache access, executeScript, logAction, auth helpers). Auto-attaches backend URL, JSON headers, and Bearer token. Replaces the old `apiUtils.js` (deleted). `actionLogger.js` now delegates to it.
- **Frontend fetch migration COMPLETE** for all live-path files: MainApp, Login, Profile, ModernDashboard, ModernConfigure, ModernADProperties, and components ScriptButton, DomainControllers, ServerStatus, TickerTape, CurrentComputers, LockedOutUsers, Logs, SplashScreen, UpdateNotification, ServerManager, Terminal, UserStatusTable, ComputerStatusTable, SetupWizard, and both charts. All verified to parse via babel-preset-react-app. Intentionally NOT migrated (raw fetch remains, by design): legacy `pages/ADProperties.js` (on hold for deletion), unrouted duplicate `pages/Configure.js`, and `pages/Setup.js` (posts to a form-driven dynamic base URL, so the fixed-base client doesn't apply). Note: `UserStatusTable` still accepts an unused `endpoint` prop (harmless lint warning).
- **Backend hardening trio (domain-agnostic)**:
  - `Backend/powershell.js`: all three exec functions converted from `exec` (string, cmd.exe) to `execFile` (arg arrays) — closes parameter injection. The three functions are **intentionally separate** by execution context (local action / server monitoring / remote fallback) — do not merge them. Added `timeout` (2m) + `maxBuffer` (10MB) via `buildExecOptions()`.
  - `/api/test-data` (can DELETE live tables) now only registers when `ENABLE_TEST_DATA=true` — off by default in the portable exe.
  - Secrets: `server.js` bootstraps ephemeral `crypto.randomBytes` JWT/SESSION secrets when `.env` lacks them (lets first-run/copied exe boot to the setup wizard without a shared hardcoded secret). Removed hardcoded `|| 'your-secret-key'` / `'-secret-key'` / `'your-session-secret'` fallbacks in `verifyToken.js`, `auth.js`, `remoteApi.js`, `configure.js`, `server.js`. Wizard `generateRandomString` now uses `crypto.randomBytes` instead of `Math.random`.
  - Untracked `Backend/db/admin_backup_*.json` from git and added a gitignore rule.

### Client-side caching (DONE)
`frontend/src/utils/api.js` has an opt-in in-memory response cache — pass `{ cache: <ttlMs> }` to `apiGet`/`apiPost`. It's a module-level `Map`, so a **browser tab refresh clears it** (fresh data on demand) while in-app tab switches reuse it. It stores the in-flight promise, so concurrent identical requests (StrictMode double-mount, two tabs opening the same object) collapse to one network call; failures are never cached. Mutations call `invalidateCache('<pathSubstring>')` (also exported) to drop stale entries.
- Cached reads: `fetch-adobject` (60s), `fetch-user` (30s), `get-logs` (60s), `domain-controllers/pdc` (300s), `fetch-user/security-question` (60s). These are what caused the reload flash when switching between multiple AD object inner tabs.
- **Left live (uncached) on purpose**: all `execute-command` status polls (Test-Connection, Get-ADUser lockout, PsLoggedon) in ComputerStatusTable/UserStatusTable, and the dashboard ledger reads — these must stay real-time.
- Invalidation wired on: password reset + unlock (`fetch-user`), security-question save/clear (`fetch-user/security-question`), dashboard unlock (`fetch-user`).

### User feedback fields on AD user status (DONE)
Two features on the AD-object User status component (`frontend/src/components/UserStatusTable.js`), rendered below the Security Questions box in this order: **Feedback (thumbs)** then **Comment**.
- **DB**: added `Comment TEXT`, `ThumbsUp INT DEFAULT 0`, `ThumbsDown INT DEFAULT 0`, `LastVoteDate TEXT` to the `Users` table — in `db/init.js` (fresh DBs) and migration `2025-07-15-add-user-feedback` in `db/migrations.js` (existing DBs). `fetchUser` is `SELECT *` so these flow through automatically; `storeUser` only touches its 6 fixed columns so unlock/reset never clobber them.
- **Backend routes** (`routes/fetchUser.js`, both `verifyToken`-protected): `PUT /api/fetch-user/comment` {userID, comment}; `POST /api/fetch-user/vote` {userID, vote:'up'|'down'}. Vote enforces **one per calendar day** server-side (compares `LastVoteDate` to server local date) — returns 409 + current row if already voted today. Both `ensureUser()` first. Query helpers `updateUserComment`, `incrementUserVote` in `db/queries.js`.
- **Frontend**: thumbs 👍/👎 show running counts and disable when `LastVoteDate === today` ("Voted today"); comment is a textarea with Save. Both use the shared client and `invalidateCache('/api/fetch-user')` after writing. Verified end-to-end via curl (200 / 409 / 401).

### Remote process viewer / killer (DONE)
ComputerStatusTable has a "Processes" section below the control buttons (only when Online), on-demand (no polling):
- **Scripts** (`Backend/functions/`, run via `execute-script`): `GetUserProcesses.ps1 -ComputerName` uses `Invoke-Command` + `Get-Process -IncludeUserName`, filters out system accounts (`NT AUTHORITY\*`, Window Manager, Font Driver Host), returns `{Success, Processes:[{Name,ProcessId,UserName,MemoryMB}], ...}`. `StopUserProcesses.ps1 -ComputerName -ProcessName` runs `Stop-Process -Name <x> -Force` (kills ALL instances by name, matching the operator's manual habit). Both follow the profile-scripts JSON convention.
- **UI**: "Get Processes" button → list **grouped by name** (count + total memory, sorted noisiest-first) with a filter box; each row has "Kill all" (confirm dialog). Kills are logged to RecentActions (`action_type: kill_process`) and the list refetches after.
- **Caveat / not yet runtime-verified**: `Get-Process -IncludeUserName` needs admin on the remote box (service account has it); syntax validated both sides but needs a real remote target to confirm end-to-end. Note ComputerStatusTable uses `alert()` for feedback (consistent with its existing handlers, unlike the dashboard which uses the Notification toast).
- **Agreed next step**: the keep-inner-tabs-mounted refactor (render all tabs hidden via CSS + `isActive` prop gating polls) — user asked to do this after the process feature.

### RD Session Shadowing (DONE) — CmRcViewer/msra alternative
A "🕶️ Shadow" button on the AD **computer** object (ModernADProperties, between the CmRcViewer and MSRA program-launch buttons). Uses native Windows RD Shadowing (`mstsc /shadow`) — nothing installed on either side, works domain-agnostically wherever the service-desk account is admin + the "Remote Desktop - Shadow" firewall rule is open. Handles elevation (unlike msra) and shadows the user's live session (like CmRcViewer).
- **Not via the `jarvis://` deep link** — shadow needs two params (session id + computer), so it goes through `execute-script` instead. The backend runs on the tech's machine as the tech, so mstsc opens on their desktop with their creds.
- **Scripts** (`Backend/functions/`): `GetComputerSessions.ps1 -ComputerName` runs `quser /server:` and returns parsed `{Sessions:[{Username,SessionName,SessionId,State,Info}]}` (the quser call also doubles as an RPC reachability pre-check). `StartShadowSession.ps1 -ComputerName -SessionId` does `Start-Process mstsc /shadow:<id> /v:<pc> /control`.
- **UI flow**: click Shadow → fetch sessions → react-modal dropdown (defaults to the Active session; needed because the ID isn't always 1 and there can be multiple users) → Start Shadow. Logged to RecentActions (`shadow_session`).
- **Verified**: `GetComputerSessions.ps1` tested against the local machine (parses correctly); JS + both scripts parse. Not yet run end-to-end against a remote target from the browser, and `StartShadowSession` not launch-tested here (would open mstsc) — but `mstsc /shadow` itself was confirmed working manually by the maintainer (`/control` needed; `/noConsentPrompt` needs a GPO the domain may not set — default consent flow works).
- **Portability caveat / possible future**: if a domain lacks the shadow firewall rule/admin rights, the launch fails; plan is a toast-on-failure (the session fetch failing is the natural pre-check) rather than a full GPO checker. The `Shadow` policy value (`HKLM\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services\Shadow`) can be read remotely if a proactive indicator is wanted later.
- **Local vs remote mode**: shadow works in BOTH. `execute-script`/`execute-command` always run on the LOCAL backend — `powershell.js:shouldUseRemoteData()` only routes MONITORING_SCRIPTS (LockedOutList, getDomainInfo, Get-ServerStatus, Get-Logs) to the remote server in remote mode. Action scripts (shadow, processes, unlock, etc.) are never in that list, so they execute locally and mstsc opens on the tech's own desktop regardless of deployment mode. No code change was needed for remote-mode shadow.

### AD object search disambiguation (DONE)
Searching an object that wildcard-matched several (e.g. "o0614" also matched "o0614-t") silently picked one. Now `Get-ADObject.ps1` returns a candidate list `{ __multipleMatches:true, Matches:[{Name,SamAccountName,ObjectClass,DisplayName,DistinguishedName}], Query }` whenever the search matches >1 object; `ModernADProperties.addTab` detects this and opens a react-modal picker. Picking re-queries that object **exactly** (`fetch-adobject` with `exact:true` → `Get-ADObject.ps1 -exact` uses `SamAccountName -eq` no wildcard) so it resolves to a single object. Route `fetchADObject.js` passes `exact` as a second positional arg. Note the ambiguous response is distinguished by the `__multipleMatches` key (real AD objects won't have it). **JSON depth gotcha (fixed):** the full-property object MUST serialize at ConvertTo-Json's default depth (2) — a deeper depth explodes complex AD attributes (nTSecurityDescriptor/ACLs) into MBs and overruns the child-process stdout maxBuffer (`ERR_CHILD_PROCESS_STDIO_MAXBUFFER`). The tiny candidate list uses depth 4 (simple strings only). Tested against a live domain object: full-property output ≈75 KB.

### Exe build modernized to Node 22 (DONE)
Swapped the archived `vercel/pkg@5.8.1` (capped at node18) for the maintained `@yao-pkg/pkg` and retargeted `node18-win-x64` → `node22-win-x64` in `package.json` (pkg block + `dist:win`) and `scripts/version-build.js`. Root cause of the old node18 pin: pkg's newest embeddable runtime was Node 18, and better-sqlite3 (ABI-specific) had to match — the docs' "bcrypt requirement" was the symptom. Found a latent bug: the binary in the `node-v108` slot was actually an ABI-127 (Node 22) build, so an old-config build would have produced a **crashing exe**. Replaced the shell `copy-native-binaries` (broke under cmd.exe because `mkdir -p` couldn't create the new `node-v127` folder; the old build only worked because `node-v108` pre-existed) with cross-platform `scripts/copy-native-binaries.js`. **Verified end-to-end**: built the exe (~85 MB, up from 61 MB due to the larger Node 22 base), ran it — boots on Node 22.23.1, `Connected to the SQLite database` (ABI-127 better-sqlite3 loads clean, no NODE_MODULE_VERSION crash), all tables created, ephemeral-secrets bootstrap fires. bcrypt (NAPI, ABI-stable) not exercised in the smoke test (only loads on login) but low-risk. README/TODO still say "61MB / Node 18" — cosmetic, not yet updated.

### Polling optimization (DONE)
ComputerStatusTable (5s Test-Connection + PsLoggedon) and UserStatusTable (opt-in) now **pause polling when the page is hidden** (Page Visibility API) and resume with an immediate refresh on return. Note the AD page renders only the **active** inner tab (`key={currentTab.name}`, single instance) — non-active tabs are fully unmounted and never polled. Possible future step (not done, higher risk): keep all inner tabs mounted (hide with display:none) for instant switching, gated by an `isActive` prop so only the focused tab polls.

### Pending / next steps
- **Auth added to core data routes (DONE)**: `verifyToken` now protects `/api/ledger`, `/api/servers`, `/api/domain-controllers`, `/api/get-logs`, `/api/actions`, `/api/update-locked-out-users`, `/api/get-locked-out-users` in `server.js`. Verified: 401 without token, 200 with a valid token, unprotected routes unaffected. Also refactored the daily actions cleanup to delete from the DB directly instead of an unauthenticated HTTP self-call to `/api/actions/cleanup-daily`, so the whole `/api/actions` router (including the audit-log-wiping DELETE routes) is now behind `verifyToken`. Remote routes (`/api/remote/*`) use `verifyApiKey` — left as-is.
- **Config routes protected (DONE)**: `verifyToken` now on `/api/users`, `/api/roles`, `/api/permissions`, `/api/logging-settings`, `/api/server-manager`, `/api/multi-fetch`. Verified 401 without token / 200 with.
- **`/api/execute-command` permission gate (DONE)**: now registered as `verifyToken, verifyPermissions('execute_command'), executeCommandRoute` in `server.js`. Verified: 401 without token, 200 with token (PowerShell executes). Note `verifyPermissions` grants all perms to any authenticated user in `local`/`remote` mode (only DB mode checks the permission table) — so in the current local deployment this gate == requires a valid login. `executeCommand.js` still has an inner `verifyToken` (now redundant but harmless).
- **Dashboard usability (DONE)** in `ModernDashboard.js`: dead-nav removed — metric cards now `scrollToSection` to the relevant on-page table (`dash-locked-users`, `dash-server-health`, `dash-domain-controllers`) instead of navigating to non-existent routes; the six dashboard fetches now run concurrently via `Promise.all` (each with `.catch(()=>null)` so one failure doesn't blank the rest); `alert()` replaced with a non-blocking `Notification` toast (auto-dismiss 4s); added a last-updated timestamp + manual Refresh button; locked-user UserID cells link to `/ad-object/:id`; pie-chart department click now filters the locked-users table (with a clearable chip) instead of the dead `/active-issues` route; removed the dead Recent Activity "View All".
- **Legacy page removal is ON HOLD** — maintainer still uses the components. `/dashboard-legacy` and `/ad-object-legacy` routes + Navbar links were removed and the Profile legacy toggle was dropped, but `pages/Dashboard.js`, `pages/ADProperties.js`, `pages/Configure.js` and all components remain. Do not delete without asking.
- Other noted-but-not-done items: `jarvis://` protocol handler passes `%adObjectID%` unquoted into psexec/powershell and persists machine-wide (validate + document); catch-all `app.get('*')` makes `forbidden`/`notFound` middleware dead code; `executeScript.js` references a non-existent `PasswordResetter` script.

## Build Troubleshooting

### Standalone Executable Issues
- **Path Resolution**: The application uses `process.pkg` detection to handle path resolution differently in packaged vs development mode
- **Database Location**: In standalone mode, database is created in `database/` folder relative to the executable
- **Environment Files**: `.env` files are looked for in the current working directory when running as standalone
- **Native Modules**: better-sqlite3 is ABI-specific and must match the pkg target's Node ABI — node22 = ABI 127, so its binary lives in `lib/binding/node-v127-win32-x64/`. bcrypt is NAPI (`napi-v3`), ABI-stable across Node versions, plus the `bcryptPkg.js` wrapper. `scripts/copy-native-binaries.js` (cross-platform Node, replacing the old shell `mkdir -p`/`cp` that broke under cmd.exe when the target folder didn't pre-exist) copies better-sqlite3's `build/Release` binary into the node-v127 folder before packaging. If you bump the pkg target Node version, update `ABI_FOLDER` in that script (Node18=108, 20=115, 22=127) and the pkg asset path.
- **PowerShell Scripts**: Scripts are bundled in the executable but must be extracted to `functions/` folder for PowerShell to access them
- **Tools Downloads**: External tools are downloaded from GitHub repository to `Tools/` folder on first run