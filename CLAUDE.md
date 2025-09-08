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
- `cd frontend && npm run build` - Build frontend for production
- Backend runs directly with `node server.js`

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