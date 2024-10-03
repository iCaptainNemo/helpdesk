import React, { useEffect } from 'react';
import socketIOClient from 'socket.io-client';
import './styles.css'; // Import the CSS file
import Header from './Header';
import Navbar from './Navbar';
import Content from './Content';

const ENDPOINT = "http://localhost:3001";
// Backend server URL
function App() {
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

  const showSection = (sectionId) => {
    const sections = document.querySelectorAll('.content');
    sections.forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
  };

  useEffect(() => {
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
              'Content-Type': 'application/json'
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
              'Content-Type': 'application/json'
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
  }, []);

  return (
    <div className="App">
      <Header />
      <Navbar showSection={showSection} />
      <Content />
    </div>
  );
}

export default App;