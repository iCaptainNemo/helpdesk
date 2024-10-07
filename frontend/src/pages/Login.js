import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');

  const handleLogin = async () => {
    const hostname = window.location.hostname; // Get the hostname

    try {
      const response = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          computerName: hostname, // Use the hostname as the computer name
        }),
      });
      const data = await response.json();
      if (data.newUser) {
        // Prompt for temp password and log file location
        const tempPassword = prompt('Enter temp password:');
        const logFile = prompt('Enter log file location:');
        await fetch('/api/auth/admin/updateUser', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            tempPassword,
            logFile,
          }),
        });
      }
      alert(`Welcome, ${data.username}`);
      onLogin(data.username);
    } catch (error) {
      console.error('Login failed:', error);
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
    </div>
  );
};

export default Login;