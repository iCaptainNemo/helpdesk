import React from 'react';

const Content = () => {
  const handleHelloWorldButtonClick = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/hello-world', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
        }
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      document.getElementById('helloWorldOutputContainer').innerText = data.message;
    } catch (error) {
      console.error('Error fetching hello world output:', error);
      document.getElementById('helloWorldOutputContainer').innerText = 'Error fetching hello world output';
    }
  };

  const handleTokenCheck = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
        }
      });

      if (!response.ok) {
        throw new Error('Token verification failed');
      }

      const data = await response.json();
      document.getElementById('tokenCheckOutput').innerText = 'Token is valid: ' + JSON.stringify(data);
    } catch (error) {
      console.error('Error verifying token:', error);
      document.getElementById('tokenCheckOutput').innerText = 'Error verifying token';
    }
  };

  return (
    <>
      <div className="content" id="dashboard">
        <h2>Dashboard</h2>
        <form id="helloWorldForm" onSubmit={handleHelloWorldButtonClick}>
          <button type="submit">Test</button>
        </form>
        <div id="helloWorldOutputContainer"></div>
      </div>

      <div className="content" id="user-prop">
        <h2>User Properties</h2>
        <div className="loading-screen" id="loadingScreen">Loading...</div>
        <div id="userPropertiesContainer"></div>
      </div>

      <div className="content" id="placeholder">
        <h2>Placeholder</h2>
        <p>This is a placeholder for a different view.</p>
        <form id="tokenCheckForm" onSubmit={handleTokenCheck}>
          <button type="submit">Check Token</button>
        </form>
        <div id="tokenCheckOutput"></div>
      </div>
    </>
  );
};

export default Content;