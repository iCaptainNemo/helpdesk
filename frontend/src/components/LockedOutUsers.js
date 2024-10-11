import React, { useEffect, useState } from 'react';
import '../styles/LockedOutUsers.css'; // Import the CSS file

const LockedOutUsers = () => {
    const [lockedOutUsers, setLockedOutUsers] = useState([]);

    const fetchLockedOutUsers = () => {
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/get-locked-out-users`)
            .then(response => response.json())
            .then(data => setLockedOutUsers(data))
            .catch(error => console.error('Error fetching locked out users:', error));
    };

    useEffect(() => {
        // Fetch data initially
        fetchLockedOutUsers();

        // Set up interval to fetch data periodically
        const intervalId = setInterval(fetchLockedOutUsers, 60000); // Fetch every 60 seconds

        // Clean up interval on component unmount
        return () => clearInterval(intervalId);
    }, []);

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
            <table>
                <thead>
                    <tr>
                        <th>UserID</th>
                        <th>Name</th>
                        <th>Department</th>
                        <th>Account Lockout Time</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedUsers.map(user => (
                        <tr key={user.UserID} className={isRecentLockout(user.AccountLockoutTime) ? 'recent-lockout' : ''}>
                            <td>{user.UserID}</td>
                            <td>{user.name}</td>
                            <td>{user.department}</td>
                            <td>{formatDate(user.AccountLockoutTime)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default LockedOutUsers;