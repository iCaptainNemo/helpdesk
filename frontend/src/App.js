import React, { useEffect, useState } from 'react';
import axios from 'axios';
import socketIOClient from 'socket.io-client';

const ENDPOINT = "http://localhost:3000";

function App() {
    const [helloWorldMessage, setHelloWorldMessage] = useState('');
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const socket = socketIOClient(ENDPOINT);
        setSocket(socket);

        socket.on('connect', () => {
            console.log('Connected to Socket.IO server');
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from Socket.IO server');
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const fetchHelloWorld = async () => {
        try {
            const response = await axios.get(`${ENDPOINT}/api/hello-world`);
            setHelloWorldMessage(response.data.message);
        } catch (error) {
            console.error('Error fetching hello world message:', error);
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>Helpdesk GUI</h1>
                <button onClick={fetchHelloWorld}>Fetch Hello World</button>
                {helloWorldMessage && <pre>{helloWorldMessage}</pre>}
            </header>
        </div>
    );
}

export default App;