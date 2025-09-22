import React, { useState } from 'react';
import LockedOutUsers from '../components/LockedOutUsers';
import ServerStatus from '../components/ServerStatus';
import DomainControllers from '../components/DomainControllers';
import ModernDashboard from './ModernDashboard';
import '../styles/Dashboard.css';
import '../styles/theme.css';

const Dashboard = ({ onLogout, permissions = [], adminID = '', adminComputer = '' }) => {
    const [isModernView, setIsModernView] = useState(true);

    const toggleView = () => {
        setIsModernView(!isModernView);
    };

    if (isModernView) {
        return (
            <>
                {/* View Toggle Button */}
                <button
                    onClick={toggleView}
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '80px',
                        background: 'var(--primary-gradient)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--border-radius-md)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        fontSize: 'var(--font-size-sm)',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-md)',
                        zIndex: 'var(--z-fixed)',
                        transition: 'var(--transition-fast)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)'
                    }}
                    title="Switch to Legacy View"
                >
                    🔄 Legacy View
                </button>
                <ModernDashboard 
                    onLogout={onLogout} 
                    permissions={permissions} 
                    adminID={adminID} 
                    adminComputer={adminComputer} 
                />
            </>
        );
    }

    return (
        <div className="dashboard-page">
            {/* View Toggle Button */}
            <button
                onClick={toggleView}
                style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    background: 'var(--primary-gradient)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--border-radius-md)',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    fontSize: 'var(--font-size-sm)',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 'var(--z-fixed)',
                    transition: 'var(--transition-fast)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)'
                }}
                title="Switch to Modern View"
            >
                ✨ Modern View
            </button>
            
            <div className="dashboard-tables-container">
                <LockedOutUsers />
                <ServerStatus />
                <DomainControllers />
            </div>
        </div>
    );
};

export default Dashboard;