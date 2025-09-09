# Helpdesk Jarvis Production Conversion TODO

This document outlines the comprehensive conversion of Helpdesk Jarvis from a development prototype to a production-ready, distributable application that can run in either local or remote database modes.

## Project Conversion Overview

**Goal**: Transform the current helpdesk application into a distributable desktop application that helpdesk agents can install without Node.js/Python dependencies, with options for local operation or remote database connectivity.

**Key Requirements**:
- Self-contained desktop application (likely Electron)
- Initial setup wizard for configuration
- Local vs Remote database mode selection
- Local .env authentication (hashed passwords)
- Preserve user management PowerShell scripts in both modes
- Remote fetching for monitoring utilities only
- Auto-update capability for distribution

## Phase 1: Architecture Foundation & Setup System

### 1.1 Create Splash Screen/Setup Wizard for Initial Configuration
**Status**: ✅ Completed
**Files Affected**: 
- `frontend/src/components/SetupWizard.js` (new)
- `frontend/src/pages/InitialSetup.js` (new)
- `frontend/src/App.js` (routing updates)
- `setupConfig.js` (configuration detection)

**Details**: 
- Create multi-step setup wizard that appears on first launch
- Steps should include: Welcome, Database Mode Selection, Configuration, Testing, Complete
- Wizard should detect if configuration already exists and skip to main app
- Must persist setup completion state to prevent re-showing wizard
- Include branding and helpful explanations for helpdesk agents

**Technical Requirements**:
- React component with step navigation
- Form validation for each step
- Configuration persistence
- Loading states and error handling
- Skip capability for reconfiguration

### 1.2 Design Setup Flow for Local vs Remote Database Selection
**Status**: ✅ Completed
**Files Affected**:
- `frontend/src/components/SetupWizard.js`
- `setupConfig.js` (mode detection and storage)
- `Backend/server.js` (startup configuration reading)
- `Backend/config/modes.js` (new - mode definitions)

**Details**:
Local Mode Flow:
- Database initialization prompts
- Local authentication setup
- PowerShell script permissions verification
- Network interface selection for server binding
- Test database connection and PowerShell execution

Remote Mode Flow:
- Remote server URL input with validation
- API key entry and verification
- Connection testing with remote database
- Local authentication setup (for local user management scripts)
- Feature availability explanation (what works remotely vs locally)

**Technical Requirements**:
- Mode selection persistence in setupConfig.js
- Validation functions for both modes
- Connection testing utilities
- Clear user feedback during setup process
- Fallback handling if remote connection fails

### 1.3 Implement Configuration Management System for Deployment Modes
**Status**: ✅ Completed
**Files Affected**:
- `setupConfig.js` (major refactor)
- `Backend/config/modes.js` (new)
- `Backend/middleware/configMiddleware.js` (new)
- `Backend/server.js` (configuration loading)

**Details**:
- Create configuration schema that supports both modes
- Add mode detection and validation
- Implement configuration migration for existing installations
- Add configuration backup and restore functionality
- Create configuration validation utilities

**Configuration Schema**:
```javascript
{
  mode: 'local' | 'remote',
  database: {
    type: 'local' | 'remote',
    localPath: string,
    remoteUrl: string,
    apiKey: string
  },
  authentication: {
    type: 'local_env',
    hashMethod: 'bcrypt'
  },
  features: {
    localPowerShell: boolean,
    remoteMonitoring: boolean,
    userManagement: boolean
  }
}
```

## Phase 2: Authentication System Overhaul

### 2.1 Implement Local .env Password System to Replace Database Authentication
**Status**: ✅ Completed
**Files Affected**:
- `Backend/.env` (authentication data)
- `Backend/middleware/auth.js` (complete refactor)
- `Backend/routes/auth.js` (login/logout logic)
- `Backend/utils/authUtils.js` (new - hashing utilities)
- `frontend/src/components/Login.js` (simplified login form)
- `frontend/src/utils/auth.js` (frontend auth utilities)

**Details**:
- Remove all database-stored authentication
- Create .env-based user storage with bcrypt hashing
- Implement secure .env file generation during setup
- Add password change functionality that updates .env
- Maintain JWT token system for session management
- Add .env file validation and error handling

**Technical Requirements**:
- Secure .env file creation with proper permissions
- bcrypt hashing for password storage
- .env file backup before modifications
- Validation of .env file integrity
- Migration path from current database auth

**.env Authentication Format**:
```
# Local Authentication
AUTH_USERNAME=helpdesk_agent
AUTH_PASSWORD_HASH=$2b$10$...
JWT_SECRET=generated_secret_key
SESSION_SECRET=generated_session_key
```

