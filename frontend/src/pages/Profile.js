import React, { useEffect, useState } from 'react';
import '../styles/Profile.css'; // Import the CSS file

const Profile = ({ permissions }) => {
    const [profile, setProfile] = useState({});
    const [roles, setRoles] = useState([]);
    const [error, setError] = useState(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
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
                body: JSON.stringify({ AdminID: profile.AdminID, tempPassword })
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
        <div className="profile-container">
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
                <p>Current Temporary Password: {tempPassword}</p> {/* Display current temporary password */}
                <form onSubmit={handleTempPasswordUpdate} className="form-container">
                    <input
                        type="text"
                        placeholder="New Temporary Password"
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
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
};

export default Profile;