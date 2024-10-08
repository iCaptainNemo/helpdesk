import React, { useEffect, useState } from 'react';
import socketIOClient from 'socket.io-client';
import './styles.css'; // Import the CSS file
import Header from './Header';
import Navbar from './Navbar';
import Content from './Content';
import Login from './pages/Login';

const ENDPOINT = "http://localhost:3001"; // Backend server URL

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [initialCheck, setInitialCheck] = useState(false); // State to track initial authentication check

  useEffect(() => {
    const socket = socketIOClient(ENDPOINT);

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
    if (token) {
      fetch('http://localhost:3001/api/auth/verifySession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include' // Include credentials (cookies) in the request
      })
      .then(response => response.json())
      .then(data => {
        if (data.username) {
          setIsAuthenticated(true);
          setUsername(data.username);
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

  const handleLogin = async (username, computerName) => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, computerName }),
        credentials: 'include' // Include credentials (cookies) in the request
      });
      const data = await response.json();
      if (data.newUser) {
        const tempPassword = prompt('Enter temp password:');
        const logFile = prompt('Enter log file location:');
        await fetch('http://localhost:3001/api/auth/admin/updateUser', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, tempPassword, logFile }),
          credentials: 'include' // Include credentials (cookies) in the request
        });
      }
      document.cookie = `token=${data.token}; HttpOnly`; // Store token in HTTP-only cookie
      setIsAuthenticated(true);
      setUsername(username);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => {
    fetch('http://localhost:3001/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Include credentials (cookies) in the request
    })
    .then(() => {
      setIsAuthenticated(false);
      setUsername('');
    })
    .catch(error => {
      console.error('Logout failed:', error);
    });
  };

  const showSection = (sectionId) => {
    const sections = document.querySelectorAll('.content');
    sections.forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
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
                'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}` // Include token in Authorization header
              },
              body: JSON.stringify(data),
              credentials: 'include' // Include credentials (cookies) in the request
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
                'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}` // Include token in Authorization header
              },
              body: JSON.stringify(data),
              credentials: 'include' // Include credentials (cookies) in the request
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
          <Header username={username} onLogout={handleLogout} />
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