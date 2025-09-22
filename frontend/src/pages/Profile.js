import React, { useEffect, useState } from 'react';
import '../styles/Profile.css';
import '../styles/theme.css';
import '../styles/grid.css';

const Profile = ({ permissions }) => {
    const [isModernView, setIsModernView] = useState(true);
    const [profile, setProfile] = useState({});
    const [roles, setRoles] = useState([]);
    const [error, setError] = useState(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [tempPassword, setTempPassword] = useState('');
    const [newTempPassword, setNewTempPassword] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/profile`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch profile');
                }

                const data = await response.json();
                // console.log('Profile data UI:', data); 
                setProfile(data.profile);
                setRoles(data.roles || []); // Ensure roles is an array
                setTempPassword(data.profile.temppassword || ''); // Set the current temporary password
            } catch (error) {
                console.error('Error fetching profile:', error);
                setError('Error fetching profile');
            }
        };

        fetchProfile();
    }, []);

    const handlePasswordUpdate = async (event) => {
        event.preventDefault();
        if (newPassword !== confirmNewPassword) {
            alert('New passwords do not match');
            return;
        }
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/update-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            if (!response.ok) {
                throw new Error('Failed to update password');
            }

            alert('Password updated successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (error) {
            console.error('Error updating password:', error);
            setError('Error updating password');
        }
    };

    const handleTempPasswordUpdate = async (event) => {
        event.preventDefault();
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/update-temp-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
                },
                body: JSON.stringify({ tempPassword: newTempPassword })
            });

            if (!response.ok) {
                throw new Error('Failed to update temporary password');
            }

            alert('Temporary password updated successfully');
            setTempPassword(newTempPassword); // Update the current temp password display
            setNewTempPassword(''); // Clear the input field
        } catch (error) {
            console.error('Error updating temporary password:', error);
            setError('Error updating temporary password');
        }
    };

    const toggleView = () => {
        setIsModernView(!isModernView);
    };

    // Legacy View
    if (!isModernView) {
        return (
            <div className="profile-container">
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
                
                <h2>Profile</h2>
                {error && <p>{error}</p>}
                <div>
                    <h3>Admin ID</h3>
                    <p>{profile.AdminID}</p>
                </div>
                <div>
                    <h3>Update Password</h3>
                    <form onSubmit={handlePasswordUpdate} className="form-container">
                        <input
                            type="password"
                            placeholder="Current Password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="New Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Confirm New Password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                        />
                        <button type="submit" className="simple-button">Update Password</button>
                    </form>
                </div>
                <div>
                    <h3>Temporary Active Directory Reset Password</h3>
                    <p>Current Temporary Password: {tempPassword}</p>
                    <form onSubmit={handleTempPasswordUpdate} className="form-container">
                        <input
                            type="text"
                            placeholder="New Temporary Password"
                            value={newTempPassword}
                            onChange={(e) => setNewTempPassword(e.target.value)}
                        />
                        <button type="submit" className="simple-button">Update Temporary Password</button>
                    </form>
                </div>
                <div>
                    <h3>Roles</h3>
                    <ul>
                        {roles.map((role, index) => (
                            <li key={index}>{role.RoleName}</li>
                        ))}
                    </ul>
                </div>
                <div>
                    <h3>Permissions</h3>
                    <ul>
                        {permissions.map((permission, index) => (
                            <li key={index}>{permission}</li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    }

    // Modern View
    return (
        <div className="theme-modern min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 'var(--spacing-lg)' }}>
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
                title="Switch to Legacy View"
            >
                🔄 Legacy View
            </button>

            {/* Header */}
            <div className="mb-xl">
                <h1 className="text-3xl font-bold mb-sm" style={{ color: 'var(--text-primary)' }}>
                    👨‍💼 User Profile
                </h1>
                <p className="text-secondary">Manage your account settings and security preferences</p>
            </div>

            {error && (
                <div className="dashboard-card mb-lg" style={{ background: 'var(--status-error)', border: '1px solid var(--status-error)', borderRadius: 'var(--border-radius-md)', padding: 'var(--spacing-md)' }}>
                    <p style={{ color: 'white', margin: 0 }}>⚠️ {error}</p>
                </div>
            )}

            <div className="grid gap-lg" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
                {/* Admin Information Card */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">👤 Account Information</h3>
                            <p className="card-subtitle">Your administrator details</p>
                        </div>
                    </div>
                    <div className="card-content">
                        <div className="space-y-md">
                            <div>
                                <label className="text-sm font-medium text-secondary mb-xs block">Admin ID</label>
                                <div className="p-md bg-bg-secondary rounded-md border border-border-secondary">
                                    <span className="text-primary font-medium">{profile.AdminID || 'Loading...'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Password Update Card */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">🔐 Update Password</h3>
                            <p className="card-subtitle">Change your account password</p>
                        </div>
                    </div>
                    <div className="card-content">
                        <form onSubmit={handlePasswordUpdate} className="space-y-md">
                            <div>
                                <label className="text-sm font-medium text-secondary mb-xs block">Current Password</label>
                                <input
                                    type="password"
                                    placeholder="Enter current password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full p-md border border-border-primary rounded-md bg-bg-secondary text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                                    style={{ color: '#000000' }}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-secondary mb-xs block">New Password</label>
                                <input
                                    type="password"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full p-md border border-border-primary rounded-md bg-bg-secondary text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                                    style={{ color: '#000000' }}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-secondary mb-xs block">Confirm New Password</label>
                                <input
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    className="w-full p-md border border-border-primary rounded-md bg-bg-secondary text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                                    style={{ color: '#000000' }}
                                />
                            </div>
                            <button 
                                type="submit" 
                                className="w-full bg-primary-gradient text-white py-md px-lg rounded-md hover-lift transition font-medium"
                            >
                                Update Password
                            </button>
                        </form>
                    </div>
                </div>

                {/* Temporary Password Card */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">🔑 Temporary AD Reset Password</h3>
                            <p className="card-subtitle">Active Directory reset password</p>
                        </div>
                    </div>
                    <div className="card-content">
                        <div className="mb-md">
                            <label className="text-sm font-medium text-secondary mb-xs block">Current Temporary Password</label>
                            <div className="p-md bg-bg-secondary rounded-md border border-border-secondary">
                                <span className="text-primary font-mono">{tempPassword || 'Not set'}</span>
                            </div>
                        </div>
                        <form onSubmit={handleTempPasswordUpdate} className="space-y-md">
                            <div>
                                <label className="text-sm font-medium text-secondary mb-xs block">New Temporary Password</label>
                                <input
                                    type="text"
                                    placeholder="Enter new temporary password"
                                    value={newTempPassword}
                                    onChange={(e) => setNewTempPassword(e.target.value)}
                                    className="w-full p-md border border-border-primary rounded-md bg-bg-secondary text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                                    style={{ color: '#000000' }}
                                />
                            </div>
                            <button 
                                type="submit" 
                                className="w-full bg-accent-blue text-white py-md px-lg rounded-md hover-lift transition font-medium"
                            >
                                Update Temporary Password
                            </button>
                        </form>
                    </div>
                </div>

                {/* Roles Card */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">👥 User Roles</h3>
                            <p className="card-subtitle">Your assigned roles</p>
                        </div>
                    </div>
                    <div className="card-content">
                        {roles.length > 0 ? (
                            <div className="space-y-xs">
                                {roles.map((role, index) => (
                                    <div key={index} className="flex items-center gap-sm p-sm bg-bg-secondary rounded-sm border border-border-secondary">
                                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                                        <span className="text-primary font-medium">{role.RoleName}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted py-lg">
                                <div className="text-2xl mb-sm">👤</div>
                                <p>No roles assigned</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Permissions Card */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">🔒 Permissions</h3>
                            <p className="card-subtitle">Your access permissions</p>
                        </div>
                    </div>
                    <div className="card-content">
                        {permissions.length > 0 ? (
                            <div className="space-y-xs">
                                {permissions.map((permission, index) => (
                                    <div key={index} className="flex items-center gap-sm p-sm bg-bg-secondary rounded-sm border border-border-secondary">
                                        <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                                        <span className="text-primary font-medium">{permission}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted py-lg">
                                <div className="text-2xl mb-sm">🔐</div>
                                <p>No permissions assigned</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;