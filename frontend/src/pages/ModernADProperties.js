import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from 'react-modal';
import Logs from '../components/Logs';
import UserStatusTable from '../components/UserStatusTable';
import ComputerStatusTable from '../components/ComputerStatusTable';
import TickerTape from '../components/TickerTape';
import '../styles/theme.css';
import '../styles/grid.css';
import '../styles/Logs.css';

Modal.setAppElement('#root');

const ENDPOINT = process.env.REACT_APP_BACKEND_URL;

const ModernTabs = ({ tabs, activeTab, onTabClick, onCloseTab }) => {
  return (
    <div className="tabs-container-modern" style={{
      display: 'flex',
      gap: 'var(--spacing-xs)',
      padding: 'var(--spacing-md)',
      borderBottom: '1px solid var(--border-secondary)',
      backgroundColor: 'var(--bg-secondary)',
      overflowX: 'auto'
    }}>
      {tabs.map((tab, index) => (
        <div
          key={index}
          className={`tab-modern ${activeTab === index ? 'active' : ''}`}
          onClick={() => onTabClick(index)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: activeTab === index ? 'var(--primary-gradient)' : 'var(--bg-card)',
            color: activeTab === index ? 'white' : 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--border-radius-md)',
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
            whiteSpace: 'nowrap',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)'
          }}
        >
          <span>{tab.name}</span>
          <button
            className="close-tab-modern"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(index);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 'var(--font-size-lg)',
              lineHeight: 1,
              padding: '2px',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

const ModernADProperties = ({ permissions }) => {
  const { adObjectID } = useParams();
  const navigate = useNavigate();
  
  // All the state and functionality from original ADProperties
  const defaultUserProperties = useMemo(() => [
    'sAMAccountName',
    'ObjectClass',
    'Name',
    'mail',
    'title',
    'Created',
    'department',
    'homeDirectory',
    'streetAddress',
    'physicalDeliveryOfficeName',
    'telephoneNumber',
    'memberOf',
  ], []);

  const defaultComputerProperties = useMemo(() => [
    'CN',
    'ObjectClass',
    'CanonicalName',
    'operatingSystem',
    'DistinguishedName',
    'memberOf',
  ], []);

  const getDefaultProperties = useCallback((ObjectClass, allProperties) => {
    if (ObjectClass === 'user') {
      return defaultUserProperties;
    } else if (ObjectClass === 'computer') {
      return defaultComputerProperties;
    }
    return allProperties;
  }, [defaultUserProperties, defaultComputerProperties]);

  const [tabs, setTabs] = useState(() => {
    const savedTabs = sessionStorage.getItem('tabs');
    return savedTabs ? JSON.parse(savedTabs) : [];
  });
  const [activeTab, setActiveTab] = useState(0);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [forceChangePassword, setForceChangePassword] = useState(true);
  const [showPropertyColumn, setShowPropertyColumn] = useState(true);
  const [tooltip, setTooltip] = useState({ visible: false, message: '' });
  const [additionalFields, setAdditionalFields] = useState({
    LastHelped: null,
    TimesUnlocked: null,
    PasswordResets: null,
    TimesHelped: null
  });
  const logsTableRef = useRef(null);
  const adPropertiesTableRef = useRef(null);

  // All the callback functions from original ADProperties
  const fetchADObjectData = useCallback(async (id) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${ENDPOINT}/api/fetch-adobject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ adObjectID: id }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching AD object properties:', error);
      return {};
    }
  }, []);

  const fetchAdditionalFields = useCallback(async (userID) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return {};

      const response = await fetch(`${ENDPOINT}/api/fetch-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ adObjectID: userID }),
      });

      if (response.ok) {
        const userData = await response.json();
        return {
          LastHelped: userData.LastHelped || null,
          TimesUnlocked: userData.TimesUnlocked || null,
          PasswordResets: userData.PasswordResets || null,
          TimesHelped: userData.TimesHelped || null
        };
      }
      return {};
    } catch (error) {
      console.error('Error fetching additional fields:', error);
      return {};
    }
  }, []);

  const addTab = useCallback(async (adObjectID) => {
    const existingTabIndex = tabs.findIndex(tab => tab.name === adObjectID);
    if (existingTabIndex !== -1) {
      setActiveTab(existingTabIndex);
      return;
    }

    const adObjectData = await fetchADObjectData(adObjectID);
    const allProperties = Object.keys(adObjectData || {});
    const defaultProperties = getDefaultProperties(adObjectData?.ObjectClass, allProperties);
    
    // Fetch additional fields for user objects
    let additionalData = {};
    if (adObjectData?.ObjectClass === 'user') {
      additionalData = await fetchAdditionalFields(adObjectID);
    }

    const newTab = {
      name: adObjectID,
      data: { ...adObjectData, ...additionalData },
      allProperties,
      defaultProperties,
      showAdvanced: false,
    };

    setTabs(prevTabs => {
      const updatedTabs = [...prevTabs, newTab];
      sessionStorage.setItem('tabs', JSON.stringify(updatedTabs));
      return updatedTabs;
    });

    setActiveTab(tabs.length);
    // Always keep URL as /ad-object for persistent tab behavior
    navigate('/ad-object');
  }, [tabs, fetchADObjectData, fetchAdditionalFields, getDefaultProperties, navigate]);

  const closeTab = useCallback((index) => {
    const updatedTabs = tabs.filter((_, i) => i !== index);
    setTabs(updatedTabs);
    sessionStorage.setItem('tabs', JSON.stringify(updatedTabs));
    
    if (activeTab >= updatedTabs.length) {
      setActiveTab(Math.max(0, updatedTabs.length - 1));
    }
    
    if (updatedTabs.length === 0) {
      navigate('/ad-object'); // Stay on AD Object page when no tabs
    }
    // Don't change URL when switching between tabs
  }, [tabs, activeTab, navigate]);

  const copyToClipboard = useCallback((text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setTooltip({ visible: true, message: 'Copied!' });
          setTimeout(() => setTooltip({ visible: false, message: '' }), 2000);
        })
        .catch(() => {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setTooltip({ visible: true, message: 'Copied!' });
          setTimeout(() => setTooltip({ visible: false, message: '' }), 2000);
        });
    }
  }, []);

  const handlePasswordReset = useCallback(async (userID) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      // First command to reset the password
      const resetPasswordCommand = `Set-ADAccountPassword -Identity ${userID} -Reset -NewPassword (ConvertTo-SecureString -AsPlainText "${newPassword}" -Force) -ErrorAction Stop;`;
      const resetPasswordResponse = await fetch(`${ENDPOINT}/api/execute-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ command: resetPasswordCommand }),
      });

      if (!resetPasswordResponse.ok) {
        throw new Error('Failed to reset password');
      }

      // If the toggle switch is enabled, run the second command
      if (forceChangePassword) {
        const changePasswordAtLogonCommand = `Set-ADUser -Identity ${userID} -ChangePasswordAtLogon $true -ErrorAction Stop;`;
        const changePasswordAtLogonResponse = await fetch(`${ENDPOINT}/api/execute-command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ command: changePasswordAtLogonCommand }),
        });

        if (!changePasswordAtLogonResponse.ok) {
          throw new Error('Failed to set change password at logon');
        }
      }

      // If we get here, both commands were successful
        // Update additional fields
        setAdditionalFields(prev => ({
          ...prev,
          LastHelped: new Date().toISOString(),
          PasswordResets: (prev.PasswordResets || 0) + 1,
          TimesHelped: (prev.TimesHelped || 0) + 1
        }));

        // Update database
        try {
          const checkResponse = await fetch(`${ENDPOINT}/api/fetch-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ adObjectID: userID }),
          });

          const updates = {
            LastHelped: new Date().toISOString(),
            TimesHelped: 1,
            PasswordResets: 1
          };

          if (checkResponse.ok) {
            await fetch(`${ENDPOINT}/api/users/${encodeURIComponent(userID)}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify(updates),
            });
          } else {
            await fetch(`${ENDPOINT}/api/users`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ UserID: userID, ...updates }),
            });
          }
        } catch (dbError) {
          console.warn('Error updating user stats:', dbError);
        }

        // Log the password reset action to Recent Actions
        try {
          await fetch(`${ENDPOINT}/api/actions/log`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              activity: `Reset password for user: ${userID}`,
              target: userID,
              action_type: 'password_reset',
              details: {
                userID: userID,
                forceChangePassword: forceChangePassword,
                newPassword: '[REDACTED]' // Don't log the actual password
              },
              result: 'success'
            }),
          });
        } catch (logError) {
          console.warn('Failed to log password reset action:', logError);
          // Don't fail the main operation if logging fails
        }

        alert(`Password successfully reset for ${userID}`);
        setModalIsOpen(false);
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(`Failed to reset password: ${error.message}`);
    }
  }, [newPassword, forceChangePassword]);

  const launchProgram = useCallback(async (programName, computerName) => {
    let url;
    if (programName === 'CmRcViewer') {
      url = `jarvis:cmrcvie${computerName}`;
    } else if (programName === 'msra') {
      url = `jarvis:msraaaa${computerName}`;
    } else if (programName === 'PowerShell') {
      url = `jarvis:powersh${computerName}`;
    } else if (programName === 'CommandPrompt') {
      url = `jarvis:cmdexec${computerName}`;
    } else {
      console.error('Unknown program:', programName);
      return;
    }

    try {
      window.location.href = url;
      console.log(`Successfully launched ${programName} for ${computerName}`);
    } catch (error) {
      console.error(`Error launching ${programName}:`, error);
      alert(`Failed to launch ${programName}: ${error.message}`);
    }
  }, []);

  // Handle URL parameter changes and page refresh
  useEffect(() => {
    if (adObjectID && adObjectID !== '') {
      // Only create tab if coming from direct URL (page refresh or direct link)
      const existingTabIndex = tabs.findIndex(tab => tab.name === adObjectID);
      if (existingTabIndex !== -1) {
        // Tab exists, just switch to it
        if (activeTab !== existingTabIndex) {
          setActiveTab(existingTabIndex);
        }
      } else {
        // Tab doesn't exist, create it and then navigate to clean URL
        addTab(adObjectID);
      }
    }
  }, [adObjectID, tabs, addTab, navigate, activeTab]);

  // Fetch temp password from backend profile
  useEffect(() => {
    const fetchTempPassword = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${ENDPOINT}/api/auth/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setNewPassword(data.profile?.temppassword || '');
        }
      } catch (error) {
        console.error('Error fetching temp password:', error);
      }
    };

    fetchTempPassword();
  }, []);

  const currentTab = tabs[activeTab];
  const currentData = currentTab?.data || {};
  const currentProperties = currentTab?.showAdvanced ? currentTab?.allProperties : currentTab?.defaultProperties;

  return (
    <div className="theme-modern min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>

      {/* Ticker Tape - Real-time System Status */}
      <TickerTape />

      {/* Tabs */}
      {tabs.length > 0 && (
        <ModernTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabClick={(index) => {
            setActiveTab(index);
            // Keep URL clean without object ID
            navigate('/ad-object');
          }}
          onCloseTab={closeTab}
        />
      )}

      {/* Content */}
      <div className="p-lg">
        {tabs.length === 0 && !adObjectID ? (
          <div className="dashboard-card text-center py-xl">
            <div className="text-4xl mb-md">🔍</div>
            <h3 className="text-lg font-semibold mb-sm">No AD Objects Loaded</h3>
            <p className="text-secondary mb-lg">Search for an AD object from the dashboard to get started</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-primary-gradient text-white px-lg py-md rounded-md hover-lift transition"
            >
              Go to Dashboard
            </button>
          </div>
        ) : tabs.length === 0 && adObjectID ? (
          <div className="dashboard-card text-center py-xl">
            <div className="text-4xl mb-md">⏳</div>
            <h3 className="text-lg font-semibold mb-sm">Loading AD Object</h3>
            <p className="text-secondary mb-lg">Fetching data for {adObjectID}...</p>
          </div>
        ) : (
          <div className="ad-properties-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 'var(--spacing-lg)',
            height: 'calc(100vh - 200px)',
            overflow: 'hidden'
          }}>
            {/* Column 1: Logs (left) - Order 3 on mobile */}
            <div className="dashboard-card ad-column-logs" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="card-header">
                <h3 className="card-title">
                  {currentData.ObjectClass === 'computer' ? 'Computer Logs' : 'Login ledger'}
                </h3>
              </div>
              <div className="card-content" style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-md)' }}>
                <Logs
                  ref={logsTableRef}
                  adObjectID={currentTab?.name}
                />
              </div>
            </div>

            {/* Column 2: AD Properties (middle) - Order 2 on mobile */}
            <div className="dashboard-card ad-column-properties" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                {/* Title Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                  <h3 className="card-title">{currentData.ObjectClass === 'user' ? 'User' : 'Computer'} Properties: {currentTab?.name}</h3>
                </div>
                
                {/* Checkbox Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
                  {/* Advanced Properties Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--font-size-sm)' }}>
                    <input
                      type="checkbox"
                      checked={currentTab?.showAdvanced || false}
                      onChange={(e) => {
                        const updatedTabs = tabs.map((tab, index) =>
                          index === activeTab ? { ...tab, showAdvanced: e.target.checked } : tab
                        );
                        setTabs(updatedTabs);
                        sessionStorage.setItem('tabs', JSON.stringify(updatedTabs));
                      }}
                      style={{
                        accentColor: 'var(--accent-blue)',
                        marginRight: 'var(--spacing-xs)'
                      }}
                    />
                    <span style={{ color: 'var(--text-secondary)' }}>All Properties</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--font-size-sm)' }}>
                    <input
                      type="checkbox"
                      checked={showPropertyColumn}
                      onChange={(e) => setShowPropertyColumn(e.target.checked)}
                      style={{
                        accentColor: 'var(--accent-blue)',
                        marginRight: 'var(--spacing-xs)'
                      }}
                    />
                    <span style={{ color: 'var(--text-secondary)' }}>Property Names</span>
                  </label>
                </div>
                
                {/* Buttons Row */}
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--spacing-sm)' }}>
                  {/* Password Reset Button (User only) */}
                  {currentData.ObjectClass === 'user' && (
                    <button
                      onClick={() => setModalIsOpen(true)}
                      style={{
                        background: 'var(--accent-orange)',
                        color: 'white',
                        border: 'none',
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        borderRadius: 'var(--border-radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      🔑 Reset Password
                    </button>
                  )}
                  
                  {/* Program Launch Buttons (Computer only) */}
                  {currentData.ObjectClass === 'computer' && (
                    <>
                      <button
                        onClick={() => launchProgram('CmRcViewer', currentTab?.name)}
                        style={{
                          background: 'var(--accent-blue)',
                          color: 'white',
                          border: 'none',
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          borderRadius: 'var(--border-radius-sm)',
                          fontSize: 'var(--font-size-xs)',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)'
                        }}
                      >
                        📺 CmRcViewer
                      </button>
                      <button
                        onClick={() => launchProgram('msra', currentTab?.name)}
                        style={{
                          background: 'var(--accent-green)',
                          color: 'white',
                          border: 'none',
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          borderRadius: 'var(--border-radius-sm)',
                          fontSize: 'var(--font-size-xs)',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)'
                        }}
                      >
                        🖥️ MSRA
                      </button>
                      <button
                        onClick={() => launchProgram('PowerShell', currentTab?.name)}
                        style={{
                          background: 'var(--accent-purple)',
                          color: 'white',
                          border: 'none',
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          borderRadius: 'var(--border-radius-sm)',
                          fontSize: 'var(--font-size-xs)',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)'
                        }}
                      >
                        💻 PowerShell
                      </button>
                      <button
                        onClick={() => launchProgram('CommandPrompt', currentTab?.name)}
                        style={{
                          background: 'var(--text-muted)',
                          color: 'white',
                          border: 'none',
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          borderRadius: 'var(--border-radius-sm)',
                          fontSize: 'var(--font-size-xs)',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)'
                        }}
                      >
                        ⌨️ CMD
                      </button>
                    </>
                  )}
                </div>
                
                {/* Computer Name Row */}
                <div style={{ marginTop: 'var(--spacing-sm)' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                    {currentTab?.name}
                  </span>
                </div>
              </div>
              
              <div className="card-content" style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-md)' }}>
                {/* Properties Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 'var(--spacing-sm)',
                  height: '100%',
                  alignContent: 'start'
                }}>
                  {currentProperties?.map((property, index) => {
                    let value = currentData[property];

                    // Handle special formatting
                    if (value === null || value === undefined) {
                      value = 'N/A';
                    } else if (Array.isArray(value)) {
                      // For memberOf and similar fields, extract only CN (Common Name) values
                      if (property === 'memberOf') {
                        value = value.map(dn => {
                          if (typeof dn === 'string') {
                            const cnParts = dn.split(',').filter(part => part.trim().startsWith('CN='));
                            if (cnParts.length > 0) {
                              return cnParts[0].replace('CN=', '').trim();
                            }
                          }
                          return dn;
                        }).join(', ');
                      } else {
                        value = value.join(', ');
                      }
                    } else if (typeof value === 'boolean') {
                      value = value ? 'True' : 'False';
                    } else if (property.toLowerCase().includes('date') || property.toLowerCase().includes('time')) {
                      if (value && value !== 'N/A') {
                        try {
                          const date = new Date(value);
                          if (!isNaN(date.getTime())) {
                            value = date.toLocaleString();
                            // Highlight recent creation (within 30 days)
                            if (property === 'Created' && (Date.now() - date.getTime()) < 30 * 24 * 60 * 60 * 1000) {
                              value = `${value} (Recently Created)`;
                            }
                          }
                        } catch (e) {
                          // Keep original value if date parsing fails
                        }
                      }
                    }

                    return (
                      <div
                        key={index}
                        onClick={() => copyToClipboard(String(value))}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 'var(--border-radius-sm)',
                          padding: 'var(--spacing-sm)',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--spacing-xs)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        title="Click to copy"
                      >
                        {showPropertyColumn && (
                          <div style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-semibold)',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {property}
                          </div>
                        )}
                        <div style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--text-primary)',
                          wordBreak: 'break-word',
                          fontWeight: showPropertyColumn ? 'var(--font-weight-normal)' : 'var(--font-weight-medium)'
                        }}>
                          {String(value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Column 3: User/Computer Status Tables (right) - Order 1 on mobile */}
            <div className="dashboard-card ad-column-status" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="card-header">
                <h3 className="card-title">
                  {currentData.ObjectClass === 'user' ? 'User Status' : 'Computer Status'}
                </h3>
                {currentData.ObjectClass === 'computer' && (
                  <p className="card-subtitle">System information and statistics</p>
                )}
              </div>
              <div className="card-content" style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xs)' }}>
                {currentData.ObjectClass === 'user' ? (
                  <UserStatusTable
                    key={currentTab?.name}
                    adObjectID={currentTab?.name}
                    permissions={permissions}
                    endpoint={ENDPOINT}
                  />
                ) : (
                  <ComputerStatusTable 
                    key={currentTab?.name}
                    adObjectID={currentTab?.name}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Password Reset Modal */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        style={{
          overlay: {
            backgroundColor: 'var(--bg-overlay)',
            zIndex: 'var(--z-modal)'
          },
          content: {
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--border-radius-lg)',
            color: 'var(--text-primary)',
            maxWidth: '500px',
            margin: 'auto',
            padding: 'var(--spacing-lg)',
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)'
          }
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 var(--spacing-lg) 0', color: 'var(--text-primary)' }}>
            Reset Password for {currentTab?.name}
          </h3>
          
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', color: 'var(--text-secondary)' }}>
              New Password:
            </label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--border-radius-sm)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)'
              }}
            />
          </div>
          
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={forceChangePassword}
                onChange={(e) => setForceChangePassword(e.target.checked)}
                style={{ accentColor: 'var(--accent-blue)' }}
              />
              Force user to change password at next logon
            </label>
          </div>
          
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setModalIsOpen(false)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-secondary)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--border-radius-sm)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => handlePasswordReset(currentTab?.name)}
              style={{
                background: 'var(--accent-orange)',
                border: 'none',
                color: 'white',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--border-radius-sm)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                fontWeight: 'var(--font-weight-medium)'
              }}
            >
              Reset Password
            </button>
          </div>
        </div>
      </Modal>
      
      {/* Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--border-primary)',
            zIndex: 'var(--z-tooltip)',
            fontSize: 'var(--font-size-sm)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {tooltip.message}
        </div>
      )}
    </div>
  );
};

export default ModernADProperties;