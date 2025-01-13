import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LockedOutUsers.css'; // Import the CSS file
import ScriptButton from './ScriptButton'; // Import the ScriptButton component

const LockedOutUsers = () => {
    const [lockedOutUsers, setLockedOutUsers] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, userID: null });
    const [additionalFields, setAdditionalFields] = useState({});
    const navigate = useNavigate();

    const fetchLockedOutUsers = () => {
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/get-locked-out-users`)
            .then(response => response.json())
            .then(data => setLockedOutUsers(Array.isArray(data) ? data : [])) // Ensure data is an array
            .catch(error => console.error('Error fetching locked out users:', error));
    };

    const fetchPermissions = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/profile`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch permissions');
            }

            const data = await response.json();
            setPermissions(data.permissions || []); // Ensure permissions is an array
        } catch (error) {
            console.error('Error fetching permissions:', error);
        }
    };

    const updateLockedOutUsers = () => {
        return fetch(`${process.env.REACT_APP_BACKEND_URL}/api/update-locked-out-users`, {
            method: 'POST'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update locked out users');
            }
        })
        .catch(error => {
            console.error('Error updating locked out users:', error);
            throw error;
        });
    };

    useEffect(() => {
        // Fetch data initially
        fetchLockedOutUsers();
        fetchPermissions();
        // Set up interval to fetch data periodically
        const intervalId = setInterval(fetchLockedOutUsers, 60000); // Fetch every 60 seconds

        // Clean up interval on component unmount
        return () => clearInterval(intervalId);
    }, []);

    const handleUnlockSuccess = async (result, userID) => {
        if (result.message.includes('Unlocked')) {
            setLockedOutUsers(prevUsers => prevUsers.filter(user => user.UserID !== userID));
    
            // Update user stats
            const updates = {
                LastHelped: new Date().toISOString(),
                TimesHelped: (additionalFields.TimesHelped || 0) + 1,
                TimesUnlocked: (additionalFields.TimesUnlocked || 0) + 1
            };
    
            try {
                const token = localStorage.getItem('token');
                if (!token) throw new Error('No token found');
    
                const backendUrl = process.env.REACT_APP_BACKEND_URL;
                if (!backendUrl) throw new Error('Backend URL is not defined');
    
                // Check if the user exists
                let response = await fetch(`${backendUrl}/api/fetch-user`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ adObjectID: userID }),
                });
    
                if (!response.ok) throw new Error('Network response was not ok');
    
                let user = await response.json();
    
                // If user does not exist, create the user
                if (!user || user.length === 0) {
                    const newUser = {
                        UserID: userID,
                        LastHelped: null,
                        TimesUnlocked: 0,
                        PasswordResets: 0
                    };
    
                    response = await fetch(`${backendUrl}/api/fetch-user`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify(newUser),
                    });
    
                    if (!response.ok) throw new Error('Failed to create new user');
    
                    user = await response.json();
                }
    
                // Update the user with the new stats
                response = await fetch(`${backendUrl}/api/fetch-user/update`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ adObjectID: userID, updates }),
                });
    
                if (!response.ok) throw new Error('Network response was not ok');
    
                const updatedUser = await response.json();
                setAdditionalFields((prevFields) => ({
                    ...prevFields,
                    ...updatedUser
                }));
            } catch (error) {
                console.error('Error updating user stats:', error);
            }
        }
        updateLockedOutUsers()
            .then(() => fetchLockedOutUsers()) // Fetch the updated list after updating
            .catch(error => console.error('Error updating or fetching locked out users:', error));
    };

    const formatDate = (unixTime) => {
        const date = new Date(parseInt(unixTime, 10));
        return date.toLocaleString(); // Converts to local date and time string
    };

    const sortedUsers = lockedOutUsers.sort((a, b) => b.AccountLockoutTime - a.AccountLockoutTime);

    const isRecentLockout = (lockoutTime) => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        return parseInt(lockoutTime, 10) >= fiveMinutesAgo;
    };

    const handleContextMenu = (event, userID) => {
        event.preventDefault();
        setContextMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            userID
        });
    };

    const handleCloseContextMenu = useCallback((event) => {
        if (contextMenu.visible && !event.target.closest('.context-menu')) {
            setContextMenu({ visible: false, x: 0, y: 0, userID: null });
        }
    }, [contextMenu.visible]);

    const handleOpen = () => {
        if (contextMenu.userID) {
            navigate(`/ad-object/${contextMenu.userID}`);
        }
        setContextMenu({ visible: false, x: 0, y: 0, userID: null });
    };

    useEffect(() => {
        document.addEventListener('click', handleCloseContextMenu);
        return () => {
            document.removeEventListener('click', handleCloseContextMenu);
        };
    }, [handleCloseContextMenu]);

    return (
        <div className="locked-out-users-container">
            <table>
                <caption>Locked Out Users</caption>
                <thead>
                    <tr>
                        <th>UserID</th>
                        <th>Name</th>
                        <th>Department</th>
                        <th>Account Lockout Time</th>
                        {permissions.includes('execute_script') && <th>Action</th>}
                    </tr>
                </thead>
                <tbody>
                    {lockedOutUsers.length === 0 ? (
                        <tr>
                            <td colSpan={permissions.includes('execute_script') ? 5 : 4}>
                                No locked out users found.
                            </td>
                        </tr>
                    ) : (
                        sortedUsers.map(user => (
                            <tr
                                key={user.UserID}
                                className={isRecentLockout(user.AccountLockoutTime) ? 'recent-lockout' : ''}
                                onContextMenu={(event) => handleContextMenu(event, user.UserID)}
                            >
                                <td>{user.UserID}</td>
                                <td>{user.name}</td>
                                <td>{user.department}</td>
                                <td>{formatDate(user.AccountLockoutTime)}</td>
                                {permissions.includes('execute_script') && (
                                    <td>
                                        <ScriptButton
                                            scriptName="unlocker"
                                            params={{ userID: user.UserID }}
                                            buttonText="Unlock"
                                            onSuccess={(result) => handleUnlockSuccess(result, user.UserID)}
                                        />
                                    </td>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            {contextMenu.visible && (
                <div
                    className="context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button onClick={handleOpen}>Open {contextMenu.userID}</button>
                </div>
            )}
        </div>
    );
};

export default LockedOutUsers;