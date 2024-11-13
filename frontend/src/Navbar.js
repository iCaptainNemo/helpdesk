import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState([]);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch permissions');
        }

        const data = await response.json();
        setPermissions(data.permissions || []); // Ensure permissions is an array
      } catch (error) {
        console.error('Error fetching permissions:', error);
      }
    };

    fetchPermissions();
  }, []);

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
      <Link className="button-link" to="/Profile">Profile</Link>
      {permissions.includes('access_configure_page') && (
        <Link className="button-link" to="/configure">Configure</Link>
      )}
    </div>
  );
};

export default Navbar;