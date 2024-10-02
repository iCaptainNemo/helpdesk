import React from 'react';

const Content = () => (
  <>
    <div className="content" id="dashboard">
      <h2>Dashboard</h2>
      <form id="testForm" action="/test" method="post">
        <button type="submit">Test</button>
      </form>
      <div id="testOutputContainer"></div>
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

export default Content;