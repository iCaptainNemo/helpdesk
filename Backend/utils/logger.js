const SENSITIVE_KEYS = ['password', 'secret', 'token', 'apikey'];

const sanitizeMessage = (message, ...optionalParams) => {
    const regex = new RegExp(`(${SENSITIVE_KEYS.join('|')}):\\s*['"]?([^'"\s]+)`, 'gi');
    const sanitizedMessage = message.replace(regex, '$1: ****');

    const sanitizedParams = optionalParams.map((param) => 
        typeof param === 'string' ? param.replace(regex, '$1: ****') : param
    );

    return [sanitizedMessage, ...sanitizedParams];
};

const log = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        console.log(sanitizedMessage, ...sanitizedParams);
    }
};

const info = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        console.info(sanitizedMessage, ...sanitizedParams);
    }
};

const warn = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        console.warn(sanitizedMessage, ...sanitizedParams);
    }
};

const error = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        const [sanitizedMessage, ...sanitizedParams] = sanitizeMessage(message, ...optionalParams);
        console.error(sanitizedMessage, ...sanitizedParams);
    }
};

module.exports = {
    log,
    info,
    warn,
    error
};