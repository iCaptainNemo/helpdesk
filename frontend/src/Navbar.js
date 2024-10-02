import React from 'react';

const Navbar = ({ showSection }) => (
  <div className="navbar">
    <a onClick={() => showSection('dashboard')}>Dashboard</a>
    <a onClick={() => showSection('user-prop')}>User Properties</a>
    <a onClick={() => showSection('placeholder')}>Placeholder</a>
  </div>
);

export default Navbar;