import React, { useEffect, useState } from 'react';
import '../styles/Logs.css'; // Import the CSS file

const Logs = () => {
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState(null);
    const [tooltip, setTooltip] = useState({ visible: false, message: '' });

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const currentADObjectID = localStorage.getItem('currentADObjectID');

                if (!currentADObjectID) {
                    throw new Error('AD Object ID is undefined');
                }

                console.log('Fetching logs for AD Object ID:', currentADObjectID); // Add this log

                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/get-logs`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ currentADObjectID }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch logs');
                }

                const logsData = await response.json();
                setLogs(logsData);
            } catch (error) {
                console.error('Error fetching logs:', error);
                setError(`Error fetching logs: ${error.message}`);
            }
        };

        if (localStorage.getItem('currentADObjectID')) {
            fetchLogs();
        }
    }, []);

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
        <div className="logs-container">
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
                            logs.map((log, index) => (
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
};

export default Logs;