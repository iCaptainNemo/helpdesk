import React from 'react';

const Navbar = ({ showSection }) => (
  <div className="navbar">
    <button className="button-link" onClick={() => showSection('dashboard')}>Dashboard</button>
    <button className="button-link" onClick={() => showSection('user-prop')}>User Properties</button>
    <button className="button-link" onClick={() => showSection('placeholder')}>Placeholder</button>
  </div>
);

export default Navbar;