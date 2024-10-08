import React from 'react';

const Header = ({ username }) => {
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    const adObjectID = event.target.adObjectID.value;

    try {
      const response = await fetch('/api/fetch-adobject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}` // Include token in Authorization header
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
      <h1>Helpdesk - Welcome, {username}</h1>
      <div className="form-container">
        <form id="fetchAdObjectForm" onSubmit={handleFormSubmit}>
          <label htmlFor="adObjectID">AD Object: </label>
          <input type="text" id="adObjectID" name="adObjectID" />
          <button type="submit">Go</button>
        </form>
      </div>
    </div>
  );
};

export default Header;