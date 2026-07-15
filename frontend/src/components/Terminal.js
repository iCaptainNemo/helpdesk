import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import '../styles/Terminal.css';
import io from 'socket.io-client';
import { apiGet } from '../utils/api';

const TerminalComponent = ({ onToggle }) => {
    const terminalRef = useRef(null);
    const terminalInstance = useRef(null);
    const fitAddon = useRef(null);
    const socket = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [deploymentMode, setDeploymentMode] = useState('unknown');

    useEffect(() => {
        // Initialize terminal
        if (terminalRef.current && !terminalInstance.current) {
            terminalInstance.current = new Terminal({
                cursorBlink: true,
                fontSize: 12,
                fontFamily: 'Consolas, "Courier New", monospace',
                theme: {
                    background: '#1e1e1e',
                    foreground: '#cccccc',
                    cursor: '#ffffff',
                    selection: '#264f78',
                    black: '#000000',
                    red: '#cd3131',
                    green: '#0dbc79',
                    yellow: '#e5e510',
                    blue: '#2472c8',
                    magenta: '#bc3fbc',
                    cyan: '#11a8cd',
                    white: '#e5e5e5',
                    brightBlack: '#666666',
                    brightRed: '#f14c4c',
                    brightGreen: '#23d18b',
                    brightYellow: '#f5f543',
                    brightBlue: '#3b8eea',
                    brightMagenta: '#d670d6',
                    brightCyan: '#29b8db',
                    brightWhite: '#e5e5e5'
                },
                rows: 15,
                cols: 120,
                scrollback: 1000,
                allowTransparency: false
            });

            // Add fit addon
            fitAddon.current = new FitAddon();
            terminalInstance.current.loadAddon(fitAddon.current);

            // Open terminal
            terminalInstance.current.open(terminalRef.current);
            
            // Fit to container
            setTimeout(() => {
                fitAddon.current.fit();
            }, 100);

            // Welcome message
            terminalInstance.current.writeln('\x1b[32m╔══════════════════════════════════════════════════════════════╗\x1b[0m');
            terminalInstance.current.writeln('\x1b[32m║                    Helpdesk Jarvis Terminal                  ║\x1b[0m');
            terminalInstance.current.writeln('\x1b[32m╚══════════════════════════════════════════════════════════════╝\x1b[0m');
            terminalInstance.current.writeln('\x1b[36mConnecting to backend...\x1b[0m');
        }

        // Initialize socket connection
        connectToBackend();

        // Handle window resize
        const handleResize = () => {
            if (fitAddon.current) {
                setTimeout(() => {
                    fitAddon.current.fit();
                }, 100);
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (socket.current) {
                socket.current.disconnect();
            }
            if (terminalInstance.current) {
                terminalInstance.current.dispose();
            }
        };
    }, []);


    const connectToBackend = async () => {
        try {
            // Get deployment mode from backend
            const setupData = await apiGet('/api/setup/status');
            setDeploymentMode(setupData.details?.mode || 'local');

            // Connect to Socket.IO
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
            socket.current = io(backendUrl);

            socket.current.on('connect', () => {
                setIsConnected(true);
                if (terminalInstance.current) {
                    terminalInstance.current.writeln('\x1b[32m✓ Connected to backend server\x1b[0m');
                    terminalInstance.current.writeln(`\x1b[33mDeployment Mode: ${setupData.details?.mode || 'local'}\x1b[0m`);
                    terminalInstance.current.writeln('\x1b[36m' + '─'.repeat(60) + '\x1b[0m');
                }

                // Request to join terminal room
                socket.current.emit('join-terminal');
            });

            socket.current.on('disconnect', () => {
                setIsConnected(false);
                if (terminalInstance.current) {
                    terminalInstance.current.writeln('\x1b[31m✗ Disconnected from backend server\x1b[0m');
                }
            });

            // Listen for backend logs (local mode)
            socket.current.on('backend-log', (data) => {
                if (terminalInstance.current) {
                    const timestamp = new Date().toLocaleTimeString();
                    const colorCode = getLogColor(data.level || 'info');
                    terminalInstance.current.writeln(`\x1b[90m[${timestamp}]\x1b[0m ${colorCode}[${data.level?.toUpperCase() || 'INFO'}]\x1b[0m ${data.message}`);
                }
            });

            // Listen for PowerShell command output (both modes)
            socket.current.on('powershell-output', (data) => {
                if (terminalInstance.current) {
                    const timestamp = new Date().toLocaleTimeString();
                    const prefix = deploymentMode === 'remote' ? '\x1b[94m[PS-Remote]\x1b[0m' : '\x1b[92m[PS-Local]\x1b[0m';
                    
                    if (data.type === 'command') {
                        terminalInstance.current.writeln(`\x1b[90m[${timestamp}]\x1b[0m ${prefix} \x1b[95m> ${data.command}\x1b[0m`);
                    } else if (data.type === 'output') {
                        const lines = data.output.toString().split('\n');
                        lines.forEach(line => {
                            if (line.trim()) {
                                terminalInstance.current.writeln(`\x1b[90m[${timestamp}]\x1b[0m ${prefix} ${line}`);
                            }
                        });
                    } else if (data.type === 'error') {
                        terminalInstance.current.writeln(`\x1b[90m[${timestamp}]\x1b[0m ${prefix} \x1b[91mError: ${data.error}\x1b[0m`);
                    }
                }
            });

            // Listen for general system events
            socket.current.on('system-event', (data) => {
                if (terminalInstance.current) {
                    const timestamp = new Date().toLocaleTimeString();
                    const colorCode = data.type === 'error' ? '\x1b[91m' : '\x1b[96m';
                    terminalInstance.current.writeln(`\x1b[90m[${timestamp}]\x1b[0m ${colorCode}[SYSTEM] ${data.message}\x1b[0m`);
                }
            });

        } catch (error) {
            console.error('Error connecting to backend:', error);
            if (terminalInstance.current) {
                terminalInstance.current.writeln('\x1b[91m✗ Failed to connect to backend server\x1b[0m');
            }
        }
    };

    const getLogColor = (level) => {
        switch (level?.toLowerCase()) {
            case 'error': return '\x1b[91m';
            case 'warn': return '\x1b[93m';
            case 'info': return '\x1b[92m';
            case 'debug': return '\x1b[94m';
            case 'verbose': return '\x1b[95m';
            default: return '\x1b[97m';
        }
    };

    const clearTerminal = () => {
        if (terminalInstance.current) {
            terminalInstance.current.clear();
            terminalInstance.current.writeln('\x1b[32m╔══════════════════════════════════════════════════════════════╗\x1b[0m');
            terminalInstance.current.writeln('\x1b[32m║                    Helpdesk Jarvis Terminal                  ║\x1b[0m');
            terminalInstance.current.writeln('\x1b[32m╚══════════════════════════════════════════════════════════════╝\x1b[0m');
            terminalInstance.current.writeln(`\x1b[33mDeployment Mode: ${deploymentMode}\x1b[0m`);
            terminalInstance.current.writeln('\x1b[36m' + '─'.repeat(60) + '\x1b[0m');
        }
    };

    const toggleTerminal = () => {
        if (onToggle) {
            onToggle();
        }
    };

    return (
        <div className="terminal-container">
            <div className="terminal-header">
                <div className="terminal-title">
                    <span className="terminal-icon">⚡</span>
                    <span>Live Terminal</span>
                    <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                        {isConnected ? '● Connected' : '● Disconnected'}
                    </span>
                </div>
                <div className="terminal-controls">
                    <span className="deployment-mode">{deploymentMode.toUpperCase()} MODE</span>
                    <button 
                        className="terminal-btn clear-btn" 
                        onClick={clearTerminal}
                        title="Clear terminal"
                    >
                        🗑️
                    </button>
                    <button 
                        className="terminal-btn toggle-btn" 
                        onClick={toggleTerminal}
                        title="Hide terminal"
                    >
                        ▼
                    </button>
                </div>
            </div>
            
            <div className="terminal-content">
                <div 
                    ref={terminalRef} 
                    className="xterm-container"
                />
            </div>
        </div>
    );
};

export default TerminalComponent;