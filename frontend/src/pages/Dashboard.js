import React from 'react';
import LockedOutUsers from '../components/LockedOutUsers';
import ServerStatus from '../components/ServerStatus';
import DomainControllers from '../components/DomainControllers'; // Import the new component
import '../styles/Dashboard.css'; // Import the CSS file for styling

const Dashboard = () => {
    return (
        <div className="dashboard-page">
            <div className="dashboard-tables-container">
                <LockedOutUsers />
                <ServerStatus />
                <DomainControllers /> {/* Add the new component */}
            </div>
        </div>
    );
};

export default Dashboard;