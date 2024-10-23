import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from 'react-modal';
import Logs from '../components/Logs'; // Import the Logs component
import '../styles/UserProperties.css'; // Import CSS for styling

// Set the app element for react-modal
Modal.setAppElement('#root');

const UserProperties = ({ adObjectData }) => {
  const defaultProperties = useMemo(() => [
    'sAMAccountName',
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
  const [selectedProperties, setSelectedProperties] = useState([]);
  const [data, setData] = useState({});
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, message: '' });
  const logsTableRef = useRef(null);
  const userPropertiesTableRef = useRef(null);

  useEffect(() => {
    // Load selected properties from local storage or set default properties
    const savedProperties = JSON.parse(localStorage.getItem('selectedProperties')) || defaultProperties;
    setSelectedProperties(savedProperties);
  }, [defaultProperties]); // Include defaultProperties in the dependency array

  useEffect(() => {
    // Parse adObjectData whenever it changes
    if (adObjectData) {
      try {
        const parsedData = JSON.parse(adObjectData);
        setData(parsedData);
      } catch (error) {
        console.error('Failed to parse adObjectData:', error);
        setData({});
      }
    }
  }, [adObjectData]);

  useEffect(() => {
    // Synchronize the heights of the tables
    if (logsTableRef.current && userPropertiesTableRef.current) {
      const userPropertiesTableHeight = userPropertiesTableRef.current.offsetHeight;
      logsTableRef.current.style.maxHeight = `${userPropertiesTableHeight}px`;
    }
  }, [selectedProperties, data]);

  const formatDate = (windowsFileTime) => {
    const windowsEpochStart = new Date('1601-01-01T00:00:00Z').getTime(); // Windows epoch start in milliseconds
    const windowsFileTimeInMs = parseInt(windowsFileTime, 10) / 10000; // Convert 100-nanosecond intervals to milliseconds
    const date = new Date(windowsEpochStart + windowsFileTimeInMs);
    return date.toLocaleString(); // Converts to local date and time string
  };

  const handlePropertyChange = (event) => {
    const { value, checked } = event.target;
    setSelectedProperties((prev) => {
      const updatedProperties = checked
        ? [...prev, value]
        : prev.filter((prop) => prop !== value);
      localStorage.setItem('selectedProperties', JSON.stringify(updatedProperties));
      return updatedProperties;
    });
  };

  const clearData = () => {
    setData({});
    localStorage.removeItem('adObjectData');
  };

  const stripDistinguishedName = (dn) => {
    return dn.split(',').filter(part => part.startsWith('CN=')).map(part => part.replace('CN=', '')).join(', ');
  };

  const formatValue = (value) => {
    if (Array.isArray(value)) {
      return value.map(stripDistinguishedName).join(', ');
    } else if (typeof value === 'string' && value.match(/^\d+$/)) {
      return formatDate(value);
    } else if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2); // Pretty print JSON objects
    } else if (value === null) {
      return 'N/A'; // Placeholder for null values
    } else {
      return value;
    }
  };

  const copyToClipboard = (value) => {
    navigator.clipboard.writeText(value).then(() => {
      setTooltip({ visible: true, message: 'Copied!' });
      setTimeout(() => setTooltip({ visible: false, message: '' }), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  return (
    <div className="user-properties-container">
      <div className="button-container">
        <button onClick={() => setModalIsOpen(true)} className="settings-button">
          ⚙️
        </button>
        <button onClick={clearData} className="clear-button">
          Clear
        </button>
      </div>
      <div className="table-header">
      </div>
      <div className="tables-container">
        <div className="logs-table-container" ref={logsTableRef}>
          <Logs adObjectData={adObjectData} /> {/* Pass adObjectData to Logs component */}
        </div>
        <div id="userPropertiesContainer" ref={userPropertiesTableRef}>
          <table className="properties-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {selectedProperties.map((key) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td onClick={() => copyToClipboard(formatValue(data[key]))} className="clickable-cell">
                    {formatValue(data[key])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            {Object.keys(data).sort().map((key) => (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    value={key}
                    checked={selectedProperties.includes(key)}
                    onChange={handlePropertyChange}
                    disabled={defaultProperties.includes(key)} // Disable default properties
                  />
                  <span className={defaultProperties.includes(key) ? 'default-property' : ''}>
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

export default UserProperties;