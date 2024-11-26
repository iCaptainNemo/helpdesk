import React, { useEffect, useState, useMemo } from 'react';
import '../styles/UserStatusTable.css';
import ScriptButton from './ScriptButton'; // Import the ScriptButton component

const UserStatusTable = ({ adObjectID, permissions }) => {
  const [userAccountStatus, setUserAccountStatus] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(true); // State to control auto-refresh
  const userAccountStatusProperties = useMemo(() => [
    'Enabled',
    'LockedOut',
    'badPasswordTime',
    'badPwdCount',
    'PasswordExpired',
    'pwdLastSet'
  ], []);

  useEffect(() => {
    let isMounted = true; // Track if the component is mounted

    const fetchUserAccountStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        const command = `Get-ADUser -Identity ${adObjectID} -Properties ${userAccountStatusProperties.join(',')}`;
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ command }),
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        if (isMounted) {
          setUserAccountStatus(data);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error fetching user account status:', error);
        }
      }
    };

    fetchUserAccountStatus();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchUserAccountStatus, 5000); // Refresh every 5 seconds
    }

    return () => {
      isMounted = false; // Cleanup function to set isMounted to false
      clearInterval(interval); // Cleanup interval on component unmount
    };
  }, [adObjectID, autoRefresh, userAccountStatusProperties]);

  const handleUnlockSuccess = (result) => {
    if (result.message.includes('Unlocked')) {
      setUserAccountStatus((prevStatus) => ({
        ...prevStatus,
        LockedOut: false,
      }));
    }
  };

  const formatValue = (key, value) => {
    if (typeof value === 'boolean') {
      let backgroundColor;
      if (key === 'LockedOut') {
        backgroundColor = value ? 'red' : 'green';
        return (
          <div className="boolean-value" style={{ backgroundColor }}>
            {value ? (
              permissions.includes('execute_script') ? (
                <ScriptButton
                  scriptName="unlocker"
                  params={{ userID: adObjectID }}
                  buttonText="Locked"
                  onSuccess={handleUnlockSuccess}
                  className="script-button initial"
                />
              ) : (
                <button className="script-button grey" disabled>
                  Locked
                </button>
              )
            ) : (
              'False'
            )}
          </div>
        );
      } else if (key === 'PasswordExpired') {
        backgroundColor = value ? 'red' : 'green';
      } else {
        backgroundColor = value ? 'green' : 'red';
      }
      return (
        <div className="boolean-value" style={{ backgroundColor }}>
          {value ? 'True' : 'False'}
        </div>
      );
    } else if (key === 'badPasswordTime' || key === 'pwdLastSet') {
      return formatDate(value);
    } else if (Array.isArray(value)) {
      return value.join(', ');
    } else if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    } else if (value === null) {
      return 'N/A';
    } else {
      return value;
    }
  };

  const formatDate = (fileTime) => {
    const epochDiff = 11644473600000; // Difference between Unix epoch and Windows epoch in milliseconds
    const date = new Date((parseInt(fileTime, 10) / 10000) - epochDiff);
    return date.toLocaleString(); // Use toLocaleString for a readable format
  };

  const calculatePasswordAge = (pwdLastSet) => {
    if (!pwdLastSet) return 'N/A';
    const epochDiff = 11644473600000; // Difference between Unix epoch and Windows epoch in milliseconds
    const lastSetDate = new Date((parseInt(pwdLastSet, 10) / 10000) - epochDiff);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - lastSetDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  };

  return (
    <div className="user-status-table-container">
      <table className="user-account-status-table">
        <thead>
          <tr>
            <th colSpan="2">
              Status Table
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={() => setAutoRefresh(!autoRefresh)}
                />
                <span className="slider round" title="Auto Status Refresh"></span>
              </label>
            </th>
          </tr>
        </thead>
        <tbody>
          {userAccountStatusProperties.map((key) => (
            <tr key={key}>
              <td className="property-cell">{key}</td>
              <td className="value-cell">
                {formatValue(key, userAccountStatus[key])}
              </td>
            </tr>
          ))}
          <tr>
            <td className="property-cell">Password Age</td>
            <td className="value-cell">
              {calculatePasswordAge(userAccountStatus.pwdLastSet)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default UserStatusTable;