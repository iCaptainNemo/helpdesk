export const executePowerShellScript = async (scriptName, params = {}, sessionID, adminComputer) => {
    try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-script`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
            },
            body: JSON.stringify({ scriptName, params, sessionID, adminComputer }) // Include adminComputer in the request body
        });

        if (!response.ok) {
            throw new Error('Failed to execute script');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error executing script:', error);
        throw error;
    }
};

export const login = async (AdminID, password) => {
    try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ AdminID, password })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error);
        }

        const data = await response.json();
        localStorage.setItem('token', data.token); // Store token in local storage
        localStorage.setItem('sessionID', data.sessionID); // Store session ID in local storage
        localStorage.setItem('adminComputer', data.adminComputer); // Store adminComputer in local storage
        return data;
    } catch (error) {
        console.error('Login failed:', error);
        throw error;
    }
};

export const verifyToken = async () => {
    try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/verify-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
            }
        });

        if (!response.ok) {
            throw new Error('Token verification failed');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error verifying token:', error);
        throw error;
    }
};

export const getSessionCount = async () => {
    try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/session-count`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // Include token in Authorization header
            }
        });

        if (!response.ok) {
            throw new Error('Failed to get session count');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting session count:', error);
        throw error;
    }
};