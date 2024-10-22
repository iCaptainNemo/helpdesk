import React, { useEffect, useState } from 'react';
import '../styles/Logs.css'; // Import the CSS file

const Logs = ({ adObjectData }) => {
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const currentADObjectID = JSON.parse(adObjectData).sAMAccountName;
                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/get-logs`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ currentADObjectID }),
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch logs');
                }
                const data = await response.json();
                setLogs(data.LogTable);
            } catch (error) {
                console.error('Error fetching logs:', error);
                setError('Error fetching logs');
            }
        };

        if (adObjectData) {
            fetchLogs();
        }
    }, [adObjectData]);

    const copyToClipboard = (value) => {
        navigator.clipboard.writeText(value).then(() => {
            alert('Copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    };

    return (
        <div className="logs-container">
            <h2>Logs</h2>
            <table className="logs-table">
                <thead>
                    <tr>
                        <th>Log Entry</th>
                    </tr>
                </thead>
                <tbody>
                    {error ? (
                        <tr>
                            <td>{error}</td>
                        </tr>
                    ) : logs.length === 0 ? (
                        <tr>
                            <td>No logs available.</td>
                        </tr>
                    ) : (
                        logs.map((log, index) => (
                            <tr key={index}>
                                <td onClick={() => copyToClipboard(log)} className="clickable-cell">
                                    {log}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default Logs;