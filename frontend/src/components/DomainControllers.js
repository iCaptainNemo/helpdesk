import React, { useEffect, useState } from 'react';
import '../styles/ServerStatus.css'; // Reuse the CSS file for styling

const DomainControllers = () => {
    const [domainControllers, setDomainControllers] = useState([]);
    const [error, setError] = useState(null);

    const fetchDomainControllers = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/domain-controllers`);
            if (!response.ok) {
                throw new Error('Failed to fetch domain controllers');
            }
            const data = await response.json();
            setDomainControllers(data.domainControllers);
        } catch (error) {
            console.error('Error fetching domain controllers:', error);
            setError(`Error fetching domain controllers: ${error.message}`);
        }
    };

    useEffect(() => {
        fetchDomainControllers();
        const intervalId = setInterval(fetchDomainControllers, 300000); // Fetch every 5 minutes
        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="server-status-container">
            {error ? (
                <p>{error}</p>
            ) : domainControllers.length === 0 ? (
                <p>No domain controllers available.</p>
            ) : (
                <table>
                    <caption>Domain Controllers</caption>
                    <thead>
                        <tr>
                            <th>Controller Name</th>
                            <th>Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {domainControllers.map((controller, index) => (
                            <tr key={index}>
                                <td>{controller.ControllerName}</td>
                                <td>{controller.Role}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default DomainControllers;