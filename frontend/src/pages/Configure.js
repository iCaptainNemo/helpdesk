import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Configure.css'; // Import the CSS file for the toggle switch

const Configure = ({ permissions }) => {
    const navigate = useNavigate();
    const [debugLogging, setDebugLogging] = useState(false);
    const [verboseLogging, setVerboseLogging] = useState(false);

    useEffect(() => {
        // Check if the user has the required permission
        if (!permissions.includes('access_configure_page')) {
            navigate('/dashboard'); // Redirect to dashboard if the user does not have the required permission
        }

        // Fetch the current logging settings from the backend
        fetch('/api/logging-settings')
            .then(response => response.json())
            .then(data => {
                setDebugLogging(data.debug);
                setVerboseLogging(data.verbose);
            })
            .catch(error => {
                console.error('Error fetching logging settings:', error);
            });
    }, [permissions, navigate]);

    const handleDebugToggle = () => {
        const newDebugLogging = !debugLogging;
        setDebugLogging(newDebugLogging);
        fetch('/api/logging-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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
        const newVerboseLogging = !verboseLogging;
        setVerboseLogging(newVerboseLogging);
        fetch('/api/logging-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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

    return (
        <div>
            <h2>Logging</h2>
            <table>
                <tbody>
                    <tr>
                        <td>Debug Logging</td>
                        <td>
                            <label className="switch">
                                <input type="checkbox" checked={debugLogging} onChange={handleDebugToggle} />
                                <span className="slider round"></span>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <td>Verbose Logging</td>
                        <td>
                            <label className="switch">
                                <input type="checkbox" checked={verboseLogging} onChange={handleVerboseToggle} />
                                <span className="slider round"></span>
                            </label>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default Configure;