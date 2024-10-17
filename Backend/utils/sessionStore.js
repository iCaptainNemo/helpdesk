const session = require('express-session');
const { closePowerShellSession } = require('../powershell');

class CustomSessionStore extends session.Store {
    constructor() {
        super();
        this.sessions = {}; // Store both session data and PowerShell sessions
    }

    // Retrieve a session by ID
    get(sid, callback) {
        const sessionData = this.sessions[sid];
        callback(null, sessionData ? JSON.parse(sessionData) : null);
    }

    // Store session data and associated PowerShell session
    set(sid, session, callback) {
        this.sessions[sid] = JSON.stringify(session);
        callback(null);
    }

    // Destroy a session and clean up PowerShell session if it exists
    destroy(sid, callback) {
        const sessionData = this.sessions[sid] ? JSON.parse(this.sessions[sid]) : null;

        if (sessionData && sessionData.powershellSession) {
            const { powershellSession } = sessionData;
            closePowerShellSession(powershellSession); // Ensure session is closed
        }

        delete this.sessions[sid]; // Remove from store
        callback(null);
    }

    // Count the number of active sessions
    count(callback) {
        callback(null, Object.keys(this.sessions).length);
    }

    // Find a session by user ID
    findSessionByUserID(userID, callback) {
        const sessionID = Object.keys(this.sessions).find(sid => {
            const session = JSON.parse(this.sessions[sid]);
            return session && session.powershellSession && session.powershellSession.username === userID;
        });
        callback(null, sessionID);
    }

    // Retrieve all sessions
    all(callback) {
        const allSessions = Object.keys(this.sessions).map(sid => JSON.parse(this.sessions[sid]));
        callback(null, allSessions);
    }
}

module.exports = new CustomSessionStore();