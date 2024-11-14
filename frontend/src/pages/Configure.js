import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Configure = ({ permissions }) => {
    const navigate = useNavigate();

    useEffect(() => {
        // Check if the user has the required permission
        if (!permissions.includes('access_configure_page')) {
            navigate('/dashboard'); // Redirect to dashboard if the user does not have the required permission
        }
    }, [permissions, navigate]);

    return (
        <div>
            <p>Yes you can access this</p>
        </div>
    );
};

export default Configure;