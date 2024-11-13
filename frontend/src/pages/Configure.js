import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Configure = () => {
    const [permissions, setPermissions] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/profile`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch permissions');
                }

                const data = await response.json();
                setPermissions(data.permissions || []); // Ensure permissions is an array

                // Check if the user has the required permission
                if (!data.permissions.includes('access_configure_page')) {
                    navigate('/dashboard'); // Redirect to dashboard if the user does not have the required permission
                }
            } catch (error) {
                console.error('Error fetching permissions:', error);
                navigate('/dashboard'); // Redirect to dashboard on error
            }
        };

        fetchPermissions();
    }, [navigate]);

    return (
        <div>
            <p>Yes you can access this</p>
        </div>
    );
};

export default Configure;