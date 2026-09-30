import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import '../styles/theme.css';
import '../styles/grid.css';
import ServerManager from '../components/ServerManager';

const ModernConfigure = ({ permissions }) => {
    const navigate = useNavigate();
    // Remote-mode users only get 'manage_deployment' (their own hub connection
    // settings) - they can reach this page but only the Application tab; the
    // rest of Configure (Users/System/Infrastructure) stays hub-only.
    const hasFullConfigAccess = Boolean(permissions && permissions.includes('access_configure_page'));
    const [activeTab, setActiveTab] = useState(() => (hasFullConfigAccess ? 'system' : 'application'));
    const [debugLogging, setDebugLogging] = useState(false);
    const [verboseLogging, setVerboseLogging] = useState(false);
    const [users, setUsers] = useState([]);
    const [deploymentMode, setDeploymentMode] = useState('local');
    const [permissionsList, setPermissionsList] = useState([]);
    const [newUser, setNewUser] = useState({ AdminID: '', password: '', displayName: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            navigate('/dashboard');
            return;
        }

        if (!permissions || (!hasFullConfigAccess && !permissions.includes('manage_deployment'))) {
            console.warn('Access denied to configuration page. Redirecting to dashboard.');
            navigate('/dashboard');
            return;
        }

        loadAllData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissions, navigate]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const loaders = [loadDeploymentMode()];
            if (hasFullConfigAccess) {
                loaders.push(loadLoggingSettings(), loadUsers(), loadPermissions());
            }
            await Promise.all(loaders);
        } catch (error) {
            setError('Failed to load configuration data');
            console.error('Error loading configuration:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadLoggingSettings = async () => {
        try {
            const data = await apiGet('/api/logging-settings');
            setDebugLogging(data.debug);
            setVerboseLogging(data.verbose);
        } catch (error) {
            console.error('Error loading logging settings:', error);
        }
    };

    const loadUsers = async () => {
        try {
            const data = await apiGet('/api/users');
            setUsers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    };

    const loadDeploymentMode = async () => {
        try {
            const data = await apiGet('/api/setup/status');
            setDeploymentMode(data?.details?.mode || 'local');
        } catch (error) {
            console.error('Error loading deployment mode:', error);
        }
    };

    const loadPermissions = async () => {
        try {
            const data = await apiGet('/api/permissions');
            setPermissionsList(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error loading permissions:', error);
        }
    };

    const handleLoggingToggle = async (type, value) => {
        try {
            await apiPost('/api/logging-settings', { [type]: value });

            if (type === 'debug') setDebugLogging(value);
            if (type === 'verbose') setVerboseLogging(value);
        } catch (error) {
            console.error(`Error updating ${type} logging:`, error);
        }
    };

    const handleAddUser = async () => {
        if (!newUser.AdminID.trim() || !newUser.password) return;

        try {
            const data = await apiPost('/api/users', newUser);
            setUsers([...users, data]);
            setNewUser({ AdminID: '', password: '', displayName: '' });
        } catch (error) {
            console.error('Error adding new user:', error);
        }
    };

    const handleRemoveUser = async (adminID) => {
        if (!window.confirm(`Remove user "${adminID}"?`)) return;

        try {
            await apiDelete(`/api/users/${encodeURIComponent(adminID)}`);
            setUsers(users.filter(user => user.AdminID !== adminID));
        } catch (error) {
            console.error('Error removing user:', error);
        }
    };

    const handleResetPassword = async (adminID) => {
        const newPassword = window.prompt(`Enter a new password for "${adminID}":`);
        if (!newPassword) return;

        try {
            await apiPut(`/api/users/${encodeURIComponent(adminID)}/password`, { password: newPassword });
            alert(`Password reset for ${adminID}`);
        } catch (error) {
            console.error('Error resetting password:', error);
            alert(`Failed to reset password: ${error.message}`);
        }
    };

    const filteredUsers = users.filter(user => 
        user.AdminID.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const tabs = hasFullConfigAccess
        ? [
            { id: 'system', label: 'System Settings', icon: '⚙️' },
            { id: 'users', label: 'User Management', icon: '👥' },
            { id: 'infrastructure', label: 'Infrastructure', icon: '🖥️' },
            { id: 'application', label: 'Application', icon: '📱' }
        ]
        : [{ id: 'application', label: 'Application', icon: '📱' }];

    if (loading) {
        return (
            <div className="configure-modern" style={{ 
                padding: 'var(--spacing-xl)', 
                minHeight: '400px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
            }}>
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-md)' }}>⚙️</div>
                    <div>Loading configuration...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="configure-modern" style={{
            background: 'var(--bg-primary)',
            minHeight: '100vh',
            padding: 'var(--spacing-lg)'
        }}>
            {/* Header */}
            <div className="configure-header" style={{
                marginBottom: 'var(--spacing-xl)'
            }}>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--text-primary)',
                    margin: 0,
                    marginBottom: 'var(--spacing-sm)'
                }}>
                    System Configuration
                </h1>
                <p style={{
                    color: 'var(--text-secondary)',
                    margin: 0,
                    fontSize: 'var(--font-size-lg)'
                }}>
                    Manage system settings, users, and infrastructure
                </p>
            </div>

            {error && (
                <div style={{
                    background: 'var(--status-error)',
                    color: 'white',
                    padding: 'var(--spacing-md)',
                    borderRadius: 'var(--border-radius-md)',
                    marginBottom: 'var(--spacing-lg)'
                }}>
                    {error}
                </div>
            )}

            {/* Tabs Navigation */}
            <div className="tabs-nav" style={{
                display: 'flex',
                gap: 'var(--spacing-xs)',
                marginBottom: 'var(--spacing-xl)',
                borderBottom: '1px solid var(--border-secondary)'
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            padding: 'var(--spacing-md) var(--spacing-lg)',
                            background: activeTab === tab.id ? 'var(--accent-blue)' : 'transparent',
                            color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 'var(--border-radius-md) var(--border-radius-md) 0 0',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-md)',
                            fontWeight: activeTab === tab.id ? 'var(--font-weight-semibold)' : 'normal',
                            transition: 'var(--transition-fast)'
                        }}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'system' && (
                    <SystemSettings 
                        debugLogging={debugLogging}
                        verboseLogging={verboseLogging}
                        onLoggingToggle={handleLoggingToggle}
                    />
                )}

                {activeTab === 'users' && (
                    <UserManagement
                        users={filteredUsers}
                        deploymentMode={deploymentMode}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onRemoveUser={handleRemoveUser}
                        onResetPassword={handleResetPassword}
                        newUser={newUser}
                        onNewUserChange={setNewUser}
                        onAddUser={handleAddUser}
                    />
                )}

                {activeTab === 'infrastructure' && (
                    <InfrastructureManagement />
                )}

                {activeTab === 'application' && (
                    <ApplicationSettings />
                )}
            </div>
        </div>
    );
};

