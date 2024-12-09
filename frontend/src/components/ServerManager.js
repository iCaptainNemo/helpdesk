import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import '../styles/ServerManager.css'; // Import the CSS file for styling

Modal.setAppElement('#root'); // Set the app element for accessibility

const ServerManager = () => {
    const [servers, setServers] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState(null);
    const [editMode, setEditMode] = useState(null); // Track which server is being edited
    const [editServer, setEditServer] = useState({}); // Track the edited server details
    const [isModalOpen, setIsModalOpen] = useState(false); // Track modal open state
    const [newServerDetails, setNewServerDetails] = useState({}); // Track new server details

    useEffect(() => {
        fetchServers();
    }, []);

    const fetchServers = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/server-manager`);
            if (!response.ok) {
                throw new Error('Failed to fetch servers');
            }
            const data = await response.json();
            setServers(data);
        } catch (error) {
            console.error('Error fetching servers:', error);
            setError(`Error fetching servers: ${error.message}`);
        }
    };

    const handleSearch = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/multi-fetch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ adObjectIDs: [searchQuery] }),
            });
            if (!response.ok) {
                throw new Error('Failed to search servers');
            }
            const data = await response.json();
            const existingServerNames = servers.map(server => server.ServerName.toLowerCase());
            const filteredResults = data[0].result.filter(result => !existingServerNames.includes(result.CN.toLowerCase()));
            setSearchResults(filteredResults); // Set the filtered search results
            setIsModalOpen(true); // Open the modal with search results
        } catch (error) {
            console.error('Error searching servers:', error);
            setError(`Error searching servers: ${error.message}`);
        }
    };

    const handleAddServer = async (server) => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/server-manager`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    ServerName: server.CN,
                    Description: newServerDetails[server.CN]?.Description || '',
                    Location: newServerDetails[server.CN]?.Location || ''
                }),
            });
            if (!response.ok) {
                throw new Error('Failed to add server');
            }
            fetchServers(); // Refresh the server list
            setSearchResults(prevResults => prevResults.filter(result => result.CN !== server.CN)); // Remove added server from search results
        } catch (error) {
            console.error('Error adding server:', error);
            setError(`Error adding server: ${error.message}`);
        }
    };

    const handleRemoveServer = async (serverName) => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/server-manager/${serverName}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to remove server');
            }
            fetchServers(); // Refresh the server list
        } catch (error) {
            console.error('Error removing server:', error);
            setError(`Error removing server: ${error.message}`);
        }
    };

    const handleEditServer = (server) => {
        setEditMode(server.ServerName);
        setEditServer(server);
    };

    const handleSaveServer = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/server-manager/${editServer.ServerName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(editServer),
            });
            if (!response.ok) {
                throw new Error('Failed to update server');
            }
            setEditMode(null);
            fetchServers(); // Refresh the server list
        } catch (error) {
            console.error('Error updating server:', error);
            setError(`Error updating server: ${error.message}`);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditServer({ ...editServer, [name]: value });
    };

    const handleNewServerDetailsChange = (e, cn) => {
        const { name, value } = e.target;
        setNewServerDetails((prevDetails) => ({
            ...prevDetails,
            [cn]: {
                ...prevDetails[cn],
                [name]: value
            }
        }));
    };

    return (
        <div className="server-manager-container">
            <h2>Server Manager</h2>
            {error && <p className="error">{error}</p>}
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search for servers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button onClick={handleSearch}>Search</button>
            </div>
            <table className="server-table">
                <thead>
                    <tr>
                        <th>Server Name</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Location</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {servers.map((server) => (
                        <tr key={server.ServerName}>
                            <td>{server.ServerName}</td>
                            <td>
                                {editMode === server.ServerName ? (
                                    <input
                                        type="text"
                                        name="Description"
                                        value={editServer.Description}
                                        onChange={handleChange}
                                    />
                                ) : (
                                    server.Description
                                )}
                            </td>
                            <td>{server.Status}</td>
                            <td>
                                {editMode === server.ServerName ? (
                                    <input
                                        type="text"
                                        name="Location"
                                        value={editServer.Location}
                                        onChange={handleChange}
                                    />
                                ) : (
                                    server.Location
                                )}
                            </td>
                            <td>
                                {editMode === server.ServerName ? (
                                    <button onClick={handleSaveServer}>Save</button>
                                ) : (
                                    <>
                                        <button onClick={() => handleEditServer(server)}>Edit</button>
                                        <button onClick={() => handleRemoveServer(server.ServerName)}>Delete</button>
                                    </>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <Modal
                isOpen={isModalOpen}
                onRequestClose={() => setIsModalOpen(false)}
                contentLabel="Search Results"
                className="modal"
                overlayClassName="overlay"
            >
                <h3>Search Results</h3>
                <table className="search-results-table">
                    <thead>
                        <tr>
                            <th>Server Name</th>
                            <th>Description</th>
                            <th>Location</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {searchResults.map((result) => (
                            <tr key={result.CN}>
                                <td>{result.CN}</td>
                                <td>
                                    <input
                                        type="text"
                                        name="Description"
                                        placeholder="Enter description"
                                        onChange={(e) => handleNewServerDetailsChange(e, result.CN)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        name="Location"
                                        placeholder="Enter location"
                                        onChange={(e) => handleNewServerDetailsChange(e, result.CN)}
                                    />
                                </td>
                                <td>
                                    <button onClick={() => handleAddServer(result)}>Add</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={() => setIsModalOpen(false)}>Close</button>
            </Modal>
        </div>
    );
};

export default ServerManager;