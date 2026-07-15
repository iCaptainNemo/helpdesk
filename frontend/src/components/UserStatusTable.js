import React, { useEffect, useState, useMemo } from 'react';
import '../styles/UserStatusTable.css';
import '../styles/theme.css'; // Import modern theme
import { apiGet, apiPost, apiPut, apiDelete, invalidateCache } from '../utils/api';
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
  const [comment, setComment] = useState(''); // Free-text comment for the user
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
        // PDC rarely changes within a session — cache for 5 minutes.
        const data = await apiGet('/api/domain-controllers/pdc', { cache: 300000 }); // returns plain text
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
        // Fetch Active Directory properties
        const command = `Get-ADUser -Identity ${adObjectID} -Server ${PDC} -Properties ${userAccountStatusProperties.join(',')} | ConvertTo-Json -Compress`;
        const adData = await apiPost('/api/execute-command', { command });

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
        if (!adObjectID) throw new Error('adObjectID is not defined');

        // Fetch additional fields from the database (cached so tab switches are instant)
        const dbData = await apiPost('/api/fetch-user', { adObjectID }, { cache: 30000 });

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
        if (!adObjectID) throw new Error('adObjectID is not defined');

        // Fetch security questions from the database (cached across tab switches)
        const sqData = await apiGet(`/api/fetch-user/security-question/${adObjectID}`, { cache: 60000 });

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

    // Poll live account status only while the page is visible (see ComputerStatusTable)
    let interval = null;
    const startPolling = () => {
      if (interval || !autoRefresh || document.hidden) return;
      interval = setInterval(fetchUserAccountStatus, 5000); // Refresh every 5 seconds
    };
    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchUserAccountStatus();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false; // Cleanup function to set isMounted to false
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [adObjectID, autoRefresh, userAccountStatusProperties, PDC]);

  const handleUnlockSuccess = async (result) => {
    if (result.message.includes('Unlocked')) {
      // Update the UI to show unlocked status immediately
      setUserAccountStatus((prevStatus) => ({
        ...prevStatus,
        LockedOut: false,
      }));

      // The unlock changed this user's DB stats — drop the cached read first.
      invalidateCache('/api/fetch-user');

      // Refresh user data from database to get the updated stats (LastHelped, LastAdminHelped, etc.)
      // The backend executeScript route has already updated these in the database
      try {
        const userData = await apiPost('/api/fetch-user', { adObjectID });
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
      const updatedData = await apiPut('/api/fetch-user/security-question', {
        userID: adObjectID,
        securityQuestion: securityQuestionForm.SecurityQuestion,
        securityAnswer: securityQuestionForm.SecurityAnswer
      });
      setSecurityQuestions(updatedData);
      invalidateCache('/api/fetch-user/security-question');
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
      const clearedData = await apiDelete(`/api/fetch-user/security-question/${adObjectID}`);
      setSecurityQuestions(clearedData);
      invalidateCache('/api/fetch-user/security-question');
      setSecurityQuestionForm({
        SecurityQuestion: '',
        SecurityAnswer: ''
      });
      setEditingSecurityQuestion(false);
    } catch (error) {
      console.error('Error clearing security question:', error);
    }
  };

  // Keep the comment textarea in sync when the user's DB row loads/changes
  useEffect(() => {
    setComment(additionalFields.Comment || '');
  }, [additionalFields.Comment]);

  // Local calendar date (YYYY-MM-DD), matching the server's one-vote-per-day check
  const todayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const votedToday = additionalFields.LastVoteDate === todayString();

  const handleVote = async (vote) => {
    try {
      const updated = await apiPost('/api/fetch-user/vote', { userID: adObjectID, vote });
      setAdditionalFields((prev) => ({ ...prev, ...updated }));
      invalidateCache('/api/fetch-user');
    } catch (error) {
      // 409 = already voted today; sync state from the returned row so the UI reflects it
      if (error.status === 409 && error.data) {
        setAdditionalFields((prev) => ({ ...prev, ...error.data }));
      } else {
        console.error('Error recording vote:', error);
      }
    }
  };

  const handleSaveComment = async () => {
    try {
      const updated = await apiPut('/api/fetch-user/comment', { userID: adObjectID, comment });
      setAdditionalFields((prev) => ({ ...prev, ...updated }));
      invalidateCache('/api/fetch-user');
    } catch (error) {
      console.error('Error saving comment:', error);
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
      {/* Daily thumbs feedback — one vote per calendar day (enforced server-side) */}
      <table className="user-account-status-table">
        <thead>
          <tr>
            <th colSpan="2">Feedback</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="value-cell" colSpan="2">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                <button
                  onClick={() => handleVote('down')}
                  disabled={votedToday}
                  style={{
                    flex: 1,
                    fontSize: '14px',
                    padding: '8px 10px',
                    border: '1px solid #e57373',
                    borderRadius: 'var(--border-radius-sm)',
                    background: '#ffcdd2',
                    color: '#000000',
                    cursor: votedToday ? 'not-allowed' : 'pointer',
                    opacity: votedToday ? 0.6 : 1
                  }}
                  title={votedToday ? 'Already voted today' : 'Thumbs down'}
                >
                  👎 {additionalFields.ThumbsDown || 0}
                </button>
                <button
                  onClick={() => handleVote('up')}
                  disabled={votedToday}
                  style={{
                    flex: 1,
                    fontSize: '14px',
                    padding: '8px 10px',
                    border: '1px solid #81c784',
                    borderRadius: 'var(--border-radius-sm)',
                    background: '#c8e6c9',
                    color: '#000000',
                    cursor: votedToday ? 'not-allowed' : 'pointer',
                    opacity: votedToday ? 0.6 : 1
                  }}
                  title={votedToday ? 'Already voted today' : 'Thumbs up'}
                >
                  👍 {additionalFields.ThumbsUp || 0}
                </button>
                {votedToday && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Voted today</span>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <br />
      {/* Free-text comment for the user */}
      <table className="user-account-status-table">
        <thead>
          <tr>
            <th colSpan="2" style={{ position: 'relative' }}>
              Comment
              <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                <button
                  onClick={handleSaveComment}
                  className="script-button save"
                  style={{ fontSize: '12px', padding: '2px 6px' }}
                >
                  Save
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan="2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment about this user"
                style={{ width: '100%', minHeight: '60px', padding: '6px', boxSizing: 'border-box', resize: 'vertical' }}
              />
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