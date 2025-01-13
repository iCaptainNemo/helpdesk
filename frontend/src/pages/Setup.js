import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Setup.css';

const Setup = () => {
  const [formData, setFormData] = useState({
    server: {
      port: 3001,
      backendUrl: 'http://localhost:3001',
      frontendUrl: 'http://localhost:3000',
      frontendUrl2: '',
      subnetPattern: ''
    },
    database: {
      type: 'local',
      path: './Backend/db/database.db',
      host: '',
      port: '',
      name: '',
      user: '',
      password: ''
    },
    security: {
      jwtSecret: '',
      sessionSecret: '',
      tempPassword: 'Welcome123!',
      apiKey: '',
      jwtExpiration: '7D'
    },
    activeDirectory: {
      groups: '',
      domainControllers: []
    },
    monitoring: {
      lockedOutUsersRefreshInterval: '2M',
      serverStatusRefreshInterval: '10M',
      logfilePath: './logs'
    },
    admin: {
      superAdminId: '',
      superAdminPassword: ''
    }
  });

  const navigate = useNavigate();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dbType, setDbType] = useState('local');

  const handleChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${formData.server.backendUrl}/api/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      alert('Setup completed successfully');
      navigate('/login');
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Error saving configuration');
    }
  };

  return (
    <div className="setupContainer">
      <h2>Initial Setup</h2>
      <form onSubmit={handleSubmit}>
        {/* Server Configuration */}
        <section className="setup-section">
          <h3>Server Configuration</h3>
          <div className="formGroup">
            <label>Backend URL</label>
            <input
              type="text"
              value={formData.server.backendUrl}
              onChange={(e) => handleChange('server', 'backendUrl', e.target.value)}
              required
            />
          </div>
          <div className="formGroup">
            <label>Frontend URL</label>
            <input
              type="text"
              value={formData.server.frontendUrl}
              onChange={(e) => handleChange('server', 'frontendUrl', e.target.value)}
              required
            />
          </div>
        </section>

        {/* Database Configuration */}
        <section className="setup-section">
          <h3>Database Configuration</h3>
          <div className="formGroup">
            <label>Database Type</label>
            <select
              value={formData.database.type}
              onChange={(e) => {
                setDbType(e.target.value);
                handleChange('database', 'type', e.target.value);
              }}
            >
              <option value="local">Local SQLite</option>
              <option value="remote">Remote Database</option>
            </select>
          </div>
          {formData.database.type === 'local' ? (
            <div className="formGroup">
              <label>Database Path</label>
              <input
                type="text"
                value={formData.database.path}
                onChange={(e) => handleChange('database', 'path', e.target.value)}
                required
              />
            </div>
          ) : (
            <>
              <div className="formGroup">
                <label>Database Host</label>
                <input
                  type="text"
                  value={formData.database.host}
                  onChange={(e) => handleChange('database', 'host', e.target.value)}
                  required
                />
              </div>
              <div className="formGroup">
                <label>Database Port</label>
                <input
                  type="text"
                  value={formData.database.port}
                  onChange={(e) => handleChange('database', 'port', e.target.value)}
                  required
                />
              </div>
              {/* Add other remote database fields */}
            </>
          )}
        </section>

        {/* Admin Configuration */}
        <section className="setup-section">
          <h3>Admin Configuration</h3>
          <div className="formGroup">
            <label>Super Admin Username</label>
            <input
              type="text"
              value={formData.admin.superAdminId}
              onChange={(e) => handleChange('admin', 'superAdminId', e.target.value)}
              required
            />
          </div>
          <div className="formGroup">
            <label>Super Admin Password</label>
            <input
              type="password"
              value={formData.admin.superAdminPassword}
              onChange={(e) => handleChange('admin', 'superAdminPassword', e.target.value)}
              required
            />
          </div>
        </section>

        {/* Advanced Settings Toggle */}
        <div className="advanced-toggle">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
          </button>
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <>
            <section className="setup-section">
              <h3>Active Directory Settings</h3>
              <div className="formGroup">
                <label>AD Groups (comma-separated)</label>
                <input
                  type="text"
                  value={formData.activeDirectory.groups}
                  onChange={(e) => handleChange('activeDirectory', 'groups', e.target.value)}
                />
              </div>
            </section>

            <section className="setup-section">
              <h3>Monitoring Settings</h3>
              <div className="formGroup">
                <label>Log File Path</label>
                <input
                  type="text"
                  value={formData.monitoring.logfilePath}
                  onChange={(e) => handleChange('monitoring', 'logfilePath', e.target.value)}
                />
              </div>
            </section>
          </>
        )}

        <button type="submit" className="setupButton">Complete Setup</button>
      </form>
    </div>
  );
};

export default Setup;