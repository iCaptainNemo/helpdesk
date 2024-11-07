import React, { useEffect, useState } from 'react';
import '../styles/ServerStatus.css'; // Import the CSS file

const ServerStatus = () => {
    const [serverStatuses, setServerStatuses] = useState([]);
    const [error, setError] = useState(null);

    const fetchServerStatuses = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/servers/status`);
            if (!response.ok) {
                throw new Error('Failed to fetch server statuses');
            }
            const data = await response.json();
            // Ensure data is an array
            const statusesArray = Array.isArray(data) ? data : [data];
            setServerStatuses(statusesArray);
        } catch (error) {
            console.error('Error fetching server statuses:', error);
            setError(`Error fetching server statuses: ${error.message}`);
        }
    };

    useEffect(() => {
        fetchServerStatuses();
        const intervalId = setInterval(fetchServerStatuses, 60000); // Fetch every 1 minutes

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="server-status-container">
            {error ? (
                <p>{error}</p>
            ) : serverStatuses.length === 0 ? (
                <p>No server statuses available.</p>
            ) : (
                <table>
                    <caption>Server Statuses</caption>
                    <thead>
                        <tr>
                            <th>Server Name</th>
                            <th>Status</th>
                            <th>File Share Service</th>
                        </tr>
                    </thead>
                    <tbody>
                        {serverStatuses.map((server, index) => (
                            <tr key={index}>
                                <td>{server.ServerName}</td>
                                <td>{server.Status}</td>
                                <td>{server.FileShareService}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default ServerStatus;