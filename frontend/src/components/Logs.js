import React, { useEffect, useState, forwardRef } from 'react';
import { apiPost } from '../utils/api';
import '../styles/Logs.css'; // Import the CSS file
import '../styles/theme.css'; // Import modern theme

const Logs = forwardRef(({ adObjectID }, ref) => {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, message: '' });

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        if (!adObjectID) {
          throw new Error('AD Object ID is undefined');
        }

       // console.log('Fetching logs for AD Object ID:', adObjectID); // Add this log

        // Cache briefly so switching between AD tabs doesn't re-pull the same logs.
        const logsData = await apiPost('/api/get-logs', { adObjectID }, { cache: 60000 });
       // console.log('Fetched logs data:', logsData); // Add this log

        if (Array.isArray(logsData)) {
          setLogs(logsData.reverse()); // Reverse the logs order if it's an array
        } else if (typeof logsData === 'object' && logsData !== null) {
          setLogs([logsData]); // Wrap the single log entry in an array
        } else {
          throw new Error('Logs data is not an array or an object');
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
        setError(`Error fetching logs: ${error.message}`);
      }
    };

    if (adObjectID) {
      fetchLogs();
    }
  }, [adObjectID]);

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
    <div ref={ref} className="logs-container theme-modern">
      <div className="table-container">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Computer</th>
              <th>Day</th>
              <th>Date</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan="4">{error}</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="4">No logs available.</td>
              </tr>
            ) : (
              logs.slice(0, 30).map((log, index) => (
                <tr key={index}>
                  <td onClick={() => copyToClipboard(log.Computer)} className="clickable-cell">
                    {log.Computer}
                  </td>
                  <td>{log.Day}</td>
                  <td>{log.Date}</td>
                  <td>{log.Time}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {tooltip.visible && <div className="tooltip">{tooltip.message}</div>}
    </div>
  );
});

Logs.displayName = 'Logs';

export default Logs;