### 2.2 Create Authentication Middleware for Both Modes
**Status**: ✅ Completed
**Files Affected**:
- `Backend/middleware/auth.js`
- `Backend/middleware/configMiddleware.js`
- `Backend/routes/auth.js`

**Details**:
- Modify authentication middleware to read from .env instead of database
- Add mode-aware authentication (local always uses .env, remote uses .env for local actions)
- Implement session management that works with both modes
- Add authentication testing utilities

## Phase 3: PowerShell Script Flow Modification

### 3.1 Categorize and Modify PowerShell Script Execution System
**Status**: ✅ Completed
**Files Affected**:
- `Backend/powershell.js` (major refactor)
- `Backend/utils/domainmanager.js` (flow modification)
- `Backend/utils/lockoutusersutils.js` (flow modification)
- `Backend/utils/logger.js` (flow modification)  
- `Backend/utils/servermanagerutils.js` (flow modification)
- `Backend/config/scriptCategories.js` (new)

**Details**:
Script Categories:
- **Action Scripts** (Always Local): User unlocking, password resets, user management, log collection
- **Monitoring Scripts** (Local/Remote): Server status, domain controller status, locked user lists

**Action Scripts** (Always run locally regardless of mode):
- User account unlocking
- Password resets
- User information retrieval
- Log file collection
- System management commands

**Monitoring Scripts** (Remote mode fetches from API, Local mode runs PowerShell):
- Server availability monitoring
- Domain controller status
- Locked out users list
- System health checks

**Technical Requirements**:
- Script categorization system
- Mode-aware execution logic
- Fallback handling when remote data unavailable
- Error handling for both execution types

### 3.2 Modify Utility Flow for Remote Database Mode
**Status**: ✅ Completed

#### 3.2.1 Domain Manager Utility Modification
**Files Affected**: `Backend/utils/domainmanager.js`
**Details**:
- **Local Mode**: Continue using PowerShell scripts for domain status
- **Remote Mode**: Fetch domain controller status from remote API
- **Both Modes**: User management actions still use local PowerShell
- Add API endpoints for remote domain data fetching
- Implement caching for remote domain data
- Add fallback to local PowerShell if remote unavailable

#### 3.2.2 Lockout Users Utility Modification  
**Files Affected**: `Backend/utils/lockoutusersutils.js`
**Details**:
- **Local Mode**: Continue PowerShell-based locked user detection
- **Remote Mode**: Fetch locked user lists from remote database
- **Both Modes**: User unlocking actions still use local PowerShell
- Implement real-time updates for locked user status
- Add API endpoints for remote locked user data
- Cache management for locked user data

#### 3.2.3 Logger Utility Modification
**Files Affected**: `Backend/utils/logger.js`
**Details**:
- **Local Mode**: Log to local files and database
- **Remote Mode**: Log locally but also send relevant data to remote database
- Implement log level filtering for remote transmission
- Add log aggregation for remote database mode
- Maintain local logging for troubleshooting

#### 3.2.4 Server Manager Utility Modification
**Files Affected**: `Backend/utils/servermanagerutils.js`  
**Details**:
- **Local Mode**: PowerShell-based server monitoring
- **Remote Mode**: Fetch server status from remote database
- **Both Modes**: Server management actions still use local PowerShell
- Add API endpoints for remote server data
- Implement server status caching and refresh logic
- Add fallback mechanisms for remote data unavailability

## Phase 4: Remote Database System Implementation

### 4.1 Create Remote Database API Connection System with API Key Authentication
**Status**: ✅ Completed
**Files Affected**:
- `Backend/api/remoteClient.js` (new)
- `Backend/middleware/apiKeyAuth.js` (new)
- `Backend/routes/remoteData.js` (new)
- `Backend/config/apiConfig.js` (new)

**Details**:
- Implement HTTP client for remote API communication
- Add API key management and rotation
- Create retry logic and error handling for remote connections
- Implement data validation for remote responses
- Add connection health monitoring

**API Endpoints Needed**:
- GET /api/servers - Server status data
- GET /api/domain-controllers - Domain controller status  
- GET /api/locked-users - Locked out users list
- POST /api/logs - Send local logs to remote
- GET /api/health - Connection health check

### 4.2 Create Remote Database Server Setup and API Endpoints
**Status**: Pending
**Files Affected**:
- `Backend/remoteServer/` (new directory structure)
- `Backend/remoteServer/server.js` (new)
- `Backend/remoteServer/routes/` (new)
- `Backend/remoteServer/middleware/` (new)
- `Backend/remoteServer/database/` (new)

