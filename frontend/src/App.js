import React, { useEffect, useState } from 'react';
import axios from 'axios';
import socketIOClient from 'socket.io-client';
import './styles.css'; // Import the CSS file
import Header from './Header';
import Navbar from './Navbar';
import Content from './Content';

const ENDPOINT = "http://localhost:3001"; // Backend server URL

function App() {
  const [helloWorldMessage, setHelloWorldMessage] = useState('');

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

  const fetchHelloWorld = async () => {
    try {
      const response = await axios.get(`${ENDPOINT}/api/hello-world`);
      setHelloWorldMessage(response.data.message);
    } catch (error) {
      console.error('Error fetching hello world message:', error);
    }
  };

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

    // Handle form submission with AJAX
    document.getElementById('fetchUserForm').addEventListener('submit', function(event) {
      event.preventDefault(); // Prevent the default form submission
      // Show the User Properties view immediately
      showSection('user-prop');
      // Show the loading screen
      document.getElementById('loadingScreen').style.display = 'block';
      const form = event.target;
      const formData = new FormData(form);
      fetch(form.action, {
        method: form.method,
        body: formData
      })
      .then(response => response.text())
      .then(data => {
        // Update the user properties section with the response data
        document.getElementById('userPropertiesContainer').innerHTML = data;
        // Hide the loading screen
        document.getElementById('loadingScreen').style.display = 'none';
      })
      .catch(error => {
        console.error('Error:', error);
        // Hide the loading screen in case of error
        document.getElementById('loadingScreen').style.display = 'none';
      });
    });

    // Handle test form submission with AJAX
    document.getElementById('testForm').addEventListener('submit', function(event) {
      event.preventDefault(); // Prevent the default form submission
      const form = event.target;
      const formData = new FormData(form);
      fetch(form.action, {
        method: form.method,
        body: formData
      })
      .then(response => response.text())
      .then(data => {
        // Update the test output section with the response data
        document.getElementById('testOutputContainer').innerHTML = data;
      })
      .catch(error => {
        console.error('Error:', error);
      });
    });
  }, []);

  return (
    <div className="App">
      <Header />
      <Navbar showSection={showSection} />
      <Content />
      <header className="App-header">
        <h1>Helpdesk GUI</h1>
        <button onClick={fetchHelloWorld}>Fetch Hello World</button>
        {helloWorldMessage && <pre>{helloWorldMessage}</pre>}
      </header>
    </div>
  );
}

export default App;