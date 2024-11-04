import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => (
  <div className="navbar">
    <Link className="button-link" to="/dashboard">Dashboard</Link>
    <Link className="button-link" to="/user-prop">User Properties</Link>
    <Link className="button-link" to="/placeholder">Placeholder</Link>
    <Link className="button-link" to="/configure">Configure</Link>
  </div>
);

export default Navbar;