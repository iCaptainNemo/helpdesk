import React from 'react';
import '../styles/Login.css'; // Ensure this path is correct

const Login = ({ onLogin }) => {
  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      const data = await response.json();
      if (data.newUser) {
        alert('New user detected. Please update your details.');
      } else {
        document.cookie = `token=${data.token}; HttpOnly`; // Store token in HTTP-only cookie
        onLogin(data.username);
      }
    } catch (error) {
      console.error('Login failed:', error);
      if (error.message === 'Unauthorized: User not found in Admin table') {
        alert('Login failed: User not found.');
      } else {
        alert(`Login failed: ${error.message}`);
      }
    }
  };

  return (
    <form className="form" autoComplete="off">
      <div className="control">
        <h1>Jarvis Helpdesk Utility</h1>
      </div>
      <button className="btn block-cube block-cube-hover" type="button" onClick={handleLogin}>
        <div className="bg-top">
          <div className="bg-inner"></div>
        </div>
        <div className="bg-right">
          <div className="bg-inner"></div>
        </div>
        <div className="bg">
          <div className="bg-inner"></div>
        </div>
        <div className="text">Log In</div>
      </button>
      <div className="credits">
        <a href="https://codepen.io/marko-zub/" target="_blank" rel="noopener noreferrer">
          My other codepens
        </a>
      </div>
    </form>
  );
};

export default Login;