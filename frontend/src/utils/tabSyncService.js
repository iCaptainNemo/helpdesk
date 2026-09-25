import { apiGet, apiPost, apiPut } from './api';

// Local mirror of the server-side sync_enabled flag, so callers (e.g. scheduleSync on
// every tab change) can gate on/off synchronously without a network round trip. The
// server is still the source of truth - this cache is populated by fetchRemoteState()
// and setSyncPreference(), never written independently.
const ENABLED_CACHE_KEY = 'tabSyncEnabledCache';
const DEBOUNCE_MS = 1500;
let debounceTimer = null;

const toSyncShape = (tabs) => tabs.map(t => ({ name: t.name, showAdvanced: !!t.showAdvanced }));

export const getSyncPreference = () => localStorage.getItem(ENABLED_CACHE_KEY) === 'true';

const setSyncPreferenceCache = (enabled) => localStorage.setItem(ENABLED_CACHE_KEY, String(!!enabled));

// GET /api/tabs. Never throws - mount-time callers treat a failure as "sync
// unavailable right now" rather than blocking the page.
export const fetchRemoteState = async () => {
    try {
        const data = await apiGet('/api/tabs');
        setSyncPreferenceCache(data.enabled);
        return data; // { enabled, tabs, updatedAt }
    } catch (error) {
        console.warn('[tabSync] fetchRemoteState failed:', error);
        return { enabled: getSyncPreference(), tabs: [], updatedAt: null };
    }
};

// PUT /api/tabs/preference. User-initiated from Profile.js - intentionally NOT
// fire-and-forget; the caller awaits and handles success/failure itself.
export const setSyncPreference = async (enabled, localTabs = []) => {
    const payload = { enabled };
    if (enabled) {
        payload.tabs = toSyncShape(localTabs);
    }
    const result = await apiPut('/api/tabs/preference', payload);
    setSyncPreferenceCache(result.enabled);
    return result;
};

// Debounced, fire-and-forget background sync. No queue, no retry: a failure just
// warns and drops - localStorage already holds the authoritative local copy.
export const scheduleSync = (tabs) => {
    if (!getSyncPreference()) return; // opted out (default) - never touches the network

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        apiPost('/api/tabs', { tabs: toSyncShape(tabs) })
            .catch(error => console.warn('[tabSync] background sync failed:', error));
    }, DEBOUNCE_MS);
};
