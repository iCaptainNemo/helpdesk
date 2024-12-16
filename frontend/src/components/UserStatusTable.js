import React, { useEffect, useState, useMemo } from 'react';
import '../styles/UserStatusTable.css';
import ScriptButton from './ScriptButton'; // Import the ScriptButton component
import CurrentComputers from './CurrentComputers'; // Import the CurrentComputers component

const UserStatusTable = ({ adObjectID, permissions }) => {
  const [userAccountStatus, setUserAccountStatus] = useState({});
  const [additionalFields, setAdditionalFields] = useState({
    LastHelped: null,
    TimesUnlocked: null,
    PasswordResets: null,
    TimesHelped: null
  });
  const [autoRefresh, setAutoRefresh] = useState(false); // State to control auto-refresh
  const userAccountStatusProperties = useMemo(() => [
    'Enabled',
    'LockedOut',
    'lockoutTime',
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

        // Fetch Active Directory properties
        const command = `Get-ADUser -Identity ${adObjectID} -Properties ${userAccountStatusProperties.join(',')} | ConvertTo-Json -Compress`;
        const adResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ command }),
        });

        if (!adResponse.ok) throw new Error('Network response was not ok');

        const adData = await adResponse.json();

        if (isMounted) {
          setUserAccountStatus(adData);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error fetching user account status:', error);
        }
      }
    };

    const fetchAdditionalFields = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');
    
        if (!adObjectID) throw new Error('adObjectID is not defined');
    
        const backendUrl = process.env.REACT_APP_BACKEND_URL;
        if (!backendUrl) throw new Error('Backend URL is not defined');
    
        // Fetch additional fields from the database
        const dbResponse = await fetch(`${backendUrl}/api/fetch-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ adObjectID }),
        });
    
        if (!dbResponse.ok) throw new Error('Network response was not ok');
    
        const dbData = await dbResponse.json();
    
        if (isMounted) {
          setAdditionalFields((prevFields) => ({
            ...prevFields,
            ...dbData[0] // Assuming dbData is an array and you need the first element
          }));
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error fetching additional fields:', error);
        }
      }
    };

    fetchUserAccountStatus();
    fetchAdditionalFields();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchUserAccountStatus, 5000); // Refresh every 5 seconds
    }

    return () => {
      isMounted = false; // Cleanup function to set isMounted to false
      clearInterval(interval); // Cleanup interval on component unmount
    };
  }, [adObjectID, autoRefresh, userAccountStatusProperties]);

  const handleUnlockSuccess = async (result) => {
    if (result.message.includes('Unlocked')) {
      setUserAccountStatus((prevStatus) => ({
        ...prevStatus,
        LockedOut: false,
      }));

      // Update user stats
      const updates = {
        LastHelped: new Date().toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
        TimesHelped: (additionalFields.TimesHelped || 0) + 1,
        TimesUnlocked: (additionalFields.TimesUnlocked || 0) + 1
      };

      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        const backendUrl = process.env.REACT_APP_BACKEND_URL;
        if (!backendUrl) throw new Error('Backend URL is not defined');

        const response = await fetch(`${backendUrl}/api/fetch-user/update`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ adObjectID, updates }),
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const updatedUser = await response.json();
        setAdditionalFields((prevFields) => ({
          ...prevFields,
          ...updatedUser
        }));
      } catch (error) {
        console.error('Error updating user stats:', error);
      }
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
    } else if (key === 'badPasswordTime' || key === 'pwdLastSet' || key === 'lockoutTime') {
      if (value === '0' || value === 0) {
        return 'N/A';
      }
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
      <br />
      <table className="user-account-status-table">
        <thead>
          <tr>
            <th colSpan="2">User Stats</th>
          </tr>
        </thead>
        <tbody>
          {['LastHelped', 'TimesUnlocked', 'PasswordResets', 'TimesHelped'].map((key) => (
            <tr key={key}>
              <td className="property-cell">{key}</td>
              <td className="value-cell">
                {formatValue(key, additionalFields[key])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <CurrentComputers adObjectID={adObjectID} />
    </div>
  );
};

export default UserStatusTable;