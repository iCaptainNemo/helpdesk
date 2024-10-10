import React, { useEffect, useState } from 'react';
import socketIOClient from 'socket.io-client';
import './styles.css'; // Import the CSS file
import Header from './Header';
import Navbar from './Navbar';
import Content from './Content';
import Login from './pages/Login';

// Always use the backend server IP address
const ENDPOINT = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [AdminID, setAdminID] = useState(''); // Store AdminID from the server
  const [initialCheck, setInitialCheck] = useState(false); // Track the first authentication check

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
    // Check token validity on app load
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${ENDPOINT}/api/auth/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        console.log('Token verification response:', response);
        return response.json();
      })
      .then(data => {
        if (data.AdminID) {
          setIsAuthenticated(true);
          setAdminID(data.AdminID);
        }
        setInitialCheck(true); // Complete the initial check after verification
      })
      .catch(error => {
        console.error('Session verification failed:', error);
        setInitialCheck(true); // Complete the initial check even if failed
      });
    } else {
      setInitialCheck(true); // No token found, complete the initial check
    }
  }, []);

  const handleWindowsLogin = async () => {
    // Handle NTLM-based login
    try {
      const response = await fetch(`${ENDPOINT}/api/auth/windows-login`, {
        method: 'GET',
        credentials: 'include', // NTLM requires cookies to be included
      });
      const data = await response.json();
      if (data.token) {
        localStorage.setItem('token', data.token); // Store token in localStorage
        setIsAuthenticated(true);
        setAdminID(data.AdminID);
      } else {
        console.error('Login failed: No token received');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogin = async (AdminID, password) => {
    // Handle LDAP login (assuming this is the structure for LDAP login)
    try {
      const response = await fetch(`${ENDPOINT}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          AdminID,
          password,
        }),
      });
      const data = await response.json();
      if (data.token) {
        localStorage.setItem('token', data.token); // Store token in localStorage
        setIsAuthenticated(true);
        setAdminID(data.AdminID);
      } else {
        console.error('Login failed: No token received');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token'); // Remove token from localStorage
    setIsAuthenticated(false);
    setAdminID(''); // Clear AdminID
  };

  const showSection = (sectionId) => {
    // Display the selected section
    const sections = document.querySelectorAll('.content');
    sections.forEach(section => {
      section.classList.remove('active');
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add('active');
    } else {
      console.error(`Section with ID ${sectionId} not found`);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      // Show dashboard by default after login
      showSection('dashboard');

      // Handle user form submission
      const fetchUserForm = document.getElementById('fetchUserForm');
      if (fetchUserForm) {
        fetchUserForm.addEventListener('submit', async function(event) {
          event.preventDefault();
          showSection('user-prop');
          document.getElementById('loadingScreen').style.display = 'block';
          const form = event.target;
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());
          try {
            const response = await fetch(form.action, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token
              },
              body: JSON.stringify(data)
            });
            const result = await response.text();
            document.getElementById('userPropertiesContainer').innerHTML = result;
          } catch (error) {
            console.error('Error:', error);
          } finally {
            document.getElementById('loadingScreen').style.display = 'none';
          }
        });
      }

      // Handle test form submission
      const testForm = document.getElementById('testForm');
      if (testForm) {
        testForm.addEventListener('submit', async function(event) {
          event.preventDefault();
          const form = event.target;
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());
          try {
            const response = await fetch(form.action, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token
              },
              body: JSON.stringify(data)
            });
            const result = await response.text();
            document.getElementById('testOutputContainer').innerHTML = result;
          } catch (error) {
            console.error('Error:', error);
          }
        });
      }
    }
  }, [isAuthenticated]);

  if (!initialCheck) {
    return <div>Loading...</div>; // Show loading indicator while checking session
  }

  return (
    <div className="App">
      {isAuthenticated ? (
        <>
          <Header AdminID={AdminID} onLogout={handleLogout} />
          <Navbar showSection={showSection} />
          <Content />
          <div id="dashboard" className="content"></div> 
        </>
      ) : (
        <Login onLogin={handleLogin} onWindowsLogin={handleWindowsLogin} />
      )}
    </div>
  );
}

export default App;
