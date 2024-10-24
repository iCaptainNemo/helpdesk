import React, { useEffect, useState } from 'react';
import socketIOClient from 'socket.io-client';
import './styles.css'; // Import the CSS file
import Header from './Header';
import Navbar from './Navbar';
import Dashboard from './pages/Dashboard';
import UserProperties from './pages/UserProperties';
import Placeholder from './pages/Placeholder';
import Login from './pages/Login';

// Always use the backend server IP address
const ENDPOINT = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [AdminID, setAdminID] = useState(''); // Store AdminID from the server
  const [initialCheck, setInitialCheck] = useState(false); // Track the first authentication check
  const [section, setSection] = useState(localStorage.getItem('currentView') || 'dashboard'); // Track the current section
  const [adObjectData, setAdObjectData] = useState(''); // Store AD object data

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

  useEffect(() => {
    const currentADObjectID = localStorage.getItem('currentADObjectID');
    if (currentADObjectID) {
      fetchADObject(currentADObjectID);
    }
  }, []);

  const handleLogin = (AdminID, AdminComputer, token) => {
    setIsAuthenticated(true);
    setAdminID(AdminID);
    localStorage.setItem('token', token); // Store token in local storage
    console.log(`Logged in as ${AdminID} on ${AdminComputer}`);
  };

  const handlePasswordUpdate = async (AdminID) => {
    const newPassword = prompt('Enter your new password:');
    const confirmPassword = prompt('Confirm your new password:');

    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const response = await fetch(`${ENDPOINT}/api/auth/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ AdminID, newPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      alert('Password updated successfully. Please log in with your new password.');
    } catch (error) {
      console.error('Password update failed:', error);
      alert(`Password update failed: ${error.message}`);
    }
  };

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
        localStorage.removeItem('sessionID');
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

      const data = await response.text();
      setAdObjectData(data);
      setSection('user-prop');
      localStorage.setItem('currentView', 'user-prop'); // Store the current view in local storage
      localStorage.setItem('currentADObjectID', adObjectID); // Store the current AD object ID in local storage
    } catch (error) {
      console.error('Error fetching AD object properties:', error);
    }
  };

  const fetchADObject = async (adObjectID) => {
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

      const data = await response.text();
      setAdObjectData(data);
      setSection('user-prop');
      localStorage.setItem('currentView', 'user-prop'); // Store the current view in local storage
    } catch (error) {
      console.error('Error fetching AD object properties:', error);
    }
  };

  const handleSectionChange = (newSection) => {
    setSection(newSection);
    localStorage.setItem('currentView', newSection); // Store the current view in local storage
  };

  const renderSection = () => {
    switch (section) {
      case 'dashboard':
        return <Dashboard />;
      case 'user-prop':
        return <UserProperties adObjectData={adObjectData} />;
      case 'placeholder':
        return <Placeholder />;
      default:
        return <Dashboard />;
    }
  };

  if (!initialCheck) {
    return <div>Loading...</div>;
  }

  return (
    <div className="App">
      {isAuthenticated ? (
        <>
          <Header AdminID={AdminID} onLogout={handleLogout} onFormSubmit={handleFormSubmit} />
          <Navbar setCurrentView={handleSectionChange} />
          {renderSection()}
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;