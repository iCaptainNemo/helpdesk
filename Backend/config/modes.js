const fs = require('fs');
const path = require('path');

/**
 * Configuration modes and utilities
 */

const DEPLOYMENT_MODES = {
  LOCAL: 'local',
  REMOTE: 'remote'
};

const MODE_CONFIGS = {
  [DEPLOYMENT_MODES.LOCAL]: {
    name: 'Local Mode',
    description: 'Run everything on this computer with local SQLite database',
    requiresRemoteServer: false,
    supportsPowerShellScripts: true,
    dataSource: 'local',
    authMethod: 'env-file'
  },
  [DEPLOYMENT_MODES.REMOTE]: {
    name: 'Remote Mode', 
    description: 'Connect to centralized server with shared monitoring data',
    requiresRemoteServer: true,
    supportsPowerShellScripts: 'action-only', // Only action scripts, not monitoring
    dataSource: 'remote-api',
    authMethod: 'api-key'
  }
};

/**
 * Get current deployment mode from environment
 */
function getCurrentMode() {
  return process.env.DEPLOYMENT_MODE || detectModeFromConfig();
}

/**
 * Auto-detect mode from configuration files
 */
function detectModeFromConfig() {
  try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      if (envContent.includes('ADMIN_USERNAME=') && envContent.includes('ADMIN_PASSWORD=')) {
        return DEPLOYMENT_MODES.LOCAL;
      }
      
      if (envContent.includes('REMOTE_SERVER_URL=') && envContent.includes('API_KEY=')) {
        return DEPLOYMENT_MODES.REMOTE;
      }
    }
    
    // Default to local if can't determine
    return DEPLOYMENT_MODES.LOCAL;
  } catch (error) {
    console.error('Error detecting deployment mode:', error);
    return DEPLOYMENT_MODES.LOCAL;
  }
}

/**
 * Get configuration for current or specified mode
 */
function getModeConfig(mode = null) {
  const targetMode = mode || getCurrentMode();
  return MODE_CONFIGS[targetMode] || MODE_CONFIGS[DEPLOYMENT_MODES.LOCAL];
}

/**
 * Check if current mode supports a specific feature
 */
function supportsFeature(feature, mode = null) {
  const config = getModeConfig(mode);
  
  switch (feature) {
    case 'powerShellScripts':
      return config.supportsPowerShellScripts === true;
    case 'monitoringScripts':
      return config.supportsPowerShellScripts === true || config.dataSource === 'remote-api';
    case 'actionScripts':
      return config.supportsPowerShellScripts === true || config.supportsPowerShellScripts === 'action-only';
    case 'remoteData':
      return config.dataSource === 'remote-api';
    case 'localDatabase':
      return config.dataSource === 'local';
    default:
      return false;
  }
}

/**
 * Validate configuration for a specific mode
 */
function validateModeConfig(mode) {
  const errors = [];
  const envPath = path.join(__dirname, '../.env');
  
  if (!fs.existsSync(envPath)) {
    errors.push('Environment configuration file (.env) not found');
    return errors;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Common required variables
  const commonRequired = ['JWT_SECRET', 'SESSION_SECRET'];
  for (const key of commonRequired) {
    if (!envContent.includes(`${key}=`)) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }
  
  // Mode-specific validation
  if (mode === DEPLOYMENT_MODES.LOCAL) {
    const localRequired = ['ADMIN_USERNAME', 'ADMIN_PASSWORD'];
    for (const key of localRequired) {
      if (!envContent.includes(`${key}=`)) {
        errors.push(`Missing required environment variable for local mode: ${key}`);
      }
    }
  } else if (mode === DEPLOYMENT_MODES.REMOTE) {
    const remoteRequired = ['REMOTE_SERVER_URL', 'API_KEY'];
    for (const key of remoteRequired) {
      if (!envContent.includes(`${key}=`)) {
        errors.push(`Missing required environment variable for remote mode: ${key}`);
      }
    }
  }
  
  return errors;
}

/**
 * Get system status and configuration info
 */
function getSystemInfo() {
  const currentMode = getCurrentMode();
  const modeConfig = getModeConfig(currentMode);
  const validationErrors = validateModeConfig(currentMode);
  
  return {
    mode: currentMode,
    modeConfig,
    isValid: validationErrors.length === 0,
    validationErrors,
    features: {
      powerShellScripts: supportsFeature('powerShellScripts'),
      monitoringScripts: supportsFeature('monitoringScripts'),
      actionScripts: supportsFeature('actionScripts'),
      remoteData: supportsFeature('remoteData'),
      localDatabase: supportsFeature('localDatabase')
    }
  };
}

module.exports = {
  DEPLOYMENT_MODES,
  MODE_CONFIGS,
  getCurrentMode,
  detectModeFromConfig,
  getModeConfig,
  supportsFeature,
  validateModeConfig,
  getSystemInfo
};