**Details**:
- Create separate server application for centralized database
- Implement API key authentication and management
- Add database schemas for shared monitoring data
- Create data aggregation and management endpoints
- Implement rate limiting and security measures

### 4.3 Implement API Key Management System for Remote Connections
**Status**: Pending
**Files Affected**:
- `Backend/utils/apiKeyManager.js` (new)
- `frontend/src/components/ApiKeyManager.js` (new)
- `Backend/routes/apiKeys.js` (new)

**Details**:
- API key generation and validation
- Key rotation functionality
- Usage tracking and rate limiting
- Secure key storage and transmission
- Admin interface for key management

## Phase 5: Database Schema Updates

### 5.1 Update Database Schema to Remove Admin Password Storage and Add LastAdminHelped Tracking
**Status**: ✅ Completed
**Files Affected**:
- `Backend/db/init.js` (schema modification)
- `Backend/db/migrations/` (new migration files)
- `Backend/utils/databaseUtils.js` (migration utilities)

**Details**:
**Current Schema Issues:**
```javascript
// REMOVE - No longer needed
{
    name: 'Admin',
    columns: [
        'AdminID TEXT PRIMARY KEY',
        'temppassword TEXT',    // REMOVE - auth now in .env
        'AdminComputer TEXT',
        'password TEXT'         // REMOVE - auth now in .env
    ]
}
```

**New Schema Design:**
```javascript
{
    name: 'Admin', // IT Staff - Simplified
    columns: [
        'AdminID TEXT PRIMARY KEY',
        'AdminComputer TEXT',
        'LastActive DATETIME',
        'InstallationID TEXT'   // Unique per installation
    ]
},
{
    name: 'Users', // Active Directory Users - Enhanced tracking
    columns: [
        'UserID TEXT PRIMARY KEY',
        'LastHelped DATETIME',
        'LastAdminHelped TEXT', // NEW - Track which admin helped
        'TimesUnlocked INT',
        'PasswordResets INT', 
        'TimesHelped INT',
        'LastAction TEXT',      // NEW - Track last action performed
        'Notes TEXT'            // NEW - Optional notes from admin
    ]
}
```

**Migration Requirements:**
- Create migration script to update existing databases
- Preserve existing Users table data
- Remove password-related Admin columns safely
- Add new tracking columns with default values
- Update all database queries to use new schema

**API Integration Changes:**
- Update user unlock/reset APIs to record LastAdminHelped
- Modify logging to include admin identification
- Add admin activity tracking for audit purposes
- Update remote database sync to include new fields

## Phase 6: Frontend System Updates

### 5.1 Update Frontend Components to Handle Local vs Remote Data Sources
**Status**: ✅ Completed
**Files Affected**:
- `frontend/src/components/ServerStatus.js`
- `frontend/src/components/LockedUsers.js` 
- `frontend/src/components/DomainStatus.js`
- `frontend/src/utils/dataService.js` (new)
- `frontend/src/hooks/useDataMode.js` (new)

**Details**:
- Create data service abstraction layer
- Implement mode-aware data fetching
- Add loading states for remote data
- Handle connection failures gracefully
- Implement real-time updates for both modes

**Component Updates Required**:
- Server monitoring dashboards
- Locked user management interfaces
- Domain controller status displays  
- Log viewing components
- Configuration management interfaces

### 5.2 Update Authentication Flow Components
**Status**: Pending
**Files Affected**:
- `frontend/src/components/Login.js`
- `frontend/src/components/ProtectedRoute.js`
- `frontend/src/utils/auth.js`

**Details**:
- Simplify login form (remove database complexity)
- Update authentication validation logic
- Implement session management for both modes
- Add authentication error handling

## Phase 6: Desktop Application Packaging

### 6.1 Set Up Electron Packaging for Desktop Application Distribution
**Status**: Pending
**Files Affected**:
- `package.json` (Electron dependencies)
- `electron/main.js` (new)
- `electron/preload.js` (new)  
- `electron/package.json` (new)
- `build/` (new build configuration)

**Details**:
- Configure Electron for both frontend and backend
- Set up proper window management
- Implement system tray integration
- Add auto-launch capabilities
- Configure proper security settings

**Technical Requirements**:
- Bundle both React frontend and Express backend
- Handle port management for local server
- Implement proper process lifecycle management
- Add error handling and logging
- Configure proper CSP and security policies

### 6.2 Create Auto-Updater System for Electron App Distribution from GitHub Releases
**Status**: Pending
**Files Affected**:
- `electron/updater.js` (new)
- `Backend/utils/updateChecker.js` (new)
- `frontend/src/components/UpdateNotification.js` (new)
- `package.json` (electron-updater dependency)
- `.github/workflows/release.yml` (new)

