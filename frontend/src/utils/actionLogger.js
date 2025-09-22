/**
 * Utility functions for logging user actions to the recent actions system
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Log an action to the recent actions system
 * @param {string} adminID - The admin performing the action
 * @param {string} activity - Description of the activity
 * @param {string} target - Target object (user ID, server name, etc.)
 * @param {string} actionType - Type of action (unlock, reset_password, etc.)
 * @param {object} details - Additional details to store
 * @param {string} result - Result of the action (success, error, etc.)
 */
export const logAction = async (adminID, activity, target = null, actionType = null, details = null, result = 'success') => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/actions/log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                adminID,
                activity,
                target,
                action_type: actionType,
                details,
                result
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to log action: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.warn('Error logging action:', error);
        // Don't throw error to avoid breaking the main functionality
        return null;
    }
};

/**
 * Pre-defined action logging functions for common operations
 */
export const ActionLogger = {
    /**
     * Log a user unlock action
     */
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

    /**
     * Log a password reset action
     */
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

    /**
     * Log an AD lookup action
     */
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

    /**
     * Log a system check action
     */
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

    /**
     * Log a bulk operation
     */
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

    /**
     * Log a report generation
     */
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
            success ? 'success' : 'error'
        );
    }
};

export default ActionLogger;