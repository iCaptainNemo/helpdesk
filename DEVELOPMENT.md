# Helpdesk Jarvis - Development Setup

This guide is for developers who want to contribute to the project or run it in development mode with Node.js.

## Prerequisites

- Node.js 22.x (the standalone exe is packaged for the `node22-win-x64` target - building or running with a different Node version can produce a mismatched native module for better-sqlite3)
- npm (v6.x or later)
- PowerShell (v5.1 or later)
- SQLite3

## Development Installation

### Backend Setup

1. **Navigate to the Backend directory**:
    ```sh
    cd Backend
    ```

2. **Install dependencies**:
    ```sh
    npm install
    ```

3. **Create a `.env` file** in `Backend/` (there is no `.env.example` to copy - create it directly). At minimum:
    ```env
    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=your-secure-password
    DEPLOYMENT_MODE=local
    ```
    `JWT_SECRET`/`SESSION_SECRET` are optional - if omitted, the server generates ephemeral secrets on startup (fine for local dev, but sessions won't survive a restart). See the root `README.md`'s Manual Configuration section for the full list of supported variables (LDAP settings, etc.).

4. **Start the backend server**:
    ```sh
    npm start
    ```

### Frontend Setup

1. **Navigate to the frontend directory**:
    ```sh
    cd frontend
    ```

2. **Install dependencies**:
    ```sh
    npm install
    ```

3. **Create a `.env` file** in `frontend/` (there is no `.env.example` to copy - create it directly):
    ```env
    PORT=3000
    REACT_APP_BACKEND_URL=http://localhost:3001
    REACT_APP_API_KEY=your-remote-api-key
    ```
    `REACT_APP_BACKEND_URL` must point at wherever the backend actually runs - if you're testing from another device on the LAN, use this machine's IP instead of `localhost`.

4. **Start the frontend server**:
    ```sh
    npm start
    ```

### Client Setup (Development)

1. **Run the `Browser_Launcher_registry_Import.bat` script**:
    ```sh
    Tools/Browser_Launcher_registry_Import.bat
    ```

2. **Move the `JarvisLauncher` folder to the `Program Files` directory**:
    ```sh
    move Tools/JarvisLauncher "C:\Program Files\JarvisLauncher"
    ```

### Running the Development Environment

1. **Navigate to the project root directory**:
    ```sh
    cd ..
    ```

2. **Start both backend and frontend servers concurrently**:
    ```sh
    npm run start
    ```

The backend server will run on `http://localhost:3001` and the frontend server will run on `http://localhost:3000`.

## Development Features

- **Hot Reload**: Frontend automatically reloads on changes
- **Debug Mode**: Enhanced logging and error reporting
- **Development API**: Additional endpoints for testing
- **Live Database**: Changes persist across sessions

## Building for Distribution

### Create Standalone Executable

```sh
npm run release
```

This builds the frontend, packages the backend with `@yao-pkg/pkg`, and copies the native `better-sqlite3`/`bcrypt` binaries into place. Output goes to `releases/helpdesk-jarvis-v{version}.exe` (versioned) and `releases/helpdesk-jarvis.exe` (a copy that always points at the latest build).

Use `npm run dist:win` instead if you just want an unversioned build (always `helpdesk-jarvis.exe`, no versioned copy).

## Development vs Production

| Feature | Development | Production (Standalone) |
|---------|-------------|-------------------------|
| Installation | Node.js + npm install | Single .exe file |
| Database | Local SQLite | Embedded SQLite |
| Updates | Hot reload | Manual exe replacement |
| Configuration | .env files | Built-in setup wizard |
| External Tools | Manual setup | Auto-download from GitHub |
| Registry Setup | Manual batch files | Automatic on startup |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with both development and production builds
5. Submit a pull request

## Architecture

### Development Structure
```
helpdesk-GUI/
├── Backend/                 # Express.js server
│   ├── functions/          # PowerShell scripts
│   ├── routes/             # API endpoints
│   ├── db/                 # Database layer
│   └── utils/              # Utility modules
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Route components
│   │   └── styles/         # CSS files
│   └── build/              # Production build
└── Tools/                  # External utilities
```

### Production Structure
```
helpdesk-jarvis.exe         # Standalone executable
├── [Embedded]
│   ├── Backend/            # Server code
│   ├── frontend/build/     # Static web files
│   └── Tools/ (downloaded) # External utilities
└── [Runtime Created]
    ├── .env               # Configuration
    ├── Tools/             # Downloaded utilities
    └── database.db        # SQLite database
```

## License

This project is licensed under the GNU General Public License. See the `LICENSE` file for details.