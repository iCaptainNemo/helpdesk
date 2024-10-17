import React from 'react';
import { executePowerShellScript } from '../utils/apiUtils';

const ScriptButton = ({ scriptName, params, sessionID, buttonText, onSuccess }) => {
    const handleClick = async () => {
        try {
            const result = await executePowerShellScript(scriptName, params, sessionID);
            console.log('Script executed successfully:', result);
            if (onSuccess) onSuccess(result); // Call onSuccess callback if provided
        } catch (error) {
            console.error('Error executing script:', error);
        }
    };

    return (
        <button onClick={handleClick}>
            {buttonText}
        </button>
    );
};

export default ScriptButton;