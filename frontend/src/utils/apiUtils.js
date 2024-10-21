export const executePowerShellScript = async (scriptName, params = {}, sessionID) => {
    try {
        const adminComputer = window.location.hostname; // Get the computer name from the hostname
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