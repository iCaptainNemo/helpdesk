import React, { useEffect, useState, useMemo } from 'react';
import '../styles/UserStatusTable.css';
import '../styles/theme.css'; // Import modern theme
import ScriptButton from './ScriptButton'; // Import the ScriptButton component
import CurrentComputers from './CurrentComputers'; // Import the CurrentComputers component

const UserStatusTable = ({ adObjectID, permissions, endpoint }) => {
  const [userAccountStatus, setUserAccountStatus] = useState({});
  const [additionalFields, setAdditionalFields] = useState({
    LastHelped: null,
    LastAdminHelped: null,
    TimesUnlocked: null,
    PasswordResets: null,
    TimesHelped: null
  });
  const [securityQuestions, setSecurityQuestions] = useState({
    SecurityQuestion: null,
    SecurityAnswer: null
  });
  const [editingSecurityQuestion, setEditingSecurityQuestion] = useState(false);
  const [securityQuestionForm, setSecurityQuestionForm] = useState({
    SecurityQuestion: '',
    SecurityAnswer: ''
  });
  const [autoRefresh, setAutoRefresh] = useState(false); // State to control auto-refresh
  const [PDC, setPDC] = useState(''); // State to store the PDC
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
    const fetchPDC = async () => {
      try {
        const response = await fetch(`${endpoint}/api/domain-controllers/pdc`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.text(); // Fetch as plain text
        setPDC(data);
      } catch (error) {
        console.error('Error fetching PDC:', error);
      }
    };

    fetchPDC();
  }, []);

  useEffect(() => {
    if (!PDC) return; // Wait until PDC is fetched

    let isMounted = true; // Track if the component is mounted

    const fetchUserAccountStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        // Fetch Active Directory properties
        const command = `Get-ADUser -Identity ${adObjectID} -Server ${PDC} -Properties ${userAccountStatusProperties.join(',')} | ConvertTo-Json -Compress`;
        const adResponse = await fetch(`${endpoint}/api/execute-command`, {
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

        // Fetch additional fields from the database
        const dbResponse = await fetch(`${endpoint}/api/fetch-user`, {
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

    const fetchSecurityQuestions = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        if (!adObjectID) throw new Error('adObjectID is not defined');

        // Fetch security questions from the database
        const sqResponse = await fetch(`${endpoint}/api/fetch-user/security-question/${adObjectID}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!sqResponse.ok) throw new Error('Network response was not ok');

        const sqData = await sqResponse.json();

        if (isMounted) {
          setSecurityQuestions(sqData);
          setSecurityQuestionForm({
            SecurityQuestion: sqData.SecurityQuestion || '',
            SecurityAnswer: sqData.SecurityAnswer || ''
          });
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error fetching security questions:', error);
        }
      }
    };

    fetchUserAccountStatus();
    fetchAdditionalFields();
    fetchSecurityQuestions();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchUserAccountStatus, 5000); // Refresh every 5 seconds
    }

    return () => {
      isMounted = false; // Cleanup function to set isMounted to false
      clearInterval(interval); // Cleanup interval on component unmount
    };
  }, [adObjectID, autoRefresh, userAccountStatusProperties, PDC]);

  const handleUnlockSuccess = async (result) => {
    if (result.message.includes('Unlocked')) {
      // Update the UI to show unlocked status immediately
      setUserAccountStatus((prevStatus) => ({
        ...prevStatus,
        LockedOut: false,
      }));

      // Refresh user data from database to get the updated stats (LastHelped, LastAdminHelped, etc.)
      // The backend executeScript route has already updated these in the database
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        const response = await fetch(`${endpoint}/api/fetch-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ adObjectID }),
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const userData = await response.json();
        if (userData && userData.length > 0) {
          setAdditionalFields((prevFields) => ({
            ...prevFields,
            ...userData[0] // Update with fresh data from database
          }));
        }
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  };

  const handleSaveSecurityQuestion = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${endpoint}/api/fetch-user/security-question`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userID: adObjectID,
          securityQuestion: securityQuestionForm.SecurityQuestion,
          securityAnswer: securityQuestionForm.SecurityAnswer
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const updatedData = await response.json();
      setSecurityQuestions(updatedData);
      setEditingSecurityQuestion(false);
    } catch (error) {
      console.error('Error saving security question:', error);
    }
  };

  const handleCancelSecurityQuestion = () => {
    setSecurityQuestionForm({
      SecurityQuestion: securityQuestions.SecurityQuestion || '',
      SecurityAnswer: securityQuestions.SecurityAnswer || ''
    });
    setEditingSecurityQuestion(false);
  };

  const handleClearSecurityQuestion = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${endpoint}/api/fetch-user/security-question/${adObjectID}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const clearedData = await response.json();
      setSecurityQuestions(clearedData);
      setSecurityQuestionForm({
        SecurityQuestion: '',
        SecurityAnswer: ''
      });
      setEditingSecurityQuestion(false);
    } catch (error) {
      console.error('Error clearing security question:', error);
    }
  };

  const formatPropertyName = (key) => {
    const propertyMap = {
      'LastHelped': 'Last Helped',
      'LastAdminHelped': 'Last Helped By',
      'TimesUnlocked': 'Times Unlocked',
      'PasswordResets': 'Password Resets',
      'TimesHelped': 'Times Helped'
    };
    return propertyMap[key] || key;
  };

  const formatValue = (key, value, inline = false) => {
    if (typeof value === 'boolean') {
      let backgroundColor;
      if (key === 'LockedOut') {
        backgroundColor = value ? 'red' : 'green';
        return (
          <div className="boolean-value" style={{ backgroundColor }}>
            {value ? (
              permissions.includes('execute_script') ? (
                <ScriptButton
                  scriptName="Unlocker"
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
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1; // Subtract 1 day
    return `${diffDays} days`;
  };

  return (
    <div className="user-status-table-container theme-modern">
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
            <th colSpan="2" style={{ position: 'relative' }}>
              Security Questions
              <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                {editingSecurityQuestion ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={handleSaveSecurityQuestion}
                      className="script-button save"
                      style={{ fontSize: '12px', padding: '2px 6px' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelSecurityQuestion}
                      className="script-button cancel"
                      style={{ fontSize: '12px', padding: '2px 6px' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => setEditingSecurityQuestion(true)}
                      className="script-button edit"
                      style={{ fontSize: '12px', padding: '2px 6px' }}
                    >
                      Edit
                    </button>
                    {(securityQuestions.SecurityQuestion || securityQuestions.SecurityAnswer) && (
                      <button
                        onClick={handleClearSecurityQuestion}
                        className="script-button clear"
                        style={{ fontSize: '12px', padding: '2px 6px' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="property-cell">Question</td>
            <td className="value-cell">
              {editingSecurityQuestion ? (
                <input
                  type="text"
                  value={securityQuestionForm.SecurityQuestion}
                  onChange={(e) => setSecurityQuestionForm(prev => ({
                    ...prev,
                    SecurityQuestion: e.target.value
                  }))}
                  placeholder="Enter security question"
                  style={{ width: '100%', padding: '4px' }}
                />
              ) : (
                securityQuestions.SecurityQuestion || 'Not set'
              )}
            </td>
          </tr>
          <tr>
            <td className="property-cell">Answer</td>
            <td className="value-cell">
              {editingSecurityQuestion ? (
                <input
                  type="text"
                  value={securityQuestionForm.SecurityAnswer}
                  onChange={(e) => setSecurityQuestionForm(prev => ({
                    ...prev,
                    SecurityAnswer: e.target.value
                  }))}
                  placeholder="Enter security answer"
                  style={{ width: '100%', padding: '4px' }}
                />
              ) : (
                securityQuestions.SecurityAnswer || 'Not set'
              )}
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
          {['LastHelped', 'LastAdminHelped', 'TimesUnlocked', 'PasswordResets', 'TimesHelped'].map((key) => (
            <tr key={key}>
              <td className="property-cell">{formatPropertyName(key)}</td>
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