import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/theme.css';
import '../styles/grid.css';
import ServerManager from '../components/ServerManager';

const ModernConfigure = ({ permissions }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('system');
    const [debugLogging, setDebugLogging] = useState(false);
    const [verboseLogging, setVerboseLogging] = useState(false);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [permissionsList, setPermissionsList] = useState([]);
    const [newUser, setNewUser] = useState({ AdminID: '', roleID: '' });
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

        if (!permissions || !permissions.includes('access_configure_page')) {
            console.warn('Access denied to configuration page. Redirecting to dashboard.');
            navigate('/dashboard');
            return;
        }

        loadAllData();
    }, [permissions, navigate]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadLoggingSettings(),
                loadUsers(),
                loadRoles(),
                loadPermissions()
            ]);
        } catch (error) {
            setError('Failed to load configuration data');
            console.error('Error loading configuration:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadLoggingSettings = async () => {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/logging-settings', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
        const data = await response.json();
        setDebugLogging(data.debug);
        setVerboseLogging(data.verbose);
    };

    const loadUsers = async () => {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
        if (response.ok) {
            const data = await response.json();
            setUsers(Array.isArray(data) ? data : []);
        }
    };

    const loadRoles = async () => {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/roles', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
        if (response.ok) {
            const data = await response.json();
            setRoles(Array.isArray(data) ? data : []);
        }
    };

    const loadPermissions = async () => {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/permissions', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
        if (response.ok) {
            const data = await response.json();
            setPermissionsList(Array.isArray(data) ? data : []);
        }
    };

    const handleLoggingToggle = async (type, value) => {
        const token = localStorage.getItem('token');
        try {
            await fetch('/api/logging-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ [type]: value }),
            });
            
            if (type === 'debug') setDebugLogging(value);
            if (type === 'verbose') setVerboseLogging(value);
        } catch (error) {
            console.error(`Error updating ${type} logging:`, error);
        }
    };

    const handleRoleChange = async (userId, roleId) => {
        const token = localStorage.getItem('token');
        try {
            await fetch('/api/roles/assign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ adminID: userId, roleID: roleId }),
            });
            setUsers(users.map(user => user.AdminID === userId ? { ...user, roleID: roleId } : user));
        } catch (error) {
            console.error('Error updating user role:', error);
        }
    };

    const handleAddUser = async () => {
        if (!newUser.AdminID.trim()) return;
        
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(newUser),
            });
            const data = await response.json();
            setUsers([...users, data]);
            setNewUser({ AdminID: '', roleID: '' });
        } catch (error) {
            console.error('Error adding new user:', error);
        }
    };

    const filteredUsers = users.filter(user => 
        user.AdminID.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const tabs = [
        { id: 'system', label: 'System Settings', icon: '⚙️' },
        { id: 'users', label: 'User Management', icon: '👥' },
        { id: 'infrastructure', label: 'Infrastructure', icon: '🖥️' },
        { id: 'application', label: 'Application', icon: '📱' }
    ];

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
                        roles={roles}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onRoleChange={handleRoleChange}
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
const UserManagement = ({ users, roles, searchTerm, onSearchChange, onRoleChange, newUser, onNewUserChange, onAddUser }) => (
    <div className="user-management">
        <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 'var(--spacing-lg)' }}>
            {/* Add User Card */}
            <div className="dashboard-card">
                <div className="card-header">
                    <h3 className="card-title">Add New User</h3>
                    <p className="card-subtitle">Grant system access to new administrators</p>
                </div>
                <div className="card-content">
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
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
                        <div style={{ flex: 1 }}>
                            <label style={{ 
                                display: 'block', 
                                marginBottom: 'var(--spacing-xs)', 
                                color: 'var(--text-secondary)',
                                fontSize: 'var(--font-size-sm)'
                            }}>
                                Role
                            </label>
                            <select
                                value={newUser.roleID}
                                onChange={(e) => onNewUserChange({ ...newUser, roleID: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 'var(--spacing-sm)',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: 'var(--border-radius-sm)',
                                    color: 'var(--text-primary)',
                                    fontSize: 'var(--font-size-md)'
                                }}
                            >
                                <option value="">Select Role</option>
                                {roles.map(role => (
                                    <option key={role.RoleID} value={role.RoleID}>{role.RoleName}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={onAddUser}
                            disabled={!newUser.AdminID.trim()}
                            style={{
                                padding: 'var(--spacing-sm) var(--spacing-lg)',
                                background: newUser.AdminID.trim() ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--border-radius-sm)',
                                cursor: newUser.AdminID.trim() ? 'pointer' : 'not-allowed',
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
                                roles={roles}
                                onRoleChange={onRoleChange}
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

// Application Settings Component
const ApplicationSettings = () => (
    <div className="application-settings">
        <div className="dashboard-card">
            <div className="card-header">
                <h3 className="card-title">Application Settings</h3>
                <p className="card-subtitle">Configure application behavior</p>
            </div>
            <div className="card-content">
                <div style={{ 
                    padding: 'var(--spacing-xl)', 
                    textAlign: 'center', 
                    color: 'var(--text-secondary)' 
                }}>
                    Application settings will be available in future updates
                </div>
            </div>
        </div>
    </div>
);

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

const UserCard = ({ user, roles, onRoleChange }) => (
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
                {user.AdminID}
            </div>
            <div style={{ 
                color: 'var(--text-secondary)', 
                fontSize: 'var(--font-size-sm)' 
            }}>
                Permissions: {(user.permissions || []).join(', ') || 'None'}
            </div>
        </div>
        <div style={{ minWidth: '200px', marginLeft: 'var(--spacing-md)' }}>
            <select
                value={user.roles?.length > 0 ? user.roles[0].RoleID : ''}
                onChange={(e) => onRoleChange(user.AdminID, e.target.value)}
                style={{
                    width: '100%',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--border-radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-size-sm)'
                }}
            >
                <option value="">Select Role</option>
                {roles.map(role => (
                    <option key={role.RoleID} value={role.RoleID}>{role.RoleName}</option>
                ))}
            </select>
        </div>
    </div>
);

export default ModernConfigure;