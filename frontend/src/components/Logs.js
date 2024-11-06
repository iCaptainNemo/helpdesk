import React, { useEffect, useState } from 'react';
import '../styles/Logs.css'; // Import the CSS file

const Logs = ({ adObjectData }) => {
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState(null);
    const [tooltip, setTooltip] = useState({ visible: false, message: '' });

    useEffect(() => {
        let isMounted = true; // Track if the component is mounted

        const fetchLogs = async () => {
            try {
                const adObject = JSON.parse(adObjectData);
                const currentADObjectID = adObject?.sAMAccountName;

                if (!currentADObjectID) {
                    throw new Error('AD Object ID is undefined');
                }

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

                const data = await response.json();
                if (isMounted) {
                    setLogs(data);
                }
            } catch (error) {
                console.error('Error fetching logs:', error);
                if (isMounted) {
                    setError(`Error fetching logs: ${error.message}`);
                }
            }
        };

        if (adObjectData) {
            fetchLogs();
        }

        return () => {
            isMounted = false; // Cleanup function to set isMounted to false
        };
    }, [adObjectData]);

    const copyToClipboard = (value) => {
        navigator.clipboard.writeText(value).then(() => {
            setTooltip({ visible: true, message: 'Copied!' });
            setTimeout(() => setTooltip({ visible: false, message: '' }), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
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