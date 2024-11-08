import React, { useEffect, useState } from 'react';
import '../styles/ServerStatus.css'; // Import the CSS file

const ServerStatus = () => {
    const [serverStatuses, setServerStatuses] = useState([]);
    const [error, setError] = useState(null);
    const [showAll, setShowAll] = useState(false);

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
        const intervalId = setInterval(fetchServerStatuses, 60000); // Fetch every 1 minute
        return () => clearInterval(intervalId);
    }, []);

    const toggleShowAll = () => {
        setShowAll(!showAll);
    };

    const filteredStatuses = serverStatuses.filter(server => {
        return server.Status !== 'Online' || server.FileShareService !== 'Running' || showAll;
    });

    const allServersOnline = serverStatuses.every(server => server.Status === 'Online' && server.FileShareService === 'Running');

    return (
        <div className="server-status-container">
            {error ? (
                <p>{error}</p>
            ) : serverStatuses.length === 0 ? (
                <p>No server statuses available.</p>
            ) : (
                <table>
                    <caption>
                        Server Statuses
                        <label className="toggle-switch" title={showAll ? "Hide all servers" : "Show all servers"}>
                            <input type="checkbox" checked={showAll} onChange={toggleShowAll} />
                            <span className="slider"></span>
                        </label>
                    </caption>
                    <thead>
                        <tr>
                            <th>Server Name</th>
                            <th>Status</th>
                            <th>LanmanServer</th>
                            <th>Downtime</th>
                            <th>Last Online</th>
                            <th>Back Online</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allServersOnline && !showAll ? (
                            <tr className="all-servers-online">
                                <td colSpan="6">All Servers Are Online</td>
                            </tr>
                        ) : (
                            filteredStatuses.map((server, index) => (
                                <tr key={index} title={`Location: ${server.Location || 'N/A'}\nDescription: ${server.Description || 'N/A'}`}>
                                    <td>{server.ServerName}</td>
                                    <td className={server.Status === 'Online' ? 'status-online' : 'status-offline'}>{server.Status}</td>
                                    <td className={server.FileShareService === 'Running' ? 'service-running' : server.Status === 'Online' ? 'service-warning' : 'service-not-running'}>{server.FileShareService}</td>
                                    <td>{server.Downtime ? `${server.Downtime} seconds` : 'N/A'}</td>
                                    <td>{server.LastOnline ? new Date(server.LastOnline).toLocaleString() : 'N/A'}</td>
                                    <td>{server.BackOnline ? new Date(server.BackOnline).toLocaleString() : 'N/A'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default ServerStatus;