import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../utils/api';
import '../styles/SplashScreen.css';

const SplashScreen = () => {
  const [isConfigured, setIsConfigured] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const data = await apiGet('/api/setup/status');

      setIsConfigured(data.configured);
      
      if (data.configured) {
        // If already configured, redirect to login
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking configuration:', error);
      setIsConfigured(false);
    } finally {
      setLoading(false);
    }
  };

  const startSetup = () => {
    navigate('/setup-wizard');
  };

  if (loading) {
    return (
      <div className="splash-screen loading">
        <div className="loading-animation">
          <div className="spinner"></div>
          <p>Checking system configuration...</p>
        </div>
      </div>
    );
  }

  if (isConfigured) {
    return (
      <div className="splash-screen configured">
        <div className="splash-content">
          <div className="logo">
            <div className="logo-icon">🤖</div>
            <h1>Helpdesk Jarvis</h1>
          </div>
          <p className="status-message">System configured successfully!</p>
          <p className="redirect-message">Redirecting to login...</p>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="logo">
          <div className="logo-icon">🤖</div>
          <h1>Helpdesk Jarvis</h1>
          <p className="tagline">Your IT Support Companion</p>
        </div>

        <div className="welcome-section">
          <h2>Welcome!</h2>
          <p>It looks like this is your first time running Helpdesk Jarvis.</p>
          <p>Let's get you set up with a quick configuration wizard.</p>
        </div>

        <div className="features-grid">
          <div className="feature">
            <div className="feature-icon">👥</div>
            <h3>User Management</h3>
            <p>Unlock accounts and reset passwords with ease</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🖥️</div>
            <h3>System Monitoring</h3>
            <p>Monitor server status and locked-out users in real-time</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🔐</div>
            <h3>Active Directory</h3>
            <p>Seamlessly integrate with your existing AD infrastructure</p>
          </div>
          <div className="feature">
            <div className="feature-icon">⚡</div>
            <h3>PowerShell Integration</h3>
            <p>Execute PowerShell scripts directly from the interface</p>
          </div>
        </div>

        <button className="start-setup-btn" onClick={startSetup}>
          Start Setup Wizard
        </button>

        <div className="footer-info">
          <p>This setup wizard will help you configure:</p>
          <ul>
            <li>Deployment mode (Local or Remote)</li>
            <li>Authentication settings</li>
            <li>Active Directory integration</li>
            <li>System preferences</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;