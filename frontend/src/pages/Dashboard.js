import React from 'react';
import LockedOutUsers from '../components/LockedOutUsers';

const Dashboard = () => {
    return (
        <div>
            <h2>Dashboard</h2>
            <form id="helloWorldForm" onSubmit={handleHelloWorldButtonClick}>
                <button type="submit">Test</button>
            </form>
            <div id="helloWorldOutputContainer"></div>
            <LockedOutUsers />
        </div>
    );
};

const handleHelloWorldButtonClick = async (event) => {
    event.preventDefault();
    try {
        const response = await fetch('/api/hello-world', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        document.getElementById('helloWorldOutputContainer').innerText = data.message;
    } catch (error) {
        console.error('Error fetching hello world output:', error);
        document.getElementById('helloWorldOutputContainer').innerText = 'Error fetching hello world output';
    }
};

export default Dashboard;