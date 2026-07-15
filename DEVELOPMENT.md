# Helpdesk Jarvis - Development Setup

This guide is for developers who want to contribute to the project or run it in development mode with Node.js.

## Prerequisites

- Node.js (v14.x or later)
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

3. **Create a `.env` file**:
    ```sh
    cp .env.example .env
    ```

4. **Configure the `.env` file** with your environment variables.

5. **Start the backend server**:
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

3. **Create a `.env` file**:
    ```sh
    cp .env.example .env
    ```

4. **Configure the `.env` file** with your environment variables.

5. **Start the frontend server**:
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

1. **Build frontend**:
    ```sh
    npm run build:frontend
    ```

2. **Build standalone exe**:
    ```sh
    npm run dist:win
    ```

The standalone executable will be created at `releases/helpdesk-jarvis.exe`.

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