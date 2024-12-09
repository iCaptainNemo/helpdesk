import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Configure.css'; // Import the CSS file for the toggle switch
import ServerManager from '../components/ServerManager'; // Import the ServerManager component

const Configure = ({ permissions }) => {
    const navigate = useNavigate();
    const [debugLogging, setDebugLogging] = useState(false);
    const [verboseLogging, setVerboseLogging] = useState(false);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [permissionsList, setPermissionsList] = useState([]);
    const [newUser, setNewUser] = useState({ AdminID: '', roleID: '' });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        // Check if the user has the required permission
        if (!permissions.includes('access_configure_page')) {
            navigate('/dashboard'); // Redirect to dashboard if the user does not have the required permission
        }

        // Fetch the current logging settings from the backend
        fetch('/api/logging-settings', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        })
            .then(response => response.json())
            .then(data => {
                setDebugLogging(data.debug);
                setVerboseLogging(data.verbose);
            })
            .catch(error => {
                console.error('Error fetching logging settings:', error);
            });

        // Fetch users, roles, and permissions
        fetch('/api/users', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        })
            .then(response => response.json())
            .then(data => setUsers(data))
            .catch(error => console.error('Error fetching users:', error));

        fetch('/api/roles', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        })
            .then(response => response.json())
            .then(data => setRoles(data))
            .catch(error => console.error('Error fetching roles:', error));

        fetch('/api/permissions', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        })
            .then(response => response.json())
            .then(data => setPermissionsList(data))
            .catch(error => console.error('Error fetching permissions:', error));
    }, [permissions, navigate]);

    const handleDebugToggle = () => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        const newDebugLogging = !debugLogging;
        setDebugLogging(newDebugLogging);
        fetch('/api/logging-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ debug: newDebugLogging }),
        })
            .then(() => {
                console.log(`Debug logging ${newDebugLogging ? 'enabled' : 'disabled'}`);
            })
            .catch(error => {
                console.error('Error updating debug logging setting:', error);
            });
    };

    const handleVerboseToggle = () => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        const newVerboseLogging = !verboseLogging;
        setVerboseLogging(newVerboseLogging);
        fetch('/api/logging-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ verbose: newVerboseLogging }),
        })
            .then(() => {
                console.log(`Verbose logging ${newVerboseLogging ? 'enabled' : 'disabled'}`);
            })
            .catch(error => {
                console.error('Error updating verbose logging setting:', error);
            });
    };

    const handleRoleChange = (userId, roleId) => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        fetch('/api/roles/assign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ adminID: userId, roleID: roleId }),
        })
            .then(() => {
                setUsers(users.map(user => user.AdminID === userId ? { ...user, roleID: roleId } : user));
            })
            .catch(error => {
                console.error('Error updating user role:', error);
            });
    };

    const handleRemoveRole = (userId, roleId) => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        fetch('/api/roles/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ adminID: userId, roleID: roleId }),
        })
            .then(() => {
                setUsers(users.map(user => user.AdminID === userId ? { ...user, roleID: null } : user));
            })
            .catch(error => {
                console.error('Error removing user role:', error);
            });
    };

    const handleAddUser = () => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            return;
        }

        fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(newUser),
        })
            .then(response => response.json())
            .then(data => {
                setUsers([...users, data]);
                setNewUser({ AdminID: '', roleID: '' });
            })
            .catch(error => {
                console.error('Error adding new user:', error);
            });
    };

    return (
        <div className="configure-page">
            <table>
                <thead>
                    <tr>
                        <th colSpan="2">Logging</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Debug Logging</td>
                        <td>
                            <label className="toggle-switch">
                                <input type="checkbox" checked={debugLogging} onChange={handleDebugToggle} />
                                <span className="slider round"></span>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <td>Verbose Logging</td>
                        <td>
                            <label className="toggle-switch">
                                <input type="checkbox" checked={verboseLogging} onChange={handleVerboseToggle} />
                                <span className="slider round"></span>
                            </label>
                        </td>
                    </tr>
                </tbody>
            </table>

            <h2>Users</h2>
            <table>
                <thead>
                    <tr>
                        <th>AdminID</th>
                        <th>Role</th>
                        <th>Permissions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.AdminID}>
                            <td>{user.AdminID}</td>
                            <td>
                                <select value={user.roles.length > 0 ? user.roles[0].RoleID : ''} onChange={(e) => handleRoleChange(user.AdminID, e.target.value)}>
                                    <option value="">Select Role</option>
                                    {roles.map(role => (
                                        <option key={role.RoleID} value={role.RoleID}>{role.RoleName}</option>
                                    ))}
                                </select>
                                <button onClick={() => handleRemoveRole(user.AdminID, user.roles.length > 0 ? user.roles[0].RoleID : '')}>Remove Role</button>
                            </td>
                            <td>
                                {(user.permissions || []).join(', ')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h2>Add New User</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleAddUser(); }}>
                <input
                    type="text"
                    placeholder="AdminID"
                    value={newUser.AdminID}
                    onChange={(e) => setNewUser({ ...newUser, AdminID: e.target.value })}
                />
                <select value={newUser.roleID} onChange={(e) => setNewUser({ ...newUser, roleID: e.target.value })}>
                    <option value="">Select Role</option>
                    {roles.map(role => (
                        <option key={role.RoleID} value={role.RoleID}>{role.RoleName}</option>
                    ))}
                </select>
                <button type="submit">Add User</button>
            </form>

            <ServerManager /> {/* Add the ServerManager component */}
        </div>
    );
};

export default Configure;