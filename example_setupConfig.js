// example_setupConfig.js
const config = {
  // Server Configuration
  server: {
    // REQUIRED:
    port: 3001, // Default backend port
    backendUrl: 'http://localhost:3001', // Backend URL
    frontendUrl: 'http://localhost:3000', // Primary frontend URL
    
    // OPTIONAL:
    frontendUrl2: 'http://127.0.0.1:3000', // Secondary frontend URL (for local testing)
    subnetPattern: '^http://[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}:3000$', // Allowed subnet pattern
  },
  
  // Database Configuration 
  database: {
    // REQUIRED:
    type: 'local', // 'local' or 'remote'
    
    // REQUIRED for local:
    path: './Backend/db/database.db', // SQLite database path
    
    // REQUIRED for remote:
    host: '', // Database host (required if type is 'remote')
    port: '', // Database port (required if type is 'remote')
    name: '', // Database name (required if type is 'remote')
    user: '', // Database user (required if type is 'remote')
    password: '', // Database password (required if type is 'remote')
  },

  // Security Settings
  security: {
    // REQUIRED:
    jwtSecret: '', // Secret for JWT tokens - will be auto-generated if empty
    sessionSecret: '', // Secret for sessions - will be auto-generated if empty
    tempPassword: 'Welcome123!', // Default temporary password for new users
    
    // OPTIONAL:
    apiKey: '', // API key - will be auto-generated if empty
    jwtExpiration: '7D', // JWT token expiration (default: 7 days)
  },

  // Active Directory Settings
  activeDirectory: {
    // REQUIRED:
    groups: 'Domain Admins, Enterprise Admins', // Comma-separated AD groups
    
    // OPTIONAL:
    domainControllers: [], // List of domain controllers - will be auto-discovered if empty
  },

  // Monitoring Configuration
  monitoring: {
    // OPTIONAL with defaults:
    lockedOutUsersRefreshInterval: '2M', // Locked users check interval (default: 2 minutes)
    serverStatusRefreshInterval: '10M', // Server status check interval (default: 10 minutes)
    logfilePath: '', // Path to log files (default: ./logs)
  },

  // Admin Configuration
  admin: {
    // REQUIRED:
    superAdminId: '', // Initial super admin username
    superAdminPassword: '', // Initial super admin password
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