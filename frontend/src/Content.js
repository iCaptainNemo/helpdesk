import React from 'react';
import axios from 'axios';

const Content = () => {
  const handleHelloWorldButtonClick = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post('/api/hello-world');
      document.getElementById('helloWorldOutputContainer').innerText = response.data.message;
    } catch (error) {
      console.error('Error fetching hello world output:', error);
      document.getElementById('helloWorldOutputContainer').innerText = 'Error fetching hello world output';
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
      </div>
    </>
  );
};

export default Content;