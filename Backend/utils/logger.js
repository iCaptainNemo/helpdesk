const SENSITIVE_KEYS = ['password', 'secret', 'token', 'apikey'];
const config = require('./config'); // Import the configuration object

let chalk = null;

// Try to load chalk, but don't fail if it's not available (pkg compatibility)
try {
    if (!process.pkg) {
        // Only try to load chalk in development mode
        (async () => {
            try {
                chalk = await import('chalk');
            } catch (error) {
                // Silently continue without colors
                chalk = null;
            }
        })();
    }
} catch (error) {
    // Silently continue without colors
    chalk = null;
}

const sanitizeMessage = (message, ...optionalParams) => {
    const regex = new RegExp(`(${SENSITIVE_KEYS.join('|')}):\\s*['"]?([^'"\s]+)`, 'gi');
    const sanitizedMessage = message.replace(regex, '$1: ****');

    const sanitizedParams = optionalParams.map((param) => 
        typeof param === 'string' ? param.replace(regex, '$1: ****') : param
    );

    return [sanitizedMessage, ...sanitizedParams];
};

// Broadcast backend logs to terminal for local mode
const broadcastToTerminal = (level, message, ...optionalParams) => {
    if (global.terminalIO && process.env.DEPLOYMENT_MODE === 'local') {
        const { getSystemInfo } = require('../config/modes');
        const systemInfo = getSystemInfo();
        
        if (systemInfo.mode === 'local') {
            const fullMessage = optionalParams.length > 0 
                ? `${message} ${optionalParams.join(' ')}`
                : message;
            
            global.terminalIO.to('terminal').emit('backend-log', {
                level: level,
                message: fullMessage,
                timestamp: new Date().toISOString()
            });
        }
    }
};

const log = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        const formattedMessage = chalk?.default?.white ? chalk.default.white(`[log] ${sanitizedMessage}`) : `[log] ${sanitizedMessage}`;
        console.log(formattedMessage, ...sanitizedParams);
        broadcastToTerminal('log', sanitizedMessage, ...sanitizedParams);
    }
};

const info = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        const formattedMessage = chalk?.default?.white ? chalk.default.white(`[info] ${sanitizedMessage}`) : `[info] ${sanitizedMessage}`;
        console.info(formattedMessage, ...sanitizedParams);
        broadcastToTerminal('info', sanitizedMessage, ...sanitizedParams);
    }
};

const warn = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        const formattedMessage = chalk?.default?.yellow ? chalk.default.yellow(`[warn] ${sanitizedMessage}`) : `[warn] ${sanitizedMessage}`;
        console.warn(formattedMessage, ...sanitizedParams);
        broadcastToTerminal('warn', sanitizedMessage, ...sanitizedParams);
    }
};

const error = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        const formattedMessage = chalk?.default?.red ? chalk.default.red(`[error] ${sanitizedMessage}`) : `[error] ${sanitizedMessage}`;
        console.error(formattedMessage, ...sanitizedParams);
        broadcastToTerminal('error', sanitizedMessage, ...sanitizedParams);
    }
};

const verbose = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production' && config.logging.verbose) {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        const formattedMessage = chalk?.default?.magenta ? chalk.default.magenta(`[verbose] ${sanitizedMessage}`) : `[verbose] ${sanitizedMessage}`;
        console.debug(formattedMessage, ...sanitizedParams);
        broadcastToTerminal('verbose', sanitizedMessage, ...sanitizedParams);
    }
};

const debug = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production' && config.logging.debug) {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        const formattedMessage = chalk?.default?.cyan ? chalk.default.cyan(`[debug] ${sanitizedMessage}`) : `[debug] ${sanitizedMessage}`;
        console.debug(formattedMessage, ...sanitizedParams);
        broadcastToTerminal('debug', sanitizedMessage, ...sanitizedParams);
    }
};

module.exports = {
    log,
    info,
    warn,
    error,
    verbose,
    debug
};