// Small in-memory ring buffer for the Live Terminal (see components/Terminal.js
// on the frontend). Every terminal broadcast should go through recordAndBroadcast
// instead of calling global.terminalIO directly, so newly (re)connecting clients
// can be replayed some backlog instead of only ever seeing events from the moment
// they joined. Ephemeral by design - resets on server restart, same as any other
// live operational log; RecentActions is the durable audit trail, not this.

const MAX_HISTORY = 300;
const history = [];

function recordAndBroadcast(event, data) {
    const enriched = { ...data, timestamp: new Date().toISOString() };

    history.push({ event, data: enriched });
    if (history.length > MAX_HISTORY) {
        history.shift();
    }

    if (global.terminalIO) {
        global.terminalIO.to('terminal').emit(event, enriched);
    }

    return enriched;
}

function getHistory() {
    return history;
}

module.exports = { recordAndBroadcast, getHistory };
