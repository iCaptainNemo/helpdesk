import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../utils/api';
import '../styles/Profile.css';
import '../styles/theme.css';
import '../styles/grid.css';

const Profile = ({ permissions }) => {
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
                const data = await apiGet('/api/auth/profile');
                setProfile(data.profile);
                setRoles(data.roles || []);
                setTempPassword(data.profile.temppassword || '');
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
            await apiPost('/api/auth/update-password', { currentPassword, newPassword });
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
            await apiPost('/api/auth/update-temp-password', { tempPassword: newTempPassword });
            alert('Temporary password updated successfully');
            setTempPassword(newTempPassword);
            setNewTempPassword('');
        } catch (error) {
            console.error('Error updating temporary password:', error);
            setError('Error updating temporary password');
        }
    };

    return (
        <div className="theme-modern min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 'var(--spacing-lg)' }}>
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
