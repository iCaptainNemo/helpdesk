// Small in-memory ring buffer for the Live Terminal (see components/Terminal.js
// on the frontend). Every terminal broadcast should go through recordAndBroadcast
// instead of calling global.terminalIO directly, so newly (re)connecting clients
// can be replayed some backlog instead of only ever seeing events from the moment
// they joined. Ephemeral by design - resets on server restart, same as any other
// live operational log; RecentActions is the durable audit trail, not this.

// Capped per event type (not one shared cap) - background monitoring produces far
// more 'backend-log' chatter than 'powershell-output' ever will, and a single
// shared buffer let routine health-check logging push actual command history out
// before a reconnect ever saw it.
const MAX_PER_EVENT = 150;
const buffers = {};

function recordAndBroadcast(event, data) {
    const enriched = { ...data, timestamp: new Date().toISOString() };

    if (!buffers[event]) {
        buffers[event] = [];
    }
    buffers[event].push({ event, data: enriched });
    if (buffers[event].length > MAX_PER_EVENT) {
        buffers[event].shift();
    }

    if (global.terminalIO) {
        global.terminalIO.to('terminal').emit(event, enriched);
    }

    return enriched;
}

function getHistory() {
    return Object.values(buffers)
        .flat()
        .sort((a, b) => new Date(a.data.timestamp) - new Date(b.data.timestamp));
}

module.exports = { recordAndBroadcast, getHistory };
