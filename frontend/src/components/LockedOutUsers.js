import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LockedOutUsers.css'; // Import the CSS file
import ScriptButton from './ScriptButton'; // Import the ScriptButton component

const LockedOutUsers = () => {
    const [lockedOutUsers, setLockedOutUsers] = useState([]);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, userID: null });
    const navigate = useNavigate();

    const fetchLockedOutUsers = () => {
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/get-locked-out-users`)
            .then(response => response.json())
            .then(data => setLockedOutUsers(Array.isArray(data) ? data : [])) // Ensure data is an array
            .catch(error => console.error('Error fetching locked out users:', error));
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
        // Set up interval to fetch data periodically
        const intervalId = setInterval(fetchLockedOutUsers, 60000); // Fetch every 60 seconds

        // Clean up interval on component unmount
        return () => clearInterval(intervalId);
    }, []);

    const handleUnlockSuccess = (result, userID) => {
        if (result.message.includes('Unlocked')) {
            setLockedOutUsers(prevUsers => prevUsers.filter(user => user.UserID !== userID));
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

    const handleCloseContextMenu = (event) => {
        if (contextMenu.visible && !event.target.closest('.context-menu')) {
            setContextMenu({ visible: false, x: 0, y: 0, userID: null });
        }
    };

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
    }, [contextMenu]);

    return (
        <div className="locked-out-users-container">
            {lockedOutUsers.length === 0 ? (
                <p>No locked out users found.</p>
            ) : (
                <table>
                    <caption>Locked Out Users</caption>
                    <thead>
                        <tr>
                            <th>UserID</th>
                            <th>Name</th>
                            <th>Department</th>
                            <th>Account Lockout Time</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedUsers.map(user => (
                            <tr
                                key={user.UserID}
                                className={isRecentLockout(user.AccountLockoutTime) ? 'recent-lockout' : ''}
                                onContextMenu={(event) => handleContextMenu(event, user.UserID)}
                            >
                                <td>{user.UserID}</td>
                                <td>{user.name}</td>
                                <td>{user.department}</td>
                                <td>{formatDate(user.AccountLockoutTime)}</td>
                                <td>
                                    <ScriptButton
                                        scriptName="unlocker"
                                        params={{ userID: user.UserID }}
                                        buttonText="Unlock"
                                        onSuccess={(result) => handleUnlockSuccess(result, user.UserID)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
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