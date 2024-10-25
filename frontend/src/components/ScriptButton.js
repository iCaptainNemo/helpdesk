import React, { useState } from 'react';
import { executePowerShellScript } from '../utils/apiUtils';
import '../styles/ScriptButton.css'; // Import the CSS file

const ScriptButton = ({ scriptName, params, sessionID, adminComputer, buttonText, onSuccess }) => {
    const [status, setStatus] = useState('initial'); // initial, loading, success, error
    const [message, setMessage] = useState('');

    const handleClick = async () => {
        setStatus('loading');
        setMessage('');
        try {
            const result = await executePowerShellScript(scriptName, params, sessionID, adminComputer);
            console.log('Script executed successfully:', result);
            if (result.message.includes('Unlocked')) {
                setStatus('success');
                setMessage('Unlocked');
                setTimeout(() => {
                    if (onSuccess) onSuccess(result); // Call onSuccess callback if provided
                }, 1000);
            } else if (result.message.includes('Access Denied')) {
                setStatus('error');
                setMessage('Access Denied');
                setTimeout(() => setStatus('initial'), 1000);
            } else {
                setStatus('error');
                setMessage('An Error Occurred');
                setTimeout(() => setStatus('initial'), 1000);
            }
        } catch (error) {
            console.error('Error executing script:', error);
            setStatus('error');
            setMessage('An Error Occurred');
            setTimeout(() => setStatus('initial'), 1000);
        }
    };

    return (
        <button className={`script-button ${status}`} onClick={handleClick} disabled={status === 'loading'}>
            {status === 'loading' ? (
                <span className="spinner"></span>
            ) : (
                message || buttonText
            )}
        </button>
    );
};

export default ScriptButton;