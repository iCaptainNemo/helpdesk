import React from 'react';

const Header = ({ AdminID, onLogout, onFormSubmit }) => {
  const handleFormSubmit = (event) => {
    event.preventDefault();
    const adObjectID = event.target.adObjectID.value;
    console.log('AD Object ID:', adObjectID); // Debug log

    if (!adObjectID) {
      console.error('AD Object ID is empty');
      return;
    }

    onFormSubmit(adObjectID);
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