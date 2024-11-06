import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();

  const handleADPropertiesClick = () => {
    const currentADObjectID = localStorage.getItem('currentADObjectID');
    if (currentADObjectID) {
      navigate(`/ad-object/${currentADObjectID}`);
    } else {
      navigate('/ad-object');
    }
  };

  return (
    <div className="navbar">
      <Link className="button-link" to="/dashboard">Dashboard</Link>
      <button className="button-link" onClick={handleADPropertiesClick}>AD Properties</button>
      <Link className="button-link" to="/placeholder">Placeholder</Link>
      <Link className="button-link" to="/configure">Configure</Link>
    </div>
  );
};

export default Navbar;