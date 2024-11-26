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
  const [tooltip, setTooltip] = useState({ visible: false, message: '' });
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

  const handlePropertyChange = (event) => {
    const { value, checked } = event.target;
    setTabs((prevTabs) => {
      const updatedTabs = [...prevTabs];
      const updatedProperties = checked
        ? [...updatedTabs[activeTab].selectedProperties, value]
        : updatedTabs[activeTab].selectedProperties.filter((prop) => prop !== value);
      updatedTabs[activeTab].selectedProperties = updatedProperties;
      return updatedTabs;
    });
  };

  const stripDistinguishedName = (dn) => {
    if (typeof dn !== 'string') return dn;
    return dn.split(',').filter(part => part.startsWith('CN=')).map(part => part.replace('CN=', '')).join(', ');
  };

  const formatDate = (dateString) => {
    const date = new Date(parseInt(dateString, 10));
    return date.toLocaleDateString();
  };

  const formatValue = (value) => {
    if (Array.isArray(value)) {
      return value.map(stripDistinguishedName).join(', ');
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

  return (
    <div className="ad-properties-container">
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabClick={handleTabClick}
        onCloseTab={closeTab}
      />
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
                  <td onClick={() => copyToClipboard(formatValue(tabs[activeTab].data[key]))} className="clickable-cell">
                    {formatValue(tabs[activeTab].data[key])}
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
        contentLabel="Select Properties"
        className="modal"
        overlayClassName="overlay"
      >
        <h3>Select Properties to Display</h3>
        <div className="modal-content">
          <ul>
            {Object.keys(tabs[activeTab]?.data || {}).sort().map((key) => (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    value={key}
                    checked={tabs[activeTab]?.selectedProperties.includes(key)}
                    onChange={handlePropertyChange}
                    disabled={defaultUserProperties.includes(key) || defaultComputerProperties.includes(key)}
                  />
                  <span className={defaultUserProperties.includes(key) || defaultComputerProperties.includes(key) ? 'default-property' : ''}>
                    {key}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => setModalIsOpen(false)}>Close</button>
      </Modal>
    </div>
  );
};

export default ADProperties;