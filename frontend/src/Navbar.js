import React from 'react';

const Navbar = ({ setCurrentView }) => (
  <div className="navbar">
    <button className="button-link" onClick={() => setCurrentView('dashboard')}>Dashboard</button>
    <button className="button-link" onClick={() => setCurrentView('user-prop')}>User Properties</button>
    <button className="button-link" onClick={() => setCurrentView('placeholder')}>Placeholder</button>
  </div>
);

export default Navbar;