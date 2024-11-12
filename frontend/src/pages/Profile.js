import React, { useEffect, useState } from 'react';

const Profile = () => {
    const [profile, setProfile] = useState({});
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [error, setError] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [tempPassword, setTempPassword] = useState('');

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
                console.log('Profile data UI:', data); 
                setProfile(data.profile);
                setRoles(data.roles || []); // Ensure roles is an array
                setPermissions(data.permissions || []); // Ensure permissions is an array
            } catch (error) {
                console.error('Error fetching profile:', error);
                setError('Error fetching profile');
            }
        };

        fetchProfile();
    }, []);

    const handlePasswordUpdate = async (event) => {
        event.preventDefault();
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/update-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
                },
                body: JSON.stringify({ newPassword })
            });

            if (!response.ok) {
                throw new Error('Failed to update password');
            }

            alert('Password updated successfully');
            setNewPassword('');
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
                body: JSON.stringify({ tempPassword })
            });

            if (!response.ok) {
                throw new Error('Failed to update temporary password');
            }

            alert('Temporary password updated successfully');
            setTempPassword('');
        } catch (error) {
            console.error('Error updating temporary password:', error);
            setError('Error updating temporary password');
        }
    };

    return (
        <div>
            <h2>Profile</h2>
            {error && <p>{error}</p>}
            <div>
                <h3>Admin ID</h3>
                <p>{profile.AdminID}</p>
            </div>
            <div>
                <h3>Update Password</h3>
                <form onSubmit={handlePasswordUpdate}>
                    <input
                        type="password"
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button type="submit">Update Password</button>
                </form>
            </div>
            <div>
                <h3>Temporary Password</h3>
                <form onSubmit={handleTempPasswordUpdate}>
                    <input
                        type="text"
                        placeholder="Temporary Password"
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
                    />
                    <button type="submit">Update Temporary Password</button>
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
};

export default Profile;