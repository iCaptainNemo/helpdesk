import React, { useState, useEffect } from 'react';

const Login = ({ onLogin }) => {
  const [tempPassword, setTempPassword] = useState('');
  const [logFile, setLogFile] = useState('');
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);

  useEffect(() => {
    const fetchUsername = async () => {
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
          setShowAdditionalFields(true);
        } else {
          alert(`Welcome, ${data.username}`);
          document.cookie = `token=${data.token}; HttpOnly`; // Store token in HTTP-only cookie
          onLogin(data.username);
        }
      } catch (error) {
        console.error('Login failed:', error);
        alert(`Login failed: ${error.message}`);
      }
    };

    fetchUsername();
  }, [onLogin]);

  const handleUpdateUser = async () => {
    try {
      const response = await fetch('/api/auth/admin/updateUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}` // Include token in Authorization header
        },
        body: JSON.stringify({
          tempPassword,
          logFile,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      await response.json(); // Removed unused variable 'data'
      alert('User updated successfully');
      onLogin();
    } catch (error) {
      console.error('Update user failed:', error);
      alert(`Update user failed: ${error.message}`);
    }
  };

  return (
    <div>
      <h1>Login</h1>
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