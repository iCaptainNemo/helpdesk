import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Setup.css'; // Import the CSS file

const Setup = () => {
  const [formData, setFormData] = useState({
    PORT: '',
    REACT_APP_API_KEY: '',
    DB_PATH: '',
    SESSION_SECRET: '',
    JWT_SECRET: '',
    FRONTEND_URL_1: '',
    FRONTEND_URL_2: '',
    BACKEND_URL: '',
    LOCKED_OUT_USERS_REFRESH_INTERVAL: '',
    SERVER_STATUS_REFRESH_INTERVAL: '',
    SUBNET_PATTERN: '',
    JWT_EXPIRATION: '',
    LOGFILE: '',
    AD_GROUPS: '',
    TEMP_PASSWORD: '',
    SUPER_ADMIN_ID: '',
    SUPER_ADMIN_PASSWORD: ''
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to save environment variables');
      }

      alert('Environment variables and super admin created successfully');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving environment variables:', error);
      alert('Error saving environment variables');
    }
  };

  return (
    <div className="setupContainer">
      <h2>Setup Environment Variables and Super Admin</h2>
      <form onSubmit={handleSubmit}>
        {Object.keys(formData).map((key) => (
          <div key={key} className="formGroup">
            <label htmlFor={key}>{key}</label>
            <input
              type="text"
              id={key}
              name={key}
              value={formData[key]}
              onChange={handleChange}
              required
            />
          </div>
        ))}
        <button type="submit" className="setupButton">Save</button>
      </form>
    </div>
  );
};

export default Setup;