const session = require('express-session');

class CustomSessionStore extends session.Store {
    constructor() {
        super();
        this.sessions = {}; // Store session data
    }

    // Retrieve a session by ID
    get(sid, callback) {
        const sessionData = this.sessions[sid];
        callback(null, sessionData ? JSON.parse(sessionData) : null);
    }

    // Store session data
    set(sid, session, callback) {
        this.sessions[sid] = JSON.stringify(session);
        callback(null);
    }

    // Destroy a session
    destroy(sid, callback) {
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
            return session && session.userID === userID;
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