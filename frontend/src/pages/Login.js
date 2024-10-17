import React, { useState, useEffect } from 'react';
import '../styles/Login.css'; // Ensure this path is correct

const Login = ({ onLogin, onWindowsLogin }) => {
  const [sAMAccountName, setSAMAccountName] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setSAMAccountName(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async () => {
    const upperCaseSAMAccountName = sAMAccountName.toUpperCase(); // Convert to uppercase
    console.log(`Attempting login with sAMAccountName: ${upperCaseSAMAccountName}`); // Debug log

    if (!upperCaseSAMAccountName) {
      console.error('Empty sAMAccountName provided');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          AdminID: upperCaseSAMAccountName, // Use uppercase AdminID
          password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      const data = await response.json();
      console.log('Login successful, token:', data.token); // Debug log
      localStorage.setItem('token', data.token); // Store token in local storage
      localStorage.setItem('sessionID', data.sessionID); // Store session ID in local storage
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', upperCaseSAMAccountName); // Store uppercase username
      } else {
        localStorage.removeItem('rememberedUsername');
      }
      onLogin(data.AdminID);
    } catch (error) {
      console.error('Login failed:', error);
      if (error.message === 'Invalid ID or password') {
        alert('Invalid ID or password');
      } else if (error.message === 'No account found') {
        alert('No account found');
      } else if (error.message.includes('Unexpected token')) {
        alert('Server error: Invalid response format');
      } else {
        alert(`Login failed: ${error.message}`);
      }
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleLogin(); // Call the handleLogin function for LDAP login
  };

  return (
    <div>
      <form className="form" autoComplete="off" onSubmit={handleSubmit}>
        <div className="control">
          <h1>Jarvis Helpdesk UI</h1>
        </div>
        <div className="control block-cube block-input">
          <input
            type="text"
            placeholder="Username"
            value={sAMAccountName}
            onChange={(e) => setSAMAccountName(e.target.value)}
          />
          <div className="bg-top">
            <div className="bg-inner"></div>
          </div>
          <div className="bg-right">
            <div className="bg-inner"></div>
          </div>
          <div className="bg">
            <div className="bg-inner"></div>
          </div>
        </div>
        <div className="control block-cube block-input">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="bg-top">
            <div className="bg-inner"></div>
          </div>
          <div className="bg-right">
            <div className="bg-inner"></div>
          </div>
          <div className="bg">
            <div className="bg-inner"></div>
          </div>
        </div>
        <button className="btn block-cube block-cube-hover" type="submit">
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
        <div className="control remember-me">
          <label>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember Me
          </label>
        </div>
      </form>
      {/* <div className="or-divider">
        <span>Or</span>
      </div> */}
      {/* <button className="btn block-cube block-cube-hover" onClick={handleWindowsLogin} style={{ width: '100%' }}>
        <div className="bg-top">
          <div className="bg-inner"></div>
        </div>
        <div className="bg-right">
          <div className="bg-inner"></div>
        </div>
        <div className="bg">
          <div className="bg-inner"></div>
        </div>
        <div className="text">Login with Windows</div>
      </button> */}
    </div>
  );
};

export default Login;