**Details**:
**GitHub-Based Auto-Update System:**
- Use `electron-updater` package for GitHub releases integration
- Check for updates via GitHub API: `https://api.github.com/repos/yourrepo/helpdesk-GUI/releases/latest`
- Download and install updates from GitHub release assets
- Implement semantic versioning for proper update detection
- Add update notification UI with changelog display

**Update Flow:**
1. App startup checks for updates (configurable interval)
2. Compare current version with latest GitHub release
3. Download update in background if available
4. Prompt user to restart for installation
5. Install update and restart application

**Technical Requirements:**
- GitHub releases workflow for automated publishing
- Code signing certificate for Windows (prevents security warnings)
- Update server configuration in main.js
- Rollback mechanism for failed updates
- Update progress indicators and error handling
- User preferences for auto-update settings

**Code Signing Setup:**
- Obtain code signing certificate for production
- Configure electron-builder with certificate
- Set up secure certificate storage in CI/CD
- Configure Windows installer signing

**GitHub Actions Integration:**
```yaml
# .github/workflows/release.yml
- Build Electron app for Windows
- Sign binaries with certificate
- Create GitHub release with versioned assets
- Upload packaged installers to release
```

### 6.3 Design and Implement Installer/Setup Experience for Helpdesk Agents
**Status**: Pending
**Files Affected**:
- `installer/setup.nsi` (new - NSIS installer script)
- `installer/assets/` (new - installer assets)
- `scripts/build-installer.js` (new)

**Details**:
- Create Windows installer with proper branding
- Add desktop shortcut and start menu entries
- Implement uninstaller functionality
- Add installation validation
- Create MSI package for enterprise deployment

## Phase 8: Cleanup and Legacy Code Removal

### 8.1 Clean Up Legacy Authentication Code and Unused Database Components
**Status**: Pending
**Files Affected**:
- `Backend/middleware/auth.js` (remove database auth logic)
- `Backend/routes/auth.js` (remove old login endpoints)
- `Backend/db/init.js` (remove Admin password columns)
- `Backend/utils/passwordUtils.js` (remove if exists)
- `frontend/src/components/AdminSetup.js` (remove if exists)
- `setupConfig.js` (remove old auth configuration)

**Details**:
**Remove Legacy Authentication:**
- Delete all database-based authentication middleware
- Remove password hashing utilities for database storage
- Clean up old login/registration endpoints
- Remove admin setup components from frontend
- Delete unused authentication configuration options

**Database Cleanup:**
- Remove Admin table password columns via migration
- Delete old authentication-related database utilities
- Clean up unused database initialization code
- Remove old session storage implementations

**Configuration Cleanup:**
- Remove old authentication settings from setupConfig.js
- Delete deprecated configuration options
- Clean up old environment variable references
- Remove unused middleware registration

**Testing During Cleanup:**
- Ensure new authentication system works before removing old code
- Test database operations after schema changes
- Validate that no functionality breaks during removal
- Maintain rollback capability until cleanup is complete

### 8.2 Remove Old Setup System and Replace with New Wizard
**Status**: Pending
**Files Affected**:
- `frontend/src/pages/Setup.js` (replace with SetupWizard)
- `Backend/routes/setup.js` (refactor for new wizard)
- `setupConfig.js` (remove old setup logic)
- `install-manual.cmd` (update for new flow)

**Details**:
**Old Setup System Removal:**
- Remove current `/setup` page and replace with wizard
- Delete old configuration setup endpoints
- Remove manual database setup processes
- Clean up old installation scripts

**New System Integration:**
- Ensure new setup wizard handles all old setup functionality
- Migrate any necessary setup data preservation
- Update installation documentation
- Test new setup flow thoroughly before removing old system

### 8.3 Code Quality and Optimization Cleanup
**Status**: Pending
**Files Affected**:
- All modified files (code review and optimization)
- `package.json` (remove unused dependencies)
- Configuration files (remove unused settings)

**Details**:
**Code Optimization:**
- Remove unused imports and dependencies
- Optimize database queries for new schema
- Clean up commented-out code from migration
- Standardize error handling across new systems

**Dependency Cleanup:**
- Remove authentication-related packages no longer needed
- Update package.json to reflect new dependencies
- Clean up old configuration files
- Remove unused utility functions

**Documentation Cleanup:**
- Update all code comments to reflect new architecture
- Remove outdated TODO comments
- Update function documentation
- Clean up old API documentation

