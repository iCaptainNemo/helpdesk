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
  const [section, setSection] = useState('dashboard'); // Track the current section
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

  // const handleWindowsLogin = async () => {
  //   try {
  //     const response = await fetch(`${ENDPOINT}/api/auth/windows-login`, {
  //       method: 'GET',
  //       credentials: 'include',
  //     });
  //     const data = await response.json();
  //     if (data.token) {
  //       localStorage.setItem('token', data.token);
  //       setIsAuthenticated(true);
  //       setAdminID(data.AdminID);
  //     } else {
  //       console.error('Login failed: No token received');
  //     }
  //   } catch (error) {
  //     console.error('Login failed:', error);
  //   }
  // };

  const handleLogin = async (AdminID, password) => {
    try {
      const response = await fetch(`${ENDPOINT}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ AdminID, password }),
      });
      const data = await response.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        setIsAuthenticated(true);
        setAdminID(data.AdminID);
      } else {
        console.error('Login failed: No token received');
      }
    } catch (error) {
      console.error('Login failed:', error);
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
    } catch (error) {
      console.error('Error fetching AD object properties:', error);
    }
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
          <Navbar setCurrentView={setSection} />
          {renderSection()}
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
