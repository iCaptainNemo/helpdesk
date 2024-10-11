import React from 'react';

const Placeholder = () => {
    return (
        <div>
            <h2>Placeholder</h2>
            <p>This is a placeholder for a different view.</p>
            <form id="tokenCheckForm" onSubmit={handleTokenCheck}>
                <button type="submit">Check Token</button>
            </form>
            <div id="tokenCheckOutput"></div>
        </div>
    );
};

const handleTokenCheck = async (event) => {
    event.preventDefault();
    try {
        const response = await fetch('/api/auth/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
            }
        });

        if (!response.ok) {
            throw new Error('Token verification failed');
        }

        const data = await response.json();
        document.getElementById('tokenCheckOutput').innerText = 'Token is valid: ' + JSON.stringify(data);
    } catch (error) {
        console.error('Error verifying token:', error);
        document.getElementById('tokenCheckOutput').innerText = 'Error verifying token';
    }
};

export default Placeholder;