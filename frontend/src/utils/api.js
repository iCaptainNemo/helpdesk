/**
 * Shared API client for all backend communication.
 *
 * Centralizes the backend URL, JSON headers, Bearer token handling, and
 * error handling that were previously duplicated in every component.
 *
 * Usage:
 *   import { apiGet, apiPost, executeScript, logAction } from '../utils/api';
 *   const users = await apiGet('/api/ledger/current-locked-users');
 *   await apiPost('/api/fetch-adobject', { adObjectID });
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * In-memory response cache. Module-level, so it lives only for the current page
 * session — a browser tab refresh reloads this module and starts empty, which is
 * exactly the "refresh to force fresh data" behavior we want.
 *
 * Caching is opt-in per request via the `cache` option (a TTL in ms). We store the
 * in-flight promise (not just the resolved value) so concurrent identical requests
 * — e.g. React StrictMode's double-mount, or two tabs opening the same object —
 * collapse into a single network call. Rejected requests are evicted so errors
 * are never cached.
 */
const _cache = new Map(); // key -> { expires: number, promise: Promise }

const cacheKey = (method, path, body) =>
    `${method} ${path} ${body !== undefined ? JSON.stringify(body) : ''}`;

/**
 * Drop cached entries. Call after a mutation so the next read is fresh.
 * @param {string} [pathSubstring] - Only evict keys containing this substring; omit to clear all.
 */
export const invalidateCache = (pathSubstring) => {
    if (!pathSubstring) {
        _cache.clear();
        return;
    }
    for (const key of _cache.keys()) {
        if (key.includes(pathSubstring)) _cache.delete(key);
    }
};

export const clearCache = () => _cache.clear();

export class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

/**
 * Core request function. Returns parsed JSON (or raw text for non-JSON responses).
 * Throws ApiError on non-2xx responses with the server's error message when available.
 *
 * @param {string} path - Path starting with /api/...
 * @param {object} options
 * @param {string} [options.method='GET']
 * @param {object} [options.body] - Serialized as JSON when provided
 * @param {object} [options.headers] - Extra headers
 * @param {boolean} [options.credentials=false] - Include cookies (for session endpoints)
 * @param {number} [options.cache] - If set, cache the result for this many ms (reads only)
 */
export const apiRequest = (path, { method = 'GET', body, headers = {}, credentials = false, cache } = {}) => {
    if (cache) {
        const key = cacheKey(method, path, body);
        const hit = _cache.get(key);
        if (hit && hit.expires > Date.now()) {
            return hit.promise;
        }
        const promise = performRequest(path, { method, body, headers, credentials });
        _cache.set(key, { expires: Date.now() + cache, promise });
        // Never cache a failure — evict so the next call retries.
        promise.catch(() => _cache.delete(key));
        return promise;
    }
    return performRequest(path, { method, body, headers, credentials });
};

const performRequest = async (path, { method, body, headers, credentials }) => {
    const response = await apiRequestRaw(path, { method, body, headers, credentials });
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!response.ok) {
        const message = (data && typeof data === 'object' && (data.error || data.message))
            || `Request failed with status ${response.status}`;
        throw new ApiError(message, response.status, data);
    }

    return data;
};

/**
 * Same as apiRequest but returns the raw Response, for callers that need
 * headers (e.g. X-Cache) or streaming. Does not throw on non-2xx.
 */
export const apiRequestRaw = async (path, { method = 'GET', body, headers = {}, credentials = false } = {}) => {
    const finalHeaders = { 'Content-Type': 'application/json', ...headers };
    const token = localStorage.getItem('token');
    if (token && !finalHeaders['Authorization']) {
        finalHeaders['Authorization'] = `Bearer ${token}`;
    }

    return fetch(`${BACKEND_URL}${path}`, {
        method,
        headers: finalHeaders,
        ...(credentials ? { credentials: 'include' } : {}),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
};

export const apiGet = (path, options = {}) => apiRequest(path, { ...options, method: 'GET' });
export const apiPost = (path, body, options = {}) => apiRequest(path, { ...options, method: 'POST', body });
export const apiPut = (path, body, options = {}) => apiRequest(path, { ...options, method: 'PUT', body });
export const apiPatch = (path, body, options = {}) => apiRequest(path, { ...options, method: 'PATCH', body });
export const apiDelete = (path, options = {}) => apiRequest(path, { ...options, method: 'DELETE' });

/**
 * Execute a PowerShell script from Backend/functions/ via the generic endpoint.
 * @param {string} scriptName - Script filename without .ps1 (e.g. 'Unlocker')
 * @param {object} params - Named parameters passed to the script
 */
export const executeScript = (scriptName, params = {}) =>
    apiPost('/api/execute-script', { scriptName, params });

/**
 * Log an admin action to the RecentActions table. Never throws — logging
 * failures must not break the action that triggered them.
 * @param {object} entry
 * @param {string} entry.activity - Human-readable description
 * @param {string} [entry.target] - Target object (user ID, computer name, ...)
 * @param {string} [entry.actionType] - Machine-readable type (unlock, reset_password, ...)
 * @param {object} [entry.details] - Extra data stored as JSON
 * @param {string} [entry.result='success']
 * @param {string} [entry.adminID] - Included for endpoints that expect it
 */
export const logAction = async ({ activity, target = null, actionType = null, details = null, result = 'success', adminID } = {}) => {
    try {
        return await apiPost('/api/actions/log', {
            ...(adminID ? { adminID } : {}),
            activity,
            target,
            action_type: actionType,
            details,
            result
        });
    } catch (error) {
        console.warn('Error logging action:', error);
        return null;
    }
};

// --- Auth helpers -----------------------------------------------------------

export const login = async (AdminID, password) => {
    const data = await apiPost('/api/auth/login', { AdminID, password });
    localStorage.setItem('token', data.token);
    return data;
};

export const verifyToken = () => apiPost('/api/auth/verify-token');

export const getSessionCount = () => apiGet('/api/auth/session-count');

// Backwards-compatible alias for the old apiUtils export name.
export const executePowerShellScript = executeScript;
