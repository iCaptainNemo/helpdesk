import React from 'react';
import '../styles/Notification.css'; // Import the CSS file

const Notification = ({ message, type, onClose }) => {
    if (!message) return null;

    return (
        <div className={`notification ${type}`}>
            <span>{message}</span>
            <button className="close-button" onClick={onClose}>×</button>
        </div>
    );
};

export default Notification;