// System Settings Component
const SystemSettings = ({ debugLogging, verboseLogging, onLoggingToggle }) => (
    <div className="system-settings">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-lg)' }}>
            {/* Logging Configuration Card */}
            <div className="dashboard-card">
                <div className="card-header">
                    <h3 className="card-title">Logging Configuration</h3>
                    <p className="card-subtitle">Control system logging levels</p>
                </div>
                <div className="card-content">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        <ToggleSetting
                            label="Debug Logging"
                            description="Enable detailed debug information"
                            checked={debugLogging}
                            onChange={(value) => onLoggingToggle('debug', value)}
                        />
                        <ToggleSetting
                            label="Verbose Logging"
                            description="Enable verbose system output"
                            checked={verboseLogging}
                            onChange={(value) => onLoggingToggle('verbose', value)}
                        />
                    </div>
                </div>
            </div>

            {/* System Health Card */}
            <div className="dashboard-card">
                <div className="card-header">
                    <h3 className="card-title">System Health</h3>
                    <p className="card-subtitle">Monitor system performance</p>
                </div>
                <div className="card-content">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <StatusItem label="Database" status="healthy" />
                        <StatusItem label="Authentication" status="healthy" />
                        <StatusItem label="PowerShell Integration" status="healthy" />
                        <StatusItem label="Real-time Updates" status="healthy" />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

// User Management Component
const UserManagement = ({ users, deploymentMode, searchTerm, onSearchChange, onRemoveUser, onResetPassword, newUser, onNewUserChange, onAddUser }) => (
    <div className="user-management">
        <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 'var(--spacing-lg)' }}>
            {/* Add User Card - hub (local mode) only; remote instances authenticate through the hub */}
            {deploymentMode === 'local' ? (
                <div className="dashboard-card">
                    <div className="card-header">
                        <h3 className="card-title">Add New User</h3>
                        <p className="card-subtitle">Grant system access to new administrators</p>
                    </div>
                    <div className="card-content">
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '160px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: 'var(--spacing-xs)',
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--font-size-sm)'
                                }}>
                                    Admin ID
                                </label>
                                <input
                                    type="text"
                                    value={newUser.AdminID}
                                    onChange={(e) => onNewUserChange({ ...newUser, AdminID: e.target.value })}
                                    placeholder="Enter admin username"
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-sm)',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 'var(--border-radius-sm)',
                                        color: 'var(--text-primary)',
                                        fontSize: 'var(--font-size-md)'
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: '160px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: 'var(--spacing-xs)',
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--font-size-sm)'
                                }}>
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => onNewUserChange({ ...newUser, password: e.target.value })}
                                    placeholder="Enter password"
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-sm)',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 'var(--border-radius-sm)',
                                        color: 'var(--text-primary)',
                                        fontSize: 'var(--font-size-md)'
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: '160px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: 'var(--spacing-xs)',
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--font-size-sm)'
                                }}>
                                    Display Name (optional)
                                </label>
                                <input
                                    type="text"
                                    value={newUser.displayName}
                                    onChange={(e) => onNewUserChange({ ...newUser, displayName: e.target.value })}
                                    placeholder="Enter display name"
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-sm)',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-primary)',
                                        borderRadius: 'var(--border-radius-sm)',
                                        color: 'var(--text-primary)',
                                        fontSize: 'var(--font-size-md)'
                                    }}
                                />
                            </div>
                            <button
                                onClick={onAddUser}
                                disabled={!newUser.AdminID.trim() || !newUser.password}
                                style={{
                                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                                    background: (newUser.AdminID.trim() && newUser.password) ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 'var(--border-radius-sm)',
                                    cursor: (newUser.AdminID.trim() && newUser.password) ? 'pointer' : 'not-allowed',
                                    fontSize: 'var(--font-size-md)',
                                    fontWeight: 'var(--font-weight-semibold)',
                                    transition: 'var(--transition-fast)'
                                }}
                            >
                                Add User
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="dashboard-card">
                    <div className="card-content">
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                            User management happens on the hub (local mode) instance. Ask your administrator to add or remove logins there.
                        </p>
                    </div>
                </div>
            )}

            {/* Users Directory Card */}
            <div className="dashboard-card">
                <div className="card-header">
                    <h3 className="card-title">Users Directory</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search users..."
                            style={{
                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: 'var(--border-radius-sm)',
                                color: 'var(--text-primary)',
                                fontSize: 'var(--font-size-sm)',
                                width: '200px'
                            }}
                        />
                        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            {users.length} users
                        </span>
                    </div>
                </div>
                <div className="card-content">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        {users.map(user => (
                            <UserCard
                                key={user.AdminID}
                                user={user}
                                canRemove={deploymentMode === 'local'}
                                onRemove={onRemoveUser}
                                onResetPassword={onResetPassword}
                            />
                        ))}
                        {users.length === 0 && (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--spacing-xl)',
                                color: 'var(--text-secondary)'
                            }}>
                                No users found
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
);

// Infrastructure Management Component
const InfrastructureManagement = () => (
    <div className="infrastructure-management">
        <div className="dashboard-card">
            <div className="card-header">
                <h3 className="card-title">Server Management</h3>
                <p className="card-subtitle">Manage servers and infrastructure</p>
            </div>
            <div className="card-content">
                <ServerManager />
            </div>
        </div>
    </div>
);

// Application Settings Component - deployment mode + hub connection, editable
// after the initial setup wizard (see Backend/routes/configure.js's
// /deployment endpoints). Changes take effect live, no restart needed.
const appSettingsStyles = {
    label: {
        display: 'block',
        marginBottom: 'var(--spacing-xs)',
        color: 'var(--text-secondary)',
        fontSize: 'var(--font-size-sm)'
    },
    input: {
        width: '100%',
        padding: 'var(--spacing-sm)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--border-radius-sm)',
        color: 'var(--text-primary)',
        fontSize: 'var(--font-size-md)'
    },
    modeButton: (active) => ({
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        background: active ? 'var(--accent-blue)' : 'transparent',
        color: active ? 'white' : 'var(--text-secondary)',
        border: active ? 'none' : '1px solid var(--border-primary)',
        borderRadius: 'var(--border-radius-md)',
        cursor: 'pointer',
        fontSize: 'var(--font-size-md)',
        fontWeight: active ? 'var(--font-weight-semibold)' : 'normal',
        transition: 'var(--transition-fast)'
    }),
    primaryButton: (enabled) => ({
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        background: enabled ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
        color: 'white',
        border: 'none',
        borderRadius: 'var(--border-radius-sm)',
        cursor: enabled ? 'pointer' : 'not-allowed',
        fontSize: 'var(--font-size-md)',
        fontWeight: 'var(--font-weight-semibold)',
        transition: 'var(--transition-fast)'
    }),
    secondaryButton: {
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        background: 'transparent',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--border-radius-sm)',
        cursor: 'pointer',
        fontSize: 'var(--font-size-md)'
    },
    iconButton: {
        padding: 'var(--spacing-sm)',
        background: 'transparent',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--border-radius-sm)',
        cursor: 'pointer',
        fontSize: 'var(--font-size-md)',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    valueRow: {
        display: 'flex',
        gap: 'var(--spacing-md)',
        alignItems: 'center'
    },
    valueCode: {
        padding: 'var(--spacing-sm)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--border-radius-sm)',
        flex: 1,
        wordBreak: 'break-all'
    }
};

const ApplicationSettings = () => {
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('local');
    const [hasLocalAdmin, setHasLocalAdmin] = useState(true);
    const [remoteServerUrl, setRemoteServerUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [adminUsername, setAdminUsername] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [message, setMessage] = useState(null);
    const [hubUrl, setHubUrl] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [copiedField, setCopiedField] = useState(null);
    const [fallback, setFallback] = useState(null);

    useEffect(() => {
        loadDeployment();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadDeployment = async () => {
        setLoading(true);
        try {
            const data = await apiGet('/api/deployment');
            setMode(data.mode || 'local');
            setRemoteServerUrl(data.remoteServerUrl || '');
            setApiKey(data.apiKey || '');
            setHubUrl(data.hubUrl || '');
            setHasLocalAdmin(data.hasLocalAdmin);
            setFallback(data.fallback?.active ? data.fallback : null);
        } catch (error) {
            console.error('Error loading deployment settings:', error);
            setMessage({ type: 'error', text: 'Failed to load deployment settings' });
        } finally {
            setLoading(false);
        }
    };

    const handleModeChange = async (newMode) => {
        if (newMode === mode) return;
        setMode(newMode);
        setTestResult(null);
        setMessage(null);

        if (newMode === 'local' && !hasLocalAdmin && !adminUsername) {
            try {
                const sysInfo = await apiGet('/api/setup/system-info');
                setAdminUsername(sysInfo.systemUsername || '');
            } catch (error) {
                console.error('Error loading system info:', error);
            }
        }
    };

    const handleReconnectToHub = () => {
        if (!fallback) return;
        setRemoteServerUrl(fallback.originalRemoteServerUrl || '');
        setApiKey(fallback.originalApiKey || '');
        setTestResult(null);
        setMessage(null);
        setMode('remote');
    };

    const handleTestConnection = async () => {
        if (!remoteServerUrl.trim() || !apiKey.trim()) {
            setMessage({ type: 'error', text: 'Enter a server URL and API key first' });
            return;
        }
        setTesting(true);
        setMessage(null);
        try {
            const result = await apiPost('/api/deployment/test-connection', { remoteServerUrl, apiKey });
            setTestResult(result);
        } catch (error) {
            setTestResult({ reachable: false, validKey: false, message: 'Test request failed' });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const payload = { mode };
            if (mode === 'remote') {
                payload.remoteServerUrl = remoteServerUrl;
                payload.apiKey = apiKey;
            } else if (!hasLocalAdmin) {
                payload.adminUsername = adminUsername;
                payload.adminPassword = adminPassword;
            }

            await apiPut('/api/deployment', payload);
            setMessage({ type: 'success', text: 'Saved - the change is live immediately, no restart needed.' });
            setAdminPassword('');
            await loadDeployment();
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Failed to save deployment settings' });
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerateKey = async () => {
        if (!window.confirm('Regenerating the API key will disconnect every remote instance until they are given the new key. Continue?')) {
            return;
        }
        setRegenerating(true);
        setMessage(null);
        try {
            const result = await apiPost('/api/deployment/regenerate-api-key');
            setApiKey(result.apiKey);
            setMessage({ type: 'success', text: 'API key regenerated. Update every remote instance with the new key.' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to regenerate the API key' });
        } finally {
            setRegenerating(false);
        }
    };

    const copyToClipboard = async (text, field) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(prev => (prev === field ? null : prev)), 2000);
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            setMessage({ type: 'error', text: 'Could not copy - your browser blocked clipboard access' });
        }
    };

    if (loading) {
        return (
            <div className="application-settings">
                <div className="dashboard-card">
                    <div className="card-content" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--spacing-xl)' }}>
                        Loading deployment settings...
                    </div>
                </div>
            </div>
        );
    }

    const remoteConnectionVerified = testResult && testResult.reachable && testResult.validKey;
    const canSave = mode === 'remote'
        ? Boolean(remoteConnectionVerified)
        : (hasLocalAdmin || (adminUsername.trim() && adminPassword));

    return (
        <div className="application-settings">
            {fallback && (
                <div className="dashboard-card" style={{ marginBottom: 'var(--spacing-lg)', border: '1px solid var(--accent-yellow, #e0a930)' }}>
                    <div className="card-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ color: 'var(--accent-yellow, #e0a930)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)' }}>
                                    🟡 Running on a cached local login
                                </div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                    The hub became unreachable on {new Date(fallback.since).toLocaleString()}, so this instance switched to local mode automatically.
                                    {' '}It will keep working locally until {new Date(fallback.expiresAt).toLocaleString()}, after which the cached login is cleared and setup must be redone.
                                </div>
                            </div>
                            <button style={appSettingsStyles.secondaryButton} onClick={handleReconnectToHub}>
                                Reconnect to hub
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="dashboard-card">
                <div className="card-header">
                    <h3 className="card-title">Deployment Mode</h3>
                    <p className="card-subtitle">Run as the hub (local) with your own database, or connect to another instance (remote)</p>
                </div>
                <div className="card-content">
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                        <button style={appSettingsStyles.modeButton(mode === 'local')} onClick={() => handleModeChange('local')}>
                            Local (Hub)
                        </button>
                        <button style={appSettingsStyles.modeButton(mode === 'remote')} onClick={() => handleModeChange('remote')}>
                            Remote (Satellite)
                        </button>
                    </div>

                    {mode === 'remote' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div>
                                <label style={appSettingsStyles.label}>Hub Server URL</label>
                                <input
                                    type="text"
                                    value={remoteServerUrl}
                                    onChange={(e) => { setRemoteServerUrl(e.target.value); setTestResult(null); }}
                                    placeholder="http://172.25.129.95:3001"
                                    style={appSettingsStyles.input}
                                />
                            </div>
                            <div>
                                <label style={appSettingsStyles.label}>API Key</label>
                                <input
                                    type="text"
                                    value={apiKey}
                                    onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                                    placeholder="Provided by the hub administrator"
                                    style={appSettingsStyles.input}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                <button style={appSettingsStyles.secondaryButton} onClick={handleTestConnection} disabled={testing}>
                                    {testing ? 'Testing...' : 'Test Connection'}
                                </button>
                                {testResult && (
                                    <span style={{
                                        color: remoteConnectionVerified ? 'var(--accent-green, #4caf50)' : 'var(--accent-red, #e05252)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}>
                                        {remoteConnectionVerified ? 'Connected successfully' : (testResult.message || 'Connection failed')}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {mode === 'local' && !hasLocalAdmin && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                This instance has no local admin account yet - create one to become a hub.
                            </p>
                            <div>
                                <label style={appSettingsStyles.label}>Admin Username</label>
                                <input
                                    type="text"
                                    value={adminUsername}
                                    onChange={(e) => setAdminUsername(e.target.value)}
                                    style={appSettingsStyles.input}
                                />
                            </div>
                            <div>
                                <label style={appSettingsStyles.label}>Admin Password</label>
                                <input
                                    type="password"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    style={appSettingsStyles.input}
                                />
                            </div>
                        </div>
                    )}

                    {mode === 'local' && hasLocalAdmin && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                            This instance already has a local admin account - switching to local mode just flips the mode.
                        </p>
                    )}

                    <div style={{ marginTop: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                        <button style={appSettingsStyles.primaryButton(canSave && !saving)} onClick={handleSave} disabled={!canSave || saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                        {message && (
                            <span style={{
                                color: message.type === 'success' ? 'var(--accent-green, #4caf50)' : 'var(--accent-red, #e05252)',
                                fontSize: 'var(--font-size-sm)'
                            }}>
                                {message.text}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {mode === 'local' && (
                <div className="dashboard-card" style={{ marginTop: 'var(--spacing-lg)' }}>
                    <div className="card-header">
                        <h3 className="card-title">Hub Connection Info</h3>
                        <p className="card-subtitle">Give these to a coworker setting up a remote instance</p>
                    </div>
                    <div className="card-content">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div>
                                <label style={appSettingsStyles.label}>Hub Address</label>
                                <div style={appSettingsStyles.valueRow}>
                                    <code style={appSettingsStyles.valueCode}>
                                        {hubUrl || '(unavailable)'}
                                    </code>
                                    <button
                                        style={appSettingsStyles.iconButton}
                                        onClick={() => copyToClipboard(hubUrl, 'hubUrl')}
                                        title="Copy hub address"
                                        disabled={!hubUrl}
                                    >
                                        {copiedField === 'hubUrl' ? '✓' : '📋'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style={appSettingsStyles.label}>Hub API Key</label>
                                <div style={appSettingsStyles.valueRow}>
                                    <code style={appSettingsStyles.valueCode}>
                                        {apiKey ? (showApiKey ? apiKey : '•'.repeat(Math.min(apiKey.length, 32))) : '(not set)'}
                                    </code>
                                    <button
                                        style={appSettingsStyles.iconButton}
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        title={showApiKey ? 'Hide API key' : 'Reveal API key'}
                                        disabled={!apiKey}
                                    >
                                        {showApiKey ? '🙈' : '👁'}
                                    </button>
                                    <button
                                        style={appSettingsStyles.iconButton}
                                        onClick={() => copyToClipboard(apiKey, 'apiKey')}
                                        title="Copy API key"
                                        disabled={!apiKey}
                                    >
                                        {copiedField === 'apiKey' ? '✓' : '📋'}
                                    </button>
                                    <button style={appSettingsStyles.secondaryButton} onClick={handleRegenerateKey} disabled={regenerating}>
                                        {regenerating ? 'Regenerating...' : 'Regenerate'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper Components
const ToggleSetting = ({ label, description, checked, onChange }) => (
    <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: 'var(--spacing-md)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--border-radius-sm)'
    }}>
        <div>
            <div style={{ 
                color: 'var(--text-primary)', 
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--spacing-xs)'
            }}>
                {label}
            </div>
            <div style={{ 
                color: 'var(--text-secondary)', 
                fontSize: 'var(--font-size-sm)' 
            }}>
                {description}
            </div>
        </div>
        <label className="toggle-switch-modern" style={{ position: 'relative', cursor: 'pointer' }}>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                style={{ display: 'none' }}
            />
            <div style={{
                width: '48px',
                height: '24px',
                background: checked ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                borderRadius: '12px',
                position: 'relative',
                transition: 'var(--transition-fast)'
            }}>
                <div style={{
                    width: '20px',
                    height: '20px',
                    background: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: checked ? '26px' : '2px',
                    transition: 'var(--transition-fast)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
            </div>
        </label>
    </div>
);

const StatusItem = ({ label, status }) => (
    <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: 'var(--spacing-sm) 0'
    }}>
        <span style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span style={{
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            background: status === 'healthy' ? 'var(--status-success)' : 'var(--status-error)',
            color: 'white',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)'
        }}>
            {status === 'healthy' ? '✓ Healthy' : '✗ Error'}
        </span>
    </div>
);

const UserCard = ({ user, canRemove, onRemove, onResetPassword }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--spacing-md)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--border-radius-sm)',
        border: '1px solid var(--border-secondary)'
    }}>
        <div style={{ flex: 1 }}>
            <div style={{
                color: 'var(--text-primary)',
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--spacing-xs)'
            }}>
                {user.DisplayName || user.AdminID}
            </div>
            <div style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-size-sm)'
            }}>
                {user.AdminID}{user.CreatedAt ? ` · added ${user.CreatedAt}` : ''}
            </div>
        </div>
        {canRemove && (
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginLeft: 'var(--spacing-md)' }}>
                <button
                    onClick={() => onResetPassword(user.AdminID)}
                    style={{
                        padding: 'var(--spacing-xs) var(--spacing-md)',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-sm)'
                    }}
                >
                    Reset Password
                </button>
                <button
                    onClick={() => onRemove(user.AdminID)}
                    style={{
                        padding: 'var(--spacing-xs) var(--spacing-md)',
                        background: 'transparent',
                        color: 'var(--accent-red, #e05252)',
                        border: '1px solid var(--accent-red, #e05252)',
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-sm)'
                    }}
                >
                    Remove
                </button>
            </div>
        )}
    </div>
);

export default ModernConfigure;