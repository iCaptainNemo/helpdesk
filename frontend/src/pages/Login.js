import React, { useState, useEffect } from 'react';
import '../styles/Login.css'; // Ensure this path is correct

const Login = ({ onLogin }) => {
  const [AdminID, setAdminID] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isPasswordUpdateRequired, setIsPasswordUpdateRequired] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setAdminID(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async () => {
    const upperCaseAdminID = AdminID.toUpperCase(); // Convert to uppercase
    console.log(`Attempting login with AdminID: ${upperCaseAdminID}`); // Debug log

    if (!upperCaseAdminID) {
      console.error('Empty AdminID provided');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          AdminID: upperCaseAdminID, // Use uppercase AdminID
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
      if (rememberMe) {
        localStorage.setItem('AdminID', upperCaseAdminID); // Store uppercase username
      } else {
        localStorage.removeItem('AdminID');
      }
      onLogin(data.AdminID, data.AdminComputer, data.token); // Pass AdminComputer and token to onLogin
    } catch (error) {
      console.error('Login failed:', error);
      if (error.message === 'Password needs to be updated') {
        setIsPasswordUpdateRequired(true);
      } else if (error.message === 'Invalid ID or password') {
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

  const handlePasswordUpdate = async () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          AdminID,
          newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      alert('Password updated successfully. Please log in with your new password.');
      setIsPasswordUpdateRequired(false);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Password update failed:', error);
      alert(`Password update failed: ${error.message}`);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isPasswordUpdateRequired) {
      handlePasswordUpdate();
    } else {
      handleLogin();
    }
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
            value={AdminID}
            onChange={(e) => setAdminID(e.target.value)}
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
        {!isPasswordUpdateRequired && (
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
        )}
        {isPasswordUpdateRequired && (
          <>
            <div className="control block-cube block-input">
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
          </>
        )}
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
          <div className="text">{isPasswordUpdateRequired ? 'Update Password' : 'Log In'}</div>
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
    </div>
  );
};

export default Login;