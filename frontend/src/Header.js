import React from 'react';

const Header = () => (
  <div className="header">
    <h1>Helpdesk</h1>
    <div className="form-container">
      <form id="fetchUserForm" action="/fetch-user" method="post">
        <label htmlFor="userID">User ID:</label>
        <input type="text" id="userID" name="userID" />
        <button type="submit">Fetch User</button>
      </form>
    </div>
  </div>
);

export default Header;