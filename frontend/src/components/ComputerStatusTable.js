import React, { useEffect, useState, useCallback } from 'react';
import { apiPost, executeScript, logAction } from '../utils/api';
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
  const [processes, setProcesses] = useState(null); // null = not fetched yet
  const [processLoading, setProcessLoading] = useState(false);
  const [processFilter, setProcessFilter] = useState('');
  const [killingProcess, setKillingProcess] = useState(null); // process name currently being killed

  const fetchIpv4Address = useCallback(async () => {
    try {
      const ipCommand = `Invoke-Command -ComputerName ${adObjectID} -ScriptBlock { Get-WmiObject -Class Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true } | Select-Object -ExpandProperty IPAddress | Where-Object { $_ -match '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' } } | ConvertTo-Json -Compress`;

      const ipData = await apiPost('/api/execute-command', { command: ipCommand });
      const ipAddress = ipData.value; // Extract the IP address value
      setIpv4Address(ipAddress);
    } catch (error) {
      console.error('Error fetching IP address:', error);
      setIpv4Address('Unavailable');
    }
  }, [adObjectID]);

  const fetchLoggedInUsers = useCallback(async () => {
    try {
      const usersCommand = `PsLoggedon.exe -l -x \\\\${adObjectID} | ConvertTo-Json -Compress`;

      const usersData = await apiPost('/api/execute-command', { command: usersCommand });

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
        const statusCommand = `Test-Connection -ComputerName ${adObjectID} -Count 1 -Quiet -ErrorAction Stop | ConvertTo-Json -Compress`;

        const statusData = await apiPost('/api/execute-command', { command: statusCommand });
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

    // Poll only while the page is visible. When the operator switches to another
    // browser tab or app window, polling pauses (no wasted Test-Connection/PsLoggedon
    // traffic) and resumes with an immediate refresh when they return.
    let interval = null;
    const startPolling = () => {
      if (interval || !autoRefresh || document.hidden) return;
      interval = setInterval(fetchComputerStatus, 5000); // Refresh every 5 seconds
    };
    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchComputerStatus();
        startPolling();
      }
    };

    fetchComputerStatus();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [adObjectID, autoRefresh, ipFetched, fetchIpv4Address, fetchLoggedInUsers]);

  const handleRestartComputer = async () => {
    if (!window.confirm(`Are you sure you want to restart ${adObjectID}? This will immediately restart the computer.`)) {
      return;
    }

    setLoading(prev => ({ ...prev, restart: true }));
    try {
      await executeScript('RestartComputer', { ComputerName: adObjectID });
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
      const result = await executeScript('ForceGroupPolicyUpdate', { ComputerName: adObjectID });
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
      const result = await executeScript('RestartPrintSpooler', { ComputerName: adObjectID });
      alert(`Print Spooler service restarted on ${adObjectID}`);
      console.log('Print Spooler restart result:', result);

      // Log action (non-blocking — logAction never throws)
      await logAction({
        activity: `Restarted Print Spooler service on computer: ${adObjectID}`,
        target: adObjectID,
        actionType: 'restart_print_spooler',
        details: { computerName: adObjectID, scriptResult: result },
        result: 'success'
      });

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
      const result = await executeScript('GraphicsDriverRestart', { ComputerName: adObjectID });
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
      const result = await executeScript('GetUserProfiles', { ComputerName: adObjectID });
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
      const result = await executeScript('RemoveUserProfiles', {
        ComputerName: adObjectID,
        UserIDs: profileModal.selectedProfiles
      });
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

  // On-demand fetch of the remote computer's user processes (no polling)
  const handleGetProcesses = async () => {
    setProcessLoading(true);
    try {
      const result = await executeScript('GetUserProcesses', { ComputerName: adObjectID });
      const scriptResult = result.message; // PowerShell payload is in .message
      if (scriptResult && scriptResult.Success) {
        setProcesses(Array.isArray(scriptResult.Processes) ? scriptResult.Processes : []);
      } else {
        alert(`Failed to get processes: ${scriptResult?.Message || 'Unknown error'}`);
        setProcesses([]);
      }
    } catch (error) {
      console.error('Error getting processes:', error);
      alert(`Failed to get processes from ${adObjectID}: ${error.message}`);
    } finally {
      setProcessLoading(false);
    }
  };

  // Kill all instances of a named process (mirrors Stop-Process -Name <x> -Force)
  const handleKillProcess = async (processName) => {
    if (!window.confirm(`Kill all instances of "${processName}" on ${adObjectID}?`)) return;
    setKillingProcess(processName);
    try {
      const result = await executeScript('StopUserProcesses', { ComputerName: adObjectID, ProcessName: processName });
      const scriptResult = result.message;
      if (scriptResult && scriptResult.Success) {
        await logAction({
          activity: `Killed ${scriptResult.Killed} instance(s) of ${processName} on ${adObjectID}`,
          target: adObjectID,
          actionType: 'kill_process',
          details: { computerName: adObjectID, processName, killed: scriptResult.Killed },
          result: 'success'
        });
        await handleGetProcesses(); // refresh the list to reflect the kill
      } else {
        alert(`Failed to kill ${processName}: ${scriptResult?.Message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error killing process:', error);
      alert(`Failed to kill ${processName} on ${adObjectID}: ${error.message}`);
    } finally {
      setKillingProcess(null);
    }
  };

  // Group the flat process list by name (count + total memory), filtered + sorted
  const groupedProcesses = (() => {
    if (!processes) return [];
    const map = new Map();
    for (const p of processes) {
      const g = map.get(p.Name) || { name: p.Name, count: 0, memory: 0 };
      g.count += 1;
      g.memory += p.MemoryMB || 0;
      map.set(p.Name, g);
    }
    return Array.from(map.values())
      .filter(g => g.name.toLowerCase().includes(processFilter.toLowerCase()))
      .sort((a, b) => b.count - a.count || b.memory - a.memory);
  })();

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

      {/* Processes - on-demand list of user processes with kill-by-name (only when online) */}
      {computerStatus === 'Online' && (
        <div className="computer-processes-section" style={{ marginTop: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <button
              className={`control-button ${processLoading ? 'loading' : ''}`}
              onClick={handleGetProcesses}
              disabled={processLoading}
            >
              {processLoading ? 'Loading Processes...' : '🧾 Get Processes'}
            </button>
            {processes && (
              <input
                type="text"
                value={processFilter}
                onChange={(e) => setProcessFilter(e.target.value)}
                placeholder="Filter processes…"
                style={{ flex: 1, padding: '4px 8px', minWidth: 0 }}
              />
            )}
          </div>

          {processes && (
            groupedProcesses.length > 0 ? (
              <table className="computer-status-table">
                <thead>
                  <tr>
                    <th>Process</th>
                    <th>Count</th>
                    <th>Memory</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedProcesses.map((g) => (
                    <tr key={g.name}>
                      <td className="property-cell">{g.name}</td>
                      <td className="value-cell">{g.count}</td>
                      <td className="value-cell">{g.memory.toFixed(1)} MB</td>
                      <td className="value-cell">
                        <button
                          className="control-button"
                          onClick={() => handleKillProcess(g.name)}
                          disabled={killingProcess === g.name}
                          title={`Stop-Process -Name ${g.name} -Force`}
                        >
                          {killingProcess === g.name ? 'Killing…' : 'Kill all'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px' }}>
                {processFilter ? 'No processes match your filter.' : 'No user processes found.'}
              </div>
            )
          )}
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