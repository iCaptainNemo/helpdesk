import React, { useEffect, useState, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import socketIOClient from 'socket.io-client';
import './styles.css'; // Import the CSS file
import './styles/theme.css'; // Import the new theme
import './styles/grid.css'; // Import the grid system
import './styles/mobile.css'; // Import mobile responsive styles
import { apiGet, apiPost } from './utils/api';
import Header from './Header';
import Navbar from './Navbar';
import Login from './pages/Login';
import SplashScreen from './components/SplashScreen';
import SetupWizard from './components/SetupWizard';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load heavy components
const ModernDashboard = React.lazy(() => import('./pages/ModernDashboard'));
const ModernADProperties = React.lazy(() => import('./pages/ModernADProperties'));
const Profile = React.lazy(() => import('./pages/Profile'));
const ModernConfigure = React.lazy(() => import('./pages/ModernConfigure'));
const Setup = React.lazy(() => import('./pages/Setup'));
const Terminal = React.lazy(() => import('./components/Terminal'));

// Always use the backend server IP address
const ENDPOINT = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Track authentication status
  const [AdminID, setAdminID] = useState(''); // Store AdminID from the server
  const [adminComputer, setAdminComputer] = useState(''); // Store AdminComputer from the server
  const [permissions, setPermissions] = useState([]); // Store permissions
  const [initialCheck, setInitialCheck] = useState(false); // Track the first authentication check
  const [setupComplete, setSetupComplete] = useState(null); // Track setup status

  // Establish WebSocket connection
  useEffect(() => {
    const socket = socketIOClient(ENDPOINT);

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Check setup status first
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const data = await apiGet('/api/setup/status');
        setSetupComplete(data.configured);
        // If setup is not complete, we don't need to check authentication
        if (!data.configured) {
          setInitialCheck(true);
        }
      } catch (error) {
        console.error('Error checking setup status:', error);
        setSetupComplete(false);
        setInitialCheck(true);
      }
    };

    checkSetupStatus();
  }, []);

  // Verify token and fetch permissions (only if setup is complete)
  useEffect(() => {
    if (setupComplete === null) return; // Wait for setup status check
    if (!setupComplete) return; // Skip if setup is not complete
    
    const token = localStorage.getItem('token');
    if (token) {
      (async () => {
        try {
          const data = await apiPost('/api/auth/verify-token');
          if (data.AdminID) {
            setIsAuthenticated(true);
            setAdminID(data.AdminID);
            // Fetch permissions after verifying the token
            const profile = await apiGet('/api/auth/profile');
            if (profile && profile.permissions) {
              setPermissions(profile.permissions || []);
            }
          }
          setInitialCheck(true);
        } catch (error) {
          console.error('Session verification failed:', error);
          setInitialCheck(true);
        }
      })();
    } else {
      setInitialCheck(true);
    }
  }, [setupComplete]);

  // Handle login
  const handleLogin = (AdminID, token, adminComputer = '') => {
    setIsAuthenticated(true);
    setAdminID(AdminID);
    setAdminComputer(adminComputer);
    localStorage.setItem('token', token); // Store token in local storage
    console.log(`${AdminID} Logged in successfully`);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const sessionID = localStorage.getItem('sessionID');

      await apiPost('/api/logout', { sessionID }, { credentials: true });

      localStorage.removeItem('token');
      setIsAuthenticated(false);
      setAdminID('');
      setAdminComputer('');
      console.log('Successfully logged out and session destroyed.');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Show loading screen until setup status and initial authentication check is complete
  if (setupComplete === null || !initialCheck) {
    return <div>Loading...</div>;
  }

  return (
    <ErrorBoundary fallbackMessage="Application failed to load">
      <Suspense fallback={<div className="loading-spinner" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}>Loading Application...</div>}>
        <Router>
          <div className="App">
            <Routes>
          {/* Setup Routes - Only show if setup is not complete */}
          {!setupComplete && (
            <>
              <Route path="/" element={<SplashScreen />} />
              <Route path="/setup-wizard" element={<SetupWizard />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          )}
          
          {/* Main Application Routes - Only show if setup is complete */}
          {setupComplete && (
            <>
              {isAuthenticated ? (
                <>
                  <Route path="/" element={<AuthenticatedLayout AdminID={AdminID} onLogout={handleLogout} permissions={permissions}><ErrorBoundary fallbackMessage="Dashboard failed to load"><Suspense fallback={<div className="loading-spinner">Loading Dashboard...</div>}><ModernDashboard permissions={permissions} adminID={AdminID} adminComputer={adminComputer} /></Suspense></ErrorBoundary></AuthenticatedLayout>} />
                  <Route path="/dashboard" element={<AuthenticatedLayout AdminID={AdminID} onLogout={handleLogout} permissions={permissions}><ErrorBoundary fallbackMessage="Dashboard failed to load"><Suspense fallback={<div className="loading-spinner">Loading Dashboard...</div>}><ModernDashboard permissions={permissions} adminID={AdminID} adminComputer={adminComputer} /></Suspense></ErrorBoundary></AuthenticatedLayout>} />
                  <Route path="/ad-object" element={<AuthenticatedLayout AdminID={AdminID} onLogout={handleLogout} permissions={permissions}><ErrorBoundary fallbackMessage="AD Properties failed to load"><Suspense fallback={<div className="loading-spinner">Loading AD Properties...</div>}><ModernADProperties permissions={permissions} /></Suspense></ErrorBoundary></AuthenticatedLayout>} />
                  <Route path="/ad-object/:adObjectID" element={<AuthenticatedLayout AdminID={AdminID} onLogout={handleLogout} permissions={permissions}><ErrorBoundary fallbackMessage="AD Properties failed to load"><Suspense fallback={<div className="loading-spinner">Loading AD Properties...</div>}><ModernADProperties permissions={permissions} /></Suspense></ErrorBoundary></AuthenticatedLayout>} />
                  <Route path="/Profile" element={<AuthenticatedLayout AdminID={AdminID} onLogout={handleLogout} permissions={permissions}><ErrorBoundary fallbackMessage="Profile page failed to load"><Suspense fallback={<div className="loading-spinner">Loading Profile...</div>}><Profile permissions={permissions} /></Suspense></ErrorBoundary></AuthenticatedLayout>} />
                  <Route path="/configure" element={<AuthenticatedLayout AdminID={AdminID} onLogout={handleLogout} permissions={permissions}><ErrorBoundary fallbackMessage="Configuration page failed to load"><Suspense fallback={<div className="loading-spinner">Loading Configuration...</div>}><ModernConfigure permissions={permissions} /></Suspense></ErrorBoundary></AuthenticatedLayout>} />
                  <Route path="/setup" element={<AuthenticatedLayout AdminID={AdminID} onLogout={handleLogout} permissions={permissions}><ErrorBoundary fallbackMessage="Setup page failed to load"><Suspense fallback={<div className="loading-spinner">Loading Setup...</div>}><Setup /></Suspense></ErrorBoundary></AuthenticatedLayout>} />
                  <Route path="*" element={<Navigate to="/dashboard" />} />
                </>
              ) : (
                <>
                  <Route path="/" element={<Login onLogin={handleLogin} />} />
                  <Route path="/login" element={<Login onLogin={handleLogin} />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </>
              )}
            </>
          )}
            </Routes>
          </div>
        </Router>
      </Suspense>
    </ErrorBoundary>
  );
}

function HeaderWrapper({ AdminID, onLogout }) {
  const navigate = useNavigate();

  const handleFormSubmit = async (adObjectID) => {
    try {
      await apiPost('/api/fetch-adobject', { adObjectID });
      navigate(`/ad-object/${adObjectID}`); // Navigate to the AD properties page with adObjectID in the URL
    } catch (error) {
      console.error('Error fetching AD object properties:', error);
    }
  };

  return <Header AdminID={AdminID} onLogout={onLogout} onFormSubmit={handleFormSubmit} />;
}

function AuthenticatedLayout({ AdminID, onLogout, permissions, children }) {
  const [isTerminalMinimized, setIsTerminalMinimized] = useState(false);

  const toggleTerminal = () => {
    setIsTerminalMinimized(!isTerminalMinimized);
  };

  return (
    <div className="app-layout">
      <div className="app-main-content">
        <HeaderWrapper AdminID={AdminID} onLogout={onLogout} />
        <Navbar permissions={permissions} />
        <div className="app-page-content">
          {children}
        </div>
      </div>
      <div className={`app-terminal-section ${isTerminalMinimized ? 'minimized' : ''}`}>
        {isTerminalMinimized ? (
          <div className="terminal-minimized-bar" onClick={toggleTerminal}>
            <span className="terminal-icon">⚡</span>
            <span>Live Terminal (Click to expand)</span>
            <span className="expand-icon">▲</span>
          </div>
        ) : (
          <Terminal onToggle={toggleTerminal} />
        )}
      </div>
    </div>
  );
}

export default App;