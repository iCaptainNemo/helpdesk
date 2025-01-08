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

    const calculateUpDowntime = (onlineTime, offlineTime) => {
        const currentTime = new Date();
        let diffTime;

        if (onlineTime) {
            diffTime = Math.abs(currentTime - new Date(onlineTime));
        } else if (offlineTime) {
            diffTime = Math.abs(currentTime - new Date(offlineTime));
        } else {
            return 'N/A';
        }

        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        const days = Math.floor(diffMinutes / 1440); // 1440 minutes in a day
        const hours = Math.floor((diffMinutes % 1440) / 60);
        const remainingMinutes = diffMinutes % 60;

        let formattedTime = '';
        if (days > 0) {
            formattedTime += `${days} days `;
        }
        if (hours > 0) {
            formattedTime += `${hours} hours `;
        }
        formattedTime += `${remainingMinutes} minutes`;

        return formattedTime;
    };

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
                            <th>Up/Downtime</th>
                            <th>Online Time</th>
                            <th>Offline Time</th>
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
                                    <td>{calculateUpDowntime(server.OnlineTime, server.OfflineTime)}</td>
                                    <td>{server.OnlineTime ? new Date(server.OnlineTime).toLocaleString() : 'N/A'}</td>
                                    <td>{server.OfflineTime ? new Date(server.OfflineTime).toLocaleString() : 'N/A'}</td>
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