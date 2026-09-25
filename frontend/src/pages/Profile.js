import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, logAction } from '../utils/api';
import * as tabSyncService from '../utils/tabSyncService';
import '../styles/Profile.css';
import '../styles/theme.css';
import '../styles/grid.css';

// Small pill used for Roles/Permissions - replaces one-box-per-item lists that
// grew into long scrolling columns with a compact wrapping chip cloud instead.
const Chip = ({ icon, color, children }) => (
    <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 10px',
        borderRadius: '999px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-secondary)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
    }}>
        <i className={`bx ${icon}`} style={{ color, fontSize: '13px' }}></i>
        {children}
    </span>
);

const SectionHeading = ({ icon, children }) => (
    <h2 className="text-sm font-semibold text-secondary mb-sm" style={{
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginTop: 'var(--spacing-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
    }}>
        <i className={`bx ${icon}`}></i>
        {children}
    </h2>
);

const Profile = ({ permissions }) => {
    const [profile, setProfile] = useState({});
    const [roles, setRoles] = useState([]);
    const [error, setError] = useState(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [tempPassword, setTempPassword] = useState('');
    const [newTempPassword, setNewTempPassword] = useState('');
    const [tabSyncEnabled, setTabSyncEnabled] = useState(false);

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

        // Fetched independently so a tabs-endpoint hiccup never blocks the rest of
        // the profile page from rendering.
        const fetchTabSyncPref = async () => {
            try {
                const data = await apiGet('/api/tabs');
                setTabSyncEnabled(!!data.enabled);
            } catch (error) {
                console.warn('Error fetching tab sync preference:', error);
            }
        };

        fetchProfile();
        fetchTabSyncPref();
    }, []);

    const handleToggleTabSync = async (event) => {
        const enabled = event.target.checked;
        setTabSyncEnabled(enabled); // optimistic
        try {
            const localTabs = JSON.parse(localStorage.getItem('tabs') || '[]');
            await tabSyncService.setSyncPreference(enabled, localTabs);
            // Fire-and-forget, already fail-silent - only toggle events are logged here,
            // not every background scheduleSync call (that would spam RecentActions).
            logAction({
                activity: `Tab sync ${enabled ? 'enabled' : 'disabled'}`,
                actionType: 'toggle_sync',
                result: 'success'
            });
        } catch (error) {
            console.error('Error updating tab sync preference:', error);
            setTabSyncEnabled(!enabled); // revert
            setError('Error updating tab sync preference');
        }
    };

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
        <div className="theme-modern min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 'var(--spacing-md)' }}>
            {/* Header */}
            <div className="mb-md">
                <h1 className="text-2xl font-bold mb-xs" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                    <i className="bx bx-user-circle"></i> User Profile
                </h1>
                <p className="text-secondary text-sm">Manage your account settings and security preferences</p>
            </div>

            {error && (
                <div className="dashboard-card mb-md" style={{ background: 'var(--status-error)', border: '1px solid var(--status-error)', borderRadius: 'var(--border-radius-md)', padding: 'var(--spacing-sm)' }}>
                    <p style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                        <i className="bx bx-error-circle"></i> {error}
                    </p>
                </div>
            )}

            {/* Account Overview - identity, roles, and permissions in one place as
                compact wrapping chips instead of three separate cards (one of which
                was a long one-box-per-permission scrolling list). */}
            <div className="dashboard-card mb-md">
                <div className="card-header">
                    <div>
                        <h3 className="card-title"><i className="bx bx-id-card"></i> Account Overview</h3>
                        <p className="card-subtitle">Your administrator identity and access</p>
                    </div>
                </div>
                <div className="card-content">
                    <div className="mb-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                        <span className="text-xs font-medium text-secondary">Admin ID:</span>
                        <span className="text-primary font-semibold text-sm">{profile.AdminID || 'Loading...'}</span>
                    </div>

                    <div className="mb-sm">
                        <label className="text-xs font-medium text-secondary mb-xs block">Roles</label>
                        {roles.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                                {roles.map((role, index) => (
                                    <Chip key={index} icon="bx-user-check" color="var(--accent-purple)">{role.RoleName}</Chip>
                                ))}
                            </div>
                        ) : (
                            <span className="text-muted text-xs">No roles assigned</span>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-medium text-secondary mb-xs block">Permissions</label>
                        {permissions.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                                {permissions.map((permission, index) => (
                                    <Chip key={index} icon="bx-check-shield" color="var(--accent-green)">{permission}</Chip>
                                ))}
                            </div>
                        ) : (
                            <span className="text-muted text-xs">No permissions assigned</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Security */}
            <SectionHeading icon="bx-lock-alt">Security</SectionHeading>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--spacing-md)', alignItems: 'start' }}>
                {/* Password Update Card */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title"><i className="bx bx-lock-open-alt"></i> Update Password</h3>
                            <p className="card-subtitle">Change your account password</p>
                        </div>
                    </div>
                    <div className="card-content">
                        <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                            <div>
                                <label className="text-xs font-medium text-secondary mb-xs block">Current Password</label>
                                <input
                                    type="password"
                                    placeholder="Enter current password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full p-sm border border-border-primary rounded-md bg-bg-secondary text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                    style={{ color: '#000000' }}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-secondary mb-xs block">New Password</label>
                                <input
                                    type="password"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full p-sm border border-border-primary rounded-md bg-bg-secondary text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                    style={{ color: '#000000' }}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-secondary mb-xs block">Confirm New Password</label>
                                <input
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    className="w-full p-sm border border-border-primary rounded-md bg-bg-secondary text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                    style={{ color: '#000000' }}
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-primary-gradient text-white py-sm px-md rounded-md hover-lift transition font-medium text-sm"
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
                            <h3 className="card-title"><i className="bx bx-key"></i> Temporary AD Reset Password</h3>
                            <p className="card-subtitle">Active Directory reset password</p>
                        </div>
                    </div>
                    <div className="card-content">
                        <div className="mb-sm">
                            <label className="text-xs font-medium text-secondary mb-xs block">Current Temporary Password</label>
                            <div className="p-sm bg-bg-secondary rounded-md border border-border-secondary">
                                <span className="text-primary font-mono text-sm">{tempPassword || 'Not set'}</span>
                            </div>
                        </div>
                        <form onSubmit={handleTempPasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                            <div>
                                <label className="text-xs font-medium text-secondary mb-xs block">New Temporary Password</label>
                                <input
                                    type="text"
                                    placeholder="Enter new temporary password"
                                    value={newTempPassword}
                                    onChange={(e) => setNewTempPassword(e.target.value)}
                                    className="w-full p-sm border border-border-primary rounded-md bg-bg-secondary text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                    style={{ color: '#000000' }}
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-accent-blue text-white py-sm px-md rounded-md hover-lift transition font-medium text-sm"
                            >
                                Update Temporary Password
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Preferences */}
            <SectionHeading icon="bx-slider-alt">Preferences</SectionHeading>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--spacing-md)', alignItems: 'start' }}>
                <div className="dashboard-card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title"><i className="bx bx-devices"></i> Cross-Device Tab Sync</h3>
                            <p className="card-subtitle">Carry your open AD object tabs between devices</p>
                        </div>
                    </div>
                    <div className="card-content">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <input
                                type="checkbox"
                                checked={tabSyncEnabled}
                                onChange={handleToggleTabSync}
                            />
                            <span className="text-primary font-medium text-sm">Sync tabs across devices</span>
                        </label>
                        <p className="text-secondary text-xs" style={{ marginTop: 'var(--spacing-sm)' }}>
                            Off by default. When enabled, tabs you open here sync in the background and merge in whenever this page loads on another logged-in device.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