## Phase 9: Testing and Validation

### 7.1 Test Local Deployment Workflow End-to-End
**Status**: Pending
**Testing Requirements**:
- Fresh installation testing
- Local database initialization
- PowerShell script execution validation
- Authentication system testing
- Feature functionality verification
- Performance testing under load

### 7.2 Test Remote Deployment Workflow End-to-End
**Status**: Pending  
**Testing Requirements**:
- Remote connection establishment
- API key authentication testing
- Data synchronization validation
- Fallback mechanism testing
- Network failure handling
- Multi-agent remote connection testing

### 9.3 Update Documentation and Setup Instructions for New Deployment Model
**Status**: Pending
**Files Affected**:
- `README.md` (major update)
- `INSTALL.md` (new)
- `ADMIN_GUIDE.md` (new)
- `TROUBLESHOOTING.md` (new)
- `API_DOCUMENTATION.md` (new)

### 9.4 Update CLAUDE.md to Reflect New Architecture and Workflows
**Status**: Pending
**Files Affected**:
- `CLAUDE.md` (major architectural update)

**Details**:
**Architecture Changes to Document:**
- Electron desktop application structure
- Local vs Remote database modes
- .env-based authentication system
- PowerShell script categorization (Action vs Monitoring)
- Auto-update system via GitHub releases
- Setup wizard workflow

**New Development Commands:**
```markdown
## Development Commands (Updated)

### Electron Development
- `npm run electron-dev` - Run Electron app in development
- `npm run electron-build` - Build Electron app for production
- `npm run electron-pack` - Package for distribution
- `npm run release` - Create GitHub release with auto-updater

### Database Management
- `npm run db-migrate` - Run database migrations
- `npm run db-reset` - Reset database to new schema
- `npm run db-seed` - Seed database with test data

### Mode Testing
- `npm run test-local` - Test local database mode
- `npm run test-remote` - Test remote database mode
- `npm run test-setup` - Test setup wizard flow
```

**Updated Architecture Section:**
```markdown
## Architecture (Updated)

### Desktop Application (Electron)
- **Main Process**: `electron/main.js` - Window management and auto-updater
- **Renderer Process**: React frontend + Express backend bundled
- **Auto-Updates**: GitHub releases integration with code signing

### Authentication System (.env-based)
- **Local Authentication**: Hashed passwords in .env files
- **Session Management**: JWT tokens for frontend sessions
- **No Database Auth**: All authentication moved to local files

### Database Modes
- **Local Mode**: SQLite database with PowerShell integration
- **Remote Mode**: API connections to central database server
- **Hybrid**: Action scripts local, monitoring data remote

### PowerShell Integration (Mode-Aware)
- **Action Scripts**: Always run locally (user management, unlocking)
- **Monitoring Scripts**: Local PowerShell OR remote API calls
- **Script Categories**: Defined in `Backend/config/scriptCategories.js`
```

**Updated Development Patterns:**
```markdown
## Important Patterns (Updated)

### Mode Detection
- Configuration loaded from `setupConfig.js` at startup
- Mode affects data sources and script execution
- Components adapt behavior based on mode

### Setup Wizard Flow
- First-run detection via configuration presence  
- Multi-step wizard for initial configuration
- Mode selection affects available options

### Database Schema (Updated)
- Admin table simplified (no passwords)
- Users table enhanced with LastAdminHelped tracking
- Migration system for existing installations

### Auto-Update Flow
- Startup check for GitHub releases
- Background download and installation
- User notification and restart prompts
```

## Implementation Priority and Dependencies

**Critical Path**:
1. Configuration Management System → Authentication System → PowerShell Flow Modification
2. Frontend Updates depend on Backend API changes
3. Electron packaging can be parallel to feature development
4. Testing phases depend on completion of respective features

**Risk Areas**:
- PowerShell script permissions in packaged application
- Electron security policies with local server
- .env file security and management
- Remote API performance and reliability
- Update mechanism security and validation

## File Impact Analysis

**High Impact Files** (Major changes required):
- `setupConfig.js` - Configuration system overhaul
- `Backend/server.js` - Startup and mode detection
- `Backend/powershell.js` - Script execution logic
- `Backend/middleware/auth.js` - Authentication system
- All utility files in `Backend/utils/`

**Medium Impact Files** (Moderate changes):
- Frontend components for data display
- Route files for API changes
- Database setup and migration files

**New Files Required**:
- Electron application files
- Remote server implementation
- API client and management utilities
- Setup wizard components
- Configuration management modules

This comprehensive plan accounts for the interconnected nature of the application and provides detailed guidance for future development sessions.