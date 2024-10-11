import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import '../styles/UserProperties.css'; // Import CSS for styling

// Set the app element for react-modal
Modal.setAppElement('#root');

const UserProperties = ({ adObjectData }) => {
  const [selectedProperties, setSelectedProperties] = useState([]);
  const [data, setData] = useState({});
  const [modalIsOpen, setModalIsOpen] = useState(false);

  useEffect(() => {
    // Load selected properties from local storage or set default properties
    const savedProperties = JSON.parse(localStorage.getItem('selectedProperties')) || [
      'sAMAccountName', 'Name', 'department', 'AccountLockoutTime', 'Enabled'
    ];
    setSelectedProperties(savedProperties);
  }, []);

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

  const formatDate = (unixTime) => {
    const date = new Date(parseInt(unixTime, 10));
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

  return (
    <div className="user-properties-container">
      <h2>User Properties</h2>
      <div className="button-container">
        <button onClick={() => setModalIsOpen(true)} className="settings-button">
          ⚙️
        </button>
        <button onClick={clearData} className="clear-button">
          Clear
        </button>
      </div>
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
            {Object.keys(data).map((key) => (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    value={key}
                    checked={selectedProperties.includes(key)}
                    onChange={handlePropertyChange}
                  />
                  {key}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => setModalIsOpen(false)}>Close</button>
      </Modal>
      <div id="userPropertiesContainer">
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
                <td>
                  {Array.isArray(data[key])
                    ? data[key].join(', ')
                    : typeof data[key] === 'string' && data[key].match(/^\d+$/)
                    ? formatDate(data[key])
                    : JSON.stringify(data[key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserProperties;