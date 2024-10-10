import React, { useEffect, useState } from 'react';
import socketIOClient from 'socket.io-client';
import './styles.css'; // Import the CSS file
import Header from './Header';
import Navbar from './Navbar';
import Content from './Content';
import Login from './pages/Login';

// Determine the backend server URL based on the current hostname
const ENDPOINT = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'http://172.25.129.95:3001'; // Update to your remote backend address

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [AdminID, setAdminID] = useState(''); // Updated to AdminID
  const [initialCheck, setInitialCheck] = useState(false); // State to track initial authentication check

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
      .then(response => {
        console.log('Token verification response:', response);
        return response.json();
      })
      .then(data => {
        if (data.AdminID) { // Updated to AdminID
          setIsAuthenticated(true);
          setAdminID(data.AdminID); // Updated to AdminID
        }
        setInitialCheck(true); // Set initial check to true after verification
      })
      .catch(error => {
        console.error('Session verification failed:', error);
        setInitialCheck(true); // Set initial check to true even if verification fails
      });
    } else {
      setInitialCheck(true); // Set initial check to true if no token is found
    }
  }, []);

  const handleLogin = async (AdminID, password) => { // Updated to AdminID
    try {
      const response = await fetch(`${ENDPOINT}/api/auth/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ AdminID, password }) // Updated to AdminID
      });
      const data = await response.json();
      localStorage.setItem('token', data.token); // Store token in localStorage
      setIsAuthenticated(true);
      setAdminID(AdminID); // Updated to AdminID
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token'); // Remove token from localStorage
    setIsAuthenticated(false);
    setAdminID(''); // Updated to AdminID
  };

  const showSection = (sectionId) => {
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
      // Show the dashboard section by default
      showSection('dashboard');

      // Handle form submission with REST
      const fetchUserForm = document.getElementById('fetchUserForm');
      if (fetchUserForm) {
        fetchUserForm.addEventListener('submit', async function(event) {
          event.preventDefault(); // Prevent the default form submission
          // Show the User Properties view immediately
          showSection('user-prop');
          // Show the loading screen
          document.getElementById('loadingScreen').style.display = 'block';
          const form = event.target;
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());
          try {
            const response = await fetch(form.action, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
              },
              body: JSON.stringify(data)
            });
            const result = await response.text();
            // Update the user properties section with the response data
            document.getElementById('userPropertiesContainer').innerHTML = result;
          } catch (error) {
            console.error('Error:', error);
          } finally {
            // Hide the loading screen
            document.getElementById('loadingScreen').style.display = 'none';
          }
        });
      }

      // Handle test form submission with REST
      const testForm = document.getElementById('testForm');
      if (testForm) {
        testForm.addEventListener('submit', async function(event) {
          event.preventDefault(); // Prevent the default form submission
          const form = event.target;
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());
          try {
            const response = await fetch(form.action, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
              },
              body: JSON.stringify(data)
            });
            const result = await response.text();
            // Update the test output section with the response data
            document.getElementById('testOutputContainer').innerHTML = result;
          } catch (error) {
            console.error('Error:', error);
          }
        });
      }
    }
  }, [isAuthenticated]);

  if (!initialCheck) {
    return <div>Loading...</div>; // Show a loading indicator while the initial check is in progress
  }

  return (
    <div className="App">
      {isAuthenticated ? (
        <>
          <Header AdminID={AdminID} onLogout={handleLogout} /> {/* Updated to AdminID */}
          <Navbar showSection={showSection} />
          <Content />
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;