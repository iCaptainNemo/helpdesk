import React from 'react';

const Header = ({ AdminID, onLogout }) => {
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    const adObjectID = event.target.adObjectID.value;
    console.log('AD Object ID:', adObjectID); // Debug log

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }
      console.log('Token:', token); // Debug log

      const response = await fetch('/api/fetch-adobject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Include token in Authorization header
        },
        body: JSON.stringify({ adObjectID })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.text();
      document.getElementById('userPropertiesContainer').innerHTML = `<pre>${data}</pre>`;
    } catch (error) {
      console.error('Error fetching AD object properties:', error);
      document.getElementById('userPropertiesContainer').innerHTML = 'Error fetching AD object properties';
    }
  };

  return (
    <div className="header">
      <h1>Helpdesk - Welcome, {AdminID}</h1>
      <div className="form-container">
        <form id="fetchAdObjectForm" onSubmit={handleFormSubmit}>
          <label htmlFor="adObjectID">AD Object: </label>
          <input type="text" id="adObjectID" name="adObjectID" />
          <button type="submit">Go</button>
        </form>
      </div>
      <button className="logout-button" onClick={onLogout}>Logout</button>
    </div>
  );
};

export default Header;