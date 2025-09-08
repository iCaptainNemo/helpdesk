import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/SetupWizard.css';

const SetupWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [deploymentMode, setDeploymentMode] = useState('');
  const [formData, setFormData] = useState({
    mode: '', // 'local' or 'remote'
    adminCredentials: {
      username: '',
      password: '',
      confirmPassword: ''
    },
    remoteConnection: {
      serverUrl: '',
      apiKey: ''
    },
    systemSettings: {
      adDomain: 'hs.gov',
      adGroups: 'ITSD Help Desk',
      logPath: '',
      tempPassword: 'Spring2025'
    }
  });

  const navigate = useNavigate();

  const handleModeSelection = (mode) => {
    setDeploymentMode(mode);
    setFormData(prev => ({ ...prev, mode }));
    setCurrentStep(2);
  };

  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const validateStep = () => {
    switch (currentStep) {
      case 2:
        if (deploymentMode === 'local') {
          return formData.adminCredentials.username && 
                 formData.adminCredentials.password && 
                 formData.adminCredentials.password === formData.adminCredentials.confirmPassword;
        } else {
          return formData.remoteConnection.serverUrl && formData.remoteConnection.apiKey;
        }
      case 3:
        return formData.systemSettings.adDomain && formData.systemSettings.adGroups;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep()) {
      setCurrentStep(prev => prev + 1);
    } else {
      alert('Please fill in all required fields correctly.');
    }
  };

  const prevStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setDeploymentMode('');
    } else {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) {
      alert('Please complete all required fields.');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/setup/wizard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Setup failed');
      }

      const result = await response.json();
      alert('Setup completed successfully!');
      navigate('/login');
    } catch (error) {
      console.error('Setup error:', error);
      alert('Setup failed. Please check your configuration and try again.');
    }
  };

  const renderStep1 = () => (
    <div className="wizard-step">
      <div className="splash-header">
        <h1>Welcome to Helpdesk Jarvis</h1>
        <p>Your IT support companion for Windows system administration</p>
      </div>
      
      <div className="deployment-selection">
        <h2>Choose Your Deployment Mode</h2>
        <p>Select how you want to configure Helpdesk Jarvis for your environment:</p>
        
        <div className="mode-cards">
          <div 
            className={`mode-card ${deploymentMode === 'local' ? 'selected' : ''}`}
            onClick={() => handleModeSelection('local')}
          >
            <div className="mode-icon">💻</div>
            <h3>Local Mode</h3>
            <p>Run everything on this computer. Perfect for individual helpdesk agents or small teams.</p>
            <ul>
              <li>Local SQLite database</li>
              <li>Direct PowerShell execution</li>
              <li>File-based authentication</li>
              <li>No server setup required</li>
            </ul>
          </div>
          
          <div 
            className={`mode-card ${deploymentMode === 'remote' ? 'selected' : ''}`}
            onClick={() => handleModeSelection('remote')}
          >
            <div className="mode-icon">🌐</div>
            <h3>Remote Mode</h3>
            <p>Connect to a centralized server. Ideal for larger teams with shared data and monitoring.</p>
            <ul>
              <li>Centralized database</li>
              <li>Shared monitoring data</li>
              <li>API-based authentication</li>
              <li>Multi-agent deployment</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="wizard-step">
      <h2>
        {deploymentMode === 'local' ? 'Local Authentication Setup' : 'Remote Server Connection'}
      </h2>
      
      {deploymentMode === 'local' ? (
        <div className="auth-setup">
          <p>Create your local administrator credentials:</p>
          <div className="form-group">
            <label>Administrator Username</label>
            <input
              type="text"
              value={formData.adminCredentials.username}
              onChange={(e) => handleInputChange('adminCredentials', 'username', e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.adminCredentials.password}
              onChange={(e) => handleInputChange('adminCredentials', 'password', e.target.value)}
              placeholder="Enter a secure password"
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={formData.adminCredentials.confirmPassword}
              onChange={(e) => handleInputChange('adminCredentials', 'confirmPassword', e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>
          {formData.adminCredentials.password !== formData.adminCredentials.confirmPassword && formData.adminCredentials.confirmPassword && (
            <div className="error-message">Passwords do not match</div>
          )}
        </div>
      ) : (
        <div className="remote-setup">
          <p>Connect to your remote Helpdesk Jarvis server:</p>
          <div className="form-group">
            <label>Server URL</label>
            <input
              type="text"
              value={formData.remoteConnection.serverUrl}
              onChange={(e) => handleInputChange('remoteConnection', 'serverUrl', e.target.value)}
              placeholder="https://your-server.com:3001"
              required
            />
          </div>
          <div className="form-group">
            <label>API Key</label>
            <input
              type="password"
              value={formData.remoteConnection.apiKey}
              onChange={(e) => handleInputChange('remoteConnection', 'apiKey', e.target.value)}
              placeholder="Enter your API key"
              required
            />
          </div>
          <div className="info-box">
            <p>💡 Get your API key from your system administrator or the remote server's admin panel.</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="wizard-step">
      <h2>System Configuration</h2>
      <p>Configure Active Directory and system settings:</p>
      
      <div className="form-group">
        <label>Active Directory Domain</label>
        <input
          type="text"
          value={formData.systemSettings.adDomain}
          onChange={(e) => handleInputChange('systemSettings', 'adDomain', e.target.value)}
          placeholder="e.g., hs.gov"
          required
        />
      </div>
      
      <div className="form-group">
        <label>Authorized AD Groups</label>
        <input
          type="text"
          value={formData.systemSettings.adGroups}
          onChange={(e) => handleInputChange('systemSettings', 'adGroups', e.target.value)}
          placeholder="e.g., ITSD Help Desk"
          required
        />
        <small>Comma-separated list of Active Directory groups that can access the system</small>
      </div>
      
      <div className="form-group">
        <label>Default Temporary Password</label>
        <input
          type="text"
          value={formData.systemSettings.tempPassword}
          onChange={(e) => handleInputChange('systemSettings', 'tempPassword', e.target.value)}
          placeholder="e.g., Spring2025"
        />
      </div>
      
      {deploymentMode === 'local' && (
        <div className="form-group">
          <label>Log File Path (Optional)</label>
          <input
            type="text"
            value={formData.systemSettings.logPath}
            onChange={(e) => handleInputChange('systemSettings', 'logPath', e.target.value)}
            placeholder="\\\\server\\path\\to\\logs"
          />
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="wizard-step completion">
      <div className="completion-icon">✅</div>
      <h2>Setup Complete!</h2>
      <p>Review your configuration:</p>
      
      <div className="config-summary">
        <div className="summary-item">
          <strong>Mode:</strong> {deploymentMode === 'local' ? 'Local' : 'Remote'} Deployment
        </div>
        {deploymentMode === 'local' ? (
          <div className="summary-item">
            <strong>Admin User:</strong> {formData.adminCredentials.username}
          </div>
        ) : (
          <div className="summary-item">
            <strong>Server:</strong> {formData.remoteConnection.serverUrl}
          </div>
        )}
        <div className="summary-item">
          <strong>AD Domain:</strong> {formData.systemSettings.adDomain}
        </div>
        <div className="summary-item">
          <strong>AD Groups:</strong> {formData.systemSettings.adGroups}
        </div>
      </div>
      
      <p>Click "Finish Setup" to save your configuration and start using Helpdesk Jarvis.</p>
    </div>
  );

  return (
    <div className="setup-wizard">
      <div className="wizard-container">
        {/* Progress indicator */}
        <div className="progress-bar">
          <div className="progress-steps">
            {[1, 2, 3, 4].map(step => (
              <div 
                key={step} 
                className={`progress-step ${currentStep >= step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
              >
                {step}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="step-content">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {/* Navigation buttons */}
        {currentStep > 1 && (
          <div className="wizard-navigation">
            <button 
              className="btn-secondary" 
              onClick={prevStep}
            >
              Back
            </button>
            
            {currentStep < 4 ? (
              <button 
                className="btn-primary" 
                onClick={nextStep}
                disabled={!validateStep()}
              >
                Next
              </button>
            ) : (
              <button 
                className="btn-success" 
                onClick={handleSubmit}
              >
                Finish Setup
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;