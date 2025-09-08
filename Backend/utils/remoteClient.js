const fetch = require('node-fetch');
const logger = require('./logger');

class RemoteClient {
  constructor(serverUrl, apiKey) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.token = null;
    this.tokenExpiry = null;
  }

  // Authenticate with the remote server
  async authenticate(clientId = 'helpdesk-client') {
    try {
      const response = await fetch(`${this.serverUrl}/api/remote/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({ clientId })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.token = data.token;
      this.tokenExpiry = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours from now
      
      logger.info('Successfully authenticated with remote server');
      return data;
    } catch (error) {
      logger.error('Remote authentication failed:', error);
      throw error;
    }
  }

  // Check if token is valid and not expired
  isAuthenticated() {
    return this.token && this.tokenExpiry && new Date() < this.tokenExpiry;
  }

  // Ensure we have a valid token
  async ensureAuthenticated() {
    if (!this.isAuthenticated()) {
      await this.authenticate();
    }
  }

  // Generic method to make authenticated requests
  async makeRequest(endpoint, options = {}) {
    await this.ensureAuthenticated();
    
    const url = `${this.serverUrl}/api/remote${endpoint}`;
    const requestOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'Authorization': `Bearer ${this.token}`,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`Remote request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Specific data fetching methods
  async getLockedUsers() {
    try {
      const result = await this.makeRequest('/locked-users');
      logger.info('Fetched locked users from remote server');
      return result.data;
    } catch (error) {
      logger.error('Failed to fetch locked users from remote server:', error);
      throw error;
    }
  }

  async getServerStatus(serverNames = []) {
    try {
      const queryParams = serverNames.length > 0 ? `?servers=${serverNames.join(',')}` : '';
      const result = await this.makeRequest(`/server-status${queryParams}`);
      logger.info('Fetched server status from remote server');
      return result.data;
    } catch (error) {
      logger.error('Failed to fetch server status from remote server:', error);
      throw error;
    }
  }

  async getDomainControllers() {
    try {
      const result = await this.makeRequest('/domain-controllers');
      logger.info('Fetched domain controllers from remote server');
      return result.data;
    } catch (error) {
      logger.error('Failed to fetch domain controllers from remote server:', error);
      throw error;
    }
  }

  async getLogs() {
    try {
      const result = await this.makeRequest('/logs');
      logger.info('Fetched logs from remote server');
      return result.data;
    } catch (error) {
      logger.error('Failed to fetch logs from remote server:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.makeRequest('/health');
      logger.info('Remote server health check successful');
      return result;
    } catch (error) {
      logger.error('Remote server health check failed:', error);
      throw error;
    }
  }

  // Test connection
  async testConnection() {
    try {
      await this.authenticate();
      await this.healthCheck();
      return true;
    } catch (error) {
      logger.error('Remote connection test failed:', error);
      return false;
    }
  }
}

// Factory function to create remote client instance
function createRemoteClient() {
  const serverUrl = process.env.REMOTE_SERVER_URL;
  const apiKey = process.env.API_KEY;

  if (!serverUrl || !apiKey) {
    throw new Error('Remote server configuration missing: REMOTE_SERVER_URL and API_KEY required');
  }

  return new RemoteClient(serverUrl, apiKey);
}

module.exports = {
  RemoteClient,
  createRemoteClient
};