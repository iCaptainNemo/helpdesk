import React, { useState, useEffect } from 'react';
import '../styles/UpdateNotification.css';

const UpdateNotification = () => {
    const [updateInfo, setUpdateInfo] = useState(null);
    const [showNotification, setShowNotification] = useState(false);
    const [updateStatus, setUpdateStatus] = useState('');
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        // Listen for update status messages from Electron main process
        if (window.electronAPI) {
            // Listen for update status from auto-updater
            const handleUpdateStatus = (status) => {
                setUpdateStatus(status);
            };

            // Setup IPC listener for update events
            window.electronAPI.onUpdateAvailable && window.electronAPI.onUpdateAvailable((updateInfo) => {
                setUpdateInfo(updateInfo);
                setShowNotification(true);
            });

            window.electronAPI.onUpdateStatus && window.electronAPI.onUpdateStatus(handleUpdateStatus);

            // Cleanup listeners on unmount
            return () => {
                window.electronAPI.removeUpdateListeners && window.electronAPI.removeUpdateListeners();
            };
        } else {
            // Fallback for web version - check via API
            checkForUpdatesWeb();
        }
    }, []);

    const checkForUpdatesWeb = async () => {
        try {
            setIsChecking(true);
            const response = await fetch('/api/check-updates');
            
            if (response.ok) {
                const updateData = await response.json();
                
                if (updateData.updateAvailable) {
                    setUpdateInfo(updateData);
                    setShowNotification(true);
                }
                
                setUpdateStatus(updateData.updateAvailable 
                    ? `Update available: ${updateData.latestVersion}`
                    : 'You have the latest version'
                );
            } else {
                setUpdateStatus('Failed to check for updates');
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
            setUpdateStatus('Update check failed');
        } finally {
            setIsChecking(false);
        }
    };

    const handleCheckUpdates = async () => {
        if (window.electronAPI && window.electronAPI.checkForUpdates) {
            // Electron version - use IPC
            setIsChecking(true);
            try {
                await window.electronAPI.checkForUpdates(true); // Manual check
            } catch (error) {
                console.error('Error checking for updates:', error);
                setUpdateStatus('Update check failed');
            } finally {
                setIsChecking(false);
            }
        } else {
            // Web version - use API
            await checkForUpdatesWeb();
        }
    };

    const handleDownloadUpdate = () => {
        if (window.electronAPI && window.electronAPI.downloadUpdate) {
            window.electronAPI.downloadUpdate();
            setUpdateStatus('Downloading update...');
        } else if (updateInfo && updateInfo.downloadUrl) {
            // Open GitHub releases page
            window.open(updateInfo.downloadUrl, '_blank');
        }
    };

    const handleDismiss = () => {
        setShowNotification(false);
        setUpdateInfo(null);
    };

    const handleSkipVersion = () => {
        if (window.electronAPI && window.electronAPI.skipVersion && updateInfo) {
            window.electronAPI.skipVersion(updateInfo.latestVersion);
        }
        setShowNotification(false);
        setUpdateInfo(null);
    };

    const formatReleaseNotes = (notes) => {
        if (!notes) return 'No release notes available';
        
        // Basic markdown-like formatting
        return notes
            .replace(/### (.*)/g, '<strong>$1</strong>')
            .replace(/## (.*)/g, '<strong>$1</strong>')
            .replace(/# (.*)/g, '<strong>$1</strong>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <div className="update-notification-container">
            {/* Update Status Bar */}
            {updateStatus && (
                <div className="update-status-bar">
                    <span className="update-status-text">{updateStatus}</span>
                    <button 
                        className="check-updates-btn"
                        onClick={handleCheckUpdates}
                        disabled={isChecking}
                    >
                        {isChecking ? 'Checking...' : 'Check for Updates'}
                    </button>
                </div>
            )}

            {/* Update Notification Modal */}
            {showNotification && updateInfo && (
                <div className="update-notification-overlay">
                    <div className="update-notification-modal">
                        <div className="update-header">
                            <h3>🎉 Update Available!</h3>
                            <button className="close-btn" onClick={handleDismiss}>×</button>
                        </div>
                        
                        <div className="update-content">
                            <div className="version-info">
                                <p><strong>Current Version:</strong> {updateInfo.currentVersion}</p>
                                <p><strong>Latest Version:</strong> {updateInfo.latestVersion}</p>
                                <p><strong>Release Date:</strong> {new Date(updateInfo.releaseDate).toLocaleDateString()}</p>
                            </div>
                            
                            {updateInfo.releaseNotes && (
                                <div className="release-notes">
                                    <h4>What's New:</h4>
                                    <div 
                                        className="release-notes-content"
                                        dangerouslySetInnerHTML={{ 
                                            __html: formatReleaseNotes(updateInfo.releaseNotes) 
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        
                        <div className="update-actions">
                            <button 
                                className="download-btn primary"
                                onClick={handleDownloadUpdate}
                            >
                                Download Update
                            </button>
                            <button 
                                className="skip-btn secondary"
                                onClick={handleSkipVersion}
                            >
                                Skip This Version
                            </button>
                            <button 
                                className="later-btn secondary"
                                onClick={handleDismiss}
                            >
                                Remind Me Later
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UpdateNotification;