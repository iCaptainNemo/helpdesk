// setupConfig.js
const config = {
    // Server Configuration
    server: {
      // REQUIRED:
      port: 3001, // Backend port
      backendUrl: 'http://172.25.129.95:3001', // Backend URL from BACKEND_URL
      frontendUrl: 'http://localhost:3000', // Primary frontend URL from FRONTEND_URL_1
      
      // OPTIONAL:
      frontendUrl2: 'http://172.25.129.95:3000', // Secondary frontend URL from FRONTEND_URL_2
      subnetPattern: 'http://172.25.129.\\d{1,3}:3000', // Existing subnet pattern
    },
    
    // Database Configuration 
    database: {
      // REQUIRED:
      type: 'local', // Using SQLite
      
      // REQUIRED for local:
      path: './database.db', // From DB_PATH
      
      // REQUIRED for remote (leave empty since using local):
      host: '',
      port: '',
      name: '',
      user: '',
      password: ''
    },
  
    // Security Settings
    security: {
      // REQUIRED:
      jwtSecret: 'NDvU35hHjy', // From JWT_SECRET
      sessionSecret: '7VftBffqO8', // From SESSION_SECRET
      tempPassword: 'Winter2025', // From TEMP_PASSWORD
      
      // OPTIONAL:
      apiKey: 'P@$$w0rd', // From REACT_APP_API_KEY
      jwtExpiration: '5D', // From JWT_EXPIRATION
    },
  
    // Active Directory Settings
    activeDirectory: {
      // REQUIRED:
      groups: 'ITSD Help Desk', // From AD_GROUPS
      
      // OPTIONAL:
      domainControllers: [], // Can be populated later
    },
  
    // Monitoring Configuration
    monitoring: {
      // OPTIONAL with defaults:
      lockedOutUsersRefreshInterval: '2M', // From LOCKED_OUT_USERS_REFRESH_INTERVAL
      serverStatusRefreshInterval: '10M', // From SERVER_STATUS_REFRESH_INTERVAL
      logfilePath: '\\\\hssserver037\\login-tracking\\', // From LOGFILE
    },
  
    // Admin Configuration
    admin: {
      // REQUIRED:
      superAdminId: '', // You'll need to set this
      superAdminPassword: '', // You'll need to set this
    }
  };
  
  // Configuration Notes:
  /*
  REQUIRED fields must be filled during setup.
  OPTIONAL fields can be left empty and will use defaults.
  Auto-generated fields will be created if left empty.
  
  Interval format: 
  - 'M' for minutes (e.g., '5M')
  - 'H' for hours (e.g., '1H')
  - 'D' for days (e.g., '7D')
  
  Database types:
  - 'local': Uses SQLite (recommended for small deployments)
  - 'remote': Uses MySQL/PostgreSQL (recommended for large deployments)
  
  Security:
  - Empty secrets will be auto-generated during setup
  - Default temporary password can be changed in security settings
  */
  
  module.exports = config;