/**
 * Convenience wrappers for logging common admin actions to the
 * RecentActions system. All logging goes through the shared API client.
 */

import { logAction as apiLogAction } from './api';

/**
 * Log an action to the recent actions system.
 * @param {string} adminID - The admin performing the action
 * @param {string} activity - Description of the activity
 * @param {string} target - Target object (user ID, server name, etc.)
 * @param {string} actionType - Type of action (unlock, reset_password, etc.)
 * @param {object} details - Additional details to store
 * @param {string} result - Result of the action (success, error, etc.)
 */
export const logAction = (adminID, activity, target = null, actionType = null, details = null, result = 'success') =>
    apiLogAction({ adminID, activity, target, actionType, details, result });

/**
 * Pre-defined action logging functions for common operations
 */
export const ActionLogger = {
    logUnlock: (adminID, userID, success = true) => {
        const activity = success
            ? `Admin ${adminID} unlocked user: ${userID}`
            : `Admin ${adminID} failed to unlock user: ${userID}`;

        return logAction(
            adminID,
            activity,
            userID,
            'unlock',
            { userID, adminID, timestamp: new Date().toISOString() },
            success ? 'success' : 'error'
        );
    },

    logPasswordReset: (adminID, userID, success = true) => {
        const activity = success
            ? `Admin ${adminID} reset password for user: ${userID}`
            : `Admin ${adminID} failed to reset password for user: ${userID}`;

        return logAction(
            adminID,
            activity,
            userID,
            'reset_password',
            { userID, adminID, timestamp: new Date().toISOString() },
            success ? 'success' : 'error'
        );
    },

    logADLookup: (adminID, target, objectType = 'user') => {
        return logAction(
            adminID,
            `Admin ${adminID} performed AD lookup for ${objectType}: ${target}`,
            target,
            'ad_lookup',
            { target, objectType, adminID, timestamp: new Date().toISOString() },
            'success'
        );
    },

    logSystemCheck: (adminID, checkType = 'general') => {
        return logAction(
            adminID,
            `Performed ${checkType} system check`,
            null,
            'system_check',
            { checkType, timestamp: new Date().toISOString() },
            'success'
        );
    },

    logBulkOperation: (adminID, operation, targets = [], success = true) => {
        const activity = success
            ? `Performed bulk ${operation} on ${targets.length} users`
            : `Failed bulk ${operation} on ${targets.length} users`;

        return logAction(
            adminID,
            activity,
            targets.join(','),
            `bulk_${operation}`,
            { operation, targets, count: targets.length, timestamp: new Date().toISOString() },
            success ? 'success' : 'error'
        );
    },

    logReportGeneration: (adminID, reportType, success = true) => {
        const activity = success
            ? `Generated ${reportType} report`
            : `Failed to generate ${reportType} report`;

        return logAction(
            adminID,
            activity,
            null,
            'report_generated',
            { reportType, timestamp: new Date().toISOString() },
            'success'
        );
    }
};

export default ActionLogger;
