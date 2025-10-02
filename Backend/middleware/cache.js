const logger = require('../utils/logger');

// In-memory cache store
const cache = new Map();

/**
 * Simple in-memory cache middleware
 * @param {number} ttlSeconds - Time to live in seconds (default: 60 seconds)
 * @returns {Function} Express middleware function
 */
function cacheMiddleware(ttlSeconds = 60) {
    return (req, res, next) => {
        // Create cache key based on request path and query parameters
        const cacheKey = req.originalUrl || req.url;

        // Check if we have cached data
        const cachedData = cache.get(cacheKey);

        if (cachedData) {
            const now = Date.now();
            const isExpired = (now - cachedData.timestamp) > (ttlSeconds * 1000);

            if (!isExpired) {
                logger.verbose(`[Cache] Serving cached data for: ${cacheKey}`);
                const age = Math.floor((now - cachedData.timestamp) / 1000);

                // Add cache headers to inform frontend this is cached data
                res.set({
                    'X-Cache': 'HIT',
                    'X-Cache-Age': age.toString(),
                    'X-Cache-TTL': ttlSeconds.toString()
                });

                return res.status(cachedData.statusCode).json(cachedData.data);
            } else {
                // Remove expired cache entry
                cache.delete(cacheKey);
                logger.verbose(`[Cache] Expired cache entry removed: ${cacheKey}`);
            }
        }

        // Store original res.json function
        const originalJson = res.json;
        const originalStatus = res.status;
        let statusCode = 200;

        // Override res.status to capture status code
        res.status = function(code) {
            statusCode = code;
            return originalStatus.call(this, code);
        };

        // Override res.json to cache the response
        res.json = function(data) {
            // Only cache successful responses
            if (statusCode === 200) {
                cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now(),
                    statusCode: statusCode
                });
                logger.verbose(`[Cache] Cached response for: ${cacheKey}`);

                // Add cache miss header for fresh data
                this.set('X-Cache', 'MISS');
            }

            return originalJson.call(this, data);
        };

        next();
    };
}

/**
 * Clear all cached entries
 */
function clearCache() {
    const size = cache.size;
    cache.clear();
    logger.info(`[Cache] Cleared ${size} cache entries`);
}

/**
 * Clear expired cache entries
 */
function cleanupExpiredCache(ttlSeconds = 60) {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, value] of cache.entries()) {
        if ((now - value.timestamp) > (ttlSeconds * 1000)) {
            cache.delete(key);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        logger.verbose(`[Cache] Cleaned up ${cleanedCount} expired entries`);
    }
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    return {
        totalEntries: cache.size,
        entries: Array.from(cache.entries()).map(([key, value]) => ({
            key,
            age: Math.floor((Date.now() - value.timestamp) / 1000),
            statusCode: value.statusCode
        }))
    };
}

// Set up periodic cache cleanup (every 5 minutes)
setInterval(() => {
    cleanupExpiredCache(60); // Clean up entries older than 60 seconds
}, 5 * 60 * 1000);

module.exports = {
    cacheMiddleware,
    clearCache,
    cleanupExpiredCache,
    getCacheStats
};