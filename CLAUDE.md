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
- **Important**: Uses node18 target due to bcrypt native module requirements
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

## Build Troubleshooting

### Standalone Executable Issues
- **Path Resolution**: The application uses `process.pkg` detection to handle path resolution differently in packaged vs development mode
- **Database Location**: In standalone mode, database is created in `database/` folder relative to the executable
- **Environment Files**: `.env` files are looked for in the current working directory when running as standalone
- **Native Modules**: bcrypt and better-sqlite3 require node18 target for proper binary compatibility
- **PowerShell Scripts**: Scripts are bundled in the executable but must be extracted to `functions/` folder for PowerShell to access them
- **Tools Downloads**: External tools are downloaded from GitHub repository to `Tools/` folder on first run