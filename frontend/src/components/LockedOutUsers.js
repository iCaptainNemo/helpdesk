import React, { useEffect, useState } from 'react';
import '../styles/LockedOutUsers.css'; // Import the CSS file
import ScriptButton from './ScriptButton'; // Import the ScriptButton component

const LockedOutUsers = () => {
    const [lockedOutUsers, setLockedOutUsers] = useState([]);
    const sessionID = localStorage.getItem('sessionID'); // Retrieve session ID from local storage

    const fetchLockedOutUsers = () => {
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/get-locked-out-users`)
            .then(response => response.json())
            .then(data => setLockedOutUsers(Array.isArray(data) ? data : [])) // Ensure data is an array
            .catch(error => console.error('Error fetching locked out users:', error));
    };

    const updateLockedOutUsers = () => {
        return fetch(`${process.env.REACT_APP_BACKEND_URL}/api/update-locked-out-users`, {
            method: 'POST',
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

    return (
        <div className="locked-out-users-container">
            <h2>Locked Out Users</h2>
            {lockedOutUsers.length === 0 ? (
                <p>No locked out users.</p>
            ) : (
                <table>
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
                            <tr key={user.UserID} className={isRecentLockout(user.AccountLockoutTime) ? 'recent-lockout' : ''}>
                                <td>{user.UserID}</td>
                                <td>{user.name}</td>
                                <td>{user.department}</td>
                                <td>{formatDate(user.AccountLockoutTime)}</td>
                                <td>
                                    <ScriptButton
                                        scriptName="unlocker"
                                        params={{ userID: user.UserID }}
                                        sessionID={sessionID} // Pass sessionID to ScriptButton
                                        buttonText="Unlock"
                                        onSuccess={(result) => handleUnlockSuccess(result, user.UserID)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default LockedOutUsers;