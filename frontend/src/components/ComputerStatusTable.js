import React, { useEffect, useState } from 'react';
import '../styles/ComputerStatusTable.css';

const ComputerStatusTable = ({ adObjectID }) => {
  const [computerStatus, setComputerStatus] = useState('Checking...');
  const [autoRefresh, setAutoRefresh] = useState(true); // State to control auto-refresh

  useEffect(() => {
    const fetchComputerStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        const command = `Test-Connection -ComputerName ${adObjectID} -Count 1 -Quiet -ErrorAction Stop`;
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ command }),
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
 //       console.log('Received data:', data); // Debugging information
        setComputerStatus(data === true ? 'Online' : 'Offline');
      } catch (error) {
        console.error('Error fetching computer status:', error);
        setComputerStatus('Offline');
      }
    };

    fetchComputerStatus();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchComputerStatus, 5000); // Refresh every 5 seconds
    }

    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, [adObjectID, autoRefresh]);

  return (
    <div className="computer-status-table-container">
      <table className="computer-status-table">
        <thead>
          <tr>
            <th colSpan="2">
              Computer Status
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
        </tbody>
      </table>
    </div>
  );
};

export default ComputerStatusTable;