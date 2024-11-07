import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Modal from 'react-modal';
import Logs from '../components/Logs'; // Import the Logs component
import '../styles/ADProperties.css'; // Import CSS for styling

// Set the app element for react-modal
Modal.setAppElement('#root');

// Define the ENDPOINT variable
const ENDPOINT = process.env.REACT_APP_BACKEND_URL;

const ADProperties = () => {
  const { adObjectID } = useParams(); // Get adObjectID from URL parameters
  const navigate = useNavigate();
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
  const adPropertiesTableRef = useRef(null);

  useEffect(() => {
    // Load selected properties from local storage or set default properties
    const savedProperties = JSON.parse(localStorage.getItem('selectedProperties')) || defaultProperties;
    setSelectedProperties(savedProperties);
  }, [defaultProperties]); // Include defaultProperties in the dependency array

  useEffect(() => {
    // Fetch AD object data when adObjectID changes
    const fetchADObjectData = async (id) => {
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

        const data = await response.text();
        setData(JSON.parse(data));
      } catch (error) {
        console.error('Error fetching AD object properties:', error);
        setData({});
      }
    };

    if (adObjectID) {
      fetchADObjectData(adObjectID);
    } else {
      const currentADObjectID = localStorage.getItem('currentADObjectID');
      if (currentADObjectID) {
        navigate(`/ad-object/${currentADObjectID}`);
      }
    }
  }, [adObjectID, navigate]);

  useEffect(() => {
    // Synchronize the heights of the tables
    if (logsTableRef.current && adPropertiesTableRef.current) {
      const adPropertiesTableHeight = adPropertiesTableRef.current.offsetHeight;
      logsTableRef.current.style.maxHeight = `${adPropertiesTableHeight}px`;
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
    localStorage.removeItem('currentADObjectID'); // Remove currentADObjectID from local storage
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        setTooltip({ visible: true, message: 'Copied!' });
        setTimeout(() => setTooltip({ visible: false, message: '' }), 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    } else {
      // Fallback method for copying text
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
          <Logs adObjectData={JSON.stringify(data)} /> {/* Pass adObjectData to Logs component */}
        </div>
        <div id="adPropertiesContainer" ref={adPropertiesTableRef}>
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

export default ADProperties;