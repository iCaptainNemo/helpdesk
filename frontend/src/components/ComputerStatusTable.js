import React, { useEffect, useState, useCallback } from 'react';
import '../styles/ComputerStatusTable.css';

const ComputerStatusTable = ({ adObjectID }) => {
  const [computerStatus, setComputerStatus] = useState('Checking...');
  const [ipv4Address, setIpv4Address] = useState('Fetching...');
  const [users, setUsers] = useState('Fetching...');
  const [autoRefresh, setAutoRefresh] = useState(true); // State to control auto-refresh
  const [ipFetched, setIpFetched] = useState(false); // State to track if IP address has been fetched
  const [loading, setLoading] = useState({
    restart: false,
    gpupdate: false,
    printSpooler: false,
    graphicsRestart: false,
    profileRemoval: false
  });
  const [profileModal, setProfileModal] = useState({
    open: false,
    profiles: [],
    selectedProfiles: [],
    loading: false
  });

  const fetchIpv4Address = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const ipCommand = `Invoke-Command -ComputerName ${adObjectID} -ScriptBlock { Get-WmiObject -Class Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true } | Select-Object -ExpandProperty IPAddress | Where-Object { $_ -match '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' } } | ConvertTo-Json -Compress`;

      const ipResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ command: ipCommand }),
      });

      if (!ipResponse.ok) throw new Error('Network response was not ok');

      const ipData = await ipResponse.json();
      const ipAddress = ipData.value; // Extract the IP address value
      setIpv4Address(ipAddress);
    } catch (error) {
      console.error('Error fetching IP address:', error);
      setIpv4Address('Unavailable');
    }
  }, [adObjectID]);

  const fetchLoggedInUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const usersCommand = `PsLoggedon.exe -l -x \\\\${adObjectID} | ConvertTo-Json -Compress`;

      const usersResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ command: usersCommand }),
      });

      if (!usersResponse.ok) throw new Error('Network response was not ok');

      const usersData = await usersResponse.json();

      if (!Array.isArray(usersData)) {
        throw new Error('Unexpected data format');
      }

      const startIndex = usersData.findIndex(line => line.includes('Users logged on locally:'));

      const usersList = startIndex !== -1
        ? usersData.slice(startIndex + 1).map(line => line.replace(/\t/g, '').trim()).filter(line => line)
        : [];

      setUsers(usersList.length > 0 ? usersList.join(', ') : 'No logged in users');
    } catch (error) {
      console.error('Error fetching logged in users:', error);
      setUsers('No logged in users');
    }
  }, [adObjectID]);

  useEffect(() => {
    const fetchComputerStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        const statusCommand = `Test-Connection -ComputerName ${adObjectID} -Count 1 -Quiet -ErrorAction Stop | ConvertTo-Json -Compress`;

        const statusResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ command: statusCommand }),
        });

        if (!statusResponse.ok) throw new Error('Network response was not ok');

        const statusData = await statusResponse.json();
        setComputerStatus(statusData === true ? 'Online' : 'Offline');

        if (statusData === true && !ipFetched) {
          fetchIpv4Address();
          fetchLoggedInUsers();
          setIpFetched(true); // Mark IP address as fetched
        } else if (statusData !== true) {
          setIpv4Address('Not Online');
          setUsers('No logged in users');
        }
      } catch (error) {
        console.error('Error fetching computer status:', error);
        setComputerStatus('Offline');
        setIpv4Address('Not Online');
        setUsers('No logged in users');
      }
    };

    fetchComputerStatus();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchComputerStatus, 5000); // Refresh every 5 seconds
    }

    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, [adObjectID, autoRefresh, ipFetched, fetchIpv4Address, fetchLoggedInUsers]);

  const handleRestartComputer = async () => {
    if (!window.confirm(`Are you sure you want to restart ${adObjectID}? This will immediately restart the computer.`)) {
      return;
    }

    setLoading(prev => ({ ...prev, restart: true }));
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scriptName: 'RestartComputer',
          params: { ComputerName: adObjectID }
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const result = await response.json();
      alert(`Restart command sent to ${adObjectID}. The computer should restart shortly.`);

      // Update status after a brief delay
      setTimeout(() => {
        setComputerStatus('Restarting...');
        setIpv4Address('Restarting...');
        setUsers('Restarting...');
      }, 2000);

    } catch (error) {
      console.error('Error restarting computer:', error);
      alert(`Failed to restart ${adObjectID}: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, restart: false }));
    }
  };

  const handleGroupPolicyUpdate = async () => {
    setLoading(prev => ({ ...prev, gpupdate: true }));
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scriptName: 'ForceGroupPolicyUpdate',
          params: { ComputerName: adObjectID }
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const result = await response.json();
      alert(`Group Policy update completed on ${adObjectID}`);
      console.log('GP Update result:', result);

    } catch (error) {
      console.error('Error updating group policy:', error);
      alert(`Failed to update Group Policy on ${adObjectID}: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, gpupdate: false }));
    }
  };

  const handlePrintSpoolerRestart = async () => {
    setLoading(prev => ({ ...prev, printSpooler: true }));
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scriptName: 'RestartPrintSpooler',
          params: { ComputerName: adObjectID }
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const result = await response.json();
      alert(`Print Spooler service restarted on ${adObjectID}`);
      console.log('Print Spooler restart result:', result);

      // Log action to actions endpoint
      try {
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/actions/log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            activity: `Restarted Print Spooler service on computer: ${adObjectID}`,
            target: adObjectID,
            action_type: 'restart_print_spooler',
            details: { computerName: adObjectID, scriptResult: result },
            result: 'success'
          }),
        });
      } catch (logError) {
        console.error('Error logging print spooler restart action:', logError);
        // Don't fail the main operation if logging fails
      }

    } catch (error) {
      console.error('Error restarting print spooler:', error);
      alert(`Failed to restart Print Spooler on ${adObjectID}: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, printSpooler: false }));
    }
  };

  const handleGraphicsDriverRestart = async () => {
    setLoading(prev => ({ ...prev, graphicsRestart: true }));
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scriptName: 'GraphicsDriverRestart',
          params: { ComputerName: adObjectID }
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const result = await response.json();
      alert(`Graphics driver restart completed on ${adObjectID}`);
      console.log('Graphics restart result:', result);

    } catch (error) {
      console.error('Error restarting graphics driver:', error);
      alert(`Failed to restart graphics driver on ${adObjectID}: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, graphicsRestart: false }));
    }
  };

  const handleGetUserProfiles = async () => {
    setProfileModal(prev => ({ ...prev, loading: true }));
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scriptName: 'GetUserProfiles',
          params: { ComputerName: adObjectID }
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const result = await response.json();
      const scriptResult = result.message; // The actual PowerShell result is in the message property

      if (scriptResult.Success) {
        setProfileModal(prev => ({
          ...prev,
          open: true,
          profiles: scriptResult.Profiles,
          selectedProfiles: [],
          loading: false
        }));
      } else {
        alert(`Failed to get user profiles: ${scriptResult.Message || 'Unknown error'}`);
        setProfileModal(prev => ({ ...prev, loading: false }));
      }

    } catch (error) {
      console.error('Error getting user profiles:', error);
      alert(`Failed to get user profiles from ${adObjectID}: ${error.message}`);
      setProfileModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleRemoveUserProfiles = async () => {
    if (profileModal.selectedProfiles.length === 0) {
      alert('Please select at least one profile to remove');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove ${profileModal.selectedProfiles.length} profile(s)?\n\n` +
      `This action cannot be undone and will delete all user data for:\n` +
      `${profileModal.selectedProfiles.join(', ')}`
    );

    if (!confirmed) return;

    setLoading(prev => ({ ...prev, profileRemoval: true }));
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scriptName: 'RemoveUserProfiles',
          params: {
            ComputerName: adObjectID,
            UserIDs: profileModal.selectedProfiles
          }
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const result = await response.json();
      const scriptResult = result.message; // The actual PowerShell result is in the message property

      if (scriptResult.Success) {
        alert(`Successfully removed ${scriptResult.ProfilesDeleted} profile(s) from ${adObjectID}`);
      } else {
        alert(`Profile removal failed: ${scriptResult.Message || 'Unknown error'}`);
      }

      // Close modal and reset state
      setProfileModal({
        open: false,
        profiles: [],
        selectedProfiles: [],
        loading: false
      });

    } catch (error) {
      console.error('Error removing user profiles:', error);
      alert(`Failed to remove user profiles from ${adObjectID}: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, profileRemoval: false }));
    }
  };

  const handleProfileSelection = (userID, selected) => {
    setProfileModal(prev => ({
      ...prev,
      selectedProfiles: selected
        ? [...prev.selectedProfiles, userID]
        : prev.selectedProfiles.filter(id => id !== userID)
    }));
  };

  const closeProfileModal = () => {
    setProfileModal({
      open: false,
      profiles: [],
      selectedProfiles: [],
      loading: false
    });
  };

  return (
    <div className="computer-status-table-container">
      <table className="computer-status-table">
        <thead>
          <tr>
            <th colSpan="2">
              Stats
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
          <tr>
            <td className="property-cell">Status</td>
            <td className={`value-cell ${computerStatus.toLowerCase()}`}>
              {computerStatus}
            </td>
          </tr>
          <tr>
            <td className="property-cell">IPv4 Address</td>
            <td className="value-cell">
              {ipv4Address}
            </td>
          </tr>
          <tr>
            <td className="property-cell">Users</td>
            <td className="value-cell">
              {users}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Computer Control Buttons - Only show when online */}
      {computerStatus === 'Online' && (
        <div className="computer-control-buttons">
          <button
            className={`control-button restart-button ${loading.restart ? 'loading' : ''}`}
            onClick={handleRestartComputer}
            disabled={loading.restart}
          >
            {loading.restart ? 'Restarting...' : '🔄 Restart Computer'}
          </button>

          <button
            className={`control-button gpupdate-button ${loading.gpupdate ? 'loading' : ''}`}
            onClick={handleGroupPolicyUpdate}
            disabled={loading.gpupdate}
          >
            {loading.gpupdate ? 'Updating...' : '🔄 Force GP Update'}
          </button>

          <button
            className={`control-button spooler-button ${loading.printSpooler ? 'loading' : ''}`}
            onClick={handlePrintSpoolerRestart}
            disabled={loading.printSpooler}
          >
            {loading.printSpooler ? 'Restarting...' : '🖨️ Restart Print Spooler'}
          </button>

          <button
            className={`control-button graphics-button ${loading.graphicsRestart ? 'loading' : ''}`}
            onClick={handleGraphicsDriverRestart}
            disabled={loading.graphicsRestart}
          >
            {loading.graphicsRestart ? 'Restarting...' : '🖥️ Restart Graphics Driver'}
          </button>

          <button
            className={`control-button profile-button ${loading.profileRemoval ? 'loading' : ''}`}
            onClick={handleGetUserProfiles}
            disabled={loading.profileRemoval || profileModal.loading}
          >
            {profileModal.loading ? 'Loading Profiles...' : '👤 Remove User Profiles'}
          </button>
        </div>
      )}

      {/* Profile Removal Modal */}
      {profileModal.open && (
        <div className="profile-modal-overlay" onClick={closeProfileModal}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Remove User Profiles from {adObjectID}</h3>
              <button className="profile-modal-close" onClick={closeProfileModal}>×</button>
            </div>

            <div className="profile-modal-content">
              {profileModal.profiles.length === 0 ? (
                <div className="profile-empty-state">
                  <p>No user profiles available for removal</p>
                  <small>Only unloaded profiles with 5-character user IDs are shown</small>
                </div>
              ) : (
                <>
                  <div className="profile-list-header">
                    <div className="profile-selection-controls">
                      <button
                        className="profile-select-all"
                        onClick={() => {
                          const allUserIDs = profileModal.profiles.map(p => p.UserID);
                          const allSelected = allUserIDs.length === profileModal.selectedProfiles.length;
                          setProfileModal(prev => ({
                            ...prev,
                            selectedProfiles: allSelected ? [] : allUserIDs
                          }));
                        }}
                      >
                        {profileModal.selectedProfiles.length === profileModal.profiles.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <span className="profile-count">
                        {profileModal.selectedProfiles.length} of {profileModal.profiles.length} selected
                      </span>
                    </div>
                  </div>

                  <div className="profile-list">
                    {profileModal.profiles.map((profile) => (
                      <div key={profile.UserID} className="profile-item">
                        <label className="profile-checkbox-container">
                          <input
                            type="checkbox"
                            checked={profileModal.selectedProfiles.includes(profile.UserID)}
                            onChange={(e) => handleProfileSelection(profile.UserID, e.target.checked)}
                          />
                          <span className="profile-checkmark"></span>

                          <div className="profile-info">
                            <div className="profile-user-id">{profile.UserID}</div>
                            <div className="profile-details">
                              <span className="profile-last-modified">
                                Last Modified: {profile.LastModified}
                              </span>
                              {profile.ProfileSize > 0 && (
                                <span className="profile-size">
                                  Size: {profile.ProfileSize} MB
                                </span>
                              )}
                            </div>
                            <div className="profile-path">
                              Path: {profile.LocalPath}
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="profile-modal-footer">
              <button
                className="profile-cancel-button"
                onClick={closeProfileModal}
              >
                Cancel
              </button>
              <button
                className={`profile-remove-button ${loading.profileRemoval ? 'loading' : ''}`}
                onClick={handleRemoveUserProfiles}
                disabled={loading.profileRemoval || profileModal.selectedProfiles.length === 0}
              >
                {loading.profileRemoval ? 'Removing...' : `Remove ${profileModal.selectedProfiles.length} Profile${profileModal.selectedProfiles.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComputerStatusTable;