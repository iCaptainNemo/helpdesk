import React, { useEffect, useState } from 'react';
import '../styles/UserAccountStatusTable.css';

const UserAccountStatusTable = ({ adObjectID }) => {
  const [userAccountStatus, setUserAccountStatus] = useState({});
  const userAccountStatusProperties = [
    'Enabled',
    'LockedOut',
    'badPasswordTime',
    'badPwdCount',
    'PasswordExpired',
    'pwdLastSet'
  ];

  useEffect(() => {
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
        setUserAccountStatus(data);
      } catch (error) {
        console.error('Error fetching user account status:', error);
      }
    };

    fetchUserAccountStatus();
  }, [adObjectID]);

  const formatValue = (key, value) => {
    if (typeof value === 'boolean') {
      let backgroundColor;
      if (key === 'LockedOut' || key === 'PasswordExpired') {
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

  return (
    <table className="user-account-status-table">
      <thead>
        <tr>
          <th>Property</th>
          <th>Value</th>
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
      </tbody>
    </table>
  );
};

export default UserAccountStatusTable;