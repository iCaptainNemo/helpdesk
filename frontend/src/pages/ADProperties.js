import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from 'react-modal';
import Logs from '../components/Logs';
import UserStatusTable from '../components/UserStatusTable'; // Import the UserStatusTable component
import ComputerStatusTable from '../components/ComputerStatusTable'; // Import the ComputerStatusTable component
import '../styles/Tabs.css'; // Import the CSS file for styling the tabs
import '../styles/ADProperties.css';

Modal.setAppElement('#root');

const ENDPOINT = process.env.REACT_APP_BACKEND_URL;

const Tabs = ({ tabs, activeTab, onTabClick, onCloseTab }) => {
  return (
    <div className="tabs-container">
      {tabs.map((tab, index) => (
        <div
          key={index}
          className={`tab ${activeTab === index ? 'active' : ''}`}
          onClick={() => onTabClick(index)}
        >
          {tab.name}
          <button
            className="close-tab"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(index);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

const ADProperties = ({ permissions }) => {
  const { adObjectID } = useParams(); // Get adObjectID from URL parameters
  const navigate = useNavigate();
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
  const [newPassword, setNewPassword] = useState(process.env.TEMP_PASSWORD || 'Fall2024');
  const [forceChangePassword, setForceChangePassword] = useState(true);
  const [tooltip, setTooltip] = useState({ visible: false, message: '' });
  const [additionalFields, setAdditionalFields] = useState({
    LastHelped: null,
    TimesUnlocked: null,
    PasswordResets: null,
    TimesHelped: null
  });
  const logsTableRef = useRef(null);
  const adPropertiesTableRef = useRef(null);

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

  const addTab = useCallback(async (adObjectID) => {
    // Check if the tab already exists
    const existingTabIndex = tabs.findIndex(tab => tab.name === adObjectID);
    if (existingTabIndex !== -1) {
      setActiveTab(existingTabIndex);
      navigate(`/ad-object/${adObjectID}`); // Update the URL
      return;
    }
  
    const data = await fetchADObjectData(adObjectID);
    const allProperties = Object.keys(data); // Get all properties
    const selectedProperties = getDefaultProperties(data.ObjectClass, allProperties);
  
    setTabs((prevTabs) => [
      ...prevTabs,
      { name: adObjectID, data, selectedProperties },
    ]);
    setActiveTab(tabs.length);
    navigate(`/ad-object/${adObjectID}`); // Update the URL
  }, [fetchADObjectData, navigate, tabs, getDefaultProperties]);

  useEffect(() => {
    if (adObjectID) {
      addTab(adObjectID);
    }
  }, [adObjectID, addTab]);

  useEffect(() => {
    sessionStorage.setItem('tabs', JSON.stringify(tabs));
  }, [tabs]);

  const closeTab = (index) => {
    setTabs((prevTabs) => prevTabs.filter((_, i) => i !== index));
    if (activeTab >= index && activeTab > 0) {
      setActiveTab(activeTab - 1);
      navigate(`/ad-object/${tabs[activeTab - 1].name}`); // Update the URL
    } else if (tabs.length > 1) {
      setActiveTab(0);
      navigate(`/ad-object/${tabs[0].name}`); // Update the URL
    } else {
      navigate('/ad-object'); // Clear the URL if no tabs are left
    }
  };

  const handleTabClick = (index) => {
    setActiveTab(index);
    navigate(`/ad-object/${tabs[index].name}`); // Update the URL
  };

  const stripDistinguishedName = (dn) => {
    if (typeof dn !== 'string') return dn;
    return dn.split(',').filter(part => part.startsWith('CN=')).map(part => part.replace('CN=', '')).join(', ');
  };

  const formatDate = (unixTime) => {
    const date = new Date(parseInt(unixTime, 10));
    return date.toLocaleString(); // Converts to local date and time string
  };

  const isWithin14Days = (date) => {
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 14;
  };

  const formatValue = (key, value) => {
    if (Array.isArray(value)) {
      return value.map(stripDistinguishedName).join(', ');
    } else if (key === 'Created') {
      const formattedDate = formatDate(value);
      const date = new Date(parseInt(value, 10));
      const isRecent = isWithin14Days(date);
      return (
        <span style={{ color: isRecent ? '#90ee90' : 'inherit' }}>
          {formattedDate}
        </span>
      );
    } else if (typeof value === 'string' && value.match(/^\d+$/)) {
      return formatDate(value);
    } else if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    } else if (value === null) {
      return 'N/A';
    } else {
      return value;
    }
  };

  const copyToClipboard = (value) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        setTooltip({ visible: true, message: 'Copied!' });
        setTimeout(() => setTooltip({ visible: false, message: '' }), 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setTooltip({ visible: true, message: 'Copied!' });
        setTimeout(() => setTooltip({ visible: false, message: '' }), 2000);
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const launchProgram = (program, args) => {
    let url;
    if (program === 'CmRcViewer') {
      url = `jarvis:CmRcView${args}`;
    } else if (program === 'msra') {
      url = `jarvis:msra${args}`;
    } else if (program === 'powershell') {
      url = `jarvis:powershe${args}`;
    } else if (program === 'cmd') {
      url = `jarvis:cmd.exe${args}`;
    } else {
      url = `jarvis:${program}${args}`;
    }
    window.location.href = url;
  };

  const handleResetPassword = async () => {
    try {
      // First command to reset the password
      const resetPasswordCommand = `Set-ADAccountPassword -Identity ${adObjectID} -Reset -NewPassword (ConvertTo-SecureString -AsPlainText "${newPassword}" -Force) -ErrorAction Stop;`;
      const resetPasswordResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ command: resetPasswordCommand }),
      });
  
      if (!resetPasswordResponse.ok) {
        throw new Error('Failed to reset password');
      }
  
      // If the toggle switch is enabled, run the second command
      if (forceChangePassword) {
        const changePasswordAtLogonCommand = `
          Set-ADUser -Identity ${adObjectID} -ChangePasswordAtLogon $true -ErrorAction Stop;
        `;
        const changePasswordAtLogonResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ command: changePasswordAtLogonCommand }),
        });
  
        if (!changePasswordAtLogonResponse.ok) {
          throw new Error('Failed to set change password at logon');
        }
      }
  
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
        PasswordResets: (additionalFields.PasswordResets || 0) + 1
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
  
      alert('Password reset successfully');
      setModalIsOpen(false);
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Failed to reset password');
    }
  };

  return (
    <div className="ad-properties-container">
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabClick={handleTabClick}
        onCloseTab={closeTab}
      />
      {tabs[activeTab]?.data.ObjectClass === 'computer' && (
        <div className="button-container">
          <button onClick={() => launchProgram('CmRcViewer', adObjectID)} className="launch-button">
            CmRcViewer
          </button>
          <button onClick={() => launchProgram('msra', adObjectID)} className="launch-button">
            msra
          </button>
          <button onClick={() => launchProgram('powershell', adObjectID)} className="launch-button">
            PowerShell
          </button>
          <button onClick={() => launchProgram('cmd', adObjectID)} className="launch-button">
            Command Prompt
          </button>
        </div>
      )}
      {tabs[activeTab]?.data.ObjectClass === 'user' && (
        <div className="button-container">
          <button onClick={() => setModalIsOpen(true)} className="launch-button">
            Reset Password
          </button>
        </div>
      )}
      <div className="button-container">
        <button onClick={() => setModalIsOpen(true)} className="settings-button">
          ⚙️
        </button>
      </div>
      <div className="tables-container">
        <div className="logs-table-container" ref={logsTableRef}>
          <Logs adObjectID={tabs[activeTab]?.name} />
        </div>
        <div id="adPropertiesContainer" ref={adPropertiesTableRef}>
          <table className="properties-table">
            <thead>
              <tr>
                <th colSpan="2">AD Properties</th>
              </tr>
            </thead>
            <tbody>
              {tabs[activeTab]?.selectedProperties.map((key) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td onClick={() => copyToClipboard(formatValue(key, tabs[activeTab].data[key]))} className="clickable-cell">
                    {formatValue(key, tabs[activeTab].data[key])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(tabs[activeTab]?.data.ObjectClass === 'user') && (
          <div className="user-account-status-table-container">
            <UserStatusTable
              adObjectID={tabs[activeTab]?.name} // Pass adObjectID to UserStatusTable
              permissions={permissions} // Pass permissions to UserStatusTable
            />
          </div>
        )}
        {(tabs[activeTab]?.data.ObjectClass === 'computer') && (
          <div className="computer-status-table-container">
            <ComputerStatusTable
              adObjectID={tabs[activeTab]?.name} // Pass adObjectID to ComputerStatusTable
            />
          </div>
        )}
      </div>
      {tooltip.visible && <div className="tooltip">{tooltip.message}</div>}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Reset Password"
        className="modal"
        overlayClassName="overlay"
      >
        <h2>Reset Password</h2>
        <form>
          <label>
            New Password:
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label><br />
          <label>
            Change Password at Next Logon:
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={forceChangePassword}
                onChange={(e) => setForceChangePassword(e.target.checked)}
              />
              <span className="slider"></span>
              {/* <span className="tooltip">Force change on next logon</span> */}
            </div>
          </label>
          <div className="button-container">
            <button type="button" onClick={handleResetPassword}>
              Save
            </button>
            <button type="button" onClick={() => setModalIsOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ADProperties;