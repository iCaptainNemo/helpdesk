import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [logFile, setLogFile] = useState('');
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);

  const handleLogin = async () => {
    const hostname = window.location.hostname; // Get the hostname
    const upperUsername = username.toUpperCase(); // Convert username to uppercase

    try {
      const response = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: upperUsername, // Use the uppercase username
          computerName: hostname, // Use the hostname as the computer name
        }),
      });
      const data = await response.json();
      if (data.newUser) {
        setShowAdditionalFields(true);
      } else {
        alert(`Welcome, ${data.username}`);
        onLogin(data.username);
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleUpdateUser = async () => {
    const upperUsername = username.toUpperCase(); // Convert username to uppercase

    try {
      await fetch('/api/auth/admin/updateUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: upperUsername, // Use the uppercase username
          tempPassword,
          logFile,
        }),
      });
      alert(`Welcome, ${upperUsername}`);
      onLogin(upperUsername);
    } catch (error) {
      console.error('Update user failed:', error);
    }
  };

  return (
    <div>
      <h1>Login</h1>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button onClick={handleLogin}>Admin Login</button>
      {showAdditionalFields && (
        <div>
          <input
            type="password"
            placeholder="Temp Password"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
          />
          <input
            type="text"
            placeholder="Log File Location"
            value={logFile}
            onChange={(e) => setLogFile(e.target.value)}
          />
          <button onClick={handleUpdateUser}>Update User</button>
        </div>
      )}
    </div>
  );
};

export default Login;