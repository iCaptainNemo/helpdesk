import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import socketIOClient from 'socket.io-client';
import './styles.css'; // Import the CSS file
import Header from './Header';
import Navbar from './Navbar';
import Dashboard from './pages/Dashboard';
import ADProperties from './pages/ADProperties'; // Update import
import Placeholder from './pages/Placeholder';
import Login from './pages/Login';
import Configure from './pages/Configure'; // Import the Configure page

// Always use the backend server IP address
const ENDPOINT = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Track authentication status
  const [AdminID, setAdminID] = useState(''); // Store AdminID from the server
  const [initialCheck, setInitialCheck] = useState(false); // Track the first authentication check

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

  // Verify token and check authentication status
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${ENDPOINT}/api/auth/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
        .then(response => response.json())
        .then(data => {
          if (data.AdminID) {
            setIsAuthenticated(true);
            setAdminID(data.AdminID);
          }
          setInitialCheck(true);
        })
        .catch(error => {
          console.error('Session verification failed:', error);
          setInitialCheck(true);
        });
    } else {
      setInitialCheck(true);
    }
  }, []);

  // Handle login
  const handleLogin = (AdminID, token) => {
    setIsAuthenticated(true);
    setAdminID(AdminID);
    localStorage.setItem('token', token); // Store token in local storage
    console.log(`${AdminID} Logged in successfully`);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const sessionID = localStorage.getItem('sessionID');

      const response = await fetch(`${ENDPOINT}/api/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
        },
        body: JSON.stringify({ sessionID })
      });

      if (response.ok) {
        localStorage.removeItem('token');
        localStorage.removeItem('currentADObjectID'); // Remove current AD object ID from local storage
        setIsAuthenticated(false);
        setAdminID('');
        console.log('Successfully logged out and session destroyed.');
      } else {
        console.error('Logout failed: Network response was not ok');
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Show loading screen until initial authentication check is complete
  if (!initialCheck) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        {isAuthenticated ? (
          <>
            <HeaderWrapper AdminID={AdminID} onLogout={handleLogout} />
            <Navbar />
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/ad-object/:adObjectID" element={<ADProperties />} /> {/* Update route */}
              <Route path="/placeholder" element={<Placeholder />} />
              <Route path="/configure" element={<Configure />} />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </>
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </div>
    </Router>
  );
}

function HeaderWrapper({ AdminID, onLogout }) {
  const navigate = useNavigate();

  const handleFormSubmit = async (adObjectID) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${ENDPOINT}/api/fetch-adobject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ adObjectID }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      localStorage.setItem('currentADObjectID', adObjectID); // Store the current AD object ID in local storage
      navigate(`/ad-object/${adObjectID}`); // Navigate to the AD properties page with adObjectID in the URL
    } catch (error) {
      console.error('Error fetching AD object properties:', error);
    }
  };

  return <Header AdminID={AdminID} onLogout={onLogout} onFormSubmit={handleFormSubmit} />;
}

export default App;