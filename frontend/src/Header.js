import React from 'react';

const Header = () => {
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    const userID = event.target.userID.value;

    try {
      const response = await fetch('/api/fetch-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userID })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.text();
      document.getElementById('userPropertiesContainer').innerHTML = `<pre>${data}</pre>`;
    } catch (error) {
      console.error('Error fetching user properties:', error);
      document.getElementById('userPropertiesContainer').innerHTML = 'Error fetching user properties';
    }
  };

  return (
    <div className="header">
      <h1>Helpdesk</h1>
      <div className="form-container">
        <form id="fetchUserForm" onSubmit={handleFormSubmit}>
          <label htmlFor="userID">AD Object: </label>
          <input type="text" id="userID" name="userID" />
          <button type="submit">Go</button>
        </form>
      </div>
    </div>
  );
};

export default Header;