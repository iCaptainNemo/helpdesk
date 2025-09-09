const SENSITIVE_KEYS = ['password', 'secret', 'token', 'apikey'];
const config = require('./config'); // Import the configuration object

let chalk;
(async () => {
    chalk = await import('chalk');
})();

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
        console.log(chalk?.default.white(`[log] ${sanitizedMessage}`), ...sanitizedParams);
        broadcastToTerminal('log', sanitizedMessage, ...sanitizedParams);
    }
};

const info = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        console.info(chalk?.default.white(`[info] ${sanitizedMessage}`), ...sanitizedParams);
        broadcastToTerminal('info', sanitizedMessage, ...sanitizedParams);
    }
};

const warn = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        console.warn(chalk?.default.yellow(`[warn] ${sanitizedMessage}`), ...sanitizedParams);
        broadcastToTerminal('warn', sanitizedMessage, ...sanitizedParams);
    }
};

const error = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        console.error(chalk?.default.red(`[error] ${sanitizedMessage}`), ...sanitizedParams);
        broadcastToTerminal('error', sanitizedMessage, ...sanitizedParams);
    }
};

const verbose = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production' && config.logging.verbose) {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        console.debug(chalk?.default.magenta(`[verbose] ${sanitizedMessage}`), ...sanitizedParams);
        broadcastToTerminal('verbose', sanitizedMessage, ...sanitizedParams);
    }
};

const debug = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production' && config.logging.debug) {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        console.debug(chalk?.default.cyan(`[debug] ${sanitizedMessage}`), ...sanitizedParams);
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