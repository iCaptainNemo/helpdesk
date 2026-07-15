import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPut } from '../utils/api';
import '../styles/LockedOutUsers.css'; // Import the CSS file
import ScriptButton from './ScriptButton'; // Import the ScriptButton component

const LockedOutUsers = () => {
    const [lockedOutUsers, setLockedOutUsers] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, userID: null });
    const [additionalFields, setAdditionalFields] = useState({});
    const navigate = useNavigate();

    const fetchLockedOutUsers = async () => {
        try {
            const data = await apiGet('/api/get-locked-out-users');
            setLockedOutUsers(Array.isArray(data) ? data : []); // Ensure data is an array
        } catch (error) {
            console.error('Error fetching locked out users:', error);
        }
    };

    const fetchPermissions = async () => {
        const defaultPermissions = ['read', 'write', 'execute', 'unlock_user', 'reset_password'];
        try {
            const data = await apiGet('/api/auth/profile');
            setPermissions(data.permissions || defaultPermissions);
        } catch (error) {
            console.warn('Error fetching permissions, using default permissions:', error);
            // Fallback to default permissions for local mode
            setPermissions(defaultPermissions);
        }
    };

    const updateLockedOutUsers = () => apiPost('/api/update-locked-out-users');

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
                // Check if the user exists
                let user = await apiPost('/api/fetch-user', { adObjectID: userID });

                // If user does not exist, create the user
                if (!user || user.length === 0) {
                    user = await apiPost('/api/fetch-user', {
                        UserID: userID,
                        LastHelped: null,
                        TimesUnlocked: 0,
                        PasswordResets: 0
                    });
                }

                // Update the user with the new stats
                const updatedUser = await apiPut('/api/fetch-user/update', { adObjectID: userID, updates });
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
                                            scriptName="Unlocker